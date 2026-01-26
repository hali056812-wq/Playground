
import { calculateCornScience } from '../lib/cornModels';

console.log("🌽 --- PHYSICS ENGINE VERIFICATION --- 🌽");

// Test Case 1: Healthy Corn (Low Red Edge Reflectance)
// Healthy vegetation absorbs Red Edge (0.10 - 0.18 range)
const healthyInput = {
    redMean: 0.05,
    redEdgeMean: 0.14, // Low reflectance = High Chlorophyll
    nirMean: 0.45
};

// Test Case 2: Stressed Corn (High Red Edge Reflectance)
// Chlorophyll breakdown causes Red Edge to increase (approaching 0.25+)
const stressedInput = {
    redMean: 0.10,
    redEdgeMean: 0.22, // High reflectance = Low Chlorophyll
    nirMean: 0.30
};

console.log("\n1. Testing HEALTHY Corn Input (B05 = 0.14):");
const healthyResult = calculateCornScience(healthyInput);
console.log(JSON.stringify(healthyResult, null, 2));

console.log("\n2. Testing STRESSED Corn Input (B05 = 0.22):");
const stressedResult = calculateCornScience(stressedInput);
console.log(JSON.stringify(stressedResult, null, 2));

console.log("\n--- EXPECTED PHYSICS ---");
// Manual Check using Equation: Chl = -367.84 * B05 + 95.07
const expectedHealthyChl = -367.84 * 0.14 + 95.07;
const expectedStressedChl = -367.84 * 0.22 + 95.07;

console.log(`Expected Healthy Chl (B05=0.14): ~${expectedHealthyChl.toFixed(1)} ug/cm2`);
console.log(`Expected Stressed Chl (B05=0.22): ~${expectedStressedChl.toFixed(1)} ug/cm2`);

if (Math.abs(healthyResult.chlorophyllContent - expectedHealthyChl) < 1.0) {
    console.log("\n✅ VERIFICATION PASSED: Logic matches RTM Physics.");
} else {
    console.log("\n❌ VERIFICATION FAILED: Output mismatch.");
}
