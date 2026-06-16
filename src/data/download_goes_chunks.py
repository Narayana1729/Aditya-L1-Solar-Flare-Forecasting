import os
import pandas as pd
from sunpy.net import Fido
from sunpy.net import attrs as a
import time

def download_chunk(start_time, end_time):
    print(f"Querying HEK from {start_time} to {end_time}...")
    try:
        query = Fido.search(
            a.Time(start_time, end_time),
            a.hek.EventType("FL"),
            a.hek.OBS.Observatory == "GOES"
        )
        if not query or "hek" not in query.keys() or len(query["hek"]) == 0:
            print(f"No flares found for {start_time} to {end_time}")
            return pd.DataFrame()
            
        hek_table = query["hek"]
        flat_cols = [col for col in hek_table.colnames if len(hek_table[col].shape) <= 1]
        df = hek_table[flat_cols].to_pandas()
        
        columns_to_keep = [
            'event_starttime', 'event_peaktime', 'event_endtime', 
            'fl_goescls', 'ar_noaanum', 'event_type', 'obs_observatory'
        ]
        existing_columns = [col for col in columns_to_keep if col in df.columns]
        df_filtered = df[existing_columns].copy()
        
        df_filtered = df_filtered.rename(columns={
            'event_starttime': 'start_time',
            'event_peaktime': 'peak_time',
            'event_endtime': 'end_time',
            'fl_goescls': 'goes_class',
            'ar_noaanum': 'noaa_active_region'
        })
        
        print(f"  --> Found {len(df_filtered)} flares")
        return df_filtered
    except Exception as e:
        print(f"Error querying {start_time} to {end_time}: {e}")
        return pd.DataFrame()

def main():
    chunks = [
        ("2024-07-01 00:00:00", "2025-01-01 00:00:00"),
        ("2025-01-01 00:00:00", "2025-07-01 00:00:00"),
        ("2025-07-01 00:00:00", "2026-01-01 00:00:00"),
        ("2026-01-01 00:00:00", "2026-06-16 00:00:00")
    ]
    
    dfs = []
    for start, end in chunks:
        df_chunk = download_chunk(start, end)
        if not df_chunk.empty:
            dfs.append(df_chunk)
        # Sleep to be polite to HEK API
        time.sleep(2)
        
    if not dfs:
        print("No flares found across all chunks.")
        return
        
    df_all = pd.concat(dfs, axis=0, ignore_index=True)
    
    # Remove duplicates in case of overlapping boundaries
    if 'start_time' in df_all.columns and 'goes_class' in df_all.columns:
        df_all = df_all.drop_duplicates(subset=['start_time', 'goes_class'])
        
    os.makedirs("data/raw/noaa", exist_ok=True)
    output_path = "data/raw/noaa/goes_flares.csv"
    df_all.to_csv(output_path, index=False)
    print(f"\n[SUCCESS] Saved unified flare catalog of {len(df_all)} flares to {output_path}")

if __name__ == "__main__":
    main()
