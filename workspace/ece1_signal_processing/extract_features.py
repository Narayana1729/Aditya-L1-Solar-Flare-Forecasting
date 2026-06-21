import os
import pandas as pd
import numpy as np
from pathlib import Path
from tqdm import tqdm

def main():
    print("==============================================")
    print("Starting Aditya-L1 Feature Extraction")
    print("==============================================")
    
    labeled_path = Path("data/processed/aditya_labeled.csv")
    if not labeled_path.exists():
        print(f"ERROR: {labeled_path} does not exist. Please run Task 5 first.")
        return
        
    print(f"Loading labeled timeline from {labeled_path}...")
    df = pd.read_csv(labeled_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.set_index('timestamp')
    
    # 1. Compute temporal derivatives (first-order difference) for all numerical flux channels
    print("Computing first-order temporal derivatives...")
    flux_cols = [c for c in df.columns if c not in ['flare_class', 'is_flare', 'solexs_sdd2_baseline']]
    
    for col in tqdm(flux_cols, desc="Derivatives"):
        df[col + '_diff'] = df[col].diff()
        
    # 2. Compute spectral index / hardening ratios
    print("Computing physical hardening ratios and channel ratios...")
    # SoLEXS soft X-ray clean vs CZT1 hard X-ray low energy counts
    df['ratio_solexs_czt1_low'] = df['solexs_sdd2_counts_clean'] / (df['hel1os_czt1_20_to_40_ctr'] + 1e-5)
    
    # CZT1 spectral hardening ratio (high energy vs low energy CZT channels)
    df['ratio_czt1_high_low'] = df['hel1os_czt1_80_to_150_ctr'] / (df['hel1os_czt1_20_to_40_ctr'] + 1e-5)
    
    # CZT2 spectral hardening ratio
    df['ratio_czt2_high_low'] = df['hel1os_czt2_80_to_150_ctr'] / (df['hel1os_czt2_20_to_40_ctr'] + 1e-5)
    
    # CdTe1 ratio (high energy cdte vs low energy cdte channels)
    df['ratio_cdte1_high_low'] = df['hel1os_cdte1_40_to_60_ctr'] / (df['hel1os_cdte1_5_to_20_ctr'] + 1e-5)
    
    # CdTe2 ratio
    df['ratio_cdte2_high_low'] = df['hel1os_cdte2_40_to_60_ctr'] / (df['hel1os_cdte2_5_to_20_ctr'] + 1e-5)
    
    # 3. Compute rolling statistics (mean, std, max, min) for key channels over windows of 10, 30, and 60 minutes
    print("Computing rolling window statistics...")
    key_channels = ['solexs_sdd2_counts_clean', 'hel1os_czt1_20_to_40_ctr']
    windows = [10, 30, 60]
    
    for col in tqdm(key_channels, desc="Rolling Stats"):
        for w in windows:
            df[f'{col}_roll_mean_{w}m'] = df[col].rolling(window=w, min_periods=1).mean()
            df[f'{col}_roll_std_{w}m'] = df[col].rolling(window=w, min_periods=1).std()
            df[f'{col}_roll_max_{w}m'] = df[col].rolling(window=w, min_periods=1).max()
            df[f'{col}_roll_min_{w}m'] = df[col].rolling(window=w, min_periods=1).min()
            
    # 4. Compute rise-time/decay-time precursors (rolling accumulation of positive differences)
    print("Computing pre-flare brightening markers...")
    # Positive changes
    pos_diff_solexs = df['solexs_sdd2_counts_clean_diff'].clip(lower=0.0)
    pos_diff_hel1os = df['hel1os_czt1_20_to_40_ctr_diff'].clip(lower=0.0)
    
    df['brightening_index_solexs_10m'] = pos_diff_solexs.rolling(window=10, min_periods=1).sum()
    df['brightening_index_hel1os_10m'] = pos_diff_hel1os.rolling(window=10, min_periods=1).sum()
    
    # 5. Handle any NaNs introduced by differences or rolling windows
    # Forward-fill first, then fill remaining at the start with 0
    df = df.ffill().fillna(0.0)
    
    # 6. Save the final features dataset
    output_path = Path("data/processed/aditya_features.csv")
    final_df = df.reset_index()
    final_df.to_csv(output_path, index=False)
    
    # 7. Print verification details
    print("\n==============================================")
    print("Feature Extraction Verification")
    print("==============================================")
    print(f"Output saved to: {output_path}")
    print(f"Dataframe shape: {final_df.shape}")
    print(f"Total columns count: {len(final_df.columns)}")
    print(f"Total row count: {len(final_df)}")
    
    # Print some column names as preview
    new_cols = [c for c in final_df.columns if c not in df.columns]
    print(f"Sample of engineered columns ({len(final_df.columns) - 28} total):")
    print(list(final_df.columns[28:48]))
    
    # Check that there are no NaNs in the final dataset
    nans_count = final_df.isna().sum().sum()
    print(f"\nTotal NaNs in features dataset: {nans_count}")
    
    # Print description stats for the brightening precursor index
    print("\nPrecursor Brightening Index Stats:")
    print(final_df[['brightening_index_solexs_10m', 'brightening_index_hel1os_10m']].describe())

if __name__ == "__main__":
    main()
