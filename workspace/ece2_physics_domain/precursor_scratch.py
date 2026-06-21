import os
import pandas as pd
import numpy as np

def test_precursor_logic(processed_data_path):
    """
    ECE 2 Scratch Template: Load processed/merged data and calculate custom precursor scores.
    """
    if not os.path.exists(processed_data_path):
        print(f"Merged CSV not found: {processed_data_path}")
        print("Please run 'make data' first to build the processed/merged dataset.")
        return
        
    df = pd.read_csv(processed_data_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    print(f"Loaded merged data containing {len(df)} rows.")
    print("Columns in data:", df.columns.tolist())
    
    # 1. Compute rolling pre-flare brightening rate (SoLEXS SDD2 counts)
    solexs_col = 'solexs_sdd2_counts'
    if solexs_col in df.columns:
        # Rate of change
        flux_diff = df[solexs_col].diff()
        # Brightening index: rolling sum of positive changes over last 5 minutes
        df['brightening_score'] = (flux_diff > 0.001).rolling(window=5, min_periods=1).sum() / 5.0
        print("\n--> Calculated Soft X-Ray Brightening Precursor:")
        print(df[['timestamp', solexs_col, 'brightening_score']].dropna().head())
        
    # 2. Compute spectral hardening ratio (HEL1OS CZT energy bands)
    czt_high = 'hel1os_czt1_80_to_150_ctr'
    czt_low = 'hel1os_czt1_20_to_40_ctr'
    
    if czt_high in df.columns and czt_low in df.columns:
        # Ratio of high-energy vs low-energy hard X-rays
        df['hardening_ratio'] = df[czt_high] / (df[czt_low] + 1e-5)
        print("\n--> Calculated Hard X-Ray Hardening Ratio Precursor:")
        print(df[['timestamp', czt_low, czt_high, 'hardening_ratio']].dropna().head())
        
    # Save test results locally in this sandbox for verification
    output_test = "workspace/ece2_physics_domain/my_precursors_test.csv"
    df.to_csv(output_test, index=False)
    print(f"\nSaved calculation test results to: {output_test}")

if __name__ == "__main__":
    # Point to the processed unified file
    test_file = "data/processed/merged_data.csv"
    test_precursor_logic(test_file)
