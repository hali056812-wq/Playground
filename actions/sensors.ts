'use server';

import { getSentinelToken } from './satellite';

const STATS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';

/**
 * Fetch Virtual Sensor Data (Current Weather, Soil Moisture, Ground Temp)
 */
export async function getVirtualSensors(geometry: any, center: { lat: number, lng: number }) {
    try {
        const token = await getSentinelToken();

        // 1. Fetch Atmospheric Data (Open-Meteo - FREE, NO KEY REQUIRED)
        // Open-Meteo is trusted and uses Copernicus/ECMWF data.
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${center.lat}&longitude=${center.lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,soil_moisture_3_to_9cm&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;

        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        const currentMeteo = weatherData.current || {};
        const recentRain = currentMeteo.precipitation || 0;

        // 2. Real Soil Moisture (Volumetric Water Content m³/m³)
        // Range: 0.0 (Dry) to 0.5+ (Saturated)
        const rawMoisture = currentMeteo.soil_moisture_3_to_9cm || 0;
        // Convert to percentage for UI (e.g. 0.35 -> 35%)
        const soilMoisturePercent = (rawMoisture * 100).toFixed(0);

        // 3. Fetch Ground Temperature (Landsat 8 Thermal)
        // This requires the Statistical API with a Landsat Evalscript
        const thermalEvalscript = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B10", "dataMask"] }],
    output: [{ id: "default", bands: 1 }]
  };
}
function evaluatePixel(sample) {
  return [sample.B10 - 273.15]; // Convert Kelvin to Celsius
}
`;

        // Note: Landsat has a 16-day revisit, so we check the last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const thermalPayload = {
            input: {
                bounds: {
                    geometry: geometry,
                    properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
                },
                data: [{
                    type: "LOTL1", // Landsat 8-9 L1 (Brightness Temp)
                    dataFilter: {}
                }]
            },
            aggregation: {
                timeRange: {
                    from: startDate.toISOString(),
                    to: endDate.toISOString()
                },
                aggregationInterval: { of: "P30D" },
                width: 512,
                height: 512,
                evalscript: thermalEvalscript
            }
        };

        let groundTempF = "N/A";
        try {
            const thermalRes = await fetch(STATS_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(thermalPayload)
            });
            if (thermalRes.ok) {
                const thermalResult = await thermalRes.json();
                const stats = thermalResult.data?.[0]?.outputs?.default?.bands?.B0?.stats;
                if (stats && stats.mean !== undefined) {
                    groundTempF = ((stats.mean * 9 / 5) + 32).toFixed(1) + "°F";
                }
            }
        } catch (e) {
            console.warn("Thermal sensing failed, falling back to air temp.");
        }

        return {
            temperature: currentMeteo.temperature_2m !== undefined ? `${currentMeteo.temperature_2m.toFixed(1)}°F` : "N/A",
            humidity: currentMeteo.relative_humidity_2m !== undefined ? `${currentMeteo.relative_humidity_2m}%` : "N/A",
            precipitation: `${recentRain}"`,
            soilMoisture: `${soilMoisturePercent}%`,
            groundTemperature: groundTempF,
            weatherCode: currentMeteo.weather_code,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error("Virtual Sensor Error:", error);
        return null;
    }
}
