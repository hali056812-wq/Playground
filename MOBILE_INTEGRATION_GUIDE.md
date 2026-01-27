# Android Integration Guide: Science API

**Goal:** Integrate the Physics-Based Science Engine into the Android App.

## 1. Architecture Overview
This is a **Headless Architecture**.
-   **The "Brain" (Backend)**: Runs on the Next.js Server (this repo). It handles the heavy satellite fetching, RTM simulations, and PLSR math.
-   **The "Face" (Android App)**: Validates the token, collects the field geometry, and simply **displays** the JSON result from the brain.

**You do NOT need to port the physics logic to Java/Kotlin.** You only need to consume this REST API.

## 2. API Endpoint
-   **Development URL**: `http://<YOUR_LOCAL_IP>:3000/api/v1/science`
    -   *Note: If testing on a real phone, use your computer's LAN IP (e.g., 192.168.1.x), not localhost.*
-   **Method**: `POST`
-   **Content-Type**: `application/json`

## 3. Request Contract
The Android app must send a clean GeoJSON Polygon and the selected Crop Type.

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-88.229, 40.092],
        [-88.225, 40.092],
        [-88.225, 40.090],
        [-88.229, 40.090],
        [-88.229, 40.092]
      ]
    ]
  },
  "cropType": "Corn"
}
```
*Supported types: "Corn", "Soybean", "Wheat".*

## 4. Response Contract (JSON)
The backend does all the math. You verify these fields exist and render them.

```json
{
  "timestamp": "2024-05-20T10:00:00Z",
  "cropType": "Corn",
  "science": {
    "chlorophyllContent": 45.2,          // Render as "45.2 µg/cm²"
    "nitrogenMassPercent": 3.1,          // Render as "3.1 %"
    "nitrogenRisk": "LOW",               // Color Code: GREEN (Low), RED (Critical)
    "vmax": 32.5                         // Photosynthetic Capacity
  },
  "stress": {
    "cwsi": 0.42,                        // 0.0 - 1.0 (Higher is drier)
    "rvi": 0.65,                         // 0.0 - 1.0 (Biomass density)
    "waterStress": "HIGH"                // Display Warning if HIGH
  },
  "meta": {
    "ndreSlope": 0.0012,                 // Trend line
    "ndreAnomaly": -0.5
  }
}
```

## 5. UI Implementation Tips
1.  **Nitrogen Tile**: Show `nitrogenMassPercent` with a gauge. If `nitrogenRisk` is CRITICAL, show a "Fertilize Now" alert.
2.  **Water Stress Tile**: Display `cwsi`.
    -   Green: 0.0 - 0.4 ("Healthy")
    -   Yellow: 0.4 - 0.7 ("Stress Watch")
    -   Red: 0.7 - 1.0 ("Drought")
3.  **Analysis**: The `stress.waterStress` boolean is a good "Summary" flag for the dashboard list view.

## 6. Authentication
(Currently Open for Dev)
-   The Android app does **not** need Sentinel Hub keys.
-   The Backend handles all API secrets.

## 7. Firebase Integration Strategy
Since your app uses Firebase, here is the recommended flow:
1.  **User Scans Field** -> Android App gets Geometry.
2.  **Call Science API** -> Android App hits `api/v1/science` and gets the JSON result.
3.  **Save to Firestore** -> Save the *entire* JSON response into a collection like `users/{userId}/scans`.
    -   This allows you to show a "History" list in the app without re-running the heavy science API.

## 8. Connectivity (Crucial)
-   **Local Testing**: Your phone cannot see `localhost`. 
    -   **Emulator**: Use `http://10.0.2.2:3000/api/v1/science`.
    -   **Physical Device**: You must find your laptop's Local IP (e.g., `192.168.1.5`) or use a tool like **ngrok** to tunnel `localhost` to the internet.
-   **Production**: Eventually, you will deploy this Next.js project to **Vercel**. Then the URL will be `https://your-app.vercel.app/api/v1/science`.
