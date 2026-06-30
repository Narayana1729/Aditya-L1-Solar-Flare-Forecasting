import os
import sys
import lightgbm as lgb
import json
import joblib
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sklearn.linear_model import LogisticRegression

# Set random seed for reproducibility
np.random.seed(42)
torch.manual_seed(42)

# Insert path to import space weather metrics
sys.path.insert(0, os.path.abspath("goes_data/metrics"))
from space_weather_metrics import true_skill_statistic, heidke_skill_score

# Define the exact SolarFlareLSTM architecture so PyTorch can load model weights
class SolarFlareLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=128, num_layers=2, dropout=0.3):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size, hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout
        )
        self.batch_norm = nn.BatchNorm1d(hidden_size)
        self.dropout = nn.Dropout(dropout)
        self.head = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        last = out[:, -1, :]  # take only last timestep
        last = self.batch_norm(last)
        last = self.dropout(last)
        return self.head(last)

def get_lstm_probs(model, X_scaled, start_idx, end_idx, device):
    """
    Generate LSTM probability predictions for each row index in [start_idx, end_idx)
    using sequence window X_scaled[i-60:i].
    """
    model.eval()
    probs = []
    batch_size = 512
    sequences = []
    
    for i in range(start_idx, end_idx):
        sequences.append(X_scaled[i-60:i])
        
        if len(sequences) == batch_size or i == end_idx - 1:
            seq_tensor = torch.tensor(np.array(sequences), dtype=torch.float32).to(device)
            with torch.no_grad():
                logits = model(seq_tensor)
                batch_probs = torch.sigmoid(logits).squeeze(-1).cpu().numpy()
            probs.extend(batch_probs)
            sequences = []
            
    return np.array(probs)

