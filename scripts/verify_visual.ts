
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchSentinelImage } from '../actions/satellite';

async function testVisual() {
    console.log("🧪 Testing VISUAL Mode (True Color)...");

    // A mock geometry (Test Field in Iowa)
    const geometry = {
        "type": "Polygon",
        "coordinates": [
            [
                [-93.6, 42.0],
                [-93.6, 42.1],
                [-93.5, 42.1],
                [-93.5, 42.0],
                [-93.6, 42.0]
            ]
        ]
    };

    try {
        const image = await fetchSentinelImage(geometry, 'VISUAL');

        if (image && image.startsWith('data:image/png;base64,')) {
            console.log("✅ VISUAL SUCCESS: Received Base64 Image (" + image.length + " bytes)");
        } else {
            console.error("❌ VISUAL FAILED: No valid image returned", image);
        }

    } catch (error) {
        console.error("❌ VISUAL EXCEPTION:", error);
    }
}

testVisual();
