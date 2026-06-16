import os
import glob
import argparse
import pandas as pd
import numpy as np
from astropy.io import fits
from tqdm import tqdm

def load_solexs(cadence='1min'):
    """Find and load all SoLEXS .lc.gz files, resample, and return df."""
    print("Loading SoLEXS light curve files...")
    files = glob.glob("data/raw/solexs/**/*.lc.gz", recursive=True)
    if not files:
        print("No SoLEXS light curve files found.")
        return pd.DataFrame()
        
    dfs = []
    for f in tqdm(files, desc="Parsing SoLEXS files"):
        try:
            # Determine SDD detector from filename
            filename = os.path.basename(f)
            detector = "sdd2" if "SDD2" in filename else "sdd1"
            
            with fits.open(f) as hdul:
                rate_data = hdul[1].data
                df = pd.DataFrame({
                    'timestamp': pd.to_datetime(rate_data['TIME'].astype(float), unit='s'),
                    f'solexs_{detector}_counts': rate_data['COUNTS'].astype(float)
                })
                
                # Resample immediately to save memory
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
    """Label each timestamp in df with the highest active flare class at that time."""
    df['flare_class'] = 'quiet'
    if flare_df.empty:
        return df
        
    # Convert times to pandas datetime
    flare_df['start_time'] = pd.to_datetime(flare_df['start_time'])
    flare_df['end_time'] = pd.to_datetime(flare_df['end_time'])
    
    # Sort flares by class intensity (so that higher class overwrites lower class in case of overlap)
    def class_value(c):
        if not isinstance(c, str) or len(c) < 2:
            return 0
        letter = c[0].upper()
        try:
            num = float(c[1:])
        except ValueError:
            num = 0.0
        mapping = {'B': 10, 'C': 100, 'M': 1000, 'X': 10000}
        return mapping.get(letter, 0) * num
        
    flare_df['class_value'] = flare_df['goes_class'].apply(class_value)
    flare_df = flare_df.sort_values('class_value', ascending=True)
    
    # Label timestamps
    df_times = df.index.to_series()
    for _, row in tqdm(flare_df.iterrows(), total=len(flare_df), desc="Labeling flares"):
        mask = (df_times >= row['start_time']) & (df_times <= row['end_time'])
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
