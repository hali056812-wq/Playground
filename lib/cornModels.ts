
import modelWeights from '@/corn_model_weights.json';

/**
 * Corn Science Models
 * 
 * Powered by PROSAIL Physics Simulations + Random Forest Training.
 * 
 * Inputs:
 * - Multispectral: B04 (Red), B05 (RedEdge), B08 (NIR)
 * - Time-Series: Slope (Rate of Change), Anomaly (Z-Score)
 * 
 * Outputs:
 * - Predicted Chlorophyll (Nitrogen Proxy)
 * - Vmax (Photosynthetic Capacity)
 * - Risk Assessment
 */

export interface CornInput {
    redMean: number;      // B04
    redEdgeMean: number;  // B05 (705nm)
    nirMean: number;      // B08

    // Time-Series Context (Optional but recommended for precision)
    ndreSlope?: number;   // Unit: Change per Day
    ndreAnomaly?: number; // Unit: Standard Deviations

    // Environmental Context
    canopyWater?: number; // NDMI
}

export interface CornScienceResult {
    nitrogenMassPercent: number; // Equivalent N%
    vmax: number;                // Photosynthetic Capacity
    chlorophyllContent: number;  // ug/cm2 (The primary ML Target)
    nitrogenRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    stressProbability: number;   // 0-100%
    warnings: string[];
}

/**
 * Polynomial Regression Evaluator (Degree 2)
 * Matches the sklearn PolynomialFeatures(degree=2, include_bias=False)
 * Terms: [x1, x2, x1^2, x1*x2, x2^2]
 */
function predictFromPoly(features: number[], coefs: number[], intercept: number): number {
    if (features.length !== 2) return 0; // Only supporting NDVI, NDRE for now

    const x1 = features[0]; // NDVI
    const x2 = features[1]; // NDRE

    // Polynomial Terms matches sklearn order: x1, x2, x1^2, x1*x2, x2^2
    const terms = [
        x1,
        x2,
        x1 * x1,
        x1 * x2,
        x2 * x2
    ];

    let sum = intercept;
    for (let i = 0; i < terms.length; i++) {
        if (i < coefs.length) {
            sum += terms[i] * coefs[i];
        }
    }

    return sum;
}

export function calculateCornScience(input: CornInput): CornScienceResult {
    const { redEdgeMean, redMean, nirMean, ndreSlope = 0, ndreAnomaly = 0 } = input;
    const warnings: string[] = [];

    // 1. Calculate Indices
    const ndvi = (nirMean - redMean) / (nirMean + redMean);
    const ndre = (nirMean - redEdgeMean) / (nirMean + redEdgeMean);

    // 2. Run ML Model (Polynomial Approximation of Random Forest)
    // Target: Chlorophyll (Cab) in ug/cm2
    let predictedCab = 0;

    if (modelWeights && modelWeights.type === 'polynomial_deg2') {
        predictedCab = predictFromPoly([ndvi, ndre], modelWeights.coefficients, modelWeights.intercept);
    } else {
        // Fallback Linear Model (Old Logic)
        // Chl (ug/cm2) = -662.3 * Band_705 + 131.3
        predictedCab = -662.3 * redEdgeMean + 131.3;
        warnings.push("Using legacy linear model (ML weights missing).");
    }

    // Clamp Physical Limits (0 to 100 ug/cm2)
    if (predictedCab < 0) predictedCab = 0;
    if (predictedCab > 100) predictedCab = 100;

    // 3. Time-Series Adjustments (The "CropSight" Logic)
    // If slope is negative (rapid decline), existing Chlorophyll is degrading faster than predicted
    // We adjust the effective health score downward.
    let stressScore = 0;

    // Base Health from Cab (Target 40+)
    if (predictedCab < 20) stressScore += 80;      // Critical
    else if (predictedCab < 35) stressScore += 50; // Warning
    else if (predictedCab < 45) stressScore += 20; // Watch

    // Slope Penalty: > 0.01 drop per day is alarming
    if (ndreSlope < -0.01) {
        stressScore += 30;
        warnings.push(`Rapid Chlorophyll Decline detected (${(ndreSlope * 100).toFixed(1)}%/day).`);
    } else if (ndreSlope < -0.005) {
        stressScore += 10;
        warnings.push("Mild declining trend.");
    }

    // Anomaly Penalty: > 1.5 StdDev below mean
    if (ndreAnomaly < -2.0) {
        stressScore += 20;
        warnings.push("Field Zone is significantly below field average.");
    }

    // Final Probability
    const probability = Math.min(100, Math.max(0, stressScore));

    // Risk Category
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (probability > 80) risk = 'CRITICAL';
    else if (probability > 50) risk = 'HIGH';
    else if (probability > 25) risk = 'MEDIUM';

    // 4. Derived Science Metrics
    // Nitrogen % is correlated to Chlorophyll (Cab). 
    // Approx relationship: N% ~ 0.05 * Cab + 1.0 (Very rough, dependent on biomass)
    const nMass = (0.05 * predictedCab) + 1.0;

    // Vmax (Photosynthesis) ~ 1.5 * Cab
    const vmax = 1.5 * predictedCab;

    return {
        nitrogenMassPercent: parseFloat(nMass.toFixed(2)),
        vmax: parseFloat(vmax.toFixed(1)),
        chlorophyllContent: parseFloat(predictedCab.toFixed(1)),
        nitrogenRisk: risk,
        stressProbability: probability,
        warnings
    };
}
