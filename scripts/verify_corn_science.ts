
import { calculateCornScience } from '../lib/cornModels';

// Mock Data representing different crop health states based on Band 5 (705nm)
// Healthy Corn: Low Red Edge Reflectance (Chlorophyll absorbing well)
const healthyInput = {
    redMean: 0.05,
    redEdgeMean: 0.15, // Low-ish
    nirMean: 0.50
};

// Stressed Corn: Higher Red Edge Reflectance (Chlorophyll breaking down)
const stressedInput = {
    redMean: 0.10,
    redEdgeMean: 0.22, // High
    nirMean: 0.40
};

console.log("--- Verify Corn Science Models ---");

const healthyResult = calculateCornScience(healthyInput);
console.log("\n[Healthy Corn Simulation]");
console.log(`Input B05: ${healthyInput.redEdgeMean}`);
console.log(`Nitrogen %: ${healthyResult.nitrogenMassPercent}% (Expected ~3-4%)`);
console.log(`Vmax: ${healthyResult.vmax} (Expected >30)`);
console.log(`Warnings: ${healthyResult.warnings}`);

const stressedResult = calculateCornScience(stressedInput);
console.log("\n[Stressed Corn Simulation]");
console.log(`Input B05: ${stressedInput.redEdgeMean}`);
console.log(`Nitrogen %: ${stressedResult.nitrogenMassPercent}% (Expected Low)`);
console.log(`Vmax: ${stressedResult.vmax} (Expected Low)`);
console.log(`Warnings: ${stressedResult.warnings}`);

// Check formulas manually
// N = -20.3578 * 0.15 + 5.8092 = -3.05 + 5.81 = 2.76% (A bit low actually, maybe my healthy input 0.15 is too high for 'Healthy'?)
// Let's see what the script outputs.
