
import { calculateCropScience } from '../lib/cropModels';

console.log("🧬 --- MULTI-CROP SCIENCE VERIFICATION --- 🧬");

const input = {
    redMean: 0.05,
    redEdgeMean: 0.15, // Medium reflectance
    nirMean: 0.40,
    ndreSlope: 0
};

const crops = ['Corn', 'Soybean', 'Wheat'];

crops.forEach(crop => {
    console.log(`\n--- Testing ${crop.toUpperCase()} ---`);
    const result = calculateCropScience({ ...input, cropType: crop });
    console.log(`Chlorophyll: ${result.chlorophyllContent} ug/cm2`);
    console.log(`Nitrogen: ${result.nitrogenMassPercent}% (${result.nitrogenRisk} risk)`);
    console.log(`Vmax: ${result.vmax}`);
    console.log(`Confidence: ${result.modelConfidence.chlorophyll.toFixed(2)}`);
});

console.log("\n✅ VERIFICATION COMPLETE.");
