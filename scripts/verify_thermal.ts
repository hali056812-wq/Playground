import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchSentinelImage, fetchSentinelThermalStats } from '../actions/satellite';
import * as fs from 'fs';
import * as path from 'path';

async function verifyThermal() {
    console.log("🌡️ Testing Thermal Water Stress (Landsat-8/9)...");

    // Coordinates for a large agricultural area (Imperial Valley, CA - often hot/dry)
    const geometry = {
        "type": "Polygon",
        "coordinates": [
            [
                [-115.5, 33.0],
                [-115.4, 33.0],
                [-115.4, 32.9],
                [-115.5, 32.9],
                [-115.5, 33.0]
            ]
        ]
    };

    try {
        console.log("1. Fetching Thermal Image...");
        const imageData = await fetchSentinelImage(geometry, 'THERMAL');

        if (imageData && imageData.startsWith('data:image/png;base64,')) {
            console.log("✅ Thermal Image SUCCESS!");
            const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const outputPath = path.join(process.cwd(), 'public', 'debug_thermal.png');
            fs.writeFileSync(outputPath, buffer);
            console.log(`Saved debug thermal image to: ${outputPath}`);
        } else {
            console.error("❌ Thermal Image FAILED.");
        }

        console.log("\n2. Fetching Thermal Stats for AI...");
        const stats = await fetchSentinelThermalStats(geometry);
        if (stats) {
            console.log("✅ Thermal Stats SUCCESS!");
            console.log(`Mean Temp: ${stats.tempC.toFixed(1)}°C / ${stats.tempF.toFixed(1)}°F`);
        } else {
            console.error("❌ Thermal Stats FAILED.");
        }

    } catch (e: any) {
        console.error("❌ Error during thermal verification:", e.message);
    }
}

verifyThermal();
