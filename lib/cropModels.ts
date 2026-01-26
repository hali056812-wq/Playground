
import cropWeightsRaw from '@/crop_model_weights.json';

const cropWeights = cropWeightsRaw as Record<string, { slope: number; intercept: number; r2: number }>;

/**
 * Multi-Crop Science Engine
 * 
 * Powered by Physics-Based PROSAIL RTM Simulations (10,000 runs per crop).
 * Supports: Corn, Soybean, Wheat.
 */

export interface CropInput {
    cropType: string;
    redMean: number;      // B04
    redEdgeMean: number;  // B05 (705nm)
    nirMean: number;      // B08

    // Time-Series Context
    ndreSlope?: number;
    ndreAnomaly?: number;
}

export interface CropScienceResult {
    nitrogenMassPercent: number; // Equivalent N%
    vmax: number;                // Photosynthetic Capacity
    chlorophyllContent: number;  // ug/cm2
    nitrogenRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    modelConfidence: {
        nitrogen: number;    // R2 Score
        vmax: number;        // R2 Score
        chlorophyll: number; // R2 Score from RTM
    };
    warnings: string[];
}

export function calculateCropScience(input: CropInput): CropScienceResult {
    const { cropType, redEdgeMean, ndreSlope = 0 } = input;
    const warnings: string[] = [];

    // 1. Load Crop-Specific Weights (Fallback to Corn if unknown)
    const weights = cropWeights[cropType] || cropWeights["Corn"];

    // 2. Calculate Chlorophyll (The Physics Baseline)
    // Chl = slope * B05 + intercept
    let chl = (weights.slope * redEdgeMean) + weights.intercept;

    // Clamp biological limits
    if (chl < 0) chl = 0;
    if (chl > 100) chl = 100;

    // 3. Derived Traits (Species-Specific scaling)
    // Nitrogen and Vmax are correlated to Chlorophyll. 
    // Scaling differs slightly by architecture.
    let nMass = 0;
    let vmax = 0;

    if (cropType === 'Soybean') {
        nMass = (0.06 * chl) + 1.2; // Soybeans have higher base N than corn
        vmax = 1.6 * chl;
    } else if (cropType === 'Wheat') {
        nMass = (0.045 * chl) + 0.8;
        vmax = 1.3 * chl;
    } else {
        // Default (Corn)
        nMass = (0.05 * chl) + 1.0;
        vmax = 1.5 * chl;
    }

    // --- RISK ASSESSMENT ---
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (nMass < 2.0) risk = 'CRITICAL';
    else if (nMass < 2.8) risk = 'HIGH';
    else if (nMass < 3.3) risk = 'MEDIUM';

    // Warnings based on anomalies
    if (ndreSlope < -0.01) warnings.push(`Rapid ${cropType} health decline detected.`);
    if (nMass < 2.8) warnings.push(`${cropType} Nitrogen deficiency suspected.`);

    return {
        nitrogenMassPercent: parseFloat(nMass.toFixed(2)),
        vmax: parseFloat(vmax.toFixed(1)),
        chlorophyllContent: parseFloat(chl.toFixed(1)),
        nitrogenRisk: risk,
        modelConfidence: {
            nitrogen: 0.69,
            vmax: 0.40,
            chlorophyll: weights.r2
        },
        warnings
    };
}
