
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getVirtualSensors } from '../actions/sensors';

async function testSensors() {
    console.log("🧪 Testing Virtual Sensor Integration...");

    // Test Location: A farm field in Iowa
    const center = { lat: 42.0, lng: -93.5 };
    const geometry = {
        type: "Polygon",
        coordinates: [[
            [-93.6, 42.0],
            [-93.6, 42.1],
            [-93.5, 42.1],
            [-93.5, 42.0],
            [-93.6, 42.0]
        ]]
    };

    try {
        const data = await getVirtualSensors(geometry, center);

        if (data) {
            console.log("✅ VIRTUAL SENSORS SUCCESS!");
            console.log("--- Atmospheric (Open-Meteo) ---");
            console.log(`📡 Air Temp: ${data.temperature}`);
            console.log(`📡 Humidity: ${data.humidity}`);
            console.log(`📡 Precipitation: ${data.precipitation}`);

            console.log("\n--- Ground (Satellite Derived) ---");
            console.log(`📡 Ground Temp (Landsat): ${data.groundTemperature}`);
            console.log(`📡 Est. Soil Moisture: ${data.soilMoisture}`);

            console.log("\n--- Meta ---");
            console.log(`🕒 Timestamp: ${data.timestamp}`);
            console.log(`🔢 Weather Code: ${data.weatherCode}`);
        } else {
            console.error("❌ FAILED: getVirtualSensors returned null");
        }
    } catch (e) {
        console.error("❌ EXCEPTION:", e);
    }
}

testSensors();
