
import fs from 'fs';
import path from 'path';

// --- Configuration ---
// Load env manually for standalone script
const envPath = path.resolve(process.cwd(), '.env.local');
let envVars: any = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envVars = envContent.split('\n').reduce((acc: any, line) => {
        const [key, val] = line.split('=');
        if (key && val) acc[key.trim()] = val.trim();
        return acc;
    }, {});
}

process.env.SH_CLIENT_ID = envVars.SH_CLIENT_ID || process.env.SH_CLIENT_ID;
process.env.SH_CLIENT_SECRET = envVars.SH_CLIENT_SECRET || process.env.SH_CLIENT_SECRET;
process.env.GOOGLE_API_KEY = envVars.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;

// Load the module after setting env
const { analyzeField } = require('../actions/analyzeField');

console.log("🧪 STARTING LIVE CORN ANALYSIS TEST");
console.log("--------------------------------");

// Mock Corn Field in Iowa (likely only valid during growing season, but let's see)
// Or use a field in South America (Brazil/Argentina) where it might be season?
// Jan 2026 -> Winter in US, Summer in Brazil.
// Let's pick a field in Mato Grosso, Brazil for valid vegetation data right now.
// Coordinates: -12.5, -55.7 (Sorriso, MT - Soybean/Corn capital)

const mockGeometry = {
    "type": "Polygon",
    "coordinates": [
        [
            [-55.70, -12.50],
            [-55.69, -12.50],
            [-55.69, -12.51],
            [-55.70, -12.51],
            [-55.70, -12.50]
        ]
    ]
};

const mockFieldData = {
    name: "Test Corn Field (Brazil)",
    cropType: "Corn",
    plantingDate: "2025-11-15", // Planted approx 60 days ago
    geometry: mockGeometry,
    center: [-55.695, -12.505]
};

(async () => {
    console.log("🚀 Calling analyzeField for Corn...");
    console.log(`   Location: Brazil (Peak Season Simulation)`);

    // Call the function
    const result = await analyzeField(mockFieldData);

    console.log("\n✅ Function returned.");
    console.log("--------------------------------");
    console.log(result);
    console.log("--------------------------------");
})();
