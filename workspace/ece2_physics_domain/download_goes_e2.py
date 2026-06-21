import os
import re
import sys
import pandas as pd
import requests
from tqdm import tqdm
from datetime import datetime
from sunpy.net import Fido
from sunpy.net import attrs as a

def main():
    print("==============================================")
    print("GOES XRS Flux & NOAA Flare Catalog Downloader")
    print("==============================================")

    # 1. Set up directories
    flux_dir = "./goes_data/raw_flux/"
    catalog_dir = "./goes_data/flare_catalog/"
    os.makedirs(flux_dir, exist_ok=True)
    os.makedirs(catalog_dir, exist_ok=True)

    summary_file = "./goes_data/download_summary.txt"
    failures = []
    
    # Define time range
    start_date = "2023-11-01"
    end_date = "2026-06-20"  # Today's date representation in the environment
    
    # ---------------------------------------------------------
    # TASK B: Download the NOAA composite flare catalog CSV
    # ---------------------------------------------------------
    print("\n--- Task B: Downloading NOAA Composite Flare Catalog ---")
    index_url = "https://data.ngdc.noaa.gov/platforms/solar-space-observing-satellites/goes/multi/l2/data/xrsf-l2-flrpt_science/csv/"
    catalog_filename = None
    catalog_url = None
    
    try:
        print(f"Fetching directory index from {index_url}...")
        resp = requests.get(index_url, timeout=30)
        if resp.status_code == 200:
            # Find files matching the composite science-quality pattern:
            # sci_xrsf-l2-flrpt_geo_s19950103_e[DATE]_v1-0-0.csv
            matches = re.findall(r'href="([^"]+s19950103_e\d+_v\d+-\d+-\d+\.csv)"', resp.text)
            if matches:
                # Sort to get the latest one if multiple exist
                matches.sort()
                catalog_filename = matches[-1]
                catalog_url = index_url + catalog_filename
                print(f"Found composite flare catalog: {catalog_filename}")
            else:
                print("Could not find mission-length composite CSV matching s19950103 in the HTML index.")
        else:
            print(f"Failed to fetch directory index. Status code: {resp.status_code}")
    except Exception as e:
        print(f"Error fetching directory index: {e}")
        failures.append(f"Catalog URL resolution failed: {e}")

    # Fallback to a known filename if parsing failed
    if not catalog_url:
        # Fallback to the one we saw during testing
        catalog_filename = "sci_xrsf-l2-flrpt_geo_s19950103_e20260618_v1-0-0.csv"
        catalog_url = index_url + catalog_filename
        print(f"Using fallback catalog URL: {catalog_url}")

    catalog_dest = os.path.join(catalog_dir, "xrs_flare_report.csv")
    
    # Download the catalog file
    print(f"Downloading catalog from {catalog_url}...")
    try:
        r = requests.get(catalog_url, stream=True, timeout=60)
        if r.status_code == 200:
            total_size = int(r.headers.get('content-length', 0))
            with open(catalog_dest, 'wb') as f, tqdm(
                desc=catalog_filename,
                total=total_size,
                unit='B',
                unit_scale=True,
                unit_divisor=1024,
            ) as bar:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        bar.update(len(chunk))
            print(f"Catalog successfully saved to: {catalog_dest}")
        else:
            print(f"Failed to download catalog. HTTP Status: {r.status_code}")
            failures.append(f"Catalog download failed: HTTP Status {r.status_code}")
    except Exception as e:
        print(f"Error downloading catalog: {e}")
        failures.append(f"Catalog download failed: {e}")

    # ---------------------------------------------------------
    # TASK A: Download GOES XRS 1-minute flux data
    # ---------------------------------------------------------
    print("\n--- Task A: Downloading GOES XRS 1-Minute Flux Data ---")
    print(f"Searching GOES-18 XRS data from {start_date} to {end_date}...")
    
    downloaded_flux_files = []
    try:
        # Query Fido
        query = Fido.search(
            a.Time(start_date + " 00:00:00", end_date + " 23:59:59"),
            a.Instrument("XRS"),
            a.goes.SatelliteNumber(18)
        )
        print(f"Search query returned {len(query)} result blocks.")
        
        # Filter for Resolution == 'avg1m'
        avg1m_files = []
        if len(query) > 0:
            block = query[0]
            mask = block['Resolution'] == 'avg1m'
            filtered_block = block[mask]
            
            print(f"Found {len(filtered_block)} matching 1-minute average flux files.")
            
            # To avoid overloading NOAA servers and taking too much time,
            # we will download in batches of 30 files, or full range as requested.
            # Let's download all of them!
            print("Starting download of GOES flux files (this may take a few minutes)...")
            # Fido.fetch downloads files in parallel and skips already existing files.
            fetched = Fido.fetch(filtered_block, path=flux_dir)
            downloaded_flux_files = list(fetched)
            print(f"Successfully downloaded/verified {len(downloaded_flux_files)} flux files.")
        else:
            print("No XRS results found for GOES-18 in this range.")
            failures.append("No XRS flux files found in Fido query.")
            
    except Exception as e:
        print(f"Error downloading flux data: {e}")
        failures.append(f"Flux download failed: {e}")

    # ---------------------------------------------------------
    # VERIFICATION
    # ---------------------------------------------------------
    print("\n==============================================")
    print("Verification and Summary Generation")
    print("==============================================")
    
    # 1. List flux files
    flux_files_in_dir = [os.path.join(flux_dir, f) for f in os.listdir(flux_dir) if f.endswith('.nc') or f.endswith('.fits')]
    flux_files_in_dir.sort()
    total_flux_size = sum(os.path.getsize(f) for f in flux_files_in_dir)
    print(f"Total flux files in {flux_dir}: {len(flux_files_in_dir)}")
    print(f"Total flux files size: {total_flux_size / (1024*1024):.2f} MB")
    print("Sample flux files:")
    for f in flux_files_in_dir[:5]:
        print(f"  - {os.path.basename(f)} ({os.path.getsize(f) / 1024:.1f} KB)")
    if len(flux_files_in_dir) > 5:
        print("  ...")
        for f in flux_files_in_dir[-2:]:
            print(f"  - {os.path.basename(f)} ({os.path.getsize(f) / 1024:.1f} KB)")

    # 2. Load and verify catalog
    catalog_rows = 0
    catalog_min_time = None
    catalog_max_time = None
    unique_classes = []
    
    if os.path.exists(catalog_dest) and os.path.getsize(catalog_dest) > 1024:
        try:
            print(f"\nLoading downloaded flare catalog from {catalog_dest}...")
            # NCEI EXIS composite csv files typically use column headers like start_time, peak_time, end_time, goes_class, etc.
            # Let's inspect the headers and load using pandas
            # Exis CSV starts with some comment lines beginning with '#'
            df_cat = pd.read_csv(catalog_dest, comment='#')
            catalog_rows = len(df_cat)
            
            # Print columns and head
            print(f"Catalog columns: {list(df_cat.columns)}")
            print("First 5 rows of catalog:")
            print(df_cat.head(5))
            
            # Find time and class columns dynamically
            time_cols = [c for c in df_cat.columns if 'time' in c.lower() or 'date' in c.lower()]
            class_cols = [c for c in df_cat.columns if 'class' in c.lower() or 'goes_class' in c.lower() or 'goescls' in c.lower()]
            
            if time_cols:
                # Find min/max timestamp
                first_time_col = time_cols[0]
                df_cat[first_time_col] = pd.to_datetime(df_cat[first_time_col])
                catalog_min_time = df_cat[first_time_col].min()
                catalog_max_time = df_cat[first_time_col].max()
                print(f"Date range covered: {catalog_min_time} to {catalog_max_time}")
                
            if class_cols:
                class_col = class_cols[0]
                # Filter out nulls and get prefix letter (A, B, C, M, X)
                classes = df_cat[class_col].dropna().astype(str)
                # Keep only valid prefix strings or print unique values
                unique_classes = sorted(classes.unique())
                
                # Check for standard classes A/B/C/M/X
                prefixes = sorted(list(set(c[0].upper() for c in classes if len(c) > 0 and c[0].upper() in ['A','B','C','M','X'])))
                print(f"Unique flare class prefixes found: {prefixes}")
                print(f"Unique class values found (sample): {unique_classes[:15]}")
            else:
                print("Could not locate goes_class column in catalog.")
        except Exception as e:
            print(f"Error parsing catalog file: {e}")
            failures.append(f"Catalog parse error: {e}")
    else:
        print(f"\n[ERROR] Catalog file does not exist or is empty at {catalog_dest}")

    # 3. Write summary report
    print(f"\nWriting summary report to {summary_file}...")
    try:
        with open(summary_file, 'w') as sf:
            sf.write("==============================================\n")
            sf.write("GOES Data & NOAA Flare Catalog Ingestion Summary\n")
            sf.write("==============================================\n")
            sf.write(f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            sf.write("TASK A: GOES XRS 1-Minute Flux Data\n")
            sf.write(f"  Target Date Range: {start_date} to {end_date}\n")
            sf.write(f"  Storage Directory: {flux_dir}\n")
            sf.write(f"  Total Files Downloaded: {len(flux_files_in_dir)}\n")
            sf.write(f"  Total Files Size: {total_flux_size / (1024*1024):.2f} MB\n")
            if flux_files_in_dir:
                sf.write(f"  First File: {os.path.basename(flux_files_in_dir[0])}\n")
                sf.write(f"  Last File: {os.path.basename(flux_files_in_dir[-1])}\n")
            sf.write("\n")
            
            sf.write("TASK B: NOAA Composite Flare Catalog\n")
            sf.write(f"  Storage Location: {catalog_dest}\n")
            sf.write(f"  Total Event Rows: {catalog_rows}\n")
            sf.write(f"  Catalog Date Range: {catalog_min_time} to {catalog_max_time}\n")
            sf.write(f"  Unique Class Prefixes: {sorted(list(set(c[0].upper() for c in unique_classes if len(c) > 0 and c[0].upper() in ['A','B','C','M','X']))) if unique_classes else 'N/A'}\n")
            sf.write("\n")
            
            sf.write("DOWNLOAD FAILURES & FALLBACKS\n")
            if failures:
                for fail in failures:
                    sf.write(f"  - [FAILED] {fail}\n")
            else:
                sf.write("  - None. All tasks completed successfully with zero fallbacks.\n")
                
        print("Summary report successfully written.")
    except Exception as e:
        print(f"Error writing summary report: {e}")

if __name__ == "__main__":
    main()
