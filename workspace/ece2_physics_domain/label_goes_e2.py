import os
import pandas as pd
import numpy as np
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
        num = float(goes_class[1:])
    except ValueError:
        num = 0.0
    return val * 100 + num

def main():
    print("==============================================")
    print("GOES Flare Event & Horizon Labeling (E2)")
    print("==============================================")

    unified_path = "./goes_data/processed/goes_unified.csv"
    catalog_path = "./goes_data/flare_catalog/xrs_flare_report.csv"
    output_path = "./goes_data/processed/goes_labeled.csv"
    
    if not os.path.exists(unified_path):
        print(f"ERROR: Unified flux file not found at {unified_path}")
        return
    if not os.path.exists(catalog_path):
        print(f"ERROR: Flare catalog file not found at {catalog_path}")
        return
        
    print(f"Loading unified flux data from {unified_path}...")
    df = pd.read_csv(unified_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.set_index('timestamp')
    
    print(f"Loading flare catalog from {catalog_path}...")
    # NCEI EXIS catalog can contain comments starting with '#'
    catalog = pd.read_csv(catalog_path, comment='#')
    
    # Parse times
    catalog['start_time'] = pd.to_datetime(catalog['start_time'])
    catalog['end_time'] = pd.to_datetime(catalog['end_time'])
    
    # Filter catalog to overlap with our dataset time range to speed up matching
    min_time = df.index.min()
    max_time = df.index.max()
    catalog_filtered = catalog[
        (catalog['end_time'] >= min_time) & (catalog['start_time'] <= max_time)
    ].copy()
    print(f"Filtered catalog events overlapping with flux timeline: {len(catalog_filtered)} / {len(catalog)}")
    
    # 1. Initialize nowcast labeling columns
    df['is_flare'] = False
    df['flare_class'] = None
    df['flare_id'] = None
    
    # Sort flares ascending by severity value so that more severe flares overwrite less severe ones
    # The column in xrs_flare_report is 'flare_class'
    catalog_filtered['severity'] = catalog_filtered['flare_class'].apply(class_severity)
    catalog_sorted = catalog_filtered.sort_values('severity', ascending=True).reset_index(drop=True)
    
    print("Mapping nowcast flare events...")
    for idx, row in tqdm(catalog_sorted.iterrows(), total=len(catalog_sorted), desc="Labeling flares"):
        start = row['start_time']
        end = row['end_time']
        cls = row['flare_class']
        fid = row['flare_id']
        
        # Get prefix letter (A, B, C, M, X)
        prefix = cls[0].upper() if isinstance(cls, str) and len(cls) > 0 else None
        
        mask = (df.index >= start) & (df.index <= end)
        if mask.any():
            df.loc[mask, 'is_flare'] = True
            df.loc[mask, 'flare_class'] = prefix
            df.loc[mask, 'flare_id'] = fid

    # 2. Forecast Horizon Labeling
    # flare_start_indicator is True at the exact start minute of each flare
    # Filter unique start times from the whole catalog that fall in our range
    unique_start_times = pd.to_datetime(catalog_filtered['start_time'].unique())
    
    df['flare_start_indicator'] = False
    # Find exact matching index entries
    matching_starts = df.index.intersection(unique_start_times)
    df.loc[matching_starts, 'flare_start_indicator'] = True
    
    print("\nComputing forecast horizon flags (15m, 30m, 60m)...")
    # For a timestamp t, flare_within_H is True if a flare starts in (t, t + H]
    # We use our reversed rolling max method:
    for h in [15, 30, 60]:
        col_name = f"flare_within_{h}min"
        # Reverse, rolling max, reverse, shift by -1
        rolled = df['flare_start_indicator'][::-1].rolling(window=h, min_periods=1).max()[::-1]
        df[col_name] = rolled.shift(-1).fillna(0).astype(bool)

    # 3. Look-ahead Leak Protection
    # A timestamp already inside a flare (is_flare = True) should not have forecast flags set to True
    # unless it is the literal start minute of a flare.
    print("Applying leak protection to forecast flags...")
    is_start_minute = df['flare_start_indicator']
    mask_to_clear = df['is_flare'] & (~is_start_minute)
    
    df.loc[mask_to_clear, 'flare_within_15min'] = False
    df.loc[mask_to_clear, 'flare_within_30min'] = False
    df.loc[mask_to_clear, 'flare_within_60min'] = False
    
    # Drop temp indicator column
    df = df.drop(columns=['flare_start_indicator'])
    
    # Save labeled dataset
    print(f"Saving labeled dataset to {output_path}...")
    df_reset = df.reset_index()
    df_reset.to_csv(output_path, index=False)
    print(f"[SUCCESS] Labeled dataset saved successfully.")

    # ---------------------------------------------------------
    # VERIFICATION
    # ---------------------------------------------------------
    print("\n==============================================")
    # 1. Total row count, is_flare distribution
    total_rows = len(df_reset)
    flare_rows = df_reset['is_flare'].sum()
    quiet_rows = total_rows - flare_rows
    print(f"Total row count: {total_rows}")
    print(f"Flare rows (is_flare = True): {flare_rows} ({flare_rows / total_rows * 100:.3f}%)")
    print(f"Quiet rows (is_flare = False): {quiet_rows} ({quiet_rows / total_rows * 100:.3f}%)")
    
    # 2. Breakdown of flare_class counts
    print("\nFlare class distribution:")
    print(df_reset['flare_class'].value_counts(dropna=False))
    
    # 3. Forecast counts
    print("\nForecast horizon counts:")
    for h in [15, 30, 60]:
        col_name = f"flare_within_{h}min"
        cnt = df_reset[col_name].sum()
        print(f"  {col_name} = True: {cnt} ({cnt / total_rows * 100:.3f}%)")
        
    # 4. Sanity check: no row has is_flare=True and flare_within_15min=True simultaneously unless literal start
    # Let's check how many overlap:
    overlaps = df_reset[df_reset['is_flare'] & df_reset['flare_within_15min']]
    overlap_non_starts = []
    for idx, row in overlaps.iterrows():
        # Check if this timestamp matches any flare start_time
        t = row['timestamp']
        is_start = t in unique_start_times
        if not is_start:
            overlap_non_starts.append(t)
            
    print(f"\nOverlap Sanity Check:")
    print(f"  Total overlap rows (is_flare=True AND flare_within_15min=True): {len(overlaps)}")
    print(f"  Number of invalid overlaps (excluding literal start minute): {len(overlap_non_starts)}")
    if len(overlap_non_starts) > 0:
        print("  WARNING: Look-ahead leak detected! Invalid overlap timestamps:")
        for t in overlap_non_starts[:5]:
            print(f"    - {t}")
    else:
        print("  PASSED: No invalid overlaps found. Leak protection rule verified successfully.")

    # 5. Print the 5 largest flares
    print("\n5 Largest Flares in catalog overlapping timeline:")
    # Filter catalog_filtered to only include flares that actually overlap the timeline
    if not catalog_filtered.empty:
        top_flares = catalog_filtered.sort_values('severity', ascending=False).head(5)
        print(top_flares[['start_time', 'time', 'end_time', 'flare_class', 'flare_id']])
    else:
        print("No flares found in catalog overlapping timeline range.")

if __name__ == "__main__":
    main()
