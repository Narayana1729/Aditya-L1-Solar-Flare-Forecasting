import os
import pandas as pd
import numpy as np
from pathlib import Path
from tqdm import tqdm

def class_severity(goes_class):
    if not isinstance(goes_class, str) or len(goes_class) == 0:
        return -1
    letter = goes_class[0].upper()
    val = 0
    if letter == 'A':
        val = 1
    elif letter == 'B':
        val = 2
    elif letter == 'C':
        val = 3
    elif letter == 'M':
        val = 4
    elif letter == 'X':
        val = 5
    
    try:
        # Extract the numeric part (e.g. 2.3 from M2.3)
        num = float(goes_class[1:])
    except ValueError:
        num = 0.0
    return val * 100 + num

def main():
    print("==============================================")
    print("Starting Aditya-L1 Timeline Flare Labeling")
    print("==============================================")
    
    aligned_path = Path("data/processed/aditya_aligned.csv")
    catalog_path = Path("data/raw/noaa/goes_flares.csv")
    
    if not aligned_path.exists():
        print(f"ERROR: {aligned_path} does not exist. Please run Task 4 first.")
        return
    if not catalog_path.exists():
        print(f"ERROR: Flare catalog {catalog_path} does not exist.")
        return
        
    print(f"Loading aligned timeline from {aligned_path}...")
    df = pd.read_csv(aligned_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.set_index('timestamp')
    
    print(f"Loading NOAA flare catalog from {catalog_path}...")
    flare_df = pd.read_csv(catalog_path)
    
    # Clean and parse times in catalog
    flare_df['start_time'] = pd.to_datetime(flare_df['start_time'])
    flare_df['end_time'] = pd.to_datetime(flare_df['end_time'])
    
    # Initialize labeling columns
    df['flare_class'] = 'quiet'
    df['is_flare'] = False
    
    # Sort flares ascending by severity value so that more severe flares overwrite less severe ones
    flare_df['severity'] = flare_df['goes_class'].apply(class_severity)
    flare_df_sorted = flare_df.sort_values('severity', ascending=True).reset_index(drop=True)
    
    print("Labeling timeline entries based on catalog events (with 5s L1-to-Earth time-of-flight offset correction)...")
    # Loop and label
    for _, row in tqdm(flare_df_sorted.iterrows(), total=len(flare_df_sorted), desc="Mapping flares"):
        start = row['start_time']
        end = row['end_time']
        goes_cls = row['goes_class']
        
        # Apply L1-to-Earth 5-second light travel time correction:
        # Aditya-L1 is at the Lagrangian L1 point (~1.5 million km from Earth toward the Sun).
        # Solar photons reach Aditya-L1 ~5 seconds before they reach Earth/GOES.
        # Therefore, Aditya-L1 time = Earth/GOES time - 5 seconds.
        start_aditya = start - pd.Timedelta(seconds=5)
        end_aditya = end - pd.Timedelta(seconds=5)
        
        # Check if range overlaps with our timeline
        mask = (df.index >= start_aditya) & (df.index <= end_aditya)
        if mask.any():
            df.loc[mask, 'flare_class'] = goes_cls
            df.loc[mask, 'is_flare'] = True
            
    # Save labeled dataset
    output_path = Path("data/processed/aditya_labeled.csv")
    final_df = df.reset_index()
    final_df.to_csv(output_path, index=False)
    
    # Print verification metrics
    print("\n==============================================")
    print("Labeling Script Verification")
    print("==============================================")
    print(f"Output saved to: {output_path}")
    print(f"Dataframe shape: {final_df.shape}")
    print(f"Total row count: {len(final_df)}")
    
    flare_rows = final_df['is_flare'].sum()
    quiet_rows = len(final_df) - flare_rows
    print(f"Flare rows (is_flare = True): {flare_rows} ({flare_rows / len(final_df) * 100:.2f}%)")
    print(f"Quiet rows (is_flare = False): {quiet_rows} ({quiet_rows / len(final_df) * 100:.2f}%)")
    
    print("\nFlare Class Distribution:")
    class_dist = final_df['flare_class'].value_counts()
    print(class_dist)
    
    # Check if there is any leak of goes_class labeling out of boundaries
    # All rows with is_flare = True should map to actual flare timestamps
    print("\nNaN count check:")
    print(final_df.isna().sum())

if __name__ == "__main__":
    main()
