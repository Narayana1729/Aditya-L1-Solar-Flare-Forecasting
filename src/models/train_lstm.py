import os
import sys
import json
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import joblib

# Set random seed for reproducibility
torch.manual_seed(42)
np.random.seed(42)

# Insert path to import space weather metrics
sys.path.insert(0, os.path.abspath("goes_data/metrics"))
from space_weather_metrics import true_skill_statistic, heidke_skill_score

# Define the custom Dataset
class SolarFlareSeqDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

# Define SolarFlareLSTM architecture exactly as specified in user request
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

def build_sliding_windows(X_scaled, y_labels, window_size=60):
    """
    Build sequence windows of shape (60, n_features).
    For each row i (from row 60 onwards), X[i] contains rows [i-60:i].
    y[i] is the label at row i.
    """
    X_seq = []
    y_seq = []
    for i in range(window_size, len(X_scaled)):
        X_seq.append(X_scaled[i - window_size : i])
        y_seq.append(y_labels[i])
    return np.array(X_seq), np.array(y_seq)

def main():
    print("==========================================")
    print("Solar Flare Forecasting - PyTorch LSTM training")
    print("==========================================")

        # 1. Load aditya_features_enhanced_full.csv, class_weights.json, and optimal_thresholds.json
    aditya_path = "./features/aditya_features_enhanced_full.csv"
    weights_path = "./goes_data/processed/class_weights.json"
    thresholds_path = "./models/optimal_thresholds.json"

    print(f"Loading Aditya enhanced dataset from {aditya_path}...")
    df_aditya = pd.read_csv(aditya_path)

    print(f"Loading class weights from {weights_path}...")
    with open(weights_path, 'r') as wf:
        class_weights = json.load(wf)

    print(f"Loading optimal thresholds from {thresholds_path}...")
    with open(thresholds_path, 'r') as tf:
        lgbm_thresholds = json.load(tf)

    # Map SoLEXS features in Aditya to GOES names (identical to LightGBM baseline)
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
        'flux_prominence_30m'
    ]

    print("Using feature columns:")
    for col in feature_cols:
        print(f"  - {col}")

    # Ensure timestamp is datetime and sort chronologically
    df_aditya['timestamp'] = pd.to_datetime(df_aditya['timestamp'])
    df_aditya = df_aditya.sort_values('timestamp').reset_index(drop=True)

    # Split raw data at 70% and 85% marks chronologically (70/15/15)
    print("\nSplitting raw dataset chronologically (70/15/15)...")
    n_rows = len(df_aditya)
    train_idx = int(n_rows * 0.7)
    val_idx = int(n_rows * 0.85)

    df_train = df_aditya.iloc[:train_idx].copy()
    df_val = df_aditya.iloc[train_idx:val_idx].copy()


    # Scale the features
    print("Fitting StandardScaler on training features and transforming train/val...")
    scaler = StandardScaler()
    X_train_raw = df_train[feature_cols].values
    X_val_raw = df_val[feature_cols].values

    X_train_scaled = scaler.fit_transform(X_train_raw)
    X_val_scaled = scaler.transform(X_val_raw)

    # Save LSTM scaler
    os.makedirs("./models", exist_ok=True)
    scaler_path = "./models/scaler_lstm.pkl"
    joblib.dump(scaler, scaler_path)
    print(f"Saved LSTM scaler to: {scaler_path}")

    # Select device (falls back to CPU if MPS is not available or supported)
    device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
    print(f"Using PyTorch device: {device}")


    # Setup list of horizons to train
    horizons = ["15min", "30min", "60min"]
    lstm_results = {}

    for horizon in horizons:
        horizon_short = horizon.replace("min", "m")
        target_col = f"flare_within_{horizon}"
        print(f"\n==========================================")
        print(f"TRAINING LSTM FOR HORIZON: {horizon} ({target_col})")
        print(f"==========================================")

        # Extract targets
        y_train_raw = df_train[target_col].astype(int).values
        y_val_raw = df_val[target_col].astype(int).values

        # Build sliding window datasets (window size = 60)
        X_train_seq, y_train_seq = build_sliding_windows(X_train_scaled, y_train_raw, window_size=60)
        X_val_seq, y_val_seq = build_sliding_windows(X_val_scaled, y_val_raw, window_size=60)

        print(f"Number of training sequences:   {len(X_train_seq)}")
        print(f"Number of validation sequences: {len(X_val_seq)}")

        # Create DataLoaders
        train_dataset = SolarFlareSeqDataset(X_train_seq, y_train_seq)
        val_dataset = SolarFlareSeqDataset(X_val_seq, y_val_seq)

        train_loader = DataLoader(train_dataset, batch_size=256, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=256, shuffle=False)

        # Load starting threshold from LightGBM
        lgb_thresh = lgbm_thresholds[horizon_short]
        print(f"LightGBM threshold for horizon {horizon_short} (evaluation starting point): {lgb_thresh:.4f}")

        # Instantiate Model
        model = SolarFlareLSTM(input_size=len(feature_cols), hidden_size=128, num_layers=2, dropout=0.3)
        model.to(device)

        # Loss function with pos_weight from class_weights
        pos_weight_val = class_weights[target_col]["1"]
        criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pos_weight_val], dtype=torch.float32).to(device))
        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

        # Save paths
        model_save_path = f"./models/lstm_best_{horizon_short}.pt"

        # Train loop
        max_epochs = 50
        patience = 10
        best_val_tss = -2.0
        epochs_no_improve = 0

        for epoch in range(1, max_epochs + 1):
            # Training phase
            model.train()
            train_loss = 0.0
            for batch_X, batch_y in train_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                
                optimizer.zero_grad()
                logits = model(batch_X)
                loss = criterion(logits, batch_y.unsqueeze(-1))
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item() * len(batch_X)
            train_loss /= len(train_loader.dataset)

            # Validation phase
            model.eval()
            val_loss = 0.0
            y_prob_val = []
            with torch.no_grad():
                for batch_X, batch_y in val_loader:
                    batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                    logits = model(batch_X)
                    loss = criterion(logits, batch_y.unsqueeze(-1))
                    val_loss += loss.item() * len(batch_X)
                    
                    probs = torch.sigmoid(logits).squeeze(-1)
                    y_prob_val.extend(probs.cpu().numpy())
            
            val_loss /= len(val_loader.dataset)
            y_prob_val = np.array(y_prob_val)

            # Step scheduler
            scheduler.step(val_loss)

            # Compute validation TSS at LGBM threshold
            y_pred_val = (y_prob_val >= lgb_thresh).astype(int)
            val_tss = true_skill_statistic(y_val_seq.astype(bool), y_pred_val)

            print(f"Epoch {epoch:2d}/{max_epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val TSS (at LGBM th={lgb_thresh:.3f}): {val_tss:.4f}")

            # Check if this is the best model based on validation TSS
            if val_tss > best_val_tss:
                best_val_tss = val_tss
                epochs_no_improve = 0
                torch.save(model.state_dict(), model_save_path)
                print(f"  --> Saved best model checkpoint to {model_save_path}")
            else:
                epochs_no_improve += 1
                if epochs_no_improve >= patience:
                    print(f"Early stopping triggered after {patience} epochs without validation TSS improvement.")
                    break

        print(f"Training for {horizon} complete. Loading best checkpoint weights for threshold search...")
        # Load best weights
        model.load_state_dict(torch.load(model_save_path))
        model.eval()

        # Compute validation probabilities using the best model
        y_prob_val = []
        with torch.no_grad():
            for batch_X, _ in val_loader:
                batch_X = batch_X.to(device)
                logits = model(batch_X)
                probs = torch.sigmoid(logits).squeeze(-1)
                y_prob_val.extend(probs.cpu().numpy())
        y_prob_val = np.array(y_prob_val)

        # Threshold search (try 0.05 to 0.95 in steps of 0.005)
        print("Finding optimal decision threshold for LSTM on validation set...")
        best_lstm_thresh = 0.5
        best_lstm_tss = -2.0
        best_lstm_hss = -2.0

        thresholds = np.arange(0.05, 0.955, 0.005)
        for th in thresholds:
            y_pred = (y_prob_val >= th).astype(int)
            tss = true_skill_statistic(y_val_seq.astype(bool), y_pred)
            if tss > best_lstm_tss:
                best_lstm_tss = tss
                best_lstm_thresh = th
                best_lstm_hss = heidke_skill_score(y_val_seq.astype(bool), y_pred)

        print(f"LSTM Optimal Threshold: {best_lstm_thresh:.4f}")
        print(f"LSTM Validation TSS:    {best_lstm_tss:.4f}")
        print(f"LSTM Validation HSS:    {best_lstm_hss:.4f}")

        # Store optimal threshold and evaluation results
        lgbm_thresholds[f"lstm_{horizon_short}"] = float(best_lstm_thresh)
        lstm_results[horizon_short] = {
            "tss": float(best_lstm_tss),
            "hss": float(best_lstm_hss),
            "optimal_threshold": float(best_lstm_thresh)
        }

    # Save updated optimal thresholds
    with open(thresholds_path, 'w') as tf:
        json.dump(lgbm_thresholds, tf, indent=4)
    print(f"\nUpdated optimal thresholds saved to: {thresholds_path}")

    # Save LSTM results
    results_path = "./results/lstm_results.json"
    with open(results_path, 'w') as rf:
        json.dump(lstm_results, rf, indent=4)
    print(f"LSTM evaluation results saved to: {results_path}")

    # Print comparative table
    # Load LightGBM results
    lgbm_results_path = "./results/lgbm_aditya_results.json"
    with open(lgbm_results_path, 'r') as lf:
        lgbm_results = json.load(lf)

    print("\n" + "="*80)
    print("COMPARATIVE EVALUATION SUMMARY: LightGBM vs. LSTM")
    print("="*80)
    print(f"| {'Horizon':<7} | {'LightGBM TSS':<12} | {'LightGBM HSS':<12} | {'LSTM TSS':<12} | {'LSTM HSS':<12} |")
    print("|" + "-"*9 + "|" + "-"*14 + "|" + "-"*14 + "|" + "-"*14 + "|" + "-"*14 + "|")
    
    for horizon in ["15m", "30m", "60m"]:
        horizon_name = "15 min" if horizon == "15m" else ("30 min" if horizon == "30m" else "60 min")
        lgb_tss = lgbm_results.get(horizon, {}).get("tss", 0.0)
        lgb_hss = lgbm_results.get(horizon, {}).get("hss", 0.0)
        lstm_tss = lstm_results.get(horizon, {}).get("tss", 0.0)
        lstm_hss = lstm_results.get(horizon, {}).get("hss", 0.0)
        print(f"| {horizon_name:<7} | {lgb_tss:<12.4f} | {lgb_hss:<12.4f} | {lstm_tss:<12.4f} | {lstm_hss:<12.4f} |")
    print("="*80)

if __name__ == "__main__":
    main()
