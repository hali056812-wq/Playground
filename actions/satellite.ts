'use server';

import fs from 'fs';
import path from 'path';

const SH_CLIENT_ID = process.env.SH_CLIENT_ID;
const SH_CLIENT_SECRET = process.env.SH_CLIENT_SECRET;
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const STATS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';

/**
 * Fetch OAuth2 Access Token for Sentinel Hub
 */
export async function getSentinelToken() {
    // Re-read env vars to be safe
    const SH_CLIENT_ID = process.env.SH_CLIENT_ID;
    const SH_CLIENT_SECRET = process.env.SH_CLIENT_SECRET;

    if (!SH_CLIENT_ID || !SH_CLIENT_SECRET) {
        console.error("Sentinel Hub Credentials Missing in process.env");
        throw new Error("Sentinel Hub Credentials Missing");
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', SH_CLIENT_ID);
    params.append('client_secret', SH_CLIENT_SECRET);

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Sentinel Auth Failed [${response.status}]:`, errorText);
            throw new Error(`Auth Failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Sentinel Auth Error:", error);
        throw error;
    }
}

/**
 * Fetch NDVI Statistics for a given Geometry (GeoJSON) using the STATISTICAL API
 */
export async function fetchSentinelNDVI(geometry: any) {
    try {
        const token = await getSentinelToken();

        // Calculate time range (Last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const fromTime = startDate.toISOString();
        const toTime = endDate.toISOString();

        // The Statistical API Evalscript
        const evalscript = `
        //VERSION=3
        function setup() {
          return {
            input: [{ bands: ["B04", "B08", "dataMask"] }],
            output: [
              { id: "default", bands: 1 },
              { id: "dataMask", bands: 1 }
            ]
          };
        }

        function evaluatePixel(sample) {
          let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
          
          // Basic check to avoid division by zero
          if (Math.abs(sample.B08 + sample.B04) < 0.0001) ndvi = 0;

          return {
            default: [ndvi],
            dataMask: [sample.dataMask]
          };
        }
        `;

        const payload = {
            input: {
                bounds: {
                    geometry: geometry,
                    properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
                },
                data: [{
                    type: "S2L2A",
                    dataFilter: {}
                }]
            },
            aggregation: {
                timeRange: {
                    from: fromTime,
                    to: toTime
                },
                aggregationInterval: {
                    of: "P30D" // Aggregate the whole month into one report
                },
                width: 512,
                height: 512,
                evalscript: evalscript
            }
        };

        const response = await fetch(STATS_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();

        // SAVE FOR DEBUG: Write the raw response to a public file so it's viewable at localhost:3000/last_analysis.json
        try {
            const projectRoot = 'c:\\Users\\gotok\\Playground';
            const publicDir = path.join(projectRoot, 'public');
            const filePath = path.join(publicDir, 'last_analysis.json');

            fs.writeFileSync(filePath, JSON.stringify({
                timestamp: new Date().toISOString(),
                api_endpoint: "Statistical API",
                geometry_sent: geometry,
                raw_api_response: JSON.parse(rawText)
            }, null, 2));
            console.log(`✅ RAW DATA UPDATED: ${filePath}`);
        } catch (e: any) {
            console.error("❌ Failed to save debug file:", e.message);
        }

        if (!response.ok) {
            console.error("❌ STATS API ERROR:", rawText);
            return null;
        }

        const result = JSON.parse(rawText);

        // Extract the stats from the Sentinel Hub Statistical API format
        // Path: data[0].outputs.default.bands.B0.stats
        const entry = result.data?.[0]?.outputs?.default?.bands?.B0?.stats;

        if (entry) {
            console.log("🛰️ STATS RECEIVED:", entry);
            return {
                mean: entry.mean,
                min: entry.min,
                max: entry.max,
                sampleCount: entry.sampleCount
            };
        }

        return null;

    } catch (error) {
        console.error("Fetch Sentinel NDVI Error:", error);
        return null;
    }
}

/**
 * Fetch a Visual Heatmap (NDVI, NDMI, NDRE) for a given Geometry
 */
/**
 * Fetch a Sentinel Image as a raw Buffer (for API Routes)
 */
export async function fetchSentinelBuffer(geometry: any, layerType: 'NDVI' | 'NDMI' | 'NDRE' | 'VISUAL' = 'NDVI') {
    try {
        const token = await getSentinelToken();

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        let evalscript = '';

        if (layerType === 'NDVI') {
            evalscript = `
//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  
  if (sample.dataMask == 0) return [0,0,0,0];
  
  if (ndvi < 0) return [0.5, 0.5, 0.5, 1]; // Gray for water/snow
  
  let r, g, b;
  if (ndvi < 0.5) {
      r = 1.0;
      g = ndvi * 2.0;
      b = 0.0;
  } else {
      r = (1.0 - ndvi) * 2.0;
      g = 1.0;
      b = 0.0;
  }
  
  return [r, g, b, 1];
}
`;
        } else if (layerType === 'NDRE') {
            evalscript = `
//VERSION=3
function setup() {
  return {
    input: ["B08", "B05", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  let ndre = (sample.B08 - sample.B05) / (sample.B08 + sample.B05);
  
  if (sample.dataMask == 0) return [0,0,0,0];
  
  let r, g, b;
  if (ndre < 0.2) {
     r = 0.8; g = 0.2; b = 0.2;
  } else if (ndre < 0.5) {
     let t = (ndre - 0.2) / 0.3;
     r = 1.0; 
     g = 0.5 + (0.5 * t); 
     b = 0.0;
  } else if (ndre < 0.7) {
     let t = (ndre - 0.5) / 0.2;
     r = 1.0 - t; 
     g = 1.0;
     b = 0.0;
  } else {
     let t = (ndre - 0.7) / 0.3;
     r = 0.0;
     g = 1.0 - (0.4 * t); 
     b = 0.0;
  }

  return [r, g, b, 1];
}
`;
        } else if (layerType === 'VISUAL') {
            // Smart Sharpening (Visual Mode)
            // Uses Sigmoid Contrast + Saturation Boost + Gamma Correction
            evalscript = `
//VERSION=3
function setup() {
  return {
    input: ["B04", "B03", "B02", "dataMask"],
    output: { bands: 4 }
  };
}

function sigmoid(x) {
    // Sigmoid function for contrast
    // Midpoint 0.4, Slope 10
    return 1 / (1 + Math.exp(-10 * (x - 0.4)));
}

function evaluatePixel(sample) {
  if (sample.dataMask == 0) return [0,0,0,0];

  // 1. Basic Gain (Brightness)
  let r = sample.B04 * 2.5;
  let g = sample.B03 * 2.5;
  let b = sample.B02 * 2.5;

  // 2. Saturation Boost
  let max = Math.max(r, Math.max(g, b));
  if (max > 0) {
      // Increase saturation by pushing colors away from gray
      // Factor 1.2 = 20% boost
      r = r * 1.2;
      g = g * 1.2;
      b = b * 1.2;
  }

  // 3. Sigmoid Contrast (Pseudo-Sharpening)
  // This makes darks darker and lights lighter, increasing perceived edge sharpness
  r = sigmoid(r);
  g = sigmoid(g);
  b = sigmoid(b);

  return [r, g, b, 1];
}
`;
        } else {
            evalscript = `
//VERSION=3
function setup() {
  return {
    input: ["B08", "B11", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  let ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);
  
  if (sample.dataMask == 0) return [0,0,0,0];
  
  let r, g, b;
  if (ndmi < -0.2) {
     r = 0.6; g = 0.4; b = 0.2; 
  } else if (ndmi < 0.1) {
     let t = (ndmi + 0.2) / 0.3;
     r = 0.6 + (0.4 * t);
     g = 0.4 + (0.6 * t);
     b = 0.2 + (0.8 * t);
  } else {
     let t = (ndmi - 0.1) / 0.9;
     r = 1.0 - t;
     g = 1.0 - t;
     b = 1.0 - (0.2 * t);
  }

  return [r, g, b, 1];
}
`;
        }

        const payload = {
            input: {
                bounds: {
                    geometry: geometry,
                    properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
                },
                data: [{
                    type: "S2L2A",
                    dataFilter: {
                        timeRange: {
                            from: startDate.toISOString(),
                            to: endDate.toISOString()
                        },
                        mosaickingOrder: "leastCC"
                    }
                }]
            },
            output: {
                width: 512,
                height: 512,
                responses: [{
                    identifier: "default",
                    format: { type: "image/png" }
                }]
            },
            evalscript: evalscript
        };

        const response = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'image/png'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Visual API Error:", err);
            return null;
        }

        const buffer = await response.arrayBuffer();
        return buffer;

    } catch (error) {
        console.error("Fetch Buffer Error:", error);
        return null;
    }
}

/**
 * Fetch a Visual Heatmap (NDVI, NDMI, NDRE) for a given Geometry
 */
export async function fetchSentinelImage(geometry: any, layerType: 'NDVI' | 'NDMI' | 'NDRE' | 'VISUAL' = 'NDVI') {
    const buffer = await fetchSentinelBuffer(geometry, layerType);
    if (!buffer) return null;
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/png;base64,${base64}`;
}
