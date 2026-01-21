
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.AGROMONITORING_API_KEY;

async function testAgro() {
    console.log("🧪 Testing Agromonitoring API Key...");
    if (!API_KEY) {
        console.error("❌ AGROMONITORING_API_KEY missing in .env.local");
        return;
    }

    // Attempt to list polygons to check if key works
    const url = `http://api.agromonitoring.com/agro/1.0/polygons?appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            console.log("✅ API SUCCESS! Polygons found:", Array.isArray(data) ? data.length : 0);
        } else {
            const err = await response.text();
            console.error("❌ API FAILED:", response.status, err);
        }
    } catch (e) {
        console.error("❌ Fetch Error:", e);
    }
}

testAgro();
