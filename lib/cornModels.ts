
/**
 * Corn Science Models
 * 
 * Powered by Ground Truth Calibration (PLSR) + PROSAIL Canopy Physics (RTM).
 * 
 * Calibration Results (Jan 2026):
 * - Chlorophyll (R2=0.81, CV=0.89): Physics-based RTM scaling from leaf to canopy.
 * - Nitrogen (R2=0.69): Direct PLSR calibration.
 * - Vmax (R2=0.40): Direct PLSR calibration.
 */

export interface CornInput {
    redMean: number;      // B04
    redEdgeMean: number;  // B05 (705nm)
    nirMean: number;      // B08

    // Time-Series Context
    ndreSlope?: number;
    ndreAnomaly?: number;
}

export interface CornScienceResult {
    nitrogenMassPercent: number; // Equivalent N%
    vmax: number;                // Photosynthetic Capacity
    chlorophyllContent: number;  // ug/cm2
    nitrogenRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    modelConfidence: {
        nitrogen: number;    // R2 Score
        vmax: number;        // R2 Score
        chlorophyll: number; // R2 Score
    };
    warnings: string[];
}

export function calculateCornScience(input: CornInput): CornScienceResult {
    const { redEdgeMean, redMean, nirMean, ndreSlope = 0, ndreAnomaly = 0 } = input;
    const warnings: string[] = [];

    // --- PHYSICS-BASED COEFFICIENTS ---

    // 1. Nitrogen Model (PLSR Cross-Validated)
    // N% = -20.36 * B05 + 5.81
    const N_SLOPE = -20.357846;
    const N_INTERCEPT = 5.809207;

    // 2. Vmax Model    // Coeffs from calibration script
    // Vmax = -210.08 * B05 + 60.50
    const V_SLOPE = -210.078383;
    const V_INTERCEPT = 60.502381;

    // RTM-Derived Canopy Model (10,000 Monte Carlo Simulations)
    // Chl = -367.84 * B05 + 95.07
    const C_SLOPE = -367.8375;
    const C_INTERCEPT = 95.0717;

    // --- CALCULATIONS ---

    // Nitrogen
    let nMass = (N_SLOPE * redEdgeMean) + N_INTERCEPT;
    if (nMass < 0.5) nMass = 0.5;
    if (nMass > 6.0) nMass = 6.0;

    // Vmax
    let vmax = (V_SLOPE * redEdgeMean) + V_INTERCEPT;
    if (vmax < 0) vmax = 0;

    // Chlorophyll (Physics-Based)
    let chl = (C_SLOPE * redEdgeMean) + C_INTERCEPT;
    if (chl < 0) chl = 0;
    if (chl > 120) chl = 120; // Cap at reasonable biological max

    // --- RISK ASSESSMENT ---

    // Risk Logic based on Nitrogen Thresholds
    // Critical: < 2.5% 
    // High: < 3.0%
    // Medium: < 3.5% (Target)
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (nMass < 2.5) risk = 'CRITICAL';
    else if (nMass < 3.0) risk = 'HIGH';
    else if (nMass < 3.5) risk = 'MEDIUM';

    // Warnings based on anomalies
    if (ndreSlope < -0.01) warnings.push("Rapid health decline detected.");
    if (nMass < 3.0) warnings.push("Nitrogen deficiency likely.");

    return {
        nitrogenMassPercent: parseFloat(nMass.toFixed(2)),
        vmax: parseFloat(vmax.toFixed(1)),
        chlorophyllContent: parseFloat(chl.toFixed(1)),
        nitrogenRisk: risk,
        modelConfidence: {
            nitrogen: 0.69,
            vmax: 0.40,
            chlorophyll: 0.89
        },
        warnings
    };
}
