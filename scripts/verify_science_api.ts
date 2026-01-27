
/**
 * Verification Script for Science API
 * Usage: npx tsx scripts/verify_science_api.ts
 * 
 * Pre-requisite: 'npm run dev' must be running on port 3000.
 */

async function verify() {
    console.log("🧪 Starting Science API Verification...");
    console.log("Target: http://localhost:3000/api/v1/science");

    // 1. Define Test Payload (UIUC South Farms - Valid Field)
    const payload = {
        geometry: {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [-88.229467, 40.092789],
                        [-88.225905, 40.092789],
                        [-88.225905, 40.090332],
                        [-88.229467, 40.090332],
                        [-88.229467, 40.092789]
                    ]
                ]
            }
        },
        cropType: "Corn"
    };

    try {
        // 2. Send POST Request
        const startTime = Date.now();
        const response = await fetch('http://localhost:3000/api/v1/science', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const duration = Date.now() - startTime;
        console.log(`⏱️ Response time: ${duration}ms`);

        // 3. Check for Errors
        if (!response.ok) {
            console.error(`❌ Request Failed: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error("Server Error Details:", errorText);
            process.exit(1);
        }

        // 4. Validate JSON Structure
        const data = await response.json();
        console.log("✅ Received 200 OK. Response Data:");
        console.dir(data, { depth: null, colors: true });

        // 5. Assertions
        console.log("\n🔍 Running Assertions...");

        const checks = [
            { name: "Has cropType", pass: data.cropType === "Corn" },
            { name: "Has Science Block", pass: !!data.science },
            { name: "Has Chlorophyll", pass: typeof data.science?.chlorophyllContent === 'number' },
            { name: "Has Nitrogen", pass: typeof data.science?.nitrogenMassPercent === 'number' },
            { name: "Has CWSI (Advanced Feature)", pass: typeof data.stress?.cwsi === 'number' },
            { name: "Has RVI (Advanced Feature)", pass: typeof data.stress?.rvi === 'number' },
        ];

        let failed = false;
        checks.forEach(check => {
            if (check.pass) {
                console.log(`  ✅ ${check.name}`);
            } else {
                console.log(`  ❌ ${check.name}`);
                failed = true;
            }
        });

        if (failed) {
            console.error("\n❌ Structure Validation Failed.");
            process.exit(1);
        } else {
            console.log("\n✨ SUCCESS: API is compliant and ready for mobile.");
            process.exit(0);
        }

    } catch (error: any) {
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            console.error("\n❌ CONNECTION REFUSED: Is the server running?");
            console.error("👉 Please run 'npm run dev' in a separate terminal.");
        } else {
            console.error("\n❌ Unexpected Error:", error);
        }
        process.exit(1);
    }
}

verify();
