import os
import sys
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import matplotlib.pyplot as plt

# Set random seed for reproducibility
np.random.seed(42)

# Insert path to import space weather metrics
sys.path.insert(0, os.path.abspath("goes_data/metrics"))
from space_weather_metrics import true_skill_statistic, heidke_skill_score

def main():
    print("==========================================")
    print("Solar Flare Forecasting - Isolation Forest Anomaly Detection")
    print("==========================================")

    # 1. Load aditya_features_enhanced_full.csv
    aditya_path = "./features/aditya_features_enhanced_full.csv"
    print(f"Loading Aditya enhanced dataset from {aditya_path}...")
    df_aditya = pd.read_csv(aditya_path)

    # Map SoLEXS features in Aditya to GOES names (consistent with LightGBM/LSTM)
    df_aditya = df_aditya.rename(columns={
        'solexs_sdd2_counts_clean': 'flux_long_raw',
        'solexs_sdd2_baseline': 'flux_long_baseline',
        'solexs_sdd2_counts_clean_zscore': 'flux_long_zscore'
    })

    feature_cols = [
        'flux_long_raw', 
        'flux_long_baseline', 
        'flux_long_zscore', 
        'solexs_flux_accel', 
        'minutes_since_last_flare', 
        'flux_prominence_10m', 
        'flux_prominence_30m',
        'solexs_fft_dom_freq',
        'solexs_fft_hl_ratio',
        'solexs_fft_entropy',
        'hel1os_fft_dom_freq',
        'hel1os_fft_hl_ratio',
        'hel1os_fft_entropy',
        'solexs_wt_cA4_energy',
        'solexs_wt_cD4_energy',
        'solexs_wt_cD3_energy',
        'solexs_wt_cD2_energy',
        'solexs_wt_cD1_energy',
        'hel1os_wt_cA4_energy',
        'hel1os_wt_cD4_energy',
        'hel1os_wt_cD3_energy',
        'hel1os_wt_cD2_energy',
        'hel1os_wt_cD1_energy',
        'neupert_phase_lag'
    ]

    print("Using feature columns:")
    for col in feature_cols:
        print(f"  - {col}")

    # Ensure timestamp is datetime and sort chronologically
    df_aditya['timestamp'] = pd.to_datetime(df_aditya['timestamp'])
    df_aditya = df_aditya.sort_values('timestamp').reset_index(drop=True)

    # 2. Chronological Split (70/15/15)
    print("\nSplitting raw dataset chronologically (70/15/15)...")
    n_rows = len(df_aditya)
    train_idx = int(n_rows * 0.7)
    val_idx = int(n_rows * 0.85)

    df_train = df_aditya.iloc[:train_idx].copy()
    df_val = df_aditya.iloc[train_idx:val_idx].copy()

    print(f"Train set size:      {len(df_train)} rows")
    print(f"Validation set size: {len(df_val)} rows")


    # 3. Train Isolation Forest ONLY on quiet-sun rows from the training set
    # Define quiet sun as rows where flare_class == 'quiet' or is_flare == False (or 0)
    quiet_mask = (df_train['flare_class'] == 'quiet') | (df_train['is_flare'] == 0) | (df_train['is_flare'] == False)
    df_train_quiet = df_train[quiet_mask].copy()
    print(f"Quiet-sun training set size: {len(df_train_quiet)} rows (out of {len(df_train)})")

    X_train_quiet = df_train_quiet[feature_cols].values
    X_val = df_val[feature_cols].values
    y_val = df_val['is_flare'].astype(int).values

    print("\nTraining Isolation Forest on quiet-sun rows...")
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.15,  # approximate flare rate
        max_samples='auto',
        random_state=42,
        n_jobs=-1
    )
    iso.fit(X_train_quiet)

    # 4. Score validation set
    print("Scoring validation set...")
    anomaly_scores = iso.decision_function(X_val)
    
    # More negative = more anomalous = more likely a flare
    # Convert to probability-like score: negate and normalize to [0,1]
    # To handle potential zero-division, check if min and max are different
    score_min = anomaly_scores.min()
    score_max = anomaly_scores.max()
    print(f"Validation raw decision function range: [{score_min:.4f}, {score_max:.4f}]")
    
    if score_max != score_min:
        iso_probs = (score_max - anomaly_scores) / (score_max - score_min)
    else:
        iso_probs = np.zeros_like(anomaly_scores)

    # 5. Find optimal threshold on validation set maximizing nowcast TSS
    print("\nOptimizing decision threshold on validation set for nowcasting (is_flare)...")
    best_tss = -2.0
    best_thresh = 0.5
    best_hss = -2.0

    thresholds = np.arange(0.05, 0.955, 0.005)
    for th in thresholds:
        y_pred = (iso_probs >= th).astype(int)
        tss = true_skill_statistic(y_val.astype(bool), y_pred)
        if tss > best_tss:
            best_tss = tss
            best_thresh = th
            best_hss = heidke_skill_score(y_val.astype(bool), y_pred)

    print(f"Optimal Threshold: {best_thresh:.4f}")
    print(f"Validation TSS:    {best_tss:.4f}")
    print(f"Validation HSS:    {best_hss:.4f}")

    # 6. Save model to ./models/isolation_forest.pkl
    os.makedirs("./models", exist_ok=True)
    model_path = "./models/isolation_forest.pkl"
    joblib.dump(iso, model_path)
    print(f"\nSaved Isolation Forest model to: {model_path}")

    # Save results to ./results/isolation_forest_results.json
    os.makedirs("./results", exist_ok=True)
    results_path = "./results/isolation_forest_results.json"
    results = {
        "tss": float(best_tss),
        "hss": float(best_hss),
        "optimal_threshold": float(best_thresh)
    }
    with open(results_path, 'w') as rf:
        json.dump(results, rf, indent=4)
    print(f"Saved Isolation Forest results to: {results_path}")

    # 7. Print anomaly score distribution for flare vs quiet rows separately
    val_flare_mask = y_val == 1
    probs_flare = iso_probs[val_flare_mask]
    probs_quiet = iso_probs[~val_flare_mask]

    print("\n==========================================")
    print("Anomaly Probability Score Distribution Stats (Normalized to [0,1]):")
    print("==========================================")
    print(f"Flare rows ({len(probs_flare)}):")
    print(f"  Mean score:   {np.mean(probs_flare):.4f}")
    print(f"  Median score: {np.median(probs_flare):.4f}")
    print(f"  Std dev:      {np.std(probs_flare):.4f}")
    print(f"  Min score:    {np.min(probs_flare):.4f}")
    print(f"  Max score:    {np.max(probs_flare):.4f}")
    print(f"Quiet rows ({len(probs_quiet)}):")
    print(f"  Mean score:   {np.mean(probs_quiet):.4f}")
    print(f"  Median score: {np.median(probs_quiet):.4f}")
    print(f"  Std dev:      {np.std(probs_quiet):.4f}")
    print(f"  Min score:    {np.min(probs_quiet):.4f}")
    print(f"  Max score:    {np.max(probs_quiet):.4f}")
    print("==========================================")

    # Save anomaly score distribution plot
    plot_path = "./results/anomaly_score_distribution.png"
    plt.figure(figsize=(10, 6))
    plt.hist(probs_quiet, bins=50, alpha=0.6, label='Quiet Sun (is_flare = False)', color='#2b5c8f', density=True)
    plt.hist(probs_flare, bins=50, alpha=0.6, label='Flare (is_flare = True)', color='#d9534f', density=True)
    plt.title('Validation Anomaly Probability Score Distribution (Isolation Forest)', fontsize=14, fontweight='bold', pad=15)
    plt.xlabel('Anomaly Probability Score (Normalized [0, 1])', fontsize=12)
    plt.ylabel('Density', fontsize=12)
    plt.legend(fontsize=11)
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.tight_layout()
    plt.savefig(plot_path, dpi=150)
    plt.close()
    print(f"Saved anomaly score distribution plot to: {plot_path}")

if __name__ == "__main__":
    main()
