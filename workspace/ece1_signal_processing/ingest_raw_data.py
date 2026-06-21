import os
import glob
import zipfile
import re
from pathlib import Path

def get_dir_size(path):
    total = 0
    for root, dirs, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            try:
                if not os.path.islink(fp):
                    total += os.path.getsize(fp)
            except OSError:
                pass
    return total

def main():
    print("==============================================")
    print("Starting Aditya-L1 Raw Data Ingestion Scanner")
    print("==============================================")
    
    raw_dir = Path("data/raw")
    solexs_dir = raw_dir / "solexs"
    hel1os_dir = raw_dir / "hel1os"
    noaa_dir = raw_dir / "noaa"
    
    # 1. Check directories exist
    for d in [solexs_dir, hel1os_dir, noaa_dir]:
        if not d.exists():
            print(f"Directory {d} does not exist. Creating it.")
            d.mkdir(parents=True, exist_ok=True)
            
    # 2. Find zip files
    solexs_zips = sorted(list(solexs_dir.glob("*.zip")))
    hel1os_zips = sorted(list(hel1os_dir.glob("*.zip")))
    
    print(f"Found {len(solexs_zips)} SoLEXS zip files.")
    print(f"Found {len(hel1os_zips)} HEL1OS zip files.")
    
    # 3. Extract zip files if not already extracted
    extracted_count = 0
    skipped_count = 0
    
    # Extract helper
    def extract_zip_if_needed(zip_path, parent_dir):
        nonlocal extracted_count, skipped_count
        target_dir = zip_path.with_suffix("")
        if target_dir.exists() and any(target_dir.iterdir()):
            skipped_count += 1
            return False
        else:
            print(f"Extracting {zip_path.name} to {parent_dir}...")
            try:
                with zipfile.ZipFile(zip_path, 'r') as z:
                    z.extractall(parent_dir)
                extracted_count += 1
                return True
            except Exception as e:
                print(f"Error extracting {zip_path.name}: {e}")
                return False

    # We will run extract_zip_if_needed on all found zips.
    # To avoid extracting 2000+ files and filling up disk capacity (only 35GB available),
    # we rely on the check: if target directory exists, skip.
    print("\nProcessing SoLEXS zip archives...")
    for z in solexs_zips:
        extract_zip_if_needed(z, solexs_dir)
        
    print("\nProcessing HEL1OS zip archives...")
    for z in hel1os_zips:
        extract_zip_if_needed(z, hel1os_dir)
        
    print(f"\nExtraction summary: Extracted {extracted_count} new archives, skipped {skipped_count} already extracted archives.")
    
    # 4. Scan files and sizes
    all_solexs_files = list(solexs_dir.rglob("*"))
    all_hel1os_files = list(hel1os_dir.rglob("*"))
    
    solexs_fits_lc = [f for f in all_solexs_files if f.is_file() and f.suffix in ['.fits', '.gz', '.cdf']]
    hel1os_fits_lc = [f for f in all_hel1os_files if f.is_file() and f.suffix in ['.fits', '.gz', '.cdf']]
    
    solexs_size = get_dir_size(solexs_dir)
    hel1os_size = get_dir_size(hel1os_dir)
    
    # Check if files exist
    if len(solexs_fits_lc) == 0 and len(hel1os_fits_lc) == 0:
        print("\nERROR: No data files (.fits, .gz, .cdf) found in either raw directory!")
        print("Please download Level-1 or Level-2 files from the PRADAN portal.")
        return
        
    # 5. Extract date ranges from folder/file names
    # Match dates in the format YYYYMMDD
    date_pattern = re.compile(r"(20\d{6})")
    solexs_dates = []
    hel1os_dates = []
    
    for f in all_solexs_files:
        match = date_pattern.search(f.name)
        if match:
            date_str = match.group(1)
            solexs_dates.append(date_str)
            
    for f in all_hel1os_files:
        match = date_pattern.search(f.name)
        if match:
            date_str = match.group(1)
            hel1os_dates.append(date_str)
            
    solexs_date_range = "None"
    if solexs_dates:
        solexs_dates = sorted(list(set(solexs_dates)))
        solexs_date_range = f"{solexs_dates[0][:4]}-{solexs_dates[0][4:6]}-{solexs_dates[0][6:]} to {solexs_dates[-1][:4]}-{solexs_dates[-1][4:6]}-{solexs_dates[-1][6:]}"
        
    hel1os_date_range = "None"
    if hel1os_dates:
        hel1os_dates = sorted(list(set(hel1os_dates)))
        hel1os_date_range = f"{hel1os_dates[0][:4]}-{hel1os_dates[0][4:6]}-{hel1os_dates[0][6:]} to {hel1os_dates[-1][:4]}-{hel1os_dates[-1][4:6]}-{hel1os_dates[-1][6:]}"

    # 6. Write status summary
    status_path = raw_dir / "ingestion_status.txt"
    summary_content = f"""ADITYA-L1 DATA INGESTION STATUS SUMMARY
=======================================
Scan timestamp: {os.popen('date').read().strip()}

SOLEXS INGESTION STATS:
- Raw directory: {solexs_dir}
- Total zip files: {len(solexs_zips)}
- Total data files (.fits, .gz, .cdf): {len(solexs_fits_lc)}
- Date range covered: {solexs_date_range}
- Total directory size: {solexs_size / (1024*1024):.2f} MB

HEL1OS INGESTION STATS:
- Raw directory: {hel1os_dir}
- Total zip files: {len(hel1os_zips)}
- Total data files (.fits, .gz, .cdf): {len(hel1os_fits_lc)}
- Date range covered: {hel1os_date_range}
- Total directory size: {hel1os_size / (1024*1024*1024):.2f} GB

NOAA CATALOG STATS:
- Directory: {noaa_dir}
- goes_flares.csv present: {os.path.exists(noaa_dir / "goes_flares.csv")}

EXTRACTION OVERVIEW:
- Zip archives newly extracted: {extracted_count}
- Zip archives skipped (already unzipped): {skipped_count}
"""
    
    with open(status_path, "w") as sf:
        sf.write(summary_content)
        
    print(f"\n[SUCCESS] Wrote data ingestion summary to {status_path}")
    print("\n----------------------------------------------")
    print(summary_content)
    print("----------------------------------------------")

if __name__ == "__main__":
    main()
