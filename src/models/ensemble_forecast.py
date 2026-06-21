import os
import sys
import argparse
import json
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import joblib
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support

# Allow running from project root without installing as a package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from src.utils.flare_utils import make_is_flare, make_target, tss_score, hss_score

# Define the custom Dataset locally for compatibility
class SolarFlareDataset(Dataset):
    def __init__(self, X, y, lookback=30):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)
        self.lookback = lookback

    def __len__(self):
        return len(self.X) - self.lookback

    def __getitem__(self, idx):
        x_window = self.X[idx : idx + self.lookback]
        y_label = self.y[idx + self.lookback]
        return x_window, y_label

# Define the PyTorch LSTM architecture exactly as saved in lstm_model.pt
class SolarFlareLSTM(nn.Module):
    def __init__(self, input_dim, hidden_dim=64, num_layers=2, dropout=0.2):
        super(SolarFlareLSTM, self).__init__()
        self.lstm = nn.LSTM(
            input_dim,
            hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        self.fc = nn.Linear(hidden_dim, 1)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]
        out = self.dropout(out)
        logits = self.fc(out)
        return logits.squeeze(-1)



def load_data_and_predict(input_path, model_path, scaler_path, lookback=30, forecast_horizon=30):
    """
    Load data, scale features, run LSTM predictions, and return inputs, targets,
    predictions, and metadata.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Feature file not found at {input_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")
    if not os.path.exists(scaler_path):
        raise FileNotFoundError(f"Scaler file not found at {scaler_path}")

    print(f"Loading features from {input_path}...")
    df = pd.read_csv(input_path)

    # Ensure flare_class is NaN-safe before using shared utility
    df['flare_class'] = df['flare_class'].fillna('quiet').astype(str)

    # Re-create is_flare and target columns using shared utility
    df['is_flare'] = make_is_flare(df['flare_class'])
    df['target'] = make_target(df['flare_class'], forecast_horizon=forecast_horizon)

    # Save a copy of is_flare and timestamp for event-level evaluation
    df_meta = df[['timestamp', 'flare_class', 'is_flare', 'physics_precursor_score']].copy()

    df = df.drop(columns=['is_flare'])
    exclude_cols = ['timestamp', 'flare_class', 'target']
    feature_cols = [col for col in df.columns if col not in exclude_cols]

    # FIX: Drop NaN rows from df first, then align df_meta by index.
    # Previously nan_mask was applied to df_meta using the pre-drop boolean array,
    # which could produce length mismatches if the index was not identical.
    df = df.dropna(subset=feature_cols)
    df_meta = df_meta.loc[df.index].reset_index(drop=True)
    df = df.reset_index(drop=True)

    X_raw = df[feature_cols].values
    y_raw = df['target'].values

    # Chronological Split (80% train, 20% validation/test)
    split_idx = int(len(df) * 0.8)

    X_val_raw = X_raw[split_idx:]
    y_val = y_raw[split_idx:]
    df_meta_val = df_meta.iloc[split_idx:].reset_index(drop=True)

    # Standard Scale validation features
    scaler = joblib.load(scaler_path)
    X_val = scaler.transform(X_val_raw)

    # Dataloader
    val_dataset = SolarFlareDataset(X_val, y_val, lookback=lookback)
    val_loader = DataLoader(val_dataset, batch_size=512, shuffle=False)

    # Load Model — weights_only=True prevents arbitrary code execution
    input_dim = len(feature_cols)
    model = SolarFlareLSTM(input_dim=input_dim, hidden_dim=64, num_layers=2)
    try:
        model.load_state_dict(torch.load(model_path, map_location='cpu', weights_only=True))
    except TypeError:
        # Fallback for PyTorch < 1.13 that doesn't support weights_only
        model.load_state_dict(torch.load(model_path, map_location='cpu'))
    model.eval()

    # Run predictions
    print("Running LSTM inference on validation split...")
    lstm_probs = []
    with torch.no_grad():
        for batch_x, _ in val_loader:
            logits = model(batch_x)
            probs = torch.sigmoid(logits).numpy()
            lstm_probs.extend(probs)

    lstm_probs = np.array(lstm_probs)

    # The first 'lookback' targets are skipped in Dataset, so slice validation metadata accordingly
    y_val_seq = y_val[lookback:]
    df_meta_val_seq = df_meta_val.iloc[lookback:].reset_index(drop=True)

    return lstm_probs, y_val_seq, df_meta_val_seq


def calculate_event_lead_times(timestamps, is_flare_seq, alert_triggers, forecast_horizon=30):
    """
    Calculate average lead time for predicted flare events.
    A flare event is a contiguous block where is_flare is True.
    """
    df_events = pd.DataFrame({
        'timestamp': pd.to_datetime(timestamps),
        'is_flare': is_flare_seq.astype(int),
        'alert': alert_triggers.astype(int)
    })

    # Group contiguous blocks of flares
    df_events['event_id'] = (df_events['is_flare'] != df_events['is_flare'].shift()).cumsum()
    df_events.loc[df_events['is_flare'] == 0, 'event_id'] = np.nan

    event_groups = df_events.groupby('event_id')
    total_events = 0
    detected_events = 0
    lead_times = []

    for event_id, group in event_groups:
        total_events += 1
        start_idx = group.index[0]
        start_time = group['timestamp'].iloc[0]

        # Check preceding forecast_horizon minutes for an alert trigger
        search_start = max(0, start_idx - forecast_horizon)
        preceding_window = df_events.iloc[search_start:start_idx]

        alerts_in_window = preceding_window[preceding_window['alert'] == 1]

        if not alerts_in_window.empty:
            detected_events += 1
            first_alert_time = alerts_in_window['timestamp'].iloc[0]
            lead_time = (start_time - first_alert_time).total_seconds() / 60.0
            lead_times.append(lead_time)

    avg_lead_time = np.mean(lead_times) if lead_times else 0.0
    event_recall = detected_events / total_events if total_events > 0 else 0.0

    return total_events, detected_events, avg_lead_time, event_recall


def evaluate_ensemble(lstm_probs, y_true, df_meta, w1=0.7, w2=0.3, threshold=0.5, forecast_horizon=30):
    """
    Combine LSTM and physics precursor score, evaluate and return metrics.
    Includes standard binary metrics plus heliophysics-specific TSS and HSS.
    """
    # Combined probability
    phys_scores = df_meta['physics_precursor_score'].values
    p_final = w1 * lstm_probs + w2 * phys_scores

    # Classify
    y_pred = (p_final >= threshold).astype(int)

    # Standard sklearn metrics
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average='binary', zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    # False Alarm Rate (FAR) = FP / (TP + FP)
    far = fp / (tp + fp) if (tp + fp) > 0 else 0.0

    # Heliophysics-specific skill scores from shared utility
    tss = tss_score(int(tp), int(fp), int(fn), int(tn))
    hss = hss_score(int(tp), int(fp), int(fn), int(tn))

    # Event-based Lead Time and Detection Rate
    total_events, detected_events, avg_lead_time, event_recall = calculate_event_lead_times(
        df_meta['timestamp'].values,
        df_meta['is_flare'].values,
        y_pred,
        forecast_horizon=forecast_horizon
    )

    metrics = {
        'weight_lstm': w1,
        'weight_physics': w2,
        'threshold': threshold,
        'precision': float(precision),
        'recall': float(recall),
        'f1_score': float(f1),
        'far': float(far),
        'tss': float(tss),
        'hss': float(hss),
        'tp': int(tp),
        'fp': int(fp),
        'tn': int(tn),
        'fn': int(fn),
        'total_flare_events': total_events,
        'detected_flare_events': detected_events,
        'event_recall': float(event_recall),
        'avg_lead_time_minutes': float(avg_lead_time)
    }

    return metrics, p_final


def main():
    parser = argparse.ArgumentParser(description="Evaluate Hybrid Ensemble Flare Forecast Model.")
    parser.add_argument("--w_lstm", type=float, default=0.7, help="Weight for LSTM probabilities (w1)")
    parser.add_argument("--w_phys", type=float, default=0.3, help="Weight for Physics precursor score (w2)")
    parser.add_argument("--threshold", type=float, default=0.5, help="Alert trigger threshold")
    args = parser.parse_args()

    input_path = "data/processed/features_with_precursors.csv"
    model_path = "data/processed/lstm_model.pt"
    scaler_path = "data/processed/scaler.pkl"

    print("==================================================")
    print("Evaluating Hybrid Aditya-L1 Flare Forecast Ensemble")
    print("==================================================")

    lstm_probs, y_true, df_meta = load_data_and_predict(
        input_path, model_path, scaler_path
    )

    print(f"\nEvaluating combination: LSTM weight = {args.w_lstm}, Physics weight = {args.w_phys}")
    print(f"Decision threshold: {args.threshold}")

    metrics, p_final = evaluate_ensemble(
        lstm_probs, y_true, df_meta,
        w1=args.w_lstm, w2=args.w_phys,
        threshold=args.threshold
    )

    # Save the ensemble scores back to validation df for checking/plotting
    df_val_scores = df_meta.copy()
    df_val_scores['lstm_prob'] = lstm_probs
    df_val_scores['ensemble_prob'] = p_final
    df_val_scores['target'] = y_true
    df_val_scores.to_csv("data/processed/validation_predictions.csv", index=False)
    print("Saved validation predictions to data/processed/validation_predictions.csv")

    print("\n------------------- Evaluation Metrics -------------------")
    print(f"Metric               | Value")
    print(f"----------------------------------------------------------")
    print(f"Precision            | {metrics['precision']:.4f}")
    print(f"Recall (Sensitivity) | {metrics['recall']:.4f}")
    print(f"F1-Score             | {metrics['f1_score']:.4f}")
    print(f"False Alarm Rate     | {metrics['far']:.4f}")
    print(f"TSS (Peirce SS)      | {metrics['tss']:.4f}  ← heliophysics standard")
    print(f"HSS (Heidke SS)      | {metrics['hss']:.4f}  ← heliophysics standard")
    print(f"Confusion Matrix     | TP: {metrics['tp']}, FP: {metrics['fp']}, FN: {metrics['fn']}, TN: {metrics['tn']}")
    print(f"----------------------------------------------------------")
    print(f"Total Flare Events   | {metrics['total_flare_events']}")
    print(f"Detected Events      | {metrics['detected_flare_events']} ({metrics['event_recall']*100:.1f}%)")
    print(f"Average Lead Time    | {metrics['avg_lead_time_minutes']:.2f} minutes")
    print("----------------------------------------------------------")

    # Save metrics to json
    os.makedirs("data/processed", exist_ok=True)
    with open("data/processed/evaluation_metrics.json", "w") as f:
        json.dump(metrics, f, indent=4)
    print("[SUCCESS] Evaluation metrics saved to data/processed/evaluation_metrics.json")

    # Grid search different weight combinations and thresholds to find optimal config
    print("\nGrid Search over weights and thresholds:")
    results = []
    for w_l in [0.0, 0.3, 0.5, 0.7, 1.0]:
        w_p = 1.0 - w_l
        for th in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]:
            m, _ = evaluate_ensemble(lstm_probs, y_true, df_meta, w1=w_l, w2=w_p, threshold=th)
            results.append(m)

    df_res = pd.DataFrame(results)
    df_res = df_res.sort_values('tss', ascending=False)  # Sort by TSS (heliophysics standard)

    print("\nTop 5 Configuration Combinations (Sorted by TSS):")
    print(df_res[['weight_lstm', 'weight_physics', 'threshold', 'f1_score',
                  'tss', 'hss', 'far', 'event_recall', 'avg_lead_time_minutes']].head(5).to_string(index=False))


if __name__ == "__main__":
    main()
