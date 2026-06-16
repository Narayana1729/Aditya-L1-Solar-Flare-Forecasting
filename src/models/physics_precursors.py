import os
import pandas as pd
import numpy as np

def compute_precursors(input_path, output_path):
    """
    Compute physics-guided precursor confidence scores.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Feature file not found at {input_path}")
        
    print(f"Loading feature matrix from {input_path}...")
    df = pd.read_csv(input_path)
    
    # Ensure timestamp is datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    print("Computing Physics Precursor features...")
    
    # 1. Pre-flare Brightening (SoLEXS Soft X-rays)
    # We use log_solexs_sdd2_counts or fallback to log_solexs_sdd1_counts
    solexs_col = None
    for col in ['log_solexs_sdd2_counts', 'log_solexs_sdd1_counts']:
        if col in df.columns:
            solexs_col = col
            break
            
    if solexs_col:
        # Rolling difference to calculate rate of change
        solexs_diff = df[solexs_col].diff()
        # Precursor brightening score: fraction of the last 5 minutes with increasing flux
        df['solexs_brightening'] = (solexs_diff > 0.001).rolling(window=5, min_periods=1).sum() / 5.0
    else:
        print("Warning: SoLEXS columns not found. Setting brightening score to 0.")
        df['solexs_brightening'] = 0.0
        
    # 2. Spectral Hardening (HEL1OS Hard X-rays CZT)
    # Compare high-energy (80-150 keV) vs low-energy (20-40 keV) count rate
    czt_high = 'hel1os_czt1_80_to_150_ctr' if 'hel1os_czt1_80_to_150_ctr' in df.columns else 'hel1os_czt2_80_to_150_ctr'
    czt_low = 'hel1os_czt1_20_to_40_ctr' if 'hel1os_czt1_20_to_40_ctr' in df.columns else 'hel1os_czt2_20_to_40_ctr'
    
    if czt_high in df.columns and czt_low in df.columns:
        # Add epsilon to prevent division by zero
        df['hardness_ratio'] = df[czt_high] / (df[czt_low] + 1e-5)
        # Compute slope of hardness ratio over last 5 minutes
        hardness_diff = df['hardness_ratio'].diff()
        df['spectral_hardening'] = (hardness_diff > 0.0).rolling(window=5, min_periods=1).sum() / 5.0
    else:
        print("Warning: HEL1OS CZT columns not found. Setting hardening score to 0.")
        df['spectral_hardening'] = 0.0
        
    # 3. Microflare Peak Count (HEL1OS CdTe low-energy)
    # Identify small spikes in CdTe 5-20 keV count rate
    cdte_col = 'hel1os_cdte1_5_to_20_ctr' if 'hel1os_cdte1_5_to_20_ctr' in df.columns else 'hel1os_cdte2_5_to_20_ctr'
    if cdte_col in df.columns:
        # Identify peaks: count rate > rolling_mean + 1.5 * rolling_std
        roll_mean = df[cdte_col].rolling(window=10, min_periods=1).mean()
        roll_std = df[cdte_col].rolling(window=10, min_periods=1).std().fillna(0.0)
        
        is_spike = df[cdte_col] > (roll_mean + 1.5 * roll_std + 0.1)
        # Count microflare spikes in the last 30 minutes
        df['microflare_count'] = is_spike.rolling(window=30, min_periods=1).sum()
        # Scale score from 0 to 1 (clamping at 5 microflares)
        df['microflare_score'] = np.clip(df['microflare_count'] / 5.0, 0.0, 1.0)
    else:
        print("Warning: HEL1OS CdTe columns not found. Setting microflare score to 0.")
        df['microflare_score'] = 0.0
        
    # 4. Consolidate Physics Precursor Confidence Score (0.0 to 1.0)
    df['physics_precursor_score'] = (
        0.4 * df['solexs_brightening'] + 
        0.3 * df['spectral_hardening'] + 
        0.3 * df['microflare_score']
    )
    
    # Save the updated dataframe
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"[SUCCESS] Physics precursors computed and saved to: {output_path}")
    print(f"Max physics score observed: {df['physics_precursor_score'].max():.4f}")
    
    # Display statistics for flare vs quiet times
    if 'flare_class' in df.columns:
        df['is_flare'] = df['flare_class'] != 'quiet'
        print("\nPrecursor score statistics:")
        print(df.groupby('is_flare')['physics_precursor_score'].describe())

if __name__ == "__main__":
    compute_precursors("data/processed/features.csv", "data/processed/features_with_precursors.csv")
