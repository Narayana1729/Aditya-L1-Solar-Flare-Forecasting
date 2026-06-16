import os
import argparse
import pandas as pd
from datetime import datetime
from sunpy.net import Fido
from sunpy.net import attrs as a
from sunpy import timeseries as ts

def create_dirs():
    """Create raw data directories for NOAA GOES data."""
    os.makedirs("data/raw/noaa/goes_flux", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)

def download_goes_flares(start_time, end_time, min_class="C1.0"):
    """
    Download GOES solar flare events catalog from HEK (Heliophysics Event Knowledgebase).
    """
    print(f"Searching NOAA GOES flare catalog from {start_time} to {end_time}...")
    
    # Query HEK for flares
    query = Fido.search(
        a.Time(start_time, end_time),
        a.hek.EventType("FL"),
        a.hek.OBS.Observatory == "GOES"
    )
    
    if not query or "hek" not in query.keys() or len(query["hek"]) == 0:
        print("No flare events found in the given time range.")
        return pd.DataFrame()
        
    hek_table = query["hek"]
    # Filter out multidimensional columns that astropy cannot convert to pandas
    flat_cols = [col for col in hek_table.colnames if len(hek_table[col].shape) <= 1]
    df = hek_table[flat_cols].to_pandas()
    
    # Select key columns for our flare catalog
    columns_to_keep = [
        'event_starttime', 'event_peaktime', 'event_endtime', 
        'fl_goescls', 'ar_noaanum', 'event_type', 'obs_observatory'
    ]
    
    # Filter columns if they exist
    existing_columns = [col for col in columns_to_keep if col in df.columns]
    df_filtered = df[existing_columns].copy()
    
    # Rename columns for convenience
    df_filtered = df_filtered.rename(columns={
        'event_starttime': 'start_time',
        'event_peaktime': 'peak_time',
        'event_endtime': 'end_time',
        'fl_goescls': 'goes_class',
        'ar_noaanum': 'noaa_active_region'
    })
    
    # Filter by minimum class if requested
    if 'goes_class' in df_filtered.columns and min_class:
        # Simple string comparison can work or we can keep all and filter during analysis
        print(f"Total flares found: {len(df_filtered)}")
        
    # Save to CSV
    output_path = "data/raw/noaa/goes_flares.csv"
    df_filtered.to_csv(output_path, index=False)
    print(f"Saved flare catalog to {output_path}")
    return df_filtered

def download_goes_flux(start_time, end_time):
    """
    Download GOES X-ray flux (XRS) NetCDF/FITS data files via SunPy Fido.
    """
    print(f"Searching GOES X-ray flux files from {start_time} to {end_time}...")
    
    # Search for GOES XRS data
    query = Fido.search(
        a.Time(start_time, end_time),
        a.Instrument("XRS")
    )
    
    if not query or len(query) == 0:
        print("No GOES X-ray flux data files found.")
        return []
        
    print(f"Found {len(query)} file sets. Starting download...")
    
    # Download files to data/raw/noaa/goes_flux/
    downloaded_files = Fido.fetch(query, path="data/raw/noaa/goes_flux/")
    print(f"Downloaded files: {downloaded_files}")
    return downloaded_files

def process_goes_flux_files(downloaded_files):
    """
    Load downloaded GOES flux files, parse into a single dataframe, and save as CSV.
    """
    if not downloaded_files:
        print("No files to process.")
        return
        
    print("Processing downloaded GOES flux files...")
    try:
        # Load and concatenate time series
        goes_ts = ts.TimeSeries(downloaded_files, concat=True)
        df = goes_ts.to_pandas()
        
        # Reset index to make timestamp a column
        df = df.reset_index()
        df = df.rename(columns={'index': 'timestamp'})
        
        # GOES columns: xrsa_flux (0.5-4 A, short channel), xrsb_flux (1-8 A, long channel)
        # Check available columns
        print(f"Available columns in GOES flux: {list(df.columns)}")
        
        # Save processed flux
        output_path = "data/raw/noaa/goes_flux_processed.csv"
        df.to_csv(output_path, index=False)
        print(f"Successfully processed and saved GOES flux to {output_path}")
        
    except Exception as e:
        print(f"Error processing GOES flux files: {e}")
        print("You can manually inspect files in data/raw/noaa/goes_flux/")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download GOES X-ray flux and flare events via SunPy.")
    parser.add_argument("--start", type=str, default="2024-07-01 00:00:00", help="Start time (YYYY-MM-DD HH:MM:SS)")
    parser.add_argument("--end", type=str, default="2024-07-15 00:00:00", help="End time (YYYY-MM-DD HH:MM:SS)")
    parser.add_argument("--flares_only", action="store_true", help="Download flare catalog only")
    parser.add_argument("--flux_only", action="store_true", help="Download flux files only")
    
    args = parser.parse_args()
    
    create_dirs()
    
    if not args.flux_only:
        download_goes_flares(args.start, args.end)
        
    if not args.flares_only:
        files = download_goes_flux(args.start, args.end)
        process_goes_flux_files(files)
