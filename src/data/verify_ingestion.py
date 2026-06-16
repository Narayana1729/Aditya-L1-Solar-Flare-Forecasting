import os
import glob
from src.utils.cdf_parser import inspect_cdf, cdf_to_dataframe

def verify_folder(folder_path, ext="cdf"):
    """Check a folder for files of a specific extension and inspect the first one."""
    print(f"\nChecking folder: {folder_path}")
    files = glob.glob(os.path.join(folder_path, f"*.{ext}"))
    
    if not files:
        print(f"  --> No .{ext} files found in {folder_path}. Please place downloaded PRADAN files here.")
        return None
        
    print(f"  --> Found {len(files)} files.")
    sample_file = files[0]
    print(f"  --> Sample file: {os.path.basename(sample_file)}")
    
    # Inspect CDF
    info = inspect_cdf(sample_file)
    return sample_file

def main():
    print("==================================================")
    print("Aditya-L1 Data Ingestion Verification Tool")
    print("==================================================")
    
    # Verify SoLEXS
    solexs_file = verify_folder("data/raw/solexs", "cdf")
    
    # Verify HEL1OS
    hel1os_file = verify_folder("data/raw/hel1os", "cdf")
    
    # Try FITS if no CDF found for HEL1OS (HEL1OS data can sometimes be FITS format)
    if hel1os_file is None:
        hel1os_file = verify_folder("data/raw/hel1os", "fits")
        
    if solexs_file and hel1os_file:
        print("\n[SUCCESS] Both SoLEXS and HEL1OS data files are present!")
        print("We can now proceed to synchronize and merge the datasets on timestamp.")
    else:
        print("\n[PENDING] Please download the missing files from PRADAN and place them in the folders specified above.")
        print("Refer to DATA_INSTRUCTION.md for detailed instructions.")

if __name__ == "__main__":
    main()
