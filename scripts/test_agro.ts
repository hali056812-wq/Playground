
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { calculateCornScience } from '../lib/cornModels';

async function testScience() {
    console.log("🌽 Testing Corn Science Model...");

    // Scenario 1: Perfect Health
    // High Chlorophyll (Cab > 40), No Slope
    const healthy = calculateCornScience({
        redMean: 0.05,
        redEdgeMean: 0.15, // Low Red Edge = High Chlorphyll absorption? No, Red Edge varies.
        // Let's use indices. 
        // NDRE = (NIR - RE) / (NIR + RE)
        // High NDRE = Healthy.
        // NIR = 0.4, RE = 0.15 -> NDRE = 0.25/0.55 = 0.45 (Good)
        nirMean: 0.4,
        ndreSlope: 0,
        ndreAnomaly: 0.5
    });

    console.log("\n[Scenario 1] Healthy Field:");
    console.log(JSON.stringify(healthy, null, 2));

    // Scenario 2: Nitrogen Stress
    // Lower NDRE, Negative Slope
    const stressed = calculateCornScience({
        redMean: 0.08,
        redEdgeMean: 0.25, // Higher Red Edge Reflectance = Less Chlorophyll
        // NIR = 0.35, RE = 0.25 -> NDRE = 0.10 / 0.60 = 0.16 (Low)
        nirMean: 0.35,
        ndreSlope: -0.015, // Rapid Decline
        ndreAnomaly: -2.5
    });

    console.log("\n[Scenario 2] Stressed Field:");
    console.log(JSON.stringify(stressed, null, 2));
}

testScience();
