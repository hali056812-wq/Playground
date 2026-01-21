const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get client
        // Actually the SDK doesn't expose listModels directly easily on the instance sometimes, 
        // but we can try the REST API directly if SDK fails, but SDK usually has it.
        // Let's use a direct fetch to be safe and dependency-free regarding SDK versions.

        const key = process.env.GOOGLE_API_KEY;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            const fs = require('fs');
            const names = data.models
                .filter(m => m.name.includes("gemini"))
                .map(m => m.name);
            fs.writeFileSync('available_models.json', JSON.stringify(names, null, 2));
            console.log("Wrote models to available_models.json");
        } else {
            console.log("ERROR LISTING MODELS:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
