'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
const apiKey = process.env.GOOGLE_API_KEY;
import { fetchSentinelNDVI } from './satellite';

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

        let daysAfterPlanting: string | number = "Unknown"; // Allow number
        if (!isNaN(plantingDate.getTime())) {
            const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
            daysAfterPlanting = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else {
            daysAfterPlanting = 0;
            console.warn("Invalid planting date, defaulting to 0 days.");
        }

        // 2. Fetch Real-time Data
        let weatherData = null; // Deprecated Agromonitoring Weather
        let soilData = null;    // Deprecated Agromonitoring Soil
        let ndviStats = null;

        console.log("Analyzing Field Data:", {
            name: fieldData.name,
            geometry: !!fieldData.geometry
        });

        // 2a. Fetch Satellite Data (Copernicus)
        if (fieldData.geometry) {
            try {
                // Pass the geometry directly (Stateless)
                // Ensure we extract the geometry from the Feature if needed
                const geom = fieldData.geometry.type === 'Feature' ? fieldData.geometry.geometry : fieldData.geometry;
                ndviStats = await fetchSentinelNDVI(geom);
            } catch (e) { console.error("Sentinel fetch failed", e); }
        }


        // 3. Prepare Context Strings
        // Weather/Soil are now unknown as we removed Agromonitoring
        const currentTempF = "Unknown (Sensor Unavailable)";
        const soilMoisture = "Unknown (Sensor Unavailable)";
        const weatherDesc = "Unknown";

        // NDVI String
        let ndviString = "No recent satellite data available";
        let ndviMean = "Unknown";

        if (ndviStats && typeof ndviStats.mean === 'number' && !isNaN(ndviStats.mean)) {
            ndviMean = ndviStats.mean.toFixed(2);
            // Also check min/max just in case
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
      // - Location (Lat/Lng): ${JSON.stringify(fieldData.center)}
      
      **Real-time Sensor Data**:
      - Current Temperature: ${currentTempF}
      - Soil Moisture: ${soilMoisture}
      - Weather: ${weatherDesc}
      
      **Satellite Analysis (Sentinel-2)**:
      - **Current NDVI Mean**: ${ndviMean} (Scale: 0=Bare Soil, 1=Dense Vegetation)
      - Detailed Stats: ${ndviString}

      **CRITICAL LOGIC CHECKS (You MUST follow these):**
      1. **Data Gaps**: Since Weather/Soil sensors are offline, rely heavily on the **NDVI** and **Days After Planting**.
      2. **Satellite Logic**:
         - If NDVI Mean is > 0.6: Confirm crop biomass is high and healthy.
         - If NDVI Mean is < 0.3 AND Days After Planting > 60: Warn of **CROP FAILURE** or stunted growth (unless it's winter/fallow).
      3. **Growth Stage**: Use the "Days After Planting" count to strictly estimate the stage.

      Please provide a brief, actionable analysis in markdown format:
      1. **Growth Stage Estimation**: Based on ${daysAfterPlanting} days since planting.
      2. **Crop Health (NDVI)**: Analyze vegetation index (${ndviMean}).
      3. **Key Risks**: Focus on growth efficiency and potential yield impacts based on NDVI.
      4. **Recommendation**: One key action the farmer should take now.

      Keep it concise (under 200 words).
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Error calling Gemini SDK:", error);
        return `Error generating analysis: ${error.message || "Unknown error"}`;
    }
}
