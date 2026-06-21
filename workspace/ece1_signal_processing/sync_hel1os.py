import os
import glob
import pandas as pd
import numpy as np
from astropy.io import fits
from tqdm import tqdm
from pathlib import Path

def main():
    print("==============================================")
    print("Starting HEL1OS Timeline Synchronization")
    print("==============================================")
    
    solexs_path = Path("data/processed/solexs_preprocessed.csv")
    if not solexs_path.exists():
        print(f"ERROR: {solexs_path} does not exist. Please run Task 3 first.")
        return
        
    print(f"Loading preprocessed SoLEXS data from {solexs_path}...")
    solexs_df = pd.read_csv(solexs_path)
    solexs_df['timestamp'] = pd.to_datetime(solexs_df['timestamp'])
    solexs_df = solexs_df.set_index('timestamp')
    
    # 1. Locate HEL1OS light curve FITS files
    hel1os_files = glob.glob("data/raw/hel1os/**/lightcurve_*.fits", recursive=True)
    if not hel1os_files:
        print("ERROR: No unzipped HEL1OS lightcurve files found in data/raw/hel1os/")
        return
        
    print(f"Found {len(hel1os_files)} HEL1OS files. Parsing extensions...")
    
    dfs = []
    for f in tqdm(hel1os_files, desc="Processing HEL1OS files"):
        try:
            filename = os.path.basename(f)
            with fits.open(f) as hdul:
                file_dfs = []
                for hdu in hdul[1:]:
                    ext_name = hdu.header.get("EXTNAME", "")
                    if "BAND_" not in ext_name:
                        continue
                        
                    # Determine detector dynamically from EXTNAME, fallback to filename
                    ext_name_lower = ext_name.lower()
                    detector = "cdte1"
                    for det in ["czt1", "czt2", "cdte1", "cdte2"]:
                        if det in ext_name_lower:
                            detector = det
                            break
                    else:
                        for det in ["czt1", "czt2", "cdte1", "cdte2"]:
                            if det in filename.lower():
                                detector = det
                                break
                                
                    # Extract energy band string
                    band = ext_name.split("BAND_")[-1].replace(".00KEV", "").replace(".80KEV", "").replace(".00", "").lower()
                    
                    data = hdu.data
                    if data is None or len(data) == 0:
                        continue
                        
                    # Parse ISOT to datetime
                    times = pd.to_datetime(list(data['ISOT']))
                    rates = data['CTR'].astype(float)
                    
                    df = pd.DataFrame({
                        'timestamp': times,
                        f'hel1os_{detector}_{band}_ctr': rates
                    })
                    
                    df = df.set_index('timestamp').resample('1min').mean()
                    file_dfs.append(df)
                    
                if file_dfs:
                    # Merge all energy bands for this file
                    file_df = pd.concat(file_dfs, axis=1)
                    dfs.append(file_df)
        except Exception as e:
            print(f"Error parsing HEL1OS file {f}: {e}")
            
    if not dfs:
        print("ERROR: No HEL1OS data columns were successfully extracted.")
        return
        
    # Combine and merge HEL1OS
    print("Combining parsed HEL1OS dataframes...")
    hel1os_df = pd.concat(dfs, axis=0)
    hel1os_df = hel1os_df.groupby(hel1os_df.index).mean()
    
    # 2. Merge with SoLEXS
    print("Merging HEL1OS with SoLEXS timeline...")
    merged_df = solexs_df.join(hel1os_df, how='outer')
    
    # 3. Resolve alignment: sort index and forward-fill gaps (avoiding look-ahead bias)
    merged_df = merged_df.sort_index()
    
    # Fill gaps
    pre_fill_nans = merged_df.isna().sum().sum()
    merged_df = merged_df.ffill()
    
    # Drop rows with remaining NaNs (typically at the start where no data exists yet)
    pre_drop_len = len(merged_df)
    merged_df = merged_df.dropna()
    post_drop_len = len(merged_df)
    
    print(f"Temporal Alignment: NaNs filled: {pre_fill_nans}")
    print(f"Dropped {pre_drop_len - post_drop_len} rows at the beginning of the merged timeline due to lack of historical state.")
    
    # 4. Save aligned dataset
    output_path = Path("data/processed/aditya_aligned.csv")
    final_df = merged_df.reset_index()
    final_df.to_csv(output_path, index=False)
    
    # 5. Print verification details
    print("\n==============================================")
    print("HEL1OS Alignment Verification")
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
