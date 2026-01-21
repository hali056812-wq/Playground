'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
const apiKey = process.env.GOOGLE_API_KEY;
import { fetchSentinelNDVI } from './satellite';
import { getVirtualSensors } from './sensors';

export async function analyzeField(fieldData: any) {
    if (!apiKey) {
        return "Error: API Key not configured.";
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // 1. Calculate Days After Planting
        const plantingDate = new Date(fieldData.plantingDate);
        const today = new Date();

        let daysAfterPlanting: string | number = "Unknown";
        if (!isNaN(plantingDate.getTime())) {
            const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
            daysAfterPlanting = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else {
            daysAfterPlanting = 0;
            console.warn("Invalid planting date, defaulting to 0 days.");
        }

        // 2. Fetch Real-time Contextual Data
        let sensorData = null;
        let ndviStats = null;

        console.log("Analyzing Field Data:", {
            name: fieldData.name,
            geometry: !!fieldData.geometry
        });

        // 2a. Fetch Satellite & Sensor Data
        if (fieldData.geometry) {
            try {
                const geom = fieldData.geometry.type === 'Feature' ? fieldData.geometry.geometry : fieldData.geometry;

                // Fetch in Parallel for speed
                const [ndvi, sensors] = await Promise.all([
                    fetchSentinelNDVI(geom),
                    getVirtualSensors(geom, fieldData.center)
                ]);

                ndviStats = ndvi;
                sensorData = sensors;
            } catch (e) {
                console.error("Context fetch failed", e);
            }
        }

        // 3. Prepare Context Strings
        const currentTempF = sensorData?.temperature || "Unknown (Sensor Unavailable)";
        const soilMoisture = sensorData?.soilMoisture || "Unknown (Sensor Unavailable)";
        const groundTemp = sensorData?.groundTemperature || "N/A";
        const humidity = sensorData?.humidity || "N/A";
        const precp = sensorData?.precipitation || "0";

        // NDVI String
        let ndviString = "No recent satellite data available";
        let ndviMean = "Unknown";

        if (ndviStats && typeof ndviStats.mean === 'number' && !isNaN(ndviStats.mean)) {
            ndviMean = ndviStats.mean.toFixed(2);
            const ndviMin = typeof ndviStats.min === 'number' ? ndviStats.min.toFixed(2) : "N/A";
            const ndviMax = typeof ndviStats.max === 'number' ? ndviStats.max.toFixed(2) : "N/A";
            ndviString = `Mean: ${ndviMean}, Min: ${ndviMin}, Max: ${ndviMax} (Last 30 Days)`;
        } else {
            ndviMean = "Unavailable (Cloudy or No Data)";
            ndviString = "Satellite data exists but contains no valid vegetation measurements (likely due to current conditions).";
        }

        const prompt = `
      Act as an expert agronomist. I have a field with the following details:
      - Field Name: ${fieldData.name}
      - Crop Type: ${fieldData.cropType}
      - Planting Date: ${fieldData.plantingDate}
      - **Days After Planting**: ${daysAfterPlanting} days
      
      **Virtual Sensor Data (Near Real-Time)**:
      - Air Temperature: ${currentTempF}
      - Ground Temperature (Thermal Satellite): ${groundTemp}
      - Soil Moisture (Estimated): ${soilMoisture}
      - Humidity: ${humidity}
      - Recent Precipitation: ${precp}
      
      **Satellite Analysis (Sentinel-2)**:
      - **Current NDVI Mean**: ${ndviMean} (Scale: 0=Bare Soil, 1=Dense Vegetation)
      - Detailed Stats: ${ndviString}

      **CRITICAL LOGIC**:
      1. Combine the **NDVI** (how green it is) with the **Sensor Data** (how hot/dry it is).
      2. If soil moisture is low but NDVI is high, warn about upcoming stress.
      3. Use the "Days After Planting" to determine if the crop is on schedule.

      Provide a brief, actionable analysis in markdown:
      1. **Growth Stage Estimation**: Based on DAP.
      2. **Crop Health Analysis**: Interpret NDVI and Sensors together.
      3. **Environmental Risks**: Analyze Temp/Moisture/Precip.
      4. **Recommendation**: One key strategic action.

      Max 200 words.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Error calling Gemini SDK:", error);
        return `Error generating analysis: ${error.message || "Unknown error"}`;
    }
}
