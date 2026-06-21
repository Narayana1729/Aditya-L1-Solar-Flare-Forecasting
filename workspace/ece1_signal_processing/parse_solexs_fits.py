import os
import glob
import pandas as pd
import numpy as np
from astropy.io import fits

def main():
    print("==============================================")
    print("Starting SoLEXS FITS/CDF Data Parser")
    print("==============================================")
    
    # Locate first raw SoLEXS file
    solexs_files = sorted(glob.glob("data/raw/solexs/**/*.lc.gz", recursive=True))
    if not solexs_files:
        print("ERROR: No unzipped SoLEXS .lc.gz files found in data/raw/solexs/")
        print("Please ensure Task 1 completed and files are present.")
        return
        
    first_file = solexs_files[0]
    print(f"Loading first SoLEXS file: {first_file}")
    
    # 1. Open FITS file using astropy
    try:
        with fits.open(first_file) as hdul:
            print("\n--- FITS HDU List Info ---")
            hdul.info()
            
            # Find the binary table HDU with science data
            hdu = None
            for h in hdul:
                if not h.is_image and h.data is not None and hasattr(h.data, 'names'):
                    hdu = h
                    break
                    
            if hdu is None:
                print("Error: No binary table extension with data found in FITS file.")
                return
                
            print(f"\nSelected HDU: {hdu.name}")
            print("\n--- Extension Header Metadata ---")
            # Extract header parameters
            header = hdu.header
            observer = header.get("OBSERVER", "N/A")
            instrument = header.get("INSTRUME", "N/A")
            detector = header.get("DETECTOR", "N/A")
            target = header.get("OBJECT", "N/A")
            date_obs = header.get("DATE-OBS", "N/A")
            date_end = header.get("DATE-END", "N/A")
            
            print(f"Observer: {observer}")
            print(f"Instrument: {instrument}")
            print(f"Detector: {detector}")
            print(f"Target: {target}")
            print(f"Start Time (DATE-OBS): {date_obs}")
            print(f"End Time (DATE-END): {date_end}")
            
            columns = hdu.data.names
            print("\nAvailable columns:", columns)
            
            # Time column mapping
            time_col = None
            for col in ['TIME', 'time', 'Time']:
                if col in columns:
                    time_col = col
                    break
            if time_col is None:
                print(f"Error: Time column not found in columns: {columns}")
                return
                
            # Counts column mapping
            counts_col = None
            for col in ['COUNTS', 'RATE', 'counts', 'rate', 'Counts', 'Rate']:
                if col in columns:
                    counts_col = col
                    break
            if counts_col is None:
                # Fallback to first non-time column
                non_time_cols = [c for c in columns if c != time_col]
                if non_time_cols:
                    counts_col = non_time_cols[0]
                else:
                    print("Error: No data counts column found.")
                    return
            
            print(f"Using time column: '{time_col}', count column: '{counts_col}'")
            
            # IMPORTANT: Avoid Astropy Closed-File Reference Bug by casting array data to memory immediately
            # inside the open fits context.
            times = hdu.data[time_col].astype(float)
            counts = hdu.data[counts_col].astype(float)
            
        print("\nClosed FITS file context successfully.")
        
        # 2. Convert times to pandas DatetimeIndex (seconds since epoch)
        # Check standard Aditya-L1 epoch (seconds since 2020-01-01 or Unix epoch)
        # Let's inspect the first time value
        print(f"First raw time stamp value: {times[0]} seconds")
        
        # If timestamp is around 1.4e9 it is Unix time, if around 1.4e8 it is seconds since 2020-01-01
        # In merge_data.py, it uses: pd.to_datetime(times, unit='s')
        # Let's check how the converted timestamp looks:
        timestamps = pd.to_datetime(times, unit='s')
        print(f"Converted timestamp preview: {timestamps[0]} to {timestamps[-1]}")
        
        # Create DataFrame
        df = pd.DataFrame({
            'timestamp': timestamps,
            'solexs_counts': counts
        })
        
        print("\n--- Parsed Dataframe ---")
        print(f"DataFrame shape: {df.shape}")
        print("Head:")
        print(df.head())
        print("Tail:")
        print(df.tail())
        
        # 3. Save metadata and preview report to fits_parsing_preview.txt
        preview_path = "workspace/ece1_signal_processing/fits_parsing_preview.txt"
        with open(preview_path, "w") as pf:
            pf.write("FITS PARSING PREVIEW REPORT\n")
            pf.write("===========================\n\n")
            pf.write(f"File analyzed: {first_file}\n")
            pf.write(f"Observer: {observer}\n")
            pf.write(f"Instrument: {instrument}\n")
            pf.write(f"Detector: {detector}\n")
            pf.write(f"Target: {target}\n")
            pf.write(f"Date Observed: {date_obs}\n")
            pf.write(f"Date Ended: {date_end}\n")
            pf.write(f"Science HDU name: {hdu.name}\n")
            pf.write(f"Time column used: {time_col}\n")
            pf.write(f"Counts column used: {counts_col}\n\n")
            pf.write("First 10 rows of parsed DataFrame:\n")
            pf.write(df.head(10).to_string(index=False))
            pf.write("\n")
            
        print(f"\n[SUCCESS] Wrote parsing preview report to {preview_path}")
        
    except Exception as e:
        print(f"Error parsing FITS file: {e}")

if __name__ == "__main__":
    main()
