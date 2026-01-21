
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchSentinelBuffer } from '../actions/satellite';
import { tileToBBox } from '../utils/tileMath';

async function testTile() {
    console.log("🧪 Testing Tile Proxy Logic...");

    // Example Tile: (z=15, x=8000, y=12000) roughly
    // Let's pick a known coordinate in Iowa:
    // Lat: 42.0, Lng: -93.5
    // Z: 12
    const z = 12;
    // Calculation (Approx for test)
    // n = 2^12 = 4096
    // x = ((-93.5 + 180) / 360) * 4096 = 984
    // y = ...
    const x = 984;
    const y = 1533; // Approx for 42.0 deg

    const [minLng, minLat, maxLng, maxLat] = tileToBBox(x, y, z);

    console.log(`📍 Tile: [${z}/${x}/${y}]`);
    console.log(`📦 BBOX: [${minLng.toFixed(4)}, ${minLat.toFixed(4)}, ${maxLng.toFixed(4)}, ${maxLat.toFixed(4)}]`);

    const geometry = {
        type: "Polygon",
        coordinates: [[
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat]
        ]]
    };

    try {
        const buffer = await fetchSentinelBuffer(geometry, 'VISUAL');

        if (buffer && buffer.byteLength > 1000) {
            console.log("✅ TILE FETCH SUCCESS");
            console.log(`   Size: ${buffer.byteLength} bytes`);
            console.log(`   Type: PNG Buffer`);
        } else {
            console.error("❌ TILE FETCH FAILED: Buffer small or empty", buffer?.byteLength);
        }

    } catch (error) {
        console.error("❌ EXCEPTION:", error);
    }
}

testTile();
