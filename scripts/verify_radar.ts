import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchSentinelImage } from '../actions/satellite';
import * as fs from 'fs';
import * as path from 'path';

async function verifyRadar() {
    console.log("🛰️ Testing Radar Mode (Sentinel-1 SAR)...");

    // Small field in North Carolina (from user's debug log)
    const geometry = {
        "type": "Polygon",
        "coordinates": [
            [
                [-79.74600399999997, 36.069292],
                [-79.74321500000002, 36.06924],
                [-79.74338599999999, 36.066153],
                [-79.74596099999997, 36.066067],
                [-79.74600399999997, 36.069292]
            ]
        ]
    };

    try {
        const imageData = await fetchSentinelImage(geometry, 'RADAR');

        if (imageData && imageData.startsWith('data:image/png;base64,')) {
            console.log("✅ Radar Mode SUCCESS!");
            console.log("Image length:", imageData.length);

            // Optional: Save to file for visual check
            const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const outputPath = path.join(process.cwd(), 'public', 'debug_radar.png');
            fs.writeFileSync(outputPath, buffer);
            console.log(`Saved debug image to: ${outputPath}`);
        } else {
            console.error("❌ Radar Mode FAILED: Invalid image data response.");
            if (imageData === null) {
                console.error("Response was null. Check console for API errors.");
            }
        }
    } catch (e: any) {
        console.error("❌ Error during radar verification:", e.message);
    }
}

verifyRadar();
