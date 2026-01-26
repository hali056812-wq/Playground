
console.log("🧬 --- FEATURE DEPTH VERIFICATION --- 🧬");

// 1. Radar Vegetation Index (RVI)
// Formula: 4*VH / (VV + VH)
// Scenario: Healthy Corn (High Volume)
const radarStats = { vvMean: 0.15, vhMean: 0.03 }; // Linear units
// VV is usually stronger than VH.
// RVI = 4*0.03 / (0.15 + 0.03) = 0.12 / 0.18 = 0.66 (Dense)

const rvi = (4 * radarStats.vhMean) / (radarStats.vvMean + radarStats.vhMean);
console.log(`\nRadar RVI (Target ~0.66): ${rvi.toFixed(2)}`);

// 2. CWSI (Crop Water Stress Index)
// Formula: (Tc - Ta - LL) / (UL - LL)
// Scenario: Stressed Corn (Canopy warmer than air)
const airTempF = 85;
const canopyTempF = 88; // +3F warmer (Stressed)
// LL = -5F, UL = +10F
// CWSI = (3 - (-5)) / (10 - (-5)) = 8 / 15 = 0.53

const deltaT = canopyTempF - airTempF;
const lowerLimit = -5.0;
const upperLimit = 10.0;
let cwsi = (deltaT - lowerLimit) / (upperLimit - lowerLimit);
cwsi = Math.max(0, Math.min(1, cwsi));

console.log(`CWSI (Target ~0.53): ${cwsi.toFixed(2)}`);
console.log(`Delta T: ${deltaT}°F`);

if (rvi > 0.6 && cwsi > 0.5) {
    console.log("✅ LOGIC PASSED: Calculations align with physics.");
} else {
    console.log("❌ LOGIC FAILED.");
}