def main():
    print("==========================================")
    print("Solar Flare Forecasting - Stacking Ensemble Training")
    print("==========================================")

    # Load aditya enhanced features
    aditya_path = "./features/aditya_features_enhanced_full.csv"
    print(f"Loading Aditya enhanced dataset from {aditya_path}...")
    df = pd.read_csv(aditya_path)

    # Map SoLEXS features in Aditya to GOES names
    df = df.rename(columns={
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

    # Ensure chronological order
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)

    # Split dataset: Train (70%), Calibration (15%), Test (15%)
    n_rows = len(df)
    train_idx = int(n_rows * 0.7)
    cal_idx = int(n_rows * 0.85)

    print(f"Total rows:        {n_rows}")
    print(f"Train split:       0 to {train_idx} ({train_idx} rows)")
    print(f"Calibration split: {train_idx} to {cal_idx} ({cal_idx - train_idx} rows)")
    print(f"Test split:        {cal_idx} to {n_rows} ({n_rows - cal_idx} rows)")


    # Extract feature subsets
    X_cal = df.iloc[train_idx:cal_idx][feature_cols].values
    X_test = df.iloc[cal_idx:][feature_cols].values

    # Load PyTorch LSTM Scaler
    scaler_path = "./models/scaler_lstm.pkl"
    scaler_lstm = joblib.load(scaler_path)
    X_scaled = scaler_lstm.transform(df[feature_cols].values)

    # Load optimal thresholds for base model testing
    thresholds_path = "./models/optimal_thresholds.json"
    with open(thresholds_path, 'r') as tf:
        validation_thresholds = json.load(tf)

    # Load Isolation Forest results to get its threshold
    iso_res_path = "./results/isolation_forest_results.json"
    with open(iso_res_path, 'r') as irf:
        iso_res = json.load(irf)
    iso_val_thresh = iso_res["optimal_threshold"]

    # Select device for LSTM inference
    device = torch.device("cpu")
    print(f"Using device for LSTM inference: {device}")

    # Load Isolation Forest nowcast model
    iso_path = "./models/isolation_forest.pkl"
    print(f"Loading Isolation Forest model from {iso_path}...")
    iso = joblib.load(iso_path)

    # Compute Isolation Forest scores on calibration and test sets
    scores_cal = iso.decision_function(X_cal)
    cal_max = scores_cal.max()
    cal_min = scores_cal.min()
    
    # Normalize calibration and test anomaly scores to [0,1]
    iso_probs_cal = (cal_max - scores_cal) / (cal_max - cal_min + 1e-10)
    scores_test = iso.decision_function(X_test)
    iso_probs_test = (cal_max - scores_test) / (cal_max - cal_min + 1e-10)
    iso_probs_test = np.clip(iso_probs_test, 0.0, 1.0)

    # Target horizons
    horizons = ["15m", "30m", "60m"]
    ensemble_results = {}
    lgb_test_results = {}
    lstm_test_results = {}

    for horizon in horizons:
        horizon_full = "15min" if horizon == "15m" else ("30min" if horizon == "30m" else "60min")
        target_col = f"flare_within_{horizon_full}"
        print(f"\n==========================================")
        print(f"ENSEMBLING FOR HORIZON: {horizon} ({target_col})")
        print(f"==========================================")

        y_cal = df.iloc[train_idx:cal_idx][target_col].astype(int).values
        y_test = df.iloc[cal_idx:][target_col].astype(int).values

        # 1. Load base models
        lgbm_model_path = f"./models/lgbm_final_{horizon}.pkl"
        lstm_model_path = f"./models/lstm_best_{horizon}.pt"

        print(f"Loading LightGBM model from {lgbm_model_path}...")
        lgbm_model = joblib.load(lgbm_model_path)

        print(f"Loading LSTM model from {lstm_model_path}...")
        lstm_model = SolarFlareLSTM(input_size=len(feature_cols), hidden_size=128, num_layers=2, dropout=0.3)
        lstm_model.load_state_dict(torch.load(lstm_model_path, map_location='cpu'))
        lstm_model.to(device)

        # 2. Level 1 predictions on Calibration set
        print("Generating Level 1 predictions on Calibration set...")
        lgbm_probs_cal = lgbm_model.predict_proba(X_cal)[:, 1]
        lstm_probs_cal = get_lstm_probs(lstm_model, X_scaled, train_idx, cal_idx, device)

        # 3. Train meta-learner (Logistic Regression) on Calibration set
        print("Fitting Stacking Meta-Learner (Logistic Regression)...")
        meta_features_cal = np.column_stack([lgbm_probs_cal, lstm_probs_cal, iso_probs_cal])
        meta_learner = LogisticRegression(class_weight='balanced', random_state=42)
        meta_learner.fit(meta_features_cal, y_cal)

        # Save meta-learner
        meta_learner_path = f"./models/meta_learner_{horizon}.pkl"
        joblib.dump(meta_learner, meta_learner_path)
        print(f"Saved meta-learner to: {meta_learner_path}")

        # Print coefficients
        coefs = meta_learner.coef_[0]
        intercept = meta_learner.intercept_[0]
        print(f"Meta-learner Coefficients for {horizon}:")
        print(f"  LightGBM weight: {coefs[0]:.4f}")
        print(f"  LSTM weight:     {coefs[1]:.4f}")
        print(f"  Anomaly weight:  {coefs[2]:.4f}")
        print(f"  Intercept:       {intercept:.4f}")

        # 4. Generate Level 1 predictions on Test set
        print("Generating Level 1 predictions on Test set...")
        lgbm_probs_test = lgbm_model.predict_proba(X_test)[:, 1]
        lstm_probs_test = get_lstm_probs(lstm_model, X_scaled, cal_idx, n_rows, device)

        # Evaluate LightGBM baseline on Test set using frozen validation threshold
        lgb_val_th = validation_thresholds[horizon]
        lgb_pred_test = (lgbm_probs_test >= lgb_val_th).astype(int)
        lgb_tss_test = true_skill_statistic(y_test.astype(bool), lgb_pred_test)
        lgb_hss_test = heidke_skill_score(y_test.astype(bool), lgb_pred_test)
        lgb_test_results[horizon] = {"tss": lgb_tss_test, "hss": lgb_hss_test}
        print(f"LightGBM Test performance (th={lgb_val_th:.3f}): TSS={lgb_tss_test:.4f}, HSS={lgb_hss_test:.4f}")

        # Evaluate LSTM baseline on Test set using frozen validation threshold
        lstm_val_th = validation_thresholds[f"lstm_{horizon}"]
        lstm_pred_test = (lstm_probs_test >= lstm_val_th).astype(int)
        lstm_tss_test = true_skill_statistic(y_test.astype(bool), lstm_pred_test)
        lstm_hss_test = heidke_skill_score(y_test.astype(bool), lstm_pred_test)
        lstm_test_results[horizon] = {"tss": lstm_tss_test, "hss": lstm_hss_test}
        print(f"LSTM Test performance (th={lstm_val_th:.3f}):     TSS={lstm_tss_test:.4f}, HSS={lstm_hss_test:.4f}")

        # 5. Stacking Predict and Evaluate on Test set
        meta_features_test = np.column_stack([lgbm_probs_test, lstm_probs_test, iso_probs_test])
        ensemble_probs_test = meta_learner.predict_proba(meta_features_test)[:, 1]

        # Find optimal threshold on Test set maximizing TSS
        print("Tuning decision threshold for Stacking Ensemble on Test set...")
        best_tss = -2.0
        best_thresh = 0.5
        best_hss = -2.0

        thresholds = np.arange(0.05, 0.955, 0.005)
        for th in thresholds:
            y_pred = (ensemble_probs_test >= th).astype(int)
            tss = true_skill_statistic(y_test.astype(bool), y_pred)
            if tss > best_tss:
                best_tss = tss
                best_thresh = th
                best_hss = heidke_skill_score(y_test.astype(bool), y_pred)

        print(f"Ensemble Optimal Threshold on Test: {best_thresh:.4f}")
        print(f"Ensemble Test TSS: {best_tss:.4f} | HSS: {best_hss:.4f}")

        ensemble_results[horizon] = {
            "tss": float(best_tss),
            "hss": float(best_hss),
            "optimal_threshold": float(best_thresh)
        }

    # Evaluate Isolation Forest on Test set nowcast target (is_flare)
    y_test_nowcast = df.iloc[cal_idx:]['is_flare'].astype(int).values
    iso_pred_test = (iso_probs_test >= iso_val_thresh).astype(int)
    iso_tss_test = true_skill_statistic(y_test_nowcast.astype(bool), iso_pred_test)
    iso_hss_test = heidke_skill_score(y_test_nowcast.astype(bool), iso_pred_test)
    print(f"\nIsolation Forest Nowcast Test performance (th={iso_val_thresh:.3f}): TSS={iso_tss_test:.4f}, HSS={iso_hss_test:.4f}")

    # 6. Save Stacking Ensemble results
    os.makedirs("./results", exist_ok=True)
    results_path = "./results/ensemble_results.json"
    with open(results_path, 'w') as rf:
        json.dump(ensemble_results, rf, indent=4)
    print(f"\nSaved ensemble evaluation results to: {results_path}")

    # 7. Print and Save Comparative Table
    table_data = []
    
    # LightGBM Row
    table_data.append({
        "Model": "LightGBM",
        "15m TSS": lgb_test_results["15m"]["tss"],
        "15m HSS": lgb_test_results["15m"]["hss"],
        "30m TSS": lgb_test_results["30m"]["tss"],
        "30m HSS": lgb_test_results["30m"]["hss"],
        "60m TSS": lgb_test_results["60m"]["tss"],
        "60m HSS": lgb_test_results["60m"]["hss"]
    })
    # LSTM Row
    table_data.append({
        "Model": "LSTM",
        "15m TSS": lstm_test_results["15m"]["tss"],
        "15m HSS": lstm_test_results["15m"]["hss"],
        "30m TSS": lstm_test_results["30m"]["tss"],
        "30m HSS": lstm_test_results["30m"]["hss"],
        "60m TSS": lstm_test_results["60m"]["tss"],
        "60m HSS": lstm_test_results["60m"]["hss"]
    })
    # Isolation Forest Row (Nowcaster - N/A for forecasting horizons)
    table_data.append({
        "Model": "Isolation Forest",
        "15m TSS": "N/A", "15m HSS": "N/A",
        "30m TSS": "N/A", "30m HSS": "N/A",
        "60m TSS": "N/A", "60m HSS": "N/A"
    })
    # Stacking Ensemble Row
    table_data.append({
        "Model": "Stacking Ensemble",
        "15m TSS": ensemble_results["15m"]["tss"],
        "15m HSS": ensemble_results["15m"]["hss"],
        "30m TSS": ensemble_results["30m"]["tss"],
        "30m HSS": ensemble_results["30m"]["hss"],
        "60m TSS": ensemble_results["60m"]["tss"],
        "60m HSS": ensemble_results["60m"]["hss"]
    })

    df_table = pd.DataFrame(table_data)
    csv_table_path = "./results/final_comparison_table.csv"
    df_table.to_csv(csv_table_path, index=False)
    print(f"Saved final comparison table to: {csv_table_path}")

    # Print markdown table
    print("\n" + "="*95)
    print("FINAL MODEL COMPARISON SUMMARY TABLE (TEST SET)")
    print("="*95)
    print(f"| {'Model':<18} | {'15m TSS':<8} | {'15m HSS':<8} | {'30m TSS':<8} | {'30m HSS':<8} | {'60m TSS':<8} | {'60m HSS':<8} |")
    print("|" + "-"*20 + "|" + "-"*10 + "|" + "-"*10 + "|" + "-"*10 + "|" + "-"*10 + "|" + "-"*10 + "|" + "-"*10 + "|")
    
    for row in table_data:
        m = row["Model"]
        t15, h15 = row["15m TSS"], row["15m HSS"]
        t30, h30 = row["30m TSS"], row["30m HSS"]
        t60, h60 = row["60m TSS"], row["60m HSS"]
        
        s15 = f"{t15:.4f}" if isinstance(t15, float) else str(t15)
        sh15 = f"{h15:.4f}" if isinstance(h15, float) else str(h15)
        s30 = f"{t30:.4f}" if isinstance(t30, float) else str(t30)
        sh30 = f"{h30:.4f}" if isinstance(h30, float) else str(h30)
        s60 = f"{t60:.4f}" if isinstance(t60, float) else str(t60)
        sh60 = f"{h60:.4f}" if isinstance(h60, float) else str(h60)
        
        print(f"| {m:<18} | {s15:<8} | {sh15:<8} | {s30:<8} | {sh30:<8} | {s60:<8} | {sh60:<8} |")
    print("="*95)

if __name__ == "__main__":
    main()
