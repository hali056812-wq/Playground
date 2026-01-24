
import pandas as pd
from scipy import stats
import sys

def calibrate_model(csv_path, x_col, y_col, model_name):
    try:
        df = pd.read_csv(csv_path)
        
        # Verify columns exist
        if x_col not in df.columns or y_col not in df.columns:
            print(f"Error: Columns {x_col} or {y_col} not found in {csv_path}")
            return None

        # Drop NaNs
        df = df.dropna(subset=[x_col, y_col])
        
        if len(df) < 2:
            print(f"Error: Not enough data in {csv_path} for {model_name}")
            return None

        # Linear Regression
        slope, intercept, r_value, p_value, std_err = stats.linregress(df[x_col], df[y_col])
        
        print(f"--- {model_name} ---")
        print(f"Input File: {csv_path}")
        print(f"X: {x_col}, Y: {y_col}")
        print(f"Slope: {slope:.6f}")
        print(f"Intercept: {intercept:.6f}")
        print(f"R-squared: {r_value**2:.4f}")
        print("-----------------------")
        
        return slope, intercept
    except Exception as e:
        print(f"Failed to calibrate {model_name}: {e}")
        return None

# Paths to user files
nitrogen_csv = r"c:\Users\gotok\Downloads\Nitrogen.csv"
vmax_csv = r"c:\Users\gotok\Downloads\Vmax.csv"
chlorophyll_csv = r"c:\Users\gotok\Downloads\Chlorophyll.csv"

# 1. Nitrogen Model
calibrate_model(nitrogen_csv, 'Wave_705', 'measured_Nmass (%)', 'Nitrogen Model')

# 2. Vmax Model
calibrate_model(vmax_csv, 'Wave_705', 'measured_Vmax (umol m-2 s-1)', 'Vmax Model')

# 3. Chlorophyll Model
calibrate_model(chlorophyll_csv, 'Wave_705', 'Measured_Chl (ug/cm2)', 'Chlorophyll Model')
