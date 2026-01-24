
/**
 * Corn Science Models
 * 
 * Derived from local calibration against Ground Truth data (Jan 2026).
 * 
 * Nitrogen Model (R2=0.53):
 * N_mass (%) = -20.3578 * Band_705 + 5.8092
 * 
 * Vmax Model (R2=0.43):
 * Vmax (umol m-2 s-1) = -210.0784 * Band_705 + 60.5024
 * 
 * Chlorophyll Model (R2=0.78):
 * Chl (ug/cm2) = -662.3005 * Band_705 + 131.3117
 */

export interface CornInput {
    redMean: number;      // B04 (Sentinel Band 4)
    redEdgeMean: number;  // B05 (Sentinel Band 5 - 705nm)
    nirMean: number;      // B08 (Sentinel Band 8)
}

export interface CornScienceResult {
    nitrogenMassPercent: number;
    vmax: number;
    chlorophyllContent: number; // Measured in ug/cm2
    warnings: string[];
}

export function calculateCornScience(input: CornInput): CornScienceResult {
    const { redEdgeMean, redMean, nirMean } = input;
    const warnings: string[] = [];

    // Coeffs from calibration script
    const N_SLOPE = -20.357846;
    const N_INTERCEPT = 5.809207;

    const V_SLOPE = -210.078383;
    const V_INTERCEPT = 60.502381;

    const C_SLOPE = -662.300534;
    const C_INTERCEPT = 131.311671;

    // 1. Calculate Nitrogen
    let nMass = (N_SLOPE * redEdgeMean) + N_INTERCEPT;

    // Clamp reasonable values (Corn N mass usually 1.0% to 5.0%)
    if (nMass < 0.5) {
        nMass = 0.5;
        warnings.push("Extremely low Nitrogen detected.");
    } else if (nMass > 6.0) {
        nMass = 6.0;
        warnings.push("Nitrogen estimates may be saturated.");
    }

    // 2. Calculate Vmax (Carboxylation Capacity)
    let vmax = (V_SLOPE * redEdgeMean) + V_INTERCEPT;
    if (vmax < 0) vmax = 0;
    if (vmax > 120) warnings.push("Unusually high photosynthetic capacity (Vmax).");

    // 3. Calculate Chlorophyll Content (ug/cm2)
    let chl = (C_SLOPE * redEdgeMean) + C_INTERCEPT;
    if (chl < 0) chl = 0;
    if (chl > 100) warnings.push("Chlorophyll levels at measurement ceiling.");

    return {
        nitrogenMassPercent: parseFloat(nMass.toFixed(2)),
        vmax: parseFloat(vmax.toFixed(1)),
        chlorophyllContent: parseFloat(chl.toFixed(1)),
        warnings
    };
}
