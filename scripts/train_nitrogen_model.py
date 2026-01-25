
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib
import json
import os

# Try importing PROSAIL
try:
    import prosail
except ImportError:
    print("Error: 'prosail' library not found. Please install it using: pip install prosail")
    # We will define a dummy prosail function for fallback/testing purposes if library is missing
    # so the script structure is valid, but it won't produce a real model without the library.
    prosail = None

def run_prosail_simulation(n_samples=5000):
    """
    Generates synthetic corn spectral data using PROSAIL RTM.
    Varies Chlorophyll (Cab) as a proxy for Nitrogen.
    """
    if prosail is None:
        print("PROSAIL not installed. returning empty data.")
        return pd.DataFrame()

    print(f"Generating {n_samples} synthetic corn samples...")

    # Range of parameters for typical Corn
    # Cab (Chlorophyll): 10 to 80 ug/cm2 (Low N to High N)
    # LAI (Leaf Area Index): 1 to 6
    features = []
    labels = []

    for _ in range(n_samples):
        # 1. Randomize Leaf Parameters (Biology)
        n = 1.4 + np.random.rand() * 0.2  # Leaf structure parameter
        cab = 10 + np.random.rand() * 70  # Chlorophyll content (THE TARGET)
        car = 4 + np.random.rand() * 10   # Carotenoid
        cw = 0.005 + np.random.rand() * 0.02 # Water content
        cm = 0.003 + np.random.rand() * 0.008 # Dry matter
        lai = 0.5 + np.random.rand() * 5.5   # Leaf Area Index

        # 2. Randomize Angles (Observation Geometry)
        hspot = 0.01 + np.random.rand() * 0.5
        tts = 20 + np.random.rand() * 40  # Solar Zenith
        tto = 0 + np.random.rand() * 10   # Observer Zenith (Sentinel is near nadir)
        psi = 0 + np.random.rand() * 360  # Azimuth

        # 3. Run PROSAIL (API v2.0.5)
        # Returns reflectance from 400nm to 2500nm (1nm steps)
        # Use named arguments for clarity
        rho = prosail.run_prosail(
            n=n,
            cab=cab,
            car=car,
            cbrown=0.0,
            cw=cw,
            cm=cm,
            lai=lai,
            lidfa=45.0, # Typical corn leaf angle
            hspot=0.01, # Hotspot parameter
            tts=tts,
            tto=tto,
            psi=psi,
            prospect_version="D", # Use modern PROSPECT-D
            rsoil=1.0,
            psoil=0.5
        )

        # 4. Resample to Sentinel-2 Bands
        # Approximations based on central wavelengths
        # B04 (Red): 665nm (Index 265 in 400nm start array)
        # B05 (Red Edge): 705nm (Index 305)
        # B08 (NIR): 842nm (Index 442)
        
        b04 = rho[265]
        b05 = rho[305]
        b08 = rho[442]

        # 5. Feature Engineering (The inputs for the App)
        ndvi = (b08 - b04) / (b08 + b04)
        ndre = (b08 - b05) / (b08 + b05)
        
        features.append({
            'NDVI': ndvi,
            'NDRE': ndre,
            'B04': b04,
            'B05': b05,
            'B08': b08
        })
        
        # 6. Target Label: Nitrogen Stress Level (0 = Stressed, 1 = Healthy)
        # We define "Healthy" as Cab > 40 ug/cm2
        # But we want a probability score, so we train on the raw Cab value first, 
        # or a normalized score. Let's predict Cab directly.
        labels.append(cab)

    return pd.DataFrame(features), np.array(labels)

def train_model():
    X, y = run_prosail_simulation(10000)
    
    if X.empty:
        print("Skipping training due to missing PROSAIL.")
        return

    print("Training Random Forest Regressor...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf.fit(X_train, y_train)
    
    score = rf.score(X_test, y_test)
    print(f"Model R2 Score: {score:.4f}")

    # Export Model Weights (Simplified for JS)
    # Since we can't run a pickle file in Next.js easily without a python backend API,
    # We will export a "Decision Tree" logic or specific thresholds for JS.
    # OR, for the 'implementation', we save the python model for the API route we discussed,
    # but since the user wants mobile integration (Capacitor), avoiding a python server is better.
    # STRATEGY: We will extract the "Feature Importance" and a simple "Look Up Table" logic
    # or just saving the coefficients if we used linear. 
    # Since random forest is complex, we will approximated it or save it for the "Python API" approach.
    # However, the user LIKED the idea of "No separate API". 
    # Let's export a JSON that defines "Risk Zones" based on NDRE/NDVI.
    
    # Generate a Look Up Table (LUT) for the JS app
    # NDRE from 0.0 to 1.0, NDVI from 0.0 to 1.0 -> Prediction
    print("Generating JS Lookup Table...")
    lut = []
    for ndre_val in np.linspace(0, 0.8, 20):
        for ndvi_val in np.linspace(0, 1.0, 20):
            # Synthetic band values for prediction (approximate)
            # This is a simplification to mapping 2D space to Cab
             input_vector = pd.DataFrame([{
                'NDVI': ndvi_val,
                'NDRE': ndre_val,
                'B04': 0.1, # Dummy values for less important features
                'B05': 0.2, 
                'B08': 0.3 
            }])
            # We need to fill B04/B5/B8 to match the training shape, 
            # effectively we are marginalizing them or assuming correlation.
            # A better way for the JS app is to just implement a polynomial regression 
            # trained on this synthetic data which is lightweight.
             pass
    
    # BETTER APPROACH: Train a Polynomial Regressor on top of the RF output for portability
    # Cab = a*NDVI + b*NDRE + c*NDVI^2 ...
    # This compresses the RF knowledge into an equation for `cornModels.ts`
    
    from sklearn.preprocessing import PolynomialFeatures
    from sklearn.linear_model import LinearRegression
    
    poly = PolynomialFeatures(degree=2, include_bias=False)
    # Use only NDVI and NDRE for portable model
    X_portable = X[['NDVI', 'NDRE']]
    X_poly = poly.fit_transform(X_portable)
    
    portable_model = LinearRegression()
    portable_model.fit(X_poly, y)
    
    print("Portable Model Coefficients (Poly Degree 2):")
    print(portable_model.coef_)
    print(portable_model.intercept_)
    
    model_data = {
        "type": "polynomial_deg2",
        "features": ["NDVI", "NDRE"],
        "coefficients": portable_model.coef_.tolist(),
        "intercept": portable_model.intercept_,
        "r2_score_portable": portable_model.score(X_poly, y),
        " rf_r2_score": score,
        "note": "Predicts Chlorophyll (Cab) in ug/cm2. Target > 40 is healthy."
    }
    
    output_path = os.path.join(os.path.dirname(__file__), '../available_models.json') # Save to root/available or similar
    # Actually save to a dedicated file
    output_path = "../corn_model_weights.json"
    with open(output_path, 'w') as f:
        json.dump(model_data, f, indent=4)
    
    print(f"Model saved to {output_path}")

if __name__ == "__main__":
    train_model()
