import os
import glob
# pyrefly: ignore [missing-import]
from astropy.io import fits
import pandas as pd
import numpy as np

def inspect_and_load_fits(filepath):
    """
    ECE 1 Scratch Template: Load and inspect a SoLEXS Level-2 compressed FITS file.
    """
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return None
        
    print(f"=== Inspecting FITS: {os.path.basename(filepath)} ===")
    try:
        # astropy.io.fits can open compressed streams directly
        with fits.open(filepath) as hdul:
            # Print table HDU info
            hdul.info()
            
            # Extract header metadata and columns
            header = hdul[1].header
            data = hdul[1].data
            columns = hdul[1].columns.names
            
            print(f"\nHeader: Time System = {header.get('TIMESYS', 'Unknown')}")
            print(f"Columns found: {columns}")
            
            # Resolve COUNTS alias dynamically
            counts_col = 'COUNTS'
            if 'RATE' in columns:
                counts_col = 'RATE'
            elif 'COUNT_RATE' in columns:
                counts_col = 'COUNT_RATE'
                
            # Cast arrays immediately to prevent closed-file lazy mapping issues
            df = pd.DataFrame({
                'time': data['TIME'].astype(float),
                'counts': data[counts_col].astype(float)
            })
            
            print(f"Loaded {len(df)} rows successfully.")
            print(df.head())
            return df
    except Exception as e:
        print(f"Failed to load FITS: {e}")
        return None

if __name__ == "__main__":
    # Test on your local raw data directory
    test_pattern = "data/raw/solexs/**/*.lc.gz"
    files = glob.glob(test_pattern, recursive=True)
    if files:
        inspect_and_load_fits(files[0])
    else:
        print(f"No test files found matching: {test_pattern}")
        print("Please place downloaded PRADAN files in 'data/raw/solexs' to run this scratch script.")
