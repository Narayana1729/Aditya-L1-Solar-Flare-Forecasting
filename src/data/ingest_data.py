import os
import zipfile
import glob
import pandas as pd
from tqdm import tqdm

def extract_zips(raw_dir, only_lightcurves=False, delete_zip=False):
    """Scan directory for ZIP files and extract them into the same directory."""
    zip_files = glob.glob(os.path.join(raw_dir, "*.zip"))
    if not zip_files:
        print(f"No ZIP files found in {raw_dir}.")
        return
        
    print(f"Found {len(zip_files)} ZIP files in {raw_dir}. Extracting...")
    for zip_path in tqdm(zip_files):
        try:
            # Create a folder name based on the zip name to avoid cluttering
            base_name = os.path.basename(zip_path).replace(".zip", "")
            extract_to = os.path.join(raw_dir, base_name)
            
            # Skip if already extracted and contains files
            if os.path.exists(extract_to) and os.listdir(extract_to):
                if delete_zip:
                    try:
                        os.remove(zip_path)
                    except Exception:
                        pass
                continue
                
            os.makedirs(extract_to, exist_ok=True)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                if only_lightcurves:
                    # Only extract lightcurve_*.fits files to save ~85% space
                    for member in zip_ref.infolist():
                        if "lightcurve_" in member.filename and member.filename.endswith(".fits"):
                            zip_ref.extract(member, extract_to)
                else:
                    zip_ref.extractall(extract_to)
                
            # Delete the zip file after successful extraction to save space
            if delete_zip:
                os.remove(zip_path)
        except Exception as e:
            print(f"Error extracting {zip_path}: {e}")

def main():
    print("==================================================")
    print("Aditya-L1 Data Extraction & Ingestion Pipeline")
    print("==================================================")
    
    # Extract SoLEXS
    print("\n[Processing SoLEXS data]")
    extract_zips("data/raw/solexs", only_lightcurves=False, delete_zip=True)
    
    # Extract HEL1OS
    print("\n[Processing HEL1OS data]")
    # We only extract the lightcurves for HEL1OS (saving ~85% space) and delete the zip file to reclaim space
    extract_zips("data/raw/hel1os", only_lightcurves=True, delete_zip=True)
    
    print("\n[Extraction Complete]")
    print("Next step: Use verify_ingestion.py to see the structure of the extracted CDF/FITS files.")

if __name__ == "__main__":
    main()
