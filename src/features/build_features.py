import os
import pandas as pd
import numpy as np
from tqdm import tqdm

def main():
    print("==================================================")
    print("Aditya-L1 Solar Flare Feature Engineering Pipeline")
    print("==================================================")
    
    input_path = "data/processed/merged_data.csv"
    if not os.path.exists(input_path):
        print(f"Error: Merged dataset not found at {input_path}. Please run merge_data.py first.")
        return
        
    print(f"Loading merged dataset from {input_path}...")
    df = pd.read_csv(input_path)
    print(f"Shape: {df.shape}")
    
    # Ensure timestamp is datetime and set as index for rolling/lag features
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    df = df.set_index('timestamp')
    
    # Normalise flare_class: fill NaNs so downstream str operations are safe
    df['flare_class'] = df['flare_class'].fillna('quiet').astype(str)
    
    # Drop columns that are mostly NaN (e.g., > 50% missing values) to prevent dropna() from wiping out the dataset
    nan_threshold = len(df) * 0.5
    mostly_nan_cols = [col for col in df.columns if df[col].isna().sum() > nan_threshold]
    if mostly_nan_cols:
        print(f"\nDropping columns with >50% NaN values: {mostly_nan_cols}")
        df = df.drop(columns=mostly_nan_cols)
        
    # Identify numeric columns (excluding flare_class)
    numeric_cols = [
        col for col in df.columns
        if col != 'flare_class' and pd.api.types.is_numeric_dtype(df[col])
    ]
    print(f"\nFound {len(numeric_cols)} numeric instrument columns to process:")
    for col in numeric_cols[:10]:
        print(f"  - {col}")
    if len(numeric_cols) > 10:
        print(f"  - ... and {len(numeric_cols) - 10} more.")
        
    # 1. Log10-transform the flux/counts (mandatory to handle multiple orders of magnitude)
    print("\nApplying Log10 transformations...")
    log_cols = []
    for col in numeric_cols:
        log_col = f"log_{col}"
        # Use log10(x + 1) to handle zeros safely
        df[log_col] = np.log10(df[col] + 1.0)
        log_cols.append(log_col)
        
    # 2. Engineer Lag Features (t-1, t-3, t-5, t-10, t-30 minutes)
    print("\nGenerating lag features...")
    lag_intervals = [1, 3, 5, 10, 30]
    for interval in tqdm(lag_intervals, desc="Lag features"):
        for col in log_cols:
            df[f"{col}_lag_{interval}m"] = df[col].shift(interval)
            
    # 3. Rolling Statistics (3-min and 10-min means and standard deviations)
    print("\nGenerating rolling statistics...")
    windows = [3, 10]
    for w in tqdm(windows, desc="Rolling statistics"):
        for col in log_cols:
            df[f"{col}_roll_mean_{w}m"] = df[col].rolling(window=w, min_periods=1).mean()
            df[f"{col}_roll_std_{w}m"] = df[col].rolling(window=w, min_periods=1).std().fillna(0.0)
            
    # Defragment DataFrame to improve operations performance
    df = df.copy()

    # 4. Handle NaNs introduced by shift/lag features.
    #
    # FIX (was bfill): bfill fills early lag-NaN rows with *future* values,
    # introducing look-ahead bias into the first max(lag_intervals)=30 rows.
    # ffill is safe because it only propagates past-observed values forward.
    # After ffill, the very first rows (before any valid observation) are
    # dropped with dropna() to remove any residual boundary NaNs.
    print("\nHandling missing values (forward-fill, then drop leading NaNs)...")
    df = df.ffill()
    rows_before = len(df)
    df = df.dropna()
    rows_dropped = rows_before - len(df)
    if rows_dropped > 0:
        print(f"  Dropped {rows_dropped} leading rows with no valid prior observation.")
    
    # Save feature matrix
    output_path = "data/processed/features.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print("\nSaving feature matrix...")
    df = df.reset_index()
    df.to_csv(output_path, index=False)
    print(f"[SUCCESS] Feature matrix saved to: {output_path}")
    print(f"Final shape: {df.shape}")

if __name__ == "__main__":
    main()
