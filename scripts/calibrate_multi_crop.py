
import numpy as np
import scipy.stats as stats
import prosail
import json
import os

def run_multi_crop_calibration():
    # Targeted Crop Parameters based on Literature (PROSAIL)
    # 1. Corn (Already done, but we'll re-run for consistency)
    # 2. Soybean (Dicots, thinner/more complex leaf structure, planophile)
    # 3. Wheat (Monocots, vertical/erectile leaf structure)

    crops = {
        "Corn": {
            "n_range": (1.0, 1.5),
            "alia": 60,
            "cab_range": (10, 90),
            "lai_range": (0.5, 7.0)
        },
        "Soybean": {
            "n_range": (1.5, 2.5),
            "alia": 45,
            "cab_range": (10, 90),
            "lai_range": (0.5, 7.0)
        },
        "Wheat": {
            "n_range": (1.0, 2.0),
            "alia": 50,
            "cab_range": (10, 80),
            "lai_range": (0.5, 7.0)
        }
    }

    n_sims = 10000
    all_weights = {}

    for crop_name, params in crops.items():
        print(f"\n--- CALIBRATING: {crop_name} (10,000 Simulations) ---")
        
        synthetic_refl = []
        synthetic_chl = []

        # Monte Carlo Parameter Randomization
        n_vals = np.random.uniform(params["n_range"][0], params["n_range"][1], n_sims)
        cab_vals = np.random.uniform(params["cab_range"][0], params["cab_range"][1], n_sims)
        lai_vals = np.random.uniform(params["lai_range"][0], params["lai_range"][1], n_sims)
        
        # General params
        cw_vals = np.random.uniform(0.005, 0.02, n_sims)
        cm_vals = np.random.uniform(0.005, 0.015, n_sims)
        tts_vals = np.random.uniform(30, 60, n_sims)
        rsoil_vals = np.random.uniform(0.5, 1.5, n_sims)
        psoil_vals = np.random.uniform(0.0, 1.0, n_sims)

        for i in range(n_sims):
            try:
                # Using keyword arguments for safety across different prosail variants
                refl = prosail.run_prosail(
                    n=n_vals[i],
                    cab=cab_vals[i],
                    car=8.0,
                    cbrown=0.0,
                    cw=cw_vals[i],
                    cm=cm_vals[i],
                    lai=lai_vals[i],
                    lidfa=-1.0,
                    lidfb=0.0,
                    hspot=0.01,
                    tts=tts_vals[i],
                    tto=0.0,
                    psi=0.0,
                    rsoil=rsoil_vals[i],
                    psoil=psoil_vals[i]
                )
                
                # Sentinel-2 Band 5 (705nm) -> Index 305
                b5_val = refl[305]
                synthetic_refl.append(b5_val)
                synthetic_chl.append(cab_vals[i])
            except Exception as e:
                if i < 5: # Only print first few errors
                    print(f"PROSAIL Error: {e}")
                continue

        # Linear Regression: Trait = Slope * Reflectance + Intercept
        slope, intercept, r_val, p_val, std_err = stats.linregress(synthetic_refl, synthetic_chl)
        
        print(f"{crop_name} R2: {r_val**2:.4f}")
        print(f"Model: Chl = {slope:.2f} * B05 + {intercept:.2f}")

        all_weights[crop_name] = {
            "slope": slope,
            "intercept": intercept,
            "r2": r_val**2
        }

    # Save to JSON
    output_path = 'crop_model_weights.json'
    with open(output_path, 'w') as f:
        json.dump(all_weights, f, indent=4)
    
    print(f"\nSUCCESS: Multi-crop weights saved to {output_path}")

if __name__ == "__main__":
    run_multi_crop_calibration()
