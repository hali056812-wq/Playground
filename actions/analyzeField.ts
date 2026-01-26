'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
const apiKey = process.env.GOOGLE_API_KEY;
import { fetchSentinelNDVI, fetchSentinelRadarStats, fetchSentinelThermalStats, fetchMultiSpectralStats, fetchSentinelHistory, calculateSlope, calculateAnomaly } from './satellite';
import { getVirtualSensors } from './sensors';
import { calculateCropScience } from '../lib/cropModels';

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

        const supportedCrops = ['Corn', 'Soybean', 'Wheat'];

        if (fieldData.geometry) {
            try {
                const geom = fieldData.geometry.type === 'Feature' ? fieldData.geometry.geometry : fieldData.geometry;

                const promises: Promise<any>[] = [
                    fetchSentinelNDVI(geom),
                    getVirtualSensors(geom, fieldData.center),
                    fetchSentinelRadarStats(geom),
                    fetchSentinelThermalStats(geom)
                ];

                // Trigger Science Upgrade fetch if Corn, Soybean, or Wheat
                if (supportedCrops.includes(fieldData.cropType)) {
                    promises.push(fetchMultiSpectralStats(geom));
                    promises.push(fetchSentinelHistory(geom));
                }

                const results = await Promise.all(promises);
                ndviStats = results[0];
                sensorData = results[1];
                radarStats = results[2];
                thermalStats = results[3];

                if (supportedCrops.includes(fieldData.cropType)) {
                    // results[4] is MultiSpec, results[5] is History
                    const multiSpec = results[4];
                    historyData = results[5];

                    if (multiSpec) {
                        // Calculate Time-Series Features
                        const ndreSlope = historyData ? await calculateSlope(historyData, 'ndre', 20) : 0;

                        // We need the CURRENT NDRE for anomaly. 
                        const currentNDRE = (multiSpec.nirMean - multiSpec.redEdgeMean) / (multiSpec.nirMean + multiSpec.redEdgeMean);
                        const realAnomaly = await calculateAnomaly(currentNDRE, historyData, 'ndre');

                        // --- FEATURE DEPTH UPGRADE ---

                        // 1. Radar Vegetation Index (RVI)
                        // Formula: 4*VH / (VV + VH)
                        let rvi = 0;
                        if (radarStats && radarStats.vvMean && radarStats.vhMean) {
                            rvi = (4 * radarStats.vhMean) / (radarStats.vvMean + radarStats.vhMean);
                        }

                        // 2. CWSI (Crop Water Stress Index)
                        // Formula: (Tc - Ta - LL) / (UL - LL)
                        // Semi-Empirical Baselines: LL = -2.5C (-5F), UL = +5.0C (+10F)
                        let cwsi = 0;
                        if (sensorData && sensorData.temperature && thermalStats && thermalStats.tempF) {
                            const airTemp = parseFloat(sensorData.temperature);
                            const canopyTemp = thermalStats.tempF;

                            if (!isNaN(airTemp) && !isNaN(canopyTemp)) {
                                const deltaT = canopyTemp - airTemp;
                                const lowerLimit = -5.0; // Healthy: 5F cooler than air
                                const upperLimit = 10.0;  // Stressed: 10F warmer than air

                                cwsi = (deltaT - lowerLimit) / (upperLimit - lowerLimit);
                                cwsi = Math.max(0, Math.min(1, cwsi)); // Clamp 0-1
                            }
                        }

                        cornScienceData = calculateCropScience({
                            cropType: fieldData.cropType,
                            redMean: multiSpec.redMean,
                            redEdgeMean: multiSpec.redEdgeMean, // B05
                            nirMean: multiSpec.nirMean,
                            ndreSlope: ndreSlope,
                            ndreAnomaly: realAnomaly
                        });

                        // Inject Advanced Features
                        (cornScienceData as any).rvi = parseFloat(rvi.toFixed(2));
                        (cornScienceData as any).cwsi = parseFloat(cwsi.toFixed(2));
                        console.log(`🧬 ${fieldData.cropType} Science Data (Advanced):`, cornScienceData);
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
            let CROP_RULES = "";

            if (supportedCrops.includes(fieldData.cropType) && cornScienceData) {
                // SCIENCE UPGRADE INJECTED HERE
                CROP_RULES = `
                 **🧬 ${fieldData.cropType.toUpperCase()} SCIENCE UPGRADE ACTIVE (Physics-Based PLSR + RTM)**:
                 We have calibrated this field against specific ${fieldData.cropType} spectral libraries.
                 
                 **Model Confidence (R2 Scores)**:
                 - Chlorophyll: **${(cornScienceData.modelConfidence.chlorophyll * 100).toFixed(0)}%**
                 - Nitrogen: ${(cornScienceData.modelConfidence.nitrogen * 100).toFixed(0)}%
                 - Vmax: ${(cornScienceData.modelConfidence.vmax * 100).toFixed(0)}%

                 **Real-Time Trait Analysis**:
                 - **Chlorophyll Content**: ${cornScienceData.chlorophyllContent} ug/cm2
                 - **Estimated Nitrogen**: ${cornScienceData.nitrogenMassPercent}% (Deficiency Risk: ${cornScienceData.nitrogenRisk})
                 - **Photosynthetic Capacity (Vmax)**: ${cornScienceData.vmax} umol/m2/s

                 **FEATURE DEPTH UPGRADE (Ph.D. Level Analysis)**:
                 - **Crop Water Stress Index (CWSI)**: ${(cornScienceData as any).cwsi} (Scale 0-1).
                   - > 0.3 = Initial Stress, > 0.6 = Severe Drought.
                 - **Radar Vegetation Index (RVI)**: ${(cornScienceData as any).rvi} (Scale 0-1).
                   - Measures structural biomass. < 0.4 implies bare soil/sparse, > 0.7 implies dense canopy.
                 
                 **Action Plan**:
                 - **If CWSI > 0.4**: Alert user of "Invisible Drought" (Transpiration has slowed).
                 - **If RVI is Low + NDVI is High**: This is impossible physically, check for sensor error.
                 - **If RVI is High + NDVI is Low**: Check for senescence (drying down) or disease (greenness loss but structure remains).
                 `;
            } else {
                // Fallback for unsupported crops
                CROP_RULES = `
                  **${fieldData.cropType.toUpperCase()} ANALYSIS**:
                  - **Environmental Sensitivity**: Analyze Land Surface Temp and Soil Moisture for this species.
                  - **Growth Trend**: Use NDVI and Radar structure to assess current biomass vs regional norms.
                `;
            }

            let specificInstructions = CROP_RULES;

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
