import { NextRequest, NextResponse } from 'next/server';
import { fetchMultiSpectralStats, fetchSentinelThermalStats, fetchSentinelRadarStats, fetchSentinelHistory, calculateSlope, calculateAnomaly } from '@/actions/satellite';
import { getVirtualSensors } from '@/actions/sensors';
import { calculateCropScience } from '@/lib/cropModels';

/**
 * Headless Science API
 * 
 * Decouples the Core Science Engine from the Next.js UI.
 * Used by external clients (Mobile Apps) to get raw physics-based data.
 */

// Helper to calculate centroid for weather lookup
function getCentroid(geometry: any) {
    try {
        const g = geometry.type === 'Feature' ? geometry.geometry : geometry;
        if (g.type === 'Polygon') {
            const coords = g.coordinates[0];
            let sumLat = 0;
            let sumLng = 0;
            for (const c of coords) {
                sumLng += c[0];
                sumLat += c[1];
            }
            return { lat: sumLat / coords.length, lng: sumLng / coords.length };
        }
    } catch (e) {
        console.error("Error calculating centroid", e);
    }
    return { lat: 40.0, lng: -88.0 }; // Default to Corn Belt (UIUC)
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { geometry, cropType } = body;

        if (!geometry || !cropType) {
            return NextResponse.json({ error: "Missing geometry or cropType" }, { status: 400 });
        }

        const validCrops = ['Corn', 'Soybean', 'Wheat'];
        if (!validCrops.includes(cropType)) {
            return NextResponse.json({ error: `Invalid cropType. Must be one of: ${validCrops.join(', ')}` }, { status: 400 });
        }

        console.log(`🧪 Science API: Analyzing ${cropType}...`);

        const center = getCentroid(geometry);

        // 1. Fetch all Satellite & Sensor Data in Parallel
        const [multiSpec, radarStats, thermalStats, historyData, sensorData] = await Promise.all([
            fetchMultiSpectralStats(geometry),
            fetchSentinelRadarStats(geometry),
            fetchSentinelThermalStats(geometry),
            fetchSentinelHistory(geometry),
            getVirtualSensors(geometry, center)
        ]);

        if (!multiSpec) {
            return NextResponse.json({ error: "Failed to fetch satellite imagery (Cloud cover or API error)" }, { status: 500 });
        }

        // 2. Prepare Time-Series Inputs
        const ndreSlope = historyData ? await calculateSlope(historyData, 'ndre', 20) : 0;
        const currentNDRE = (multiSpec.nirMean - multiSpec.redEdgeMean) / (multiSpec.nirMean + multiSpec.redEdgeMean);
        const ndreAnomaly = await calculateAnomaly(currentNDRE, historyData, 'ndre');

        // 3. Run Physics-Based Crop Model (PLSR + RTM)
        const scienceData = calculateCropScience({
            cropType,
            redMean: multiSpec.redMean,
            redEdgeMean: multiSpec.redEdgeMean,
            nirMean: multiSpec.nirMean,
            ndreSlope,
            ndreAnomaly
        });

        // 4. Calculate Advanced Biophysical Traits

        // --- RVI (Radar Vegetation Index) ---
        // Formula: 4 * VH / (VV + VH)
        // Indicates structural biomass / lodging
        let rvi = 0;
        if (radarStats && radarStats.vvMean && radarStats.vhMean) {
            rvi = (4 * radarStats.vhMean) / (radarStats.vvMean + radarStats.vhMean);
        }

        // --- CWSI (Crop Water Stress Index) ---
        // Formula: (Tc - Ta - LL) / (UL - LL)
        // Uses Landsat Thermal (Tc) and Open-Meteo Air Temp (Ta)
        let cwsi = 0;
        if (sensorData && sensorData.temperature && thermalStats && thermalStats.tempF) {
            // sensorData.temperature is string "75.2°F", need to parse
            const airTemp = parseFloat(sensorData.temperature);
            const canopyTemp = thermalStats.tempF;

            if (!isNaN(airTemp) && !isNaN(canopyTemp)) {
                // Baselines: Healthy is 5F cooler (-5.0), Stressed is 10F warmer (+10.0)
                const lowerLimit = -5.0;
                const upperLimit = 10.0;

                const deltaT = canopyTemp - airTemp;

                let rawCwsi = (deltaT - lowerLimit) / (upperLimit - lowerLimit);
                cwsi = Math.max(0, Math.min(1, rawCwsi)); // Clamp 0-1
            }
        }

        // 5. Construct Final JSON Response
        const responseData = {
            timestamp: new Date().toISOString(),
            cropType,
            science: {
                chlorophyllContent: scienceData.chlorophyllContent, // ug/cm2
                nitrogenMassPercent: scienceData.nitrogenMassPercent, // %
                nitrogenRisk: scienceData.nitrogenRisk, // LOW/MED/HIGH
                vmax: scienceData.vmax, // Photosynthetic Capacity
                modelConfidence: scienceData.modelConfidence // R2 scores
            },
            stress: {
                cwsi: parseFloat(cwsi.toFixed(2)),
                rvi: parseFloat(rvi.toFixed(2)),
                waterStress: cwsi > 0.4 ? "HIGH" : "LOW",
                biomassStructure: rvi < 0.3 ? "LOW" : "HIGH"
            },
            meta: {
                ndreSlope: parseFloat(ndreSlope.toFixed(4)),
                ndreAnomaly: parseFloat(ndreAnomaly.toFixed(2))
            }
        };

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("Science API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
