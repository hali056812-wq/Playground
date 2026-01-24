import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchSentinelHistory } from '../actions/satellite';


// Since we can't easily import server actions in a standalone script without Next.js context sometimes, 
// let's try to just run it if the environment variables are loaded.

// We need to polyfill fetch for Node environment if it's not available (Node 18+ has it).
// The user has Windows so likely Node 18+.

async function testHistory() {
    console.log("Testing fetchSentinelHistory...");

    // Mock Geometry (Small field in Kansas)
    const geometry = {
        "type": "Polygon",
        "coordinates": [
            [
                [-98.5800, 39.8280],
                [-98.5790, 39.8280],
                [-98.5790, 39.8290],
                [-98.5800, 39.8290],
                [-98.5800, 39.8280]
            ]
        ]
    };

    // We rely on .env.local being loaded by the tool or system. 
    // If this script fails due to env vars, we might need a different approach.
    const history = await fetchSentinelHistory(geometry);

    console.log(`Returned ${history.length} data points.`);

    if (history.length > 0) {
        console.log("First data point:", history[0]);
        console.log("Last data point:", history[history.length - 1]);

        // Validation
        const valid = history.every(h => h.date && typeof h.ndvi === 'number');
        if (valid) {
            console.log("✅ Data format is valid.");
        } else {
            console.error("❌ Invalid data format detected.");
        }
    } else {
        console.warn("⚠️ No history returned. This might be due to cloud cover filtering or valid empty response.");
    }
}

testHistory();
