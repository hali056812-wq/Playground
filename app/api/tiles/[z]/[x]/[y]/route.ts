
import { NextRequest, NextResponse } from 'next/server';
import { fetchSentinelBuffer } from '@/actions/satellite';
import { tileToBBox } from '@/utils/tileMath';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
    // 1. Parse params
    // In Next.js 15, params is a Promise
    const p = await params;
    const z = parseInt(p.z);
    const x = parseInt(p.x);
    const y = parseInt(p.y);

    if (isNaN(z) || isNaN(x) || isNaN(y)) {
        return new NextResponse("Invalid Params", { status: 400 });
    }

    // 2. Convert Tile to BBOX
    // Sentinel Hub needs a Geometry. Use the utility we made.
    const [minLng, minLat, maxLng, maxLat] = tileToBBox(x, y, z);
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

    // 3. Fetch Sentinel Buffer
    // We use 'VISUAL' mode implicitly for the base map
    const imageBuffer = await fetchSentinelBuffer(geometry, 'VISUAL');

    if (!imageBuffer) {
        // Return transparent pixel or 404
        return new NextResponse("Failed to fetch tile", { status: 500 });
    }

    // 4. Return Image
    return new NextResponse(imageBuffer, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400' // Cache for 24h
        }
    });
}
