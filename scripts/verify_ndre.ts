import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchSentinelImage } from '../actions/satellite';

async function testNDRE() {
    console.log("🧪 Testing NDRE Layer fetching...");

    // A mock geometry (Test Field)
    const geometry = {
        "type": "Polygon",
        "coordinates": [
            [
                [-98.5795, 39.8283],
                [-98.5795, 39.8293],
                [-98.5785, 39.8293],
                [-98.5785, 39.8283],
                [-98.5795, 39.8283]
            ]
        ]
    };

    try {
        const image = await fetchSentinelImage(geometry, 'NDRE');

        if (image && image.startsWith('data:image/png;base64,')) {
            console.log("✅ NDRE SUCCESS: Received Base64 Image (" + image.length + " bytes)");
        } else {
            console.error("❌ NDRE FAILED: No valid image returned", image);
        }

    } catch (error) {
        console.error("❌ NDRE EXCEPTION:", error);
    }
}

testNDRE();
