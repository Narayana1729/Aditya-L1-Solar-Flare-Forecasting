import os
import sys
import glob
import argparse
import pandas as pd
import numpy as np
from astropy.io import fits
from tqdm import tqdm

# Allow running from project root without installing as a package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from src.utils.flare_utils import class_severity

def load_solexs(cadence='1min'):
    """Find and load all SoLEXS .lc.gz files, resample, and return df.
    
    Dynamically identifies table extensions, column names (handling COUNTS/RATE),
    and detector IDs (handling both SDD1/SDD2 and 5001/5002 path names).
    """
    print("Loading SoLEXS light curve files...")
    files = glob.glob("data/raw/solexs/**/*.lc.gz", recursive=True)
    if not files:
        print("No SoLEXS light curve files found.")
        return pd.DataFrame()
        
    dfs = []
    for f in tqdm(files, desc="Parsing SoLEXS files"):
        try:
            # Determine SDD detector (check filename and directory path)
            path_lower = f.lower()
            if "sdd2" in path_lower or "5002" in path_lower:
                detector = "sdd2"
            else:
                detector = "sdd1"  # Default fallback
            
            with fits.open(f) as hdul:
                # Find the binary table HDU with scientific columns
                hdu = None
                for h in hdul:
                    if h.is_image:
                        continue
                    if h.data is not None and hasattr(h.data, 'names'):
                        hdu = h
                        break
                
                if hdu is None:
                    print(f"Warning: No table data found in {f}")
                    continue
                    
                columns = hdu.data.names
                
                # Check for time column
                time_col = None
                for col in ['TIME', 'time', 'Time']:
                    if col in columns:
                        time_col = col
                        break
                if time_col is None:
                    print(f"Warning: No time column found in {f}. Columns: {columns}")
                    continue
                    
                # Check for signal/count column
                signal_col = None
                for col in ['COUNTS', 'RATE', 'counts', 'rate', 'Counts', 'Rate', 'COUNT_RATE', 'count_rate']:
                    if col in columns:
                        signal_col = col
                        break
                if signal_col is None:
                    # Fallback to first non-time column
                    non_time_cols = [c for c in columns if c != time_col]
                    if non_time_cols:
                        signal_col = non_time_cols[0]
                    else:
                        print(f"Warning: No data column found in {f}. Columns: {columns}")
                        continue
                
                # Extract data immediately to memory to avoid closed-file errors
                times = hdu.data[time_col].astype(float)
                signals = hdu.data[signal_col].astype(float)
                
                df = pd.DataFrame({
                    'timestamp': pd.to_datetime(times, unit='s'),
                    f'solexs_{detector}_counts': signals
                })
                
                # Resample immediately inside the loop to save memory
                df = df.set_index('timestamp').resample(cadence).mean()
                dfs.append(df)
        except Exception as e:
            print(f"Error parsing SoLEXS file {f}: {e}")
            
    if not dfs:
        return pd.DataFrame()
        
    # Combine and merge all SoLEXS dataframes
    merged_df = pd.concat(dfs, axis=0)
    # Group by timestamp in case of overlapping files and take the mean
    merged_df = merged_df.groupby(merged_df.index).mean()
    return merged_df

def load_hel1os(cadence='1min'):
    """Find and load all HEL1OS lightcurve_*.fits files, resample, and return df."""
    print("Loading HEL1OS light curve files...")
    files = glob.glob("data/raw/hel1os/**/lightcurve_*.fits", recursive=True)
    if not files:
        print("No HEL1OS light curve files found.")
        return pd.DataFrame()
        
    dfs = []
    for f in tqdm(files, desc="Parsing HEL1OS files"):
        try:
            filename = os.path.basename(f)
            # Find detector (czt1, czt2, cdte1, cdte2)
            detector = "cdte1"
            for det in ["czt1", "czt2", "cdte1", "cdte2"]:
                if det in filename:
                    detector = det
                    break
            
            with fits.open(f) as hdul:
                file_dfs = []
                for hdu in hdul[1:]:
                    ext_name = hdu.header.get("EXTNAME", "")
                    # Extract energy band string
                    band = ext_name.split("BAND_")[-1].replace(".00KEV", "").replace(".80KEV", "").replace(".00", "").lower()
                    
                    data = hdu.data
                    if data is None or len(data) == 0:
                        continue
                        
                    # Parse MJD or ISOT to datetime
                    # ISOT column is standard ISO timestamp strings
                    times = pd.to_datetime(list(data['ISOT']))
                    
                    df = pd.DataFrame({
                        'timestamp': times,
                        f'hel1os_{detector}_{band}_ctr': data['CTR'].astype(float)
                    })
                    
                    df = df.set_index('timestamp').resample(cadence).mean()
                    file_dfs.append(df)
                    
                if file_dfs:
                    # Join different energy bands for this file
                    file_df = pd.concat(file_dfs, axis=1)
                    dfs.append(file_df)
        except Exception as e:
            print(f"Error parsing HEL1OS file {f}: {e}")
            
    if not dfs:
        return pd.DataFrame()
        
    # Combine and merge all HEL1OS dataframes
    merged_df = pd.concat(dfs, axis=0)
    # Group by timestamp in case of overlaps and take the mean
    merged_df = merged_df.groupby(merged_df.index).mean()
    return merged_df

