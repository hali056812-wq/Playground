'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
const apiKey = process.env.GOOGLE_API_KEY;
import { fetchSentinelNDVI, fetchSentinelRadarStats, fetchSentinelThermalStats, fetchMultiSpectralStats, fetchSentinelHistory, calculateSlope, calculateAnomaly } from './satellite';
import { getVirtualSensors } from './sensors';
import { calculateCornScience } from '../lib/cornModels';

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
        let radarStats = null;
        let thermalStats = null;
        let cornScienceData = null;
        let historyData = null; // New History Data

        console.log("Analyzing Field Data:", {
            name: fieldData.name,
            geometry: !!fieldData.geometry,
            cropType: fieldData.cropType
        });

        // 2a. Fetch Satellite & Sensor Data
        if (fieldData.geometry) {
            try {
                const geom = fieldData.geometry.type === 'Feature' ? fieldData.geometry.geometry : fieldData.geometry;

                const promises: Promise<any>[] = [
                    fetchSentinelNDVI(geom),
                    getVirtualSensors(geom, fieldData.center),
                    fetchSentinelRadarStats(geom),
                    fetchSentinelThermalStats(geom)
                ];

                // Trigger Science Upgrade fetch if Corn
                if (fieldData.cropType === 'Corn') {
                    promises.push(fetchMultiSpectralStats(geom));
                    promises.push(fetchSentinelHistory(geom)); // Fetch history for Slope/Anomaly
                }

                const results = await Promise.all(promises);
                ndviStats = results[0];
                sensorData = results[1];
                radarStats = results[2];
                thermalStats = results[3];

                if (fieldData.cropType === 'Corn') {
                    // results[4] is MultiSpec, results[5] is History
                    const multiSpec = results[4];
                    historyData = results[5];

                    if (multiSpec) {
                        // Calculate Time-Series Features
                        const ndreSlope = historyData ? await calculateSlope(historyData, 'ndre', 20) : 0;
                        const ndreAnomaly = (historyData && multiSpec.redEdgeMean) ? await calculateAnomaly(multiSpec.redEdgeMean, historyData, 'ndre') : 0; // Note: redEdgeMean is a raw value, not NDRE. 

                        // We need the CURRENT NDRE for anomaly. 
                        // multiSpec provides Bands, clean NDRE from bands:
                        const currentNDRE = (multiSpec.nirMean - multiSpec.redEdgeMean) / (multiSpec.nirMean + multiSpec.redEdgeMean);
                        const realAnomaly = await calculateAnomaly(currentNDRE, historyData, 'ndre');

                        cornScienceData = calculateCornScience({
                            redMean: multiSpec.redMean,
                            redEdgeMean: multiSpec.redEdgeMean, // B05
                            nirMean: multiSpec.nirMean,
                            ndreSlope: ndreSlope,
                            ndreAnomaly: realAnomaly
                        });
                        console.log("🌽 Corn Science Data:", cornScienceData);
                    }
                }

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

        // Radar Context (New)
        const vv = radarStats?.vvMean ? radarStats.vvMean.toFixed(3) : "N/A";
        const vh = radarStats?.vhMean ? radarStats.vhMean.toFixed(3) : "N/A";
        const radarNote = radarStats
            ? `VV Backscatter: ${vv} (Surface Roughness), VH Backscatter: ${vh} (Structural Biomass)`
            : "Radar structural data unavailable.";

        // Thermal Data Context (New)
        const groundTempLST = thermalStats?.tempF ? thermalStats.tempF.toFixed(1) : "N/A";
        const thermalNote = thermalStats
            ? `Land Surface Temperature (LST): ${groundTempLST}°F`
            : "Direct thermal satellite data unavailable.";

        let prompt = "";

        if (fieldData.cropType === "None") {
            // EXPERT LAND POTENTIAL MODE
            prompt = `
              Act as an expert Land Appraiser and Agronomist. I am evaluating a plot of land for potential agriculture usage.
              - Field Name: ${fieldData.name}
              - **Current Status**: Fallow / Unplanted (Analyzing Land Potential)
              
              **Land Data (Real-Time)**:
              - Air Temp: ${currentTempF}
              - Ground Temp: ${groundTemp}
              - Soil Moisture (3-9cm Root Zone): ${soilMoisture}
              - Rainfall (Recent): ${precp}
              
              **Vegetation History (Last 30 Days)**:
              - NDVI Mean: ${ndviMean}
              - ${ndviString}
              
              **Physical Structure**:
              - ${radarNote}
              
              **CRITICAL ANALYSIS**:
              1. **Soil Capability**: Analyze the Soil Moisture (${soilMoisture}) and Thermal properties. Is it currently holding water well?
              2. **Vegetation Potential**: Look at the NDVI. If it's low (0-0.2), it's bare soil (good for planting). If it's high (>0.4), it's already overgrown (needs clearing) or is a forest/pasture.
              3. **Suitability**: Based on this climate and soil profile, what crops would thrive here?
              
              Provide a "Land Potential Report":
              1. **Current Condition**: Describe the land (Bare, grassy, wet, dry).
              2. **Soil & Water Rating**: Grade the moisture retention (Low/Med/High).
              3. **Recommended Crops**: List 3 suitable crops for this profile.
              4. **Action Item**: First step to prepare for planting.
              
              Max 200 words.
            `;
        } else {
            // STANDARD CROP HEALTH MODE

            // 1. Define Crop-Specific Rules ("The Vibe Coded Logic")
            let CORN_RULES = "";

            if (fieldData.cropType === 'Corn' && cornScienceData) {
                // SCIENCE UPGRADE INJECTED HERE
                CORN_RULES = `
                 **🌽 SCIENCE UPGRADE ACTIVE (Calibrated Models + Time Series)**:
                 We have run specific Random Forest simulations (PROSAIL) on this field.
                 - **Nitrogen Risk Level**: ${cornScienceData.nitrogenRisk} (Probability of Stress: ${cornScienceData.stressProbability}%)
                 - **Predicted Chlorophyll**: ${cornScienceData.chlorophyllContent} ug/cm2
                 - **Estimated Nitrogen**: ${cornScienceData.nitrogenMassPercent}%
                 - **Warnings**: ${cornScienceData.warnings.join(', ') || "None"}
                 
                 **CORN SPECIFIC ANALYSIS**:
                 - **Risk Assessment**: If Risk is HIGH or CRITICAL, warn the user immediately about nitrogen deficiency. 
                 - **Chlorophyll Check**: Target > 40 ug/cm2. value of ${cornScienceData.chlorophyllContent} indicates: ${cornScienceData.chlorophyllContent < 40 ? "Potential Nutrient Stress" : "Healthy Photosynthesis"}.
                 - **Action Plan**: If Risk > 50%, recommend tissue sampling or variable rate application.
                 `;
            } else {
                // Fallback if Science Data fails or not corn
                CORN_RULES = `
                  **CORN SPECIFIC ANALYSIS**:
                  - **Yield Benchmark**: In this region, target yield is 10-12 Mg/ha. If prediction is lower, flag as underperforming.
                  - **Nitrogen Threshold**: Laboratory trials (Illinois Data) indicate that if Calculated Nitrogen is < 3.0%, the plant is essentially starving.
                  - **Thermal Stress**: If Land Surface Temp > Air Temp + 2°C, assume transpiration has stopped (Crop Fever).
                `;
            }

            let specificInstructions = "";
            if (fieldData.cropType === 'Corn') {
                specificInstructions = CORN_RULES;
            } else {
                specificInstructions = "**General Analysis**: Provide standard agronomic advice based on the available sensor data.";
            }

            prompt = `
              Act as an expert agronomist. I have a field with the following details:
              - Field Name: ${fieldData.name}
              - Crop Type: ${fieldData.cropType}
              - Planting Date: ${fieldData.plantingDate}
              - **Days After Planting**: ${daysAfterPlanting} days
              
              ${specificInstructions}

              **Virtual Sensor Data (Near Real-Time)**:
              - Air Temperature: ${currentTempF}
              - Ground Temperature (Thermal Satellite): ${groundTemp}
              - Soil Moisture (Estimated): ${soilMoisture}
              - Humidity: ${humidity}
              - Recent Precipitation: ${precp}
              
              **Satellite Analysis (Sentinel-2 - Optical)**:
              - **Current NDVI Mean**: ${ndviMean} (Scale: 0=Bare Soil, 1=Dense Vegetation)
              - Detailed Stats: ${ndviString}
        
              **Radar Analysis (Sentinel-1 - Structural)**:
              - ${radarNote}
        
              **Thermal Water Stress Analysis (Landsat-8/9)**:
              - ${thermalNote}
        
              **CRITICAL LOGIC**:
              1. **Early Stress Detection**: Compare Surface Temperature (${groundTempLST}°F) vs Air Temperature (${currentTempF}°F). 
                 - If Surface Temp is >10°F higher than Air Temp, the crop is likely under "Transpiration Stress" (closing stomata to save water). 
                 - This is an early warning system for drought (3-5 days ahead of visible wilting).
              2. Combine **NDVI** (greenness) with **Radar** (structure). If NDVI is low due to clouds, rely on Radar VV/VH to assess biomass structure.
              3. Use Soil Moisture, Precipitation, and Thermal LST to calculate drought risk.
        
              Provide a brief, actionable analysis in markdown:
              1. **Growth Stage Estimation**: Based on DAP.
              2. **Crop Health Analysis**: Interpret NDVI, Radar, Thermal, and Sensors together. Prioritize the Thermal "Crop Fever" warning if detected.
              3. **Environmental Risks**: Analyze Temp/Moisture/Precip.
              4. **Recommendation**: One key strategic action.
        
              Max 200 words.
            `;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Error calling Gemini SDK:", error);
        return `Error generating analysis: ${error.message || "Unknown error"}`;
    }
}
