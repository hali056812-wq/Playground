
import fs from 'fs';
import path from 'path';

// --- Configuration ---
// Load from .env.local manually since this is a standalone script
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, val] = line.split('=');
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
}, {} as any);

const CLIENT_ID = envVars.SH_CLIENT_ID;
const CLIENT_SECRET = envVars.SH_CLIENT_SECRET;

const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CATALOG_URL = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';

console.log("🔍 STARTING SENTINEL HUB VERIFICATION");
console.log("-------------------------------------");
console.log(`Using Client ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 5) + '...' : 'MISSING'}`);

// --- Step 1: Authentication ---
async function getToken() {
    console.log("\n🚀 Step 1: Requesting OAuth2 Token...");
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    try {
        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Token Failed: ${res.status} - ${txt}`);
        }

        const data = await res.json();
        console.log("✅ ACCESS TOKEN RECEIVED!");
        console.log(`   Scope: ${data.scope}`);
        console.log(`   Expires in: ${data.expires_in} seconds`);
        return data.access_token;
    } catch (e) {
        console.error("❌ Authentication Failed:", e);
        process.exit(1);
    }
}

// --- Step 2: Catalog Search ---
async function searchCatalog(token: string) {
    console.log("\n🚀 Step 2: Searching Catalog (Discovery)...");

    // Search Criteria:
    // - Collection: Sentinel-2 Level 2A (S2L2A)
    // - Area: A test bounding box in Iowa (Farmland)
    // - Date: Last 30 days

    // Bbox for a random farm field in Iowa
    const bbox = [-93.6, 42.0, -93.5, 42.1];
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`   Target: Iowa Farmland BBOX [${bbox.join(', ')}]`);
    console.log(`   Time: ${startDate} to ${endDate}`);

    const payload = {
        collections: ["sentinel-2-l2a"],
        datetime: `${startDate}/${endDate}`,
        bbox: bbox,
        limit: 5 // Just get top 5
    };

    try {
        const res = await fetch(CATALOG_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Catalog Search Failed: ${res.status} - ${txt}`);
        }

        const data = await res.json();
        console.log(`\n✅ CATALOG SEARCH SUCCESS! Found ${data.features.length} features.`);

        if (data.features.length > 0) {
            console.log("\n   Visual Proof (Raw Inspection):");
            data.features.forEach((feat: any, i: number) => {
                const props = feat.properties;
                console.log(`   [${i + 1}] Date: ${props.datetime} | Cloud Cover: ${props['eo:cloud_cover']}% | ID: ${feat.id}`);
            });
        } else {
            console.warn("   ⚠️ No images found. Usage might make sense, location might be too small/cloudy?");
        }

    } catch (e) {
        console.error("❌ Catalog Search Failed:", e);
    }
}

// --- Main Execution ---
(async () => {
    const token = await getToken();
    await searchCatalog(token);
    console.log("\n-------------------------------------");
    console.log("🏁 VERIFICATION COMPLETE");
})();
