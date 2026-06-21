import os
import glob
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from tqdm import tqdm
from sunpy import timeseries as ts

def main():
    print("==============================================")
    print("GOES XRS Flux Processing & Calibration (E2)")
    print("==============================================")

    raw_dir = "./goes_data/raw_flux/"
    processed_dir = "./goes_data/processed/"
    os.makedirs(processed_dir, exist_ok=True)
    
    # 1. Locate all avg1m files
    files = glob.glob(os.path.join(raw_dir, "*avg1m*.nc"))
    if not files:
        print("ERROR: No raw GOES average flux NetCDF files found.")
        return
        
    print(f"Found {len(files)} avg1m files. Loading data...")
    
    dfs = []
    total_raw_rows = 0
    
    # Load each file sequentially (which is very fast)
    for f in tqdm(sorted(files), desc="Loading NC files"):
        try:
            goes_ts = ts.TimeSeries(f)
            df = goes_ts.to_dataframe()
            total_raw_rows += len(df)
            dfs.append(df)
        except Exception as e:
            print(f"Error loading {f}: {e}")
            
    if not dfs:
        print("ERROR: Could not load any datasets.")
        return
        
    print("Concatenating datasets...")
    full_df = pd.concat(dfs, axis=0)
    # Remove any duplicate timestamps by taking the mean
    full_df = full_df.groupby(full_df.index).mean()
    
    # 2. Quality handling
    print("\nHandling data quality...")
    initial_len = len(full_df)
    
    # Check columns
    print("Raw columns:", list(full_df.columns))
    
    # Filter rules:
    # - xrsa, xrsb must be non-null and > 0
    # - quality flags must be 0
    quality_cols = [c for c in full_df.columns if 'quality' in c]
    
    mask = (full_df['xrsa'] > 0) & (full_df['xrsb'] > 0)
    for qc in quality_cols:
        mask = mask & (full_df[qc] == 0)
        
    clean_df = full_df[mask].copy()
    dropped_count = initial_len - len(clean_df)
    dropped_pct = (dropped_count / initial_len) * 100
    print(f"Quality check completed:")
    print(f"  Initial rows: {initial_len}")
    print(f"  Cleaned rows: {len(clean_df)}")
    print(f"  Dropped: {dropped_count} rows ({dropped_pct:.3f}%)")

    # 3. Resample to a consistent 1-minute cadence
    print("\nResampling to contiguous 1-minute cadence...")
    # Resample index to make it contiguous
    clean_df = clean_df.sort_index()
    resampled_df = clean_df.resample('1min').mean()
    
    # Fill gaps using forward fill (avoids look-ahead bias)
    resampled_df = resampled_df.ffill()
    # Drop any remaining NaNs at the very start
    resampled_df = resampled_df.dropna()
    print(f"Final resampled rows: {len(resampled_df)}")

    # 4. Rolling background baseline (5th percentile over 6 hours / 360 mins)
    print("\nComputing rolling background baselines...")
    resampled_df['flux_short_baseline'] = resampled_df['xrsa'].rolling(window=360, min_periods=1).quantile(0.05)
    resampled_df['flux_long_baseline'] = resampled_df['xrsb'].rolling(window=360, min_periods=1).quantile(0.05)
    
    # 5. Normalization
    print("Normalizing flux channels...")
    resampled_df['flux_short_zscore'] = (resampled_df['xrsa'] - resampled_df['xrsa'].mean()) / (resampled_df['xrsa'].std() + 1e-12)
    resampled_df['flux_long_zscore'] = (resampled_df['xrsb'] - resampled_df['xrsb'].mean()) / (resampled_df['xrsb'].std() + 1e-12)

    # Rename columns to final names
    resampled_df = resampled_df.rename(columns={
        'xrsa': 'flux_short_raw',
        'xrsb': 'flux_long_raw'
    })
    
    final_cols = ['flux_short_raw', 'flux_long_raw', 'flux_short_baseline', 'flux_long_baseline', 'flux_short_zscore', 'flux_long_zscore']
    final_df = resampled_df[final_cols].copy()
    
    # Save the unified dataset
    unified_path = os.path.join(processed_dir, "goes_unified.csv")
    final_df_reset = final_df.reset_index().rename(columns={'index': 'timestamp'})
    final_df_reset.to_csv(unified_path, index=False)
    print(f"\n[SUCCESS] Unified dataset saved to: {unified_path}")
    print(f"Shape: {final_df_reset.shape}")
    print(f"Date range: {final_df_reset['timestamp'].min()} to {final_df_reset['timestamp'].max()}")

    # 6. Plot raw long-channel flux for a 7-day window containing a flare
    print("\nGenerating sample validation plot...")
    plot_path = os.path.join(processed_dir, "sample_plot.png")
    
    # Let's check for a window around 2026-02-25 (where we know the M2.3 flare is)
    # Or find any active period with values in our dataset
    # We will look for dates between 2026-02-20 and 2026-02-27
    start_plot = pd.to_datetime("2026-02-20 00:00:00")
    end_plot = pd.to_datetime("2026-02-27 00:00:00")
    
    plot_df = final_df.loc[start_plot:end_plot]
    
    if len(plot_df) == 0:
        # Fallback to the first 7 days if the target window is missing
        print("Target window around 2026-02-25 is empty. Falling back to first 7 days.")
        start_plot = final_df.index.min()
        end_plot = start_plot + pd.Timedelta(days=7)
        plot_df = final_df.loc[start_plot:end_plot]
        
    plt.figure(figsize=(12, 6))
    plt.plot(plot_df.index, plot_df['flux_long_raw'], label='Long Channel (0.1-0.8 nm)', color='red', alpha=0.8)
    plt.plot(plot_df.index, plot_df['flux_long_baseline'], label='Long Channel Baseline', color='black', linestyle='--', alpha=0.7)
    plt.yscale('log')
    plt.xlabel('Timestamp')
    plt.ylabel('X-ray Flux (W / m^2)')
    plt.title(f'GOES Long Channel X-ray Flux & Baseline ({start_plot.strftime("%Y-%m-%d")} to {end_plot.strftime("%Y-%m-%d")})')
    plt.grid(True, which="both", ls="--")
    plt.legend()
    
    plt.tight_layout()
    plt.savefig(plot_path, dpi=150)
    plt.close()
    print(f"Validation plot saved to: {plot_path}")

if __name__ == "__main__":
    main()
