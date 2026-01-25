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
export async function fetchSentinelNDVI(geometryInput: any) {
    try {
        const token = await getSentinelToken();
        const geometry = geometryInput.type === 'Feature' ? geometryInput.geometry : geometryInput;

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
 * Fetch Thermal Statistics (Surface Temperature) using Landsat-8/9
 */
export async function fetchSentinelThermalStats(geometryInput: any) {
    try {
        const token = await getSentinelToken();
        const geometry = geometryInput.type === 'Feature' ? geometryInput.geometry : geometryInput;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);

        const evalscript = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B10", "dataMask"] }],
    output: [
      { id: "default", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask == 0) return {
    default: [0],
    dataMask: [0]
  };
  return {
    default: [sample.B10 || 0],
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
                    type: "LOTL1",
                    dataFilter: {}
                }]
            },
            aggregation: {
                timeRange: {
                    from: startDate.toISOString(),
                    to: endDate.toISOString()
                },
                aggregationInterval: {
                    of: "P30D"
                },
                width: 256,
                height: 256,
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

        if (!response.ok) {
            const errText = await response.text();
            console.error("Thermal Stats API Failed:", errText);
            return null;
        }

        const result = await response.json();
        const stats = result.data?.[0]?.outputs?.default?.bands?.B0?.stats;

        if (stats) {
            // Stats is mean Temperature in Kelvin
            return {
                tempK: stats.mean,
                tempC: stats.mean - 273.15,
                tempF: (stats.mean - 273.15) * 9 / 5 + 32
            };
        }

        return null;

    } catch (error) {
        console.error("Fetch Thermal Stats Error:", error);
        return null;
    }
}

/**
 * Fetch Radar Statistics (VV, VH) for a given Geometry (GeoJSON) using the STATISTICAL API
 */
export async function fetchSentinelRadarStats(geometryInput: any) {
    try {
        const token = await getSentinelToken();
        const geometry = geometryInput.type === 'Feature' ? geometryInput.geometry : geometryInput;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const evalscript = `
        //VERSION=3
        function setup() {
          return {
            input: [{ bands: ["VV", "VH", "dataMask"] }],
            output: [
              { id: "default", bands: 2 },
              { id: "dataMask", bands: 1 }
            ]
          };
        }

        function evaluatePixel(sample) {
          if (sample.dataMask == 0) return { default: [0, 0], dataMask: [0] };
          return {
            default: [sample.VV, sample.VH],
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
                    type: "S1GRD",
                    dataFilter: {}
                }]
            },
            aggregation: {
                timeRange: {
                    from: startDate.toISOString(),
                    to: endDate.toISOString()
                },
                aggregationInterval: {
                    of: "P30D"
                },
                width: 256,
                height: 256,
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

        if (!response.ok) return null;

        const result = await response.json();
        const vvEntry = result.data?.[0]?.outputs?.default?.bands?.B0?.stats;
        const vhEntry = result.data?.[0]?.outputs?.default?.bands?.B1?.stats;

        if (vvEntry && vhEntry) {
            return {
                vvMean: vvEntry.mean,
                vhMean: vhEntry.mean
            };
        }

        return null;

    } catch (error) {
        console.error("Fetch Radar Stats Error:", error);
        return null;
    }
}


/**
 * Fetch a Visual Heatmap (NDVI, NDMI, NDRE) for a given Geometry
 */
/**
 * Fetch a Sentinel Image as a raw Buffer (for API Routes)
 */
export async function fetchSentinelBuffer(geometryInput: any, layerType: 'NDVI' | 'NDMI' | 'NDRE' | 'VISUAL' | 'RADAR' | 'THERMAL' = 'NDVI') {
    try {
        const token = await getSentinelToken();
        const geometry = geometryInput.type === 'Feature' ? geometryInput.geometry : geometryInput;

        const endDate = new Date();
        const startDate = new Date();
        // Landsat (Thermal/Thermal Stats) has a 16-day revisit. Expand window to 60 days to be safe.
        const historyDays = (layerType === 'THERMAL') ? 60 : 30;
        startDate.setDate(startDate.getDate() - historyDays);

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
        } else if (layerType === 'RADAR') {
            // Sentinel-1 SAR (Radar Mode)
            // Visualization: R=VV, G=VH, B=VV/VH Ratio
            evalscript = `
//VERSION=3
function setup() {
  return {
    input: ["VV", "VH", "dataMask"],
    output: { bands: 4 }
  };
}

function toDb(linear) {
    return 10 * Math.log10(Math.max(linear, 0.0001));
}

function evaluatePixel(sample) {
  if (sample.dataMask == 0) return [0,0,0,0];

  // Radar values are often very small, we boost them for visibility
  // VV: surface scattering (soil/water)
  // VH: volume scattering (biomass/leaves)
  let vv = sample.VV * 1.5;
  let vh = sample.VH * 5.0; // VH is usually weaker, boost more
  let ratio = vh / (vv + 0.01);

  // False Color Composite: 
  // R = VV (Surface roughness)
  // G = VH (Leaf density/biomass)
  // B = Structural complexity (Ratio)
  return [vv * 2, vh * 2, ratio * 2.5, 1];
}
`;
        } else if (layerType === 'THERMAL') {
            // Landsat-8/9 Thermal (B10 is Brightness Temperature in Kelvin for LOTL1)
            evalscript = `
//VERSION=3
function setup() {
  return {
    input: ["B10", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask == 0) return [0,0,0,0];

  // B10 is brightness temperature in Kelvin. 
  // Standard agricultural range: 280K (7C) to 320K (47C)
  let kelvin = sample.B10;
  let t = (kelvin - 280) / (320 - 280);
  t = Math.max(0, Math.min(1, t));

  // Heatmap: Blue (Cool) -> Cyan -> Yellow -> Red (Hot)
  let r, g, b;
  if (t < 0.25) {
      r = 0; g = t * 4; b = 1;
  } else if (t < 0.5) {
      r = 0; g = 1; b = 1 - (t - 0.25) * 4;
  } else if (t < 0.75) {
      r = (t - 0.5) * 4; g = 1; b = 0;
  } else {
      r = 1; g = 1 - (t - 0.75) * 4; b = 0;
  }

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

        const isRadar = layerType === 'RADAR';
        const isThermal = layerType === 'THERMAL';

        const payload = {
            input: {
                bounds: {
                    geometry: geometry,
                    properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
                },
                data: [{
                    type: isRadar ? "S1GRD" : (isThermal ? "LOTL1" : "S2L2A"),
                    dataFilter: {
                        timeRange: {
                            from: startDate.toISOString(),
                            to: endDate.toISOString()
                        },
                        mosaickingOrder: isRadar ? "mostRecent" : (isThermal ? "mostRecent" : "leastCC")
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
 * Fetch a Visual Heatmap (NDVI, NDMI, NDRE, RADAR, THERMAL) for a given Geometry
 */
export async function fetchSentinelImage(geometry: any, layerType: 'NDVI' | 'NDMI' | 'NDRE' | 'VISUAL' | 'RADAR' | 'THERMAL' = 'NDVI') {
    const buffer = await fetchSentinelBuffer(geometry, layerType);
    if (!buffer) return null;
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/png;base64,${base64}`;
}

/**
 * Fetch 6-Month NDVI History (The Time Machine)
 * Aggregates data every 5 days (P5D)
 */
export async function fetchSentinelHistory(geometryInput: any) {
    try {
        const token = await getSentinelToken();

        // Extract raw geometry if a Feature is passed
        const geometry = geometryInput.type === 'Feature' ? geometryInput.geometry : geometryInput;

        // Time Range: Last 6 Months
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);


        const evalscript = `
        //VERSION=3
        function setup() {
            return {
                input: [{ bands: ["B04", "B05", "B08", "dataMask"] }],
                output: [
                    { id: "default", bands: 2 },
                    { id: "dataMask", bands: 1 }
                ]
            };
        }

        function evaluatePixel(sample) {
            let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
            let ndre = (sample.B08 - sample.B05) / (sample.B08 + sample.B05);

            if (sample.dataMask == 0) return {
                default: [0, 0],
                dataMask: [0]
            };

            // Filter out water/snow negative values
            if (ndvi < 0) ndvi = 0;
            if (ndre < 0) ndre = 0;

            return {
                default: [ndvi, ndre],
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
                    from: startDate.toISOString(),
                    to: endDate.toISOString()
                },
                aggregationInterval: {
                    of: "P5D" // 5-Day Steps
                },
                width: 256,
                height: 256,
                evalscript: evalscript
            }
        };

        const response = await fetch(STATS_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token} `,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();

        // DEBUG: Save History Response to public folder
        try {
            const projectRoot = 'c:\\Users\\gotok\\Playground';
            const publicDir = path.join(projectRoot, 'public');
            const filePath = path.join(publicDir, 'last_history.json');

            fs.writeFileSync(filePath, JSON.stringify({
                timestamp: new Date().toISOString(),
                geometry_sent: geometry,
                raw_api_response: JSON.parse(rawText)
            }, null, 2));
            console.log(`📡 HISTORY DEBUG SAVED: ${filePath} `);
        } catch (e: any) {
            console.error("❌ Failed to save history debug file:", e.message);
        }

        if (!response.ok) {
            console.error("History API Failed:", rawText);
            return [];
        }

        const data = JSON.parse(rawText);

        // Parse and cleanup data
        // We want: [{ date: '2023-05-01', ndvi: 0.75, ndre: 0.45 }, ...]
        if (data.data && Array.isArray(data.data)) {
            return data.data
                .map((interval: any) => {
                    // Bands: B0=NDVI, B1=NDRE
                    const ndviStats = interval.outputs?.default?.bands?.B0?.stats;
                    const ndreStats = interval.outputs?.default?.bands?.B1?.stats;

                    if (!ndviStats || ndviStats.sampleCount === 0) return null;

                    return {
                        date: interval.interval.from.split('T')[0],
                        ndvi: parseFloat(ndviStats.mean.toFixed(2)),
                        ndre: ndreStats ? parseFloat(ndreStats.mean.toFixed(2)) : 0
                    };
                })
                .filter((item: any) => item !== null && item.ndvi > 0); // Remove empty or zero data
        }

        return [];

    } catch (error) {
        console.error("Fetch History Error:", error);
        return [];
    }
}

/**
 * Calculate Slope (Rate of Change) for the last N days
 * Returns slope (per day change)
 */
export async function calculateSlope(history: any[], key: 'ndvi' | 'ndre' = 'ndre', days: number = 20): Promise<number> {
    if (!history || history.length < 2) return 0;

    // Sort logic (just in case)
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter to last N days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recent = sorted.filter(item => new Date(item.date) >= cutoff);

    if (recent.length < 2) return 0;

    // Simple Linear Regression (Least Squares)
    // x = day index, y = value
    const startObj = new Date(recent[0].date);
    const points = recent.map(r => ({
        x: (new Date(r.date).getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24), // Days from start
        y: r[key]
    }));

    const n = points.length;
    const sumX = points.reduce((acc, p) => acc + p.x, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
}

/**
 * Calculate Z-Score Anomaly
 */
export async function calculateAnomaly(currentValue: number, history: any[], key: 'ndvi' | 'ndre' = 'ndre'): Promise<number> {
    if (!history || history.length < 5) return 0;

    const values = history.map(h => h[key]);
    const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const variance = values.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return (currentValue - mean) / stdDev;
}

/**
 * Fetch Multi-Spectral Statistics (B04, B05, B08) for Scientific Modeling
 */
export async function fetchMultiSpectralStats(geometryInput: any) {
    try {
        const token = await getSentinelToken();
        const geometry = geometryInput.type === 'Feature' ? geometryInput.geometry : geometryInput;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const evalscript = `
        //VERSION=3
        function setup() {
          return {
            input: [{ bands: ["B04", "B05", "B08", "dataMask"] }],
            output: [
              { id: "default", bands: 3 },
              { id: "dataMask", bands: 1 }
            ]
          };
        }

        function evaluatePixel(sample) {
          if (sample.dataMask == 0) return { default: [0, 0, 0], dataMask: [0] };
          return {
            default: [sample.B04, sample.B05, sample.B08],
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
                    from: startDate.toISOString(),
                    to: endDate.toISOString()
                },
                aggregationInterval: {
                    of: "P30D"
                },
                width: 256,
                height: 256,
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

        if (!response.ok) {
            console.error("MultiSpectral API Failed:", await response.text());
            return null;
        }

        const result = await response.json();

        // Output band order: B04 (Red), B05 (RedEdge1), B08 (NIR)
        // Indices in output: B0, B1, B2
        const b04Stats = result.data?.[0]?.outputs?.default?.bands?.B0?.stats;
        const b05Stats = result.data?.[0]?.outputs?.default?.bands?.B1?.stats;
        const b08Stats = result.data?.[0]?.outputs?.default?.bands?.B2?.stats;

        if (b04Stats && b05Stats && b08Stats) {
            return {
                redMean: b04Stats.mean,
                redEdgeMean: b05Stats.mean,
                nirMean: b08Stats.mean
            };
        }

        return null;

    } catch (error) {
        console.error("Fetch MultiSpectral Stats Error:", error);
        return null;
    }
}
