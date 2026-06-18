"""
Generate dashboard data for the FULL timeline (2024–2026),
not just the validation split.

Runs LSTM inference on all rows of features_with_precursors.csv
and merges predictions with raw instrument columns.
"""
import os
import sys
import pandas as pd
import numpy as np
import torch
import joblib

# Allow running from project root without installing as a package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from src.utils.flare_utils import make_is_flare, make_target

# Add the models directory so we can import the LSTM architecture
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'models'))
from train_lstm import SolarFlareDataset, SolarFlareLSTM

# Ensemble weight configuration — single source of truth for dashboard
# NOTE: evaluation_metrics.json is generated with w_lstm=0.7 / w_physics=0.3
#       (see ensemble_forecast.py). The dashboard uses equal weights (0.5/0.5)
#       to produce a more conservative, display-friendly probability.
#       Adjust both consistently if you change the operational configuration.
ENSEMBLE_W_LSTM = 0.7
ENSEMBLE_W_PHYSICS = 0.3


def main():
    print("==================================================")
    print("Creating FULL-TIMELINE Dashboard Dataset")
    print("(Covers all dates: 2024, 2025, 2026)")
    print("==================================================")

    features_path  = "data/processed/features_with_precursors.csv"
    model_path     = "data/processed/lstm_model.pt"
    scaler_path    = "data/processed/scaler.pkl"
    output_path    = "data/processed/dashboard_data.csv"
    lookback       = 30
    forecast_horizon = 30

    for p in [features_path, model_path, scaler_path]:
        if not os.path.exists(p):
            print(f"Error: {p} not found. Run the pipeline first.")
            return

    # ---- 1. Load features ------------------------------------------------
    print(f"Loading features from {features_path} (this may take a moment)...")
    df = pd.read_csv(features_path)
    print(f"  Loaded {len(df)} rows, {len(df.columns)} columns")

    # Ensure flare_class is NaN-safe before using shared utility
    df['flare_class'] = df['flare_class'].fillna('quiet').astype(str)

    # Create labels using shared utility — single source of truth
    df['is_flare'] = make_is_flare(df['flare_class'])
    df['target'] = make_target(df['flare_class'], forecast_horizon=forecast_horizon)

    # Keep metadata columns separate
    meta_cols = ['timestamp', 'flare_class', 'is_flare',
                 'physics_precursor_score',
                 'solexs_sdd2_counts',
                 'hel1os_czt1_20_to_40_ctr',
                 'hel1os_czt1_80_to_150_ctr',
                 'hel1os_cdte1_5_to_20_ctr',
                 'solexs_brightening',
                 'spectral_hardening',
                 'microflare_score']
    # Only keep meta columns that actually exist
    meta_cols = [c for c in meta_cols if c in df.columns]
    df_meta = df[meta_cols].copy()

    # Feature columns (everything except label / meta)
    exclude_cols = ['timestamp', 'flare_class', 'target', 'is_flare']
    feature_cols = [c for c in df.columns if c not in exclude_cols]

    # FIX: Drop NaN rows from df first, then align df_meta by index.
    # Previously nan_mask was applied with a pre-drop boolean array which
    # could produce length mismatches if indices diverged.
    df = df[~df[feature_cols].isna().any(axis=1)].reset_index(drop=True)
    df_meta = df_meta.loc[df.index].reset_index(drop=True) if len(df) < len(df_meta) else df_meta.reset_index(drop=True)

    X_all = df[feature_cols].values
    y_all = df['target'].values

    # ---- 2. Scale ALL features with the training scaler ------------------
    print("Scaling features with saved scaler...")
    scaler = joblib.load(scaler_path)
    X_scaled = scaler.transform(X_all)

    # ---- 3. Load the trained LSTM ----------------------------------------
    input_dim = len(feature_cols)
    model = SolarFlareLSTM(input_dim=input_dim, hidden_dim=64, num_layers=2)
    # weights_only=True prevents arbitrary code execution from untrusted .pt files
    try:
        model.load_state_dict(torch.load(model_path, map_location='cpu', weights_only=True))
    except TypeError:
        # Fallback for PyTorch < 1.13
        model.load_state_dict(torch.load(model_path, map_location='cpu'))
    model.eval()
    print(f"Loaded LSTM model ({input_dim} input features)")

    # ---- 4. Run inference on the ENTIRE dataset --------------------------
    print("Running LSTM inference on full timeline...")
    dataset = SolarFlareDataset(X_scaled, y_all, lookback=lookback)
    loader  = torch.utils.data.DataLoader(dataset, batch_size=512, shuffle=False)

    lstm_probs = []
    with torch.no_grad():
        for batch_x, _ in loader:
            logits = model(batch_x)
            probs  = torch.sigmoid(logits).numpy()
            lstm_probs.extend(probs)

    lstm_probs = np.array(lstm_probs)
    print(f"  Generated {len(lstm_probs)} probability predictions")

    # ---- 5. Align metadata (first `lookback` rows are skipped by Dataset) -
    df_out = df_meta.iloc[lookback:].reset_index(drop=True).copy()
    y_out  = y_all[lookback:]

    df_out['lstm_prob']     = lstm_probs
    df_out['target']        = y_out
    phys_scores = df_out['physics_precursor_score'].fillna(0).values
    df_out['ensemble_prob'] = ENSEMBLE_W_LSTM * lstm_probs + ENSEMBLE_W_PHYSICS * phys_scores

    # Mark training / validation split
    split_idx = int(len(df) * 0.8) - lookback   # adjust for lookback offset
    df_out['split'] = 'train'
    df_out.loc[split_idx:, 'split'] = 'validation'

    # ---- 6. Save ---------------------------------------------------------
    df_out.to_csv(output_path, index=False)
    print(f"\n[SUCCESS] Saved full-timeline dashboard data to: {output_path}")
    print(f"  Shape : {df_out.shape}")
    print(f"  Columns: {list(df_out.columns)}")
    print(f"  Ensemble weights: LSTM={ENSEMBLE_W_LSTM}, Physics={ENSEMBLE_W_PHYSICS}")

    # Quick date-range summary
    df_out['timestamp'] = pd.to_datetime(df_out['timestamp'])
    print(f"\n  Timeline: {df_out['timestamp'].min()} → {df_out['timestamp'].max()}")
    flare_dates = df_out[df_out['flare_class'] != 'quiet']['timestamp'].dt.year.value_counts().sort_index()
    print(f"  Flare minutes per year:\n{flare_dates.to_string()}")


if __name__ == "__main__":
    main()
