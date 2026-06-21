import os
import glob
import shutil
from pathlib import Path

def main():
    print("==============================================")
    print("Starting Aditya-L1 Raw Data Extraction Cleanup")
    print("==============================================")
    
    raw_dir = Path("data/raw")
    solexs_dir = raw_dir / "solexs"
    hel1os_dir = raw_dir / "hel1os"
    
    deleted_count = 0
    deleted_size = 0
    
    # Clean folders that have matching zip files
    def cleanup_instrument_dir(instrument_dir):
        nonlocal deleted_count, deleted_size
        print(f"\nScanning {instrument_dir}...")
        zip_files = list(instrument_dir.glob("*.zip"))
        for z in zip_files:
            # The extracted directory matches the zip filename without .zip
            extracted_dir = z.with_suffix("")
            if extracted_dir.exists() and extracted_dir.is_dir():
                # Calculate size before deletion
                folder_size = 0
                for p in extracted_dir.rglob('*'):
                    if p.is_file():
                        folder_size += p.stat().st_size
                
                print(f"Deleting extracted folder: {extracted_dir.name} ({folder_size / (1024*1024):.2f} MB)")
                try:
                    shutil.rmtree(extracted_dir)
                    deleted_count += 1
                    deleted_size += folder_size
                except Exception as e:
                    print(f"Error deleting {extracted_dir.name}: {e}")

    cleanup_instrument_dir(solexs_dir)
    cleanup_instrument_dir(hel1os_dir)
    
    print("\n==============================================")
    print(f"Cleanup finished: Deleted {deleted_count} directories.")
    print(f"Total space reclaimed: {deleted_size / (1024*1024*1024):.2f} GB")
    print("==============================================")

if __name__ == "__main__":
    main()
