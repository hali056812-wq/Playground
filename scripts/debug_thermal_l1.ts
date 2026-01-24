
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSentinelToken } from '../actions/satellite';

async function testL1() {
    const token = await getSentinelToken();
    const STATS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';

    // Imperial Valley Geometry
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

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    // Minimal Evalscript for L1 B10
    const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B10", "dataMask"],
        output: { bands: 1 }
      };
    }
    
    function evaluatePixel(sample) {
      return [sample.B10 || 0];
    }
    `;

    const payload = {
        input: {
            bounds: {
                geometry: geometry,
                properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
            },
            data: [{
                type: "LOTL1",
                dataFilter: {}
            }]
        },
        aggregation: {
            timeRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            },
            aggregationInterval: { of: "P30D" },
            width: 100,
            height: 100,
            evalscript: evalscript
        }
    };

    console.log("Testing LOTL1 B10...");
    try {
        const response = await fetch(STATS_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log("Response:", text);
    } catch (e) {
        console.error(e);
    }
}

testL1();
