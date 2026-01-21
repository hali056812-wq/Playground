import { NextResponse } from 'next/server';

export async function GET() {
    const SH_CLIENT_ID = process.env.SH_CLIENT_ID;
    const SH_CLIENT_SECRET = process.env.SH_CLIENT_SECRET;

    // Check if keys exist (masked)
    const status = {
        service: "Copernicus Data Space Ecosystem (Sentinel Hub)",
        clientIdConfigured: !!SH_CLIENT_ID,
        clientSecretConfigured: !!SH_CLIENT_SECRET,
        clientIdSnippet: SH_CLIENT_ID ? `${SH_CLIENT_ID.substring(0, 8)}...` : "not set",
        timestamp: new Date().toISOString(),
        view_last_raw_data: "http://localhost:3000/last_analysis.json",
        instructions: "1. Return to the Map. 2. Draw/Select a field. 3. Click 'Analyze'. 4. Refresh the link above to see the raw pixel JSON."
    };

    return NextResponse.json(status);
}
