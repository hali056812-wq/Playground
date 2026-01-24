
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSentinelToken } from '../actions/satellite';

async function probe() {
    console.log("Probing Collections via PROCESS API...");
    const token = await getSentinelToken();
    const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

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

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    const makePayload = (type: string, band: string) => ({
        input: {
            bounds: {
                geometry: geometry,
                properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
            },
            data: [{
                type: type,
                dataFilter: {
                    timeRange: { from: startDate.toISOString(), to: endDate.toISOString() }
                }
            }]
        },
        output: {
            width: 100, height: 100,
            responses: [{ identifier: "default", format: { type: "image/png" } }]
        },
        evalscript: `
            //VERSION=3
            function setup() { return { input: ["${band}", "dataMask"], output: { bands: 4 } }; }
            function evaluatePixel(sample) { return [sample.${band}/1000, 0, 0, sample.dataMask]; }
        `
    });

    async function testCollection(name: string, band: string) {
        console.log(`\nTesting ${name} (${band})...`);
        try {
            const res = await fetch(PROCESS_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(makePayload(name, band))
            });
            console.log(`Status: ${res.status} ${res.statusText}`);
            if (!res.ok) {
                console.log("Error:", await res.text());
            } else {
                console.log("✅ Success (Image returned)");
            }
        } catch (e: any) {
            console.error("Exception:", e.message);
        }
    }

    await testCollection("LOTL2", "ST_B10"); // Current (Failing)
    await testCollection("LOTL1", "B10");    // Fallback 1
    await testCollection("S3SLSTR", "S8");   // Fallback 2
}

probe();
