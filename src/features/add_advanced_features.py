import os
import pandas as pd
import numpy as np
import pywt
from tqdm import tqdm
from scipy.stats import entropy

def compute_fft_features(window):
    # Safe checks
    if len(window) < 2 or np.all(window == window[0]):
        return 0.0, 0.0, 0.0
    
    # Calculate power spectrum
    fft_vals = np.fft.rfft(window)
    fft_power = np.abs(fft_vals)**2
    
    # Dominant frequency index (exclude DC component at index 0)
    dom_freq = float(np.argmax(fft_power[1:]) + 1) if len(fft_power) > 1 else 0.0
    
    # High/Low power ratio
    mid = len(fft_power) // 2
    low_power = np.sum(fft_power[:mid]) + 1e-10
    high_power = np.sum(fft_power[mid:])
    hl_ratio = float(high_power / low_power)
    
    # Spectral entropy
    p = fft_power / (np.sum(fft_power) + 1e-10)
    spec_entropy = float(-np.sum(p * np.log2(p + 1e-10)))
    
    return dom_freq, hl_ratio, spec_entropy

def compute_wavelet_features(window):
    if len(window) < 16:  # db4 requires at least some size
        return 0.0, 0.0, 0.0, 0.0, 0.0
    
    try:
        # level=4 db4 decomposition
        coeffs = pywt.wavedec(window, 'db4', level=4)
        # coeffs: [cA4, cD4, cD3, cD2, cD1]
        cA4_energy = float(np.sum(coeffs[0]**2))
        cD4_energy = float(np.sum(coeffs[1]**2))
        cD3_energy = float(np.sum(coeffs[2]**2))
        cD2_energy = float(np.sum(coeffs[3]**2))
        cD1_energy = float(np.sum(coeffs[4]**2))
    except Exception:
        cA4_energy, cD4_energy, cD3_energy, cD2_energy, cD1_energy = 0.0, 0.0, 0.0, 0.0, 0.0
        
    return cA4_energy, cD4_energy, cD3_energy, cD2_energy, cD1_energy

def compute_neupert_lag(solexs_win, hel1os_win):
    if len(solexs_win) < 20 or np.all(solexs_win == solexs_win[0]) or np.all(hel1os_win == hel1os_win[0]):
        return 0.0
    
    best_lag = 0.0
    max_corr = -2.0
    
    # Search lags from -10 to +10 minutes
    for lag in range(-10, 11):
        if lag < 0:
            s_slice = solexs_win[-lag:]
            h_slice = hel1os_win[:len(solexs_win)+lag]
        elif lag > 0:
            s_slice = solexs_win[:-lag]
            h_slice = hel1os_win[lag:]
        else:
            s_slice = solexs_win
            h_slice = hel1os_win
            
        if len(s_slice) > 5:
            # Correlation coeff
            corr_mat = np.corrcoef(s_slice, h_slice)
            if corr_mat.shape == (2, 2):
                corr = corr_mat[0, 1]
                if not np.isnan(corr) and corr > max_corr:
                    max_corr = corr
                    best_lag = float(lag)
                    
    return best_lag

