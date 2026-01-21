import fs from 'fs';
import path from 'path';

// --- Configuration ---
// Load env manually for standalone script
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, val] = line.split('=');
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
}, {} as any);

process.env.SH_CLIENT_ID = envVars.SH_CLIENT_ID;
process.env.SH_CLIENT_SECRET = envVars.SH_CLIENT_SECRET;

// Load the module after setting env
const satellite = require('../actions/satellite');
const fetchSentinelNDVI = satellite.fetchSentinelNDVI;

console.log("🧪 STARTING MANUAL ANALYSIS TEST");
console.log("--------------------------------");

// Mock Geometry: Sahara Desert near Cairo, Egypt (Guaranteed Sunny)
const mockGeometry = {
    "type": "Polygon",
    "coordinates": [
        [
            [31.0, 29.5],
            [31.01, 29.5],
            [31.01, 29.51],
            [31.0, 29.51],
            [31.0, 29.5]
        ]
    ]
};

(async () => {
    console.log("🚀 Calling fetchSentinelNDVI with mock geometry...");

    // Call the function intended for the server action
    const result = await fetchSentinelNDVI(mockGeometry);

    console.log("\n✅ Function returned.");
    if (result) {
        console.log("   Stats:", result);
    } else {
        console.log("   Result was null (likely due to error or empty data)");
    }

    // Check if file was written
    const debugFile = path.join(process.cwd(), 'public', 'last_analysis.json');
    if (fs.existsSync(debugFile)) {
        const content = fs.readFileSync(debugFile, 'utf-8');
        const json = JSON.parse(content);
        console.log("\n📂 CHECKING DEBUG FILE:");
        console.log(`   Path: ${debugFile}`);
        console.log(`   Timestamp in file: ${json.timestamp}`);
        console.log(`   Data length: ${json.raw_pixel_data ? json.raw_pixel_data.length : 'N/A'}`);
    } else {
        console.error("\n❌ DEBUG FILE NOT FOUND. File writing logic failed.");
    }

    console.log("--------------------------------");
})();
