import os
import glob
import pandas as pd
import numpy as np
from astropy.io import fits
from tqdm import tqdm
from pathlib import Path

def main():
    print("==============================================")
    print("Starting SoLEXS Data Preprocessing & Calibration")
    print("==============================================")
    
    # 1. Locate all SoLEXS .lc.gz files
    solexs_files = glob.glob("data/raw/solexs/**/*.lc.gz", recursive=True)
    if not solexs_files:
        print("ERROR: No unzipped SoLEXS files found in data/raw/solexs/")
        return
        
    print(f"Found {len(solexs_files)} SoLEXS data files. Loading and parsing...")
    
    dfs = []
    for f in tqdm(solexs_files, desc="Processing FITS files"):
        try:
            # Determine SDD detector (sdd1 or sdd2)
            path_lower = f.lower()
            if "sdd2" in path_lower or "5002" in path_lower:
                detector = "sdd2"
            else:
                detector = "sdd1"
                
            with fits.open(f) as hdul:
                # Find the binary table HDU
                hdu = None
                for h in hdul:
                    if not h.is_image and h.data is not None and hasattr(h.data, 'names'):
                        hdu = h
                        break
                if hdu is None:
                    continue
                    
                columns = hdu.data.names
                
                # Check for time and count columns
                time_col = None
                for col in ['TIME', 'time', 'Time']:
                    if col in columns:
                        time_col = col
                        break
                if time_col is None:
                    continue
                    
                counts_col = None
                for col in ['COUNTS', 'RATE', 'counts', 'rate', 'Counts', 'Rate']:
                    if col in columns:
                        counts_col = col
                        break
                if counts_col is None:
                    non_time_cols = [c for c in columns if c != time_col]
                    if non_time_cols:
                        counts_col = non_time_cols[0]
                    else:
                        continue
                
                # Extract data immediately to memory to avoid closed-file errors
                times = hdu.data[time_col].astype(float)
                signals = hdu.data[counts_col].astype(float)
                
                df = pd.DataFrame({
                    'timestamp': pd.to_datetime(times, unit='s'),
                    f'solexs_{detector}_counts': signals
                })
                
                # Resample inside the loop to minimize memory consumption
                df = df.set_index('timestamp').resample('1min').mean()
                dfs.append(df)
        except Exception as e:
            # Skip corrupted files gracefully
            continue
            
    if not dfs:
        print("ERROR: No files were successfully parsed.")
        return
        
    # 2. Combine and aggregate
    print("Combining parsed datasets...")
    merged_df = pd.concat(dfs, axis=0)
    # Average overlapping timestamps
    merged_df = merged_df.groupby(merged_df.index).mean()
    
    # 3. Sort and Resample to a strict 1-minute cadence
    merged_df = merged_df.sort_index()
    # Resample index to make it contiguous
    original_len = len(merged_df)
    merged_df = merged_df.resample('1min').mean()
    
    # Report row gaps
    nans_before_fill = merged_df.isna().sum()
    
    # 4. Handle Gaps and NaNs
    # Forward-fill gaps to avoid temporal look-ahead bias, then drop any remaining NaNs
    merged_df = merged_df.ffill()
    
    # Calculate how many rows were dropped
    pre_drop_len = len(merged_df)
    merged_df = merged_df.dropna()
    post_drop_len = len(merged_df)
    
    print(f"Cadence Resampling: Original rows: {original_len}, Contiguous rows (pre-fill): {pre_drop_len}, Final rows (post-drop): {post_drop_len}")
    print(f"Dropped {pre_drop_len - post_drop_len} rows with NaNs at the beginning of the timeline.")
    
    # 5. Background Subtraction
    # Compute rolling 5th percentile baseline over a 6-hour (360-minute) window
    print("Computing rolling background baseline (6-hour window, 5th percentile)...")
    for col in merged_df.columns:
        if col.startswith("solexs_sdd") and col.endswith("_counts"):
            base_col = col.replace("_counts", "_baseline")
            clean_col = col.replace("_counts", "_counts_clean")
            
            merged_df[base_col] = merged_df[col].rolling(window=360, min_periods=1).quantile(0.05)
            # Subtract baseline from raw flux
            merged_df[clean_col] = merged_df[col] - merged_df[base_col]
            
            # 6. Normalization
            # Add z-score normalized columns for raw and clean flux
            raw_mean = merged_df[col].mean()
            raw_std = merged_df[col].std()
            clean_mean = merged_df[clean_col].mean()
            clean_std = merged_df[clean_col].std()
            
            merged_df[col + "_zscore"] = (merged_df[col] - raw_mean) / (raw_std + 1e-8)
            merged_df[clean_col + "_zscore"] = (merged_df[clean_col] - clean_mean) / (clean_std + 1e-8)
            
    # 7. Save the processed dataset
    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "solexs_preprocessed.csv"
    
    # Reset index to write timestamp as column
    final_df = merged_df.reset_index()
    final_df.to_csv(output_path, index=False)
    
    # 8. Print verification details
    print("\n==============================================")
    print("SoLEXS Preprocessing Verification")
    print("==============================================")
    print(f"Output saved to: {output_path}")
    print(f"Dataframe shape: {final_df.shape}")
    print(f"Date range: {final_df['timestamp'].min()} to {final_df['timestamp'].max()}")
    print(f"Columns: {list(final_df.columns)}")
    print("\nHead:")
    print(final_df.head(5))
    print("\nTail:")
    print(final_df.tail(5))
    print("\nNaN count check:")
    print(final_df.isna().sum())

if __name__ == "__main__":
    main()
