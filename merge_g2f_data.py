import pandas as pd
import os

# Define file paths
downloads_path = r'C:\Users\gotok\Downloads'
trait_data_path = os.path.join(downloads_path, '1_Training_Trait_Data_2014_2021.csv')
meta_data_path = os.path.join(downloads_path, '2_Training_Meta_Data_2014_2021.csv')
output_path = os.path.join(downloads_path, 'Final_Training_Data.csv')

print("Loading data...")
# Load the CSV files
try:
    df_trait = pd.read_csv(trait_data_path)
    df_meta = pd.read_csv(meta_data_path)
except Exception as e:
    print(f"Error loading files: {e}")
    exit(1)

print("Merging data on 'Env'...")
# Join the dataframes on the 'Env' column
# We use a left join to keep all records from the trait data
merged_df = pd.merge(df_trait, df_meta, on='Env', how='left', suffixes=('', '_meta'))

# The user wants to keep 'GrainYield', 'Latitude', and 'Longitude'
# Based on inspection, these correspond to:
# GrainYield -> Yield_Mg_ha
# Latitude -> Weather_Station_Latitude (in decimal numbers NOT DMS)
# Longitude -> Weather_Station_Longitude (in decimal numbers NOT DMS)

# Renaming columns for clarity as requested
column_mapping = {
    'Yield_Mg_ha': 'GrainYield',
    'Weather_Station_Latitude (in decimal numbers NOT DMS)': 'Latitude',
    'Weather_Station_Longitude (in decimal numbers NOT DMS)': 'Longitude'
}

# Check if columns exist before renaming
for old_col, new_col in column_mapping.items():
    if old_col in merged_df.columns:
        merged_df.rename(columns={old_col: new_col}, inplace=True)
    else:
        print(f"Warning: Column '{old_col}' not found in the merged data.")

# Select only the relevant columns if you want a clean file
# The user said "on the same row", usually implying keep other trait data too, 
# but if they want ONLY these, we can filter. I'll keep all but ensure these are present.
relevant_cols = ['Env', 'GrainYield', 'Latitude', 'Longitude']
# We'll reorder so these are at the front
other_cols = [c for c in merged_df.columns if c not in relevant_cols]
final_df = merged_df[relevant_cols + other_cols]

print(f"Saving to {output_path}...")
final_df.to_csv(output_path, index=False)
print("Merge complete!")
