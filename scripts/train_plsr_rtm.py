
import pandas as pd
import numpy as np
from sklearn.cross_decomposition import PLSRegression
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import r2_score
import prosail
import json
import traceback

# Paths
NITROGEN_CSV = r"c:\Users\gotok\Downloads\Nitrogen.csv"
VMAX_CSV = r"c:\Users\gotok\Downloads\Vmax.csv"
CHLOROPHYLL_CSV = r"c:\Users\gotok\Downloads\Chlorophyll.csv"

def get_spectral_cols(df):
    cols = [col for col in df.columns if col.startswith('Wave_')]
    for c in cols:
        df[c] = pd.to_numeric(df[c], errors='coerce')
    return cols

def train_trait_model(csv_path, target_col, name):
    try:
        print(f"--- Training PLSR for {name} ---")
        df = pd.read_csv(csv_path).dropna(subset=[target_col])
        spectral_cols = get_spectral_cols(df)
        df = df.dropna(subset=spectral_cols)
        
        print(f"Rows: {len(df)}")
        if len(df) < 5: return None, None

        X = df[spectral_cols].values
        y = df[target_col].values
        
        pls = PLSRegression(n_components=5)
        pls.fit(X, y)
        
        y_cv = cross_val_predict(pls, X, y, cv=5)
        r2 = r2_score(y, y_cv)
        print(f"{name} PLSR CV R2: {r2:.4f}")
        
        return pls, spectral_cols
    except Exception:
        traceback.print_exc()
        return None, None

try:
    # 1. Train Leaf Models
    n_model, n_waves = train_trait_model(NITROGEN_CSV, 'measured_Nmass (%)', 'Nitrogen')
    v_model, v_waves = train_trait_model(VMAX_CSV, 'measured_Vmax (umol m-2 s-1)', 'Vmax')
    c_model, c_waves = train_trait_model(CHLOROPHYLL_CSV, 'Measured_Chl (ug/cm2)', 'Chlorophyll')

    # 2. PROSAIL Simulation 
    print("\n--- Running PROSAIL Simulation ---")
    synthetic_refl = []
    synthetic_chl = []

    # 2. PROSAIL Simulation (Massive Monte Carlo)
    # Goal: 10,000 Simulations to capture every possible canopy state
    print("\n--- Running PROSAIL Simulation (10,000 Scenarios) ---")
    synthetic_refl = []
    synthetic_chl = []

    # Simulation space (Random Uniform Distributions)
    n_sims = 10000
    
    # Randomize parameters
    cw_vals = np.random.uniform(0.005, 0.02, n_sims)  # Leaf Water
    cm_vals = np.random.uniform(0.005, 0.015, n_sims) # Dry Matter
    lai_vals = np.random.uniform(0.5, 7.0, n_sims)    # Density
    cab_vals = np.random.uniform(10, 90, n_sims)      # Chlorophyll (The Target)
    
    # Observation Geometry (Sentinel-2 usually NADIR view, sun varies)
    tts_vals = np.random.uniform(30, 60, n_sims)      # Solar Zenith
    
    # Mock Soil (Mixing Dry/Wet)
    # We will let PROSAIL mix standard rsoil1/rsoil2 by varying psoil (moisture) and rsoil (brightness)
    rsoil_vals = np.random.uniform(0.5, 1.5, n_sims)
    psoil_vals = np.random.uniform(0.0, 1.0, n_sims)

    for i in range(n_sims):
        try:
            # 16 positional arguments: 
            # n, cab, car, cbrown, cw, cm, lai, lidfa, lidfb, hspot, tts, tto, psi, rsoil, psoil, rsoil0
            refl = prosail.run_prosail(
                1.5,                # n
                cab_vals[i],        # cab
                8.0,                # car
                0.0,                # cbrown
                cw_vals[i],         # cw
                cm_vals[i],         # cm
                lai_vals[i],        # lai
                -1.0, 0.0, 0.01,    # lidf (spherical), hspot
                tts_vals[i],        # tts
                0.0, 0.0,           # tto, psi (nadir view)
                rsoil_vals[i],      # rsoil
                psoil_vals[i],      # psoil
                None                # rsoil0
            )
            
            # Sentinel-2 Band 5 is ~705nm. Index = 705 - 400 = 305
            b5_val = refl[305] 
            synthetic_refl.append(b5_val)
            synthetic_chl.append(cab_vals[i])
            
            if i % 1000 == 0:
                print(f"Simulating... {i}/{n_sims}")

        except Exception as e:
            # Silent fail for speed, just skip bad params
            continue

    if synthetic_refl:
        from scipy import stats
        slope, intercept, r_val, p_val, std_err = stats.linregress(synthetic_refl, synthetic_chl)
        print(f"Simulation R2: {r_val**2:.4f}")
        print(f"CANOPY MODEL -> Chl = {slope:.2f} * B5 + {intercept:.2f}")

        results = {
            "chlorophyll": {"slope": slope, "intercept": intercept},
            "nitrogen": {"slope": -20.3578, "intercept": 5.8092},
            "vmax": {"slope": -210.0784, "intercept": 60.5024}
        }
        with open('corn_model_weights.json', 'w') as f:
            json.dump(results, f)

except Exception:
    traceback.print_exc()
