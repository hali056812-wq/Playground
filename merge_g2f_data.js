const fs = require('fs');
const path = require('path');

const traitFile = String.raw`C:\Users\gotok\Downloads\1_Training_Trait_Data_2014_2021.csv`;
const metaFile = String.raw`C:\Users\gotok\Downloads\2_Training_Meta_Data_2014_2021.csv`;
const outputFile = String.raw`C:\Users\gotok\Downloads\Final_Training_Data.csv`;

console.log("Starting merge process...");

// Helper to parse CSV line handling quotes
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(current.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
}

try {
    // 1. Read and parse Meta Data first (smaller file, lookup table)
    console.log("Reading Meta Data...");
    const metaContent = fs.readFileSync(metaFile, 'utf8');
    const metaLines = metaContent.split(/\r?\n/).filter(l => l.trim() !== '');

    if (metaLines.length === 0) throw new Error("Meta data file is empty");

    // Parse headers
    const metaHeaders = parseCSVLine(metaLines[0]);

    // Identify indices for Env, Latitude, Longitude
    // Note: Headers might be quoted in file, parser handles it.
    // Looking for: "Env", "Weather_Station_Latitude (in decimal numbers NOT DMS)", "Weather_Station_Longitude (in decimal numbers NOT DMS)"

    const envIndex = metaHeaders.findIndex(h => h === 'Env');
    // Using simple includes search because likely exact string match might fail on hidden chars or encoding
    const latIndex = metaHeaders.findIndex(h => h.includes('Weather_Station_Latitude'));
    const longIndex = metaHeaders.findIndex(h => h.includes('Weather_Station_Longitude'));

    if (envIndex === -1) throw new Error("Could not find 'Env' column in Meta Data");
    if (latIndex === -1) console.warn("Warning: Could not find Latitude column in Meta Data");
    if (longIndex === -1) console.warn("Warning: Could not find Longitude column in Meta Data");

    console.log(`Meta Data Indices - Env: ${envIndex}, Lat: ${latIndex}, Long: ${longIndex}`);

    // Build Lookup Map: Env -> { Lat, Long }
    const metaMap = new Map();
    for (let i = 1; i < metaLines.length; i++) {
        const cols = parseCSVLine(metaLines[i]);
        if (cols.length <= envIndex) continue;

        const env = cols[envIndex];
        const lat = latIndex !== -1 ? cols[latIndex] : '';
        const long = longIndex !== -1 ? cols[longIndex] : '';

        metaMap.set(env, { lat, long });
    }
    console.log(`Loaded ${metaMap.size} meta data entries.`);

    // 2. Read Trait Data and Stream Output
    console.log("Reading Trait Data and writing output...");

    // We'll read the file normally since node fs.readFileSync handles 26MB easily.
    // If it were 1GB+, we'd use streams.
    const traitContent = fs.readFileSync(traitFile, 'utf8');
    const traitLines = traitContent.split(/\r?\n/); // Don't filter empty yet to preserve line structure if needed, but usually safe.

    if (traitLines.length === 0) throw new Error("Trait data file is empty");

    const traitHeaderLine = traitLines[0];
    const traitHeaders = parseCSVLine(traitHeaderLine);

    // Identify Yield Data
    // Target: "Yield_Mg_ha"
    const yieldIndex = traitHeaders.findIndex(h => h === 'Yield_Mg_ha');
    const traitEnvIndex = traitHeaders.findIndex(h => h === 'Env');

    if (yieldIndex === -1) throw new Error("Could not find 'Yield_Mg_ha' in Trait Data");
    if (traitEnvIndex === -1) throw new Error("Could not find 'Env' in Trait Data");

    // Prepare Output
    // New Header: Env, GrainYield, Latitude, Longitude
    // User requested: "Output a new file called Final_Training_Data.csv that has the Yield and GPS on the same row."
    // implying meaningful columns.

    const outputHeaders = ['Env', 'GrainYield', 'Latitude', 'Longitude'];
    const outputLines = [];
    outputLines.push(outputHeaders.join(','));

    // Iterate
    let matches = 0;
    for (let i = 1; i < traitLines.length; i++) {
        const line = traitLines[i];
        if (line.trim() === '') continue;

        const cols = parseCSVLine(line);
        // Safety check for malformed lines
        if (cols.length < traitHeaders.length) continue;

        const env = cols[traitEnvIndex];
        const rawYield = cols[yieldIndex];

        // Lookup Meta
        const meta = metaMap.get(env) || { lat: 'NA', long: 'NA' };
        if (metaMap.has(env)) matches++;

        // Construct Row
        // Handle undefined or missing yield
        const yieldVal = rawYield || 'NA';

        const row = [
            env,
            yieldVal,
            meta.lat,
            meta.long
        ];

        // Simple join for parsing safe values (Env usually is safe, numbers are safe)
        // If Env contains comma, we should quote it.
        const csvRow = row.map(val => {
            if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
            return val;
        }).join(',');

        outputLines.push(csvRow);
    }

    console.log(`Writing ${outputLines.length} lines to output... (Matches found: ${matches})`);
    fs.writeFileSync(outputFile, outputLines.join('\n'));
    console.log("Successfully created Final_Training_Data.csv");

} catch (err) {
    console.error("An error occurred:");
    console.error(err);
    process.exit(1);
}