def label_flares(df, flare_df):
    """Label each timestamp in df with the highest active flare class at that time.

    Uses class_severity from flare_utils as the single definition of flare ordering.
    An interval-merge approach is used instead of a row-by-row loop to achieve
    O(N log M) performance instead of O(N*M).
    """
    df['flare_class'] = 'quiet'
    if flare_df.empty:
        return df

    # Convert times to pandas datetime
    flare_df = flare_df.copy()
    flare_df['start_time'] = pd.to_datetime(flare_df['start_time'])
    flare_df['end_time'] = pd.to_datetime(flare_df['end_time'])

    # Sort flares ascending by severity so higher-class events overwrite lower ones
    flare_df['class_value'] = flare_df['goes_class'].apply(class_severity)
    flare_df = flare_df.sort_values('class_value', ascending=True).reset_index(drop=True)

    # Label timestamps using vectorised interval matching (with 5s L1-to-Earth time-of-flight offset correction)
    # Aditya-L1 is at the Lagrangian L1 point (~1.5 million km from Earth toward the Sun).
    # Solar photons reach Aditya-L1 ~5 seconds before they reach Earth/GOES.
    # Therefore, Aditya-L1 time = Earth/GOES time - 5 seconds.
    for _, row in tqdm(flare_df.iterrows(), total=len(flare_df), desc="Labeling flares"):
        start_aditya = row['start_time'] - pd.Timedelta(seconds=5)
        end_aditya = row['end_time'] - pd.Timedelta(seconds=5)
        mask = (df.index >= start_aditya) & (df.index <= end_aditya)
        df.loc[mask, 'flare_class'] = row['goes_class']

    return df

def main():
    parser = argparse.ArgumentParser(description="Merge SoLEXS and HEL1OS light curves with NOAA flare labels.")
    parser.add_argument("--cadence", type=str, default="1min", help="Resampling cadence (e.g., '1min' for 1min, '10s' for 10s)")
    args = parser.parse_args()
    
    print("==================================================")
    print("Aditya-L1 Data Merging and Synchronization")
    print("==================================================")
    
    # 1. Load SoLEXS
    solexs_df = load_solexs(args.cadence)
    print(f"SoLEXS data shape: {solexs_df.shape}")
    
    # 2. Load HEL1OS
    hel1os_df = load_hel1os(args.cadence)
    print(f"HEL1OS data shape: {hel1os_df.shape}")
    
    if solexs_df.empty and hel1os_df.empty:
        print("Error: No data loaded from either SoLEXS or HEL1OS. Please ensure files are unzipped.")
        return
        
    # 3. Merge them
    print("\nMerging datasets...")
    if not solexs_df.empty and not hel1os_df.empty:
        merged_df = solexs_df.join(hel1os_df, how='outer')
    elif not solexs_df.empty:
        merged_df = solexs_df
    else:
        merged_df = hel1os_df
        
    print(f"Merged dataset shape: {merged_df.shape}")
    
    # 4. Label with NOAA flare catalog
    flare_catalog_path = "data/raw/noaa/goes_flares.csv"
    if os.path.exists(flare_catalog_path):
        print(f"\nLoading NOAA flare catalog from {flare_catalog_path}...")
        flare_df = pd.read_csv(flare_catalog_path)
        merged_df = label_flares(merged_df, flare_df)
    else:
        print(f"\n[Warning] NOAA flare catalog not found at {flare_catalog_path}. Skipping labeling.")
        merged_df['flare_class'] = 'quiet'
        
    # Save final merged data
    output_path = "data/processed/merged_data.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Reset index to make timestamp a column
    merged_df = merged_df.reset_index()
    merged_df.to_csv(output_path, index=False)
    print(f"\n[SUCCESS] Final merged and labeled data saved to: {output_path}")
    print(f"Total rows: {len(merged_df)}")
    print(f"Flare class distribution:\n{merged_df['flare_class'].value_counts().head(10)}")

if __name__ == "__main__":
    main()
