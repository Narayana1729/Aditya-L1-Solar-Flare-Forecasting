import os
import sys
import glob

# Allow running from project root without installing as a package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from src.utils.cdf_parser import inspect_cdf, cdf_to_dataframe

def verify_folder(folder_path, ext="cdf"):
    """Check a folder recursively for files of a specific extension and inspect the first one."""
    print(f"\nChecking folder: {folder_path}")
    search_path = os.path.join(folder_path, "**", f"*.{ext}")
    files = glob.glob(search_path, recursive=True)
    
    if not files:
        print(f"  --> No .{ext} files found recursively in {folder_path}.")
        return None
        
    print(f"  --> Found {len(files)} files.")
    sample_file = files[0]
    print(f"  --> Sample file: {sample_file.replace(folder_path + '/', '')}")
    
    # Inspect based on file extension
    if sample_file.endswith(".cdf"):
        from src.utils.cdf_parser import inspect_cdf
        inspect_cdf(sample_file)
    else:
        # FITS inspection
        from astropy.io import fits
        try:
            with fits.open(sample_file) as hdul:
                print(f"=== Inspecting FITS: {os.path.basename(sample_file)} ===")
                hdul.info()
                for i in range(1, min(len(hdul), 3)):
                    if hdul[i].data is not None:
                        print(f"  - HDU {i} '{hdul[i].name}' Columns: {hdul[i].data.names}")
        except Exception as e:
            print(f"  --> Error inspecting FITS file {sample_file}: {e}")
            
    return sample_file

def main():
    print("==================================================")
    print("Aditya-L1 Data Ingestion Verification Tool")
    print("==================================================")
    
    # Verify SoLEXS (.lc.gz files are compressed FITS files)
    solexs_file = verify_folder("data/raw/solexs", "lc.gz")
    if solexs_file is None:
        solexs_file = verify_folder("data/raw/solexs", "fits")
        
    # Verify HEL1OS (usually .fits or .cdf files)
    hel1os_file = verify_folder("data/raw/hel1os", "fits")
    if hel1os_file is None:
        hel1os_file = verify_folder("data/raw/hel1os", "cdf")
        
    if solexs_file and hel1os_file:
        print("\n[SUCCESS] Both SoLEXS and HEL1OS data files are present and verified!")
        print("We can now proceed to synchronize and merge the datasets on timestamp.")
    else:
        print("\n[PENDING] Please download the missing files from PRADAN and place them in the folders specified above.")
        print("Refer to DATA_INSTRUCTION.md for detailed instructions.")

if __name__ == "__main__":
    main()