def main():
    print("==================================================")
    print("Aditya-L1 Advanced Precursor Feature Extraction")
    print("==================================================")
    
    aditya_path = "./features/aditya_features_enhanced_full.csv"
    if not os.path.exists(aditya_path):
        print(f"Error: Dataset not found at {aditya_path}")
        return
        
    print(f"Loading full dataset from {aditya_path}...")
    df = pd.read_csv(aditya_path)
    print(f"Loaded {len(df)} rows. Setting up sliding windows...")
    
    solexs_arr = df['solexs_sdd2_counts'].values
    hel1os_arr = df['hel1os_czt1_20_to_40_ctr'].values
    
    # Initialize arrays for new features
    n_rows = len(df)
    window_size = 60
    
    solexs_dom_freq = np.zeros(n_rows)
    solexs_hl_ratio = np.zeros(n_rows)
    solexs_entropy = np.zeros(n_rows)
    
    hel1os_dom_freq = np.zeros(n_rows)
    hel1os_hl_ratio = np.zeros(n_rows)
    hel1os_entropy = np.zeros(n_rows)
    
    # Wavelets
    solexs_cA4 = np.zeros(n_rows)
    solexs_cD4 = np.zeros(n_rows)
    solexs_cD3 = np.zeros(n_rows)
    solexs_cD2 = np.zeros(n_rows)
    solexs_cD1 = np.zeros(n_rows)
    
    hel1os_cA4 = np.zeros(n_rows)
    hel1os_cD4 = np.zeros(n_rows)
    hel1os_cD3 = np.zeros(n_rows)
    hel1os_cD2 = np.zeros(n_rows)
    hel1os_cD1 = np.zeros(n_rows)
    
    # Neupert Phase Lag
    neupert_lag = np.zeros(n_rows)
    
    # Compute rolling windows
    for i in tqdm(range(window_size, n_rows), desc="Processing Rolling Windows"):
        s_win = solexs_arr[i - window_size : i]
        h_win = hel1os_arr[i - window_size : i]
        
        # FFT features
        s_dom, s_hl, s_ent = compute_fft_features(s_win)
        h_dom, h_hl, h_ent = compute_fft_features(h_win)
        
        solexs_dom_freq[i] = s_dom
        solexs_hl_ratio[i] = s_hl
        solexs_entropy[i] = s_ent
        
        hel1os_dom_freq[i] = h_dom
        hel1os_hl_ratio[i] = h_hl
        hel1os_entropy[i] = h_ent
        
        # Wavelet features
        s_cA4, s_cD4, s_cD3, s_cD2, s_cD1 = compute_wavelet_features(s_win)
        h_cA4, h_cD4, h_cD3, h_cD2, h_cD1 = compute_wavelet_features(h_win)
        
        solexs_cA4[i] = s_cA4
        solexs_cD4[i] = s_cD4
        solexs_cD3[i] = s_cD3
        solexs_cD2[i] = s_cD2
        solexs_cD1[i] = s_cD1
        
        hel1os_cA4[i] = h_cA4
        hel1os_cD4[i] = h_cD4
        hel1os_cD3[i] = h_cD3
        hel1os_cD2[i] = h_cD2
        hel1os_cD1[i] = h_cD1
        
        # Neupert Lag
        neupert_lag[i] = compute_neupert_lag(s_win, h_win)
        
    # Append to dataframe
    new_features = {
        'solexs_fft_dom_freq': solexs_dom_freq,
        'solexs_fft_hl_ratio': solexs_hl_ratio,
        'solexs_fft_entropy': solexs_entropy,
        'hel1os_fft_dom_freq': hel1os_dom_freq,
        'hel1os_fft_hl_ratio': hel1os_hl_ratio,
        'hel1os_fft_entropy': hel1os_entropy,
        'solexs_wt_cA4_energy': solexs_cA4,
        'solexs_wt_cD4_energy': solexs_cD4,
        'solexs_wt_cD3_energy': solexs_cD3,
        'solexs_wt_cD2_energy': solexs_cD2,
        'solexs_wt_cD1_energy': solexs_cD1,
        'hel1os_wt_cA4_energy': hel1os_cA4,
        'hel1os_wt_cD4_energy': hel1os_cD4,
        'hel1os_wt_cD3_energy': hel1os_cD3,
        'hel1os_wt_cD2_energy': hel1os_cD2,
        'hel1os_wt_cD1_energy': hel1os_cD1,
        'neupert_phase_lag': neupert_lag
    }
    
    for name, arr in new_features.items():
        # Backfill initial boundary rows (first 60 rows) with the first valid computed value
        first_valid_val = arr[window_size]
        arr[:window_size] = first_valid_val
        df[name] = arr
        
    # Verify 0 NaNs
    nans = df[list(new_features.keys())].isna().sum().sum()
    print(f"\nVerification: Total NaNs in new features: {nans}")
    
    # Save back to CSV
    print(f"Saving updated dataset with {len(new_features)} new features...")
    df.to_csv(aditya_path, index=False)
    print("[SUCCESS] Dataset updated successfully!")

if __name__ == "__main__":
    main()
