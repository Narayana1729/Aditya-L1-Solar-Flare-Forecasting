import os
import json
import threading
from pathlib import Path
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import torch
import torch.nn as nn
import joblib
from pydantic import BaseModel

# Define the PyTorch LSTM architecture exactly as it was trained
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

# Resolve base directory relative to this file
BASE_DIR = Path(__file__).resolve().parent.parent

# Global variables for data caching and ML inference
dashboard_df = None
metrics = None
feature_cols = None
scaler = None
model = None
features_df = None
timestamp_to_idx = {}

# Thread lock for stream state synchronization
stream_lock = threading.Lock()
# Simulated real-time stream state
stream_index = 0
stream_date = None  # will be set dynamically on first request

@asynccontextmanager
async def lifespan(app: FastAPI):
    global dashboard_df, metrics, feature_cols, scaler, model, features_df, timestamp_to_idx
    
    # Load metrics
    metrics_path = BASE_DIR / "data/processed/evaluation_metrics.json"
    if metrics_path.exists():
        with open(metrics_path, "r") as f:
            metrics = json.load(f)
        print(f"[SUCCESS] Loaded evaluation metrics from {metrics_path}.")
    else:
        print(f"[WARNING] Evaluation metrics JSON not found at {metrics_path}.")
        metrics = {}
        
    # Load dashboard data
    data_path = BASE_DIR / "data/processed/dashboard_data.csv"
    if data_path.exists():
        print(f"Loading dashboard data from {data_path}...")
        df = pd.read_csv(data_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Replace NaNs with None/null for JSON compatibility
        dashboard_df = df.replace({np.nan: None})
        print(f"[SUCCESS] Loaded {len(dashboard_df)} rows of dashboard data.")
    else:
        print(f"[ERROR] dashboard_data.csv not found at {data_path}! Run create_dashboard_data.py first.")

    # Load feature columns list
    feature_cols_path = BASE_DIR / "data/processed/feature_cols.txt"
    if feature_cols_path.exists():
        with open(feature_cols_path, "r") as f:
            feature_cols = [line.strip() for line in f if line.strip()]
        print(f"[SUCCESS] Loaded {len(feature_cols)} feature column names from feature_cols.txt.")
    else:
        print(f"[ERROR] feature_cols.txt not found at {feature_cols_path}!")
        feature_cols = []

    # Load scaler
    scaler_path = BASE_DIR / "data/processed/scaler.pkl"
    if scaler_path.exists():
        scaler = joblib.load(scaler_path)
        print(f"[SUCCESS] Loaded scaler from {scaler_path}.")
    else:
        print(f"[ERROR] scaler.pkl not found at {scaler_path}!")
        scaler = None

    # Load PyTorch LSTM model
    model_path = BASE_DIR / "data/processed/lstm_model.pt"
    if model_path.exists() and len(feature_cols) > 0:
        try:
            model = SolarFlareLSTM(input_dim=len(feature_cols), hidden_dim=64, num_layers=2)
            model.load_state_dict(torch.load(model_path, map_location='cpu'))
            model.eval()
            print(f"[SUCCESS] Loaded LSTM model checkpoint from {model_path}.")
        except Exception as e:
            print(f"[ERROR] Failed to load LSTM model state dict: {e}")
            model = None
    else:
        print(f"[ERROR] Could not load model: path={model_path}, feature_cols={len(feature_cols)}")
        model = None

    # Load cleaned features to perform on-the-fly lookback inference
    features_path = BASE_DIR / "data/processed/features_with_precursors.csv"
    if features_path.exists() and len(feature_cols) > 0:
        print(f"Loading feature matrix from {features_path} (loading only required columns to save RAM)...")
        try:
            features_df = pd.read_csv(features_path, usecols=feature_cols + ['timestamp'])
            # Drop rows with NaNs in features
            features_df = features_df.dropna(subset=feature_cols).reset_index(drop=True)
            features_df['timestamp'] = pd.to_datetime(features_df['timestamp'])
            
            # Map timestamps to list index for O(1) alignment lookups
            timestamp_to_idx = {ts: idx for idx, ts in enumerate(features_df['timestamp'])}
            print(f"[SUCCESS] Loaded feature matrix with {len(features_df)} rows. Aligned indices.")
        except Exception as e:
            print(f"[ERROR] Failed to load features matrix: {e}")
            features_df = None
            timestamp_to_idx = {}
    else:
        print(f"[ERROR] features_with_precursors.csv not found at {features_path}!")
        features_df = None
        timestamp_to_idx = {}
        
    yield

app = FastAPI(
    title="Aditya-L1 Solar Flare Forecasting System API",
    description="Backend API serving predictions and solar instrument measurements for Aditya-L1 Mission.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend development and tunnels
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/metrics")
def get_metrics():
    return metrics or {}

@app.get("/api/flare-dates")
def get_flare_dates():
    if dashboard_df is None:
        return []
    
    # Find dates containing any non-quiet flare activity
    df_flares = dashboard_df[dashboard_df['flare_class'] != 'quiet']
    unique_dates = sorted(df_flares['timestamp'].dt.strftime('%Y-%m-%d').unique())
    return unique_dates

@app.get("/api/flare-dates-grouped")
def get_flare_dates_grouped():
    """Return flare dates grouped by year for easier navigation."""
    if dashboard_df is None:
        return {}
    
    df_flares = dashboard_df[dashboard_df['flare_class'] != 'quiet']
    dates = sorted(df_flares['timestamp'].dt.strftime('%Y-%m-%d').unique())
    
    grouped = {}
    for d in dates:
        year = d[:4]
        grouped.setdefault(year, []).append(d)
    
    return grouped

@app.get("/api/data")
def get_data(date: str = Query(None, description="Date in YYYY-MM-DD format")):
    if dashboard_df is None:
        return []
        
    if date:
        try:
            # Filter by date
            target_date = pd.to_datetime(date).date()
            df_filtered = dashboard_df[dashboard_df['timestamp'].dt.date == target_date]
        except Exception:
            return {"error": "Invalid date format. Use YYYY-MM-DD."}
    else:
        # Default to the first day with flare activity
        df_flares = dashboard_df[dashboard_df['flare_class'] != 'quiet']
        if df_flares.empty:
            return []
        first_flare_date = df_flares['timestamp'].dt.date.min()
        target_date = first_flare_date
        df_filtered = dashboard_df[dashboard_df['timestamp'].dt.date == target_date]
        
    # Convert to JSON friendly format
    records = []
    for _, row in df_filtered.iterrows():
        rec = row.to_dict()
        # Convert timestamp to ISO format string
        rec['timestamp'] = row['timestamp'].isoformat()
        records.append(rec)
        
    return records

def compute_lstm_probs(timestamps):
    """
    Given a list of Timestamp objects, compute the corresponding LSTM probability
    on-the-fly using batched PyTorch inference.
    """
    if model is None or scaler is None or features_df is None or len(feature_cols) == 0:
        print("[WARNING] Fallback to pre-calculated lstm_prob from dashboard_df.")
        probs = []
        for ts in timestamps:
            match = dashboard_df[dashboard_df['timestamp'] == ts]
            if not match.empty:
                val = match.iloc[0]['lstm_prob']
                probs.append(float(val) if val is not None else 0.0)
            else:
                probs.append(0.0)
        return probs

    windows = []
    for ts in timestamps:
        feat_idx = timestamp_to_idx.get(ts)
        if feat_idx is not None and feat_idx >= 30:
            window = features_df[feature_cols].iloc[feat_idx - 30 : feat_idx].values
        else:
            # Fallback padding if we don't have enough lookback
            start = max(0, feat_idx - 30) if feat_idx is not None else 0
            end = feat_idx if feat_idx is not None else 0
            window = features_df[feature_cols].iloc[start:end].values
            if len(window) < 30:
                pad_len = 30 - len(window)
                if len(window) > 0:
                    pad_row = window[0]
                else:
                    pad_row = np.zeros(len(feature_cols))
                padding = np.tile(pad_row, (pad_len, 1))
                window = np.vstack([padding, window])
        windows.append(window)

    batch_size = len(windows)
    flat_windows = np.vstack(windows)
    scaled_flat = scaler.transform(flat_windows)
    scaled_windows = scaled_flat.reshape(batch_size, 30, len(feature_cols))

    input_tensor = torch.tensor(scaled_windows, dtype=torch.float32)
    with torch.no_grad():
        logits = model(input_tensor)
        probs = torch.sigmoid(logits).numpy().tolist()
        
    return probs

@app.get("/api/realtime")
def get_realtime(reset: bool = False):
    global stream_index, stream_date, dashboard_df
    if dashboard_df is None:
        return {"error": "No data loaded"}
        
    with stream_lock:
        if reset:
            stream_index = 0
            
        # If no simulation date set yet, default to first flare date
        if stream_date is None:
            df_flares = dashboard_df[dashboard_df['flare_class'] != 'quiet']
            if not df_flares.empty:
                stream_date = df_flares['timestamp'].dt.strftime('%Y-%m-%d').min()
            else:
                return {"error": "No flare data available"}
        
        # Filter data for the simulation day
        target_date = pd.to_datetime(stream_date).date()
        df_day = dashboard_df[dashboard_df['timestamp'].dt.date == target_date].reset_index(drop=True)
        
        if df_day.empty:
            return {"error": f"No data found for simulation date {stream_date}"}
            
        # If we reached the end of the day, loop back
        if stream_index >= len(df_day):
            stream_index = 0
            
        # Gather previous 30 points (for the sliding lookback)
        start_slice = max(0, stream_index - 30)
        history_slice = df_day.iloc[start_slice:stream_index+1]
        
        # Compute PyTorch model inference on the fly for all points in this history slice
        history_timestamps = history_slice['timestamp'].tolist()
        lstm_probs = compute_lstm_probs(history_timestamps)
        
        history_records = []
        for idx, (_, r) in enumerate(history_slice.iterrows()):
            rec = r.to_dict()
            rec['timestamp'] = r['timestamp'].isoformat()
            rec['lstm_prob'] = lstm_probs[idx]
            
            # Combine dynamically on backend using baseline or configured weights
            phys_val = rec.get('physics_precursor_score') or 0.0
            w_lstm = metrics.get('weight_lstm', 0.7) if metrics else 0.7
            w_physics = metrics.get('weight_physics', 0.3) if metrics else 0.3
            rec['ensemble_prob'] = lstm_probs[idx] * w_lstm + phys_val * w_physics
            history_records.append(rec)
            
        # Current row is the last element
        row = history_records[-1]
        
        # Advance index
        stream_index += 1
        
        curr_idx = stream_index - 1
        total_idx = len(df_day)
        curr_stream_date = stream_date
        
    # Calculate warning level based on ensemble probability
    prob = row['ensemble_prob'] or 0.0
    threshold = metrics.get('threshold', 0.5) if metrics else 0.5
    yellow_threshold = max(0.1, threshold - 0.2)
    if prob >= threshold:
        status = "RED"
        desc = "CRITICAL: Solar Flare Peak Imminent (< 30m)"
    elif prob >= yellow_threshold:
        status = "YELLOW"
        desc = "WARNING: Precursor heating/hardening detected"
    else:
        status = "GREEN"
        desc = "QUIET: Normal solar background activity"
        
    return {
        "current": row,
        "history": history_records,
        "warning_status": status,
        "warning_desc": desc,
        "currentIndex": curr_idx,
        "totalIndex": total_idx,
        "simulationDate": curr_stream_date
    }

@app.post("/api/set-simulation-date")
def set_simulation_date(date: str = Query(..., description="Simulation date in YYYY-MM-DD format")):
    global stream_index, stream_date, dashboard_df
    if dashboard_df is None:
        return {"error": "No data loaded"}
        
    try:
        target_date = pd.to_datetime(date).date()
        df_check = dashboard_df[dashboard_df['timestamp'].dt.date == target_date]
        if df_check.empty:
            return {"error": f"No data available for date {date}"}
        
        with stream_lock:
            stream_date = date
            stream_index = 0
            
        return {"success": True, "message": f"Simulation date set to {date}"}
    except Exception as e:
        return {"error": f"Error setting simulation date: {e}"}

class SettingsUpdate(BaseModel):
    weight_lstm: float
    weight_physics: float
    threshold: float

@app.post("/api/update-settings")
def update_settings(settings: SettingsUpdate):
    global metrics
    metrics_path = BASE_DIR / "data/processed/evaluation_metrics.json"
    if metrics is None:
        metrics = {}
    metrics["weight_lstm"] = settings.weight_lstm
    metrics["weight_physics"] = settings.weight_physics
    metrics["threshold"] = settings.threshold
    try:
        with open(metrics_path, "w") as f:
            json.dump(metrics, f, indent=4)
        return {"success": True, "message": "Settings updated successfully"}
    except Exception as e:
        return {"error": f"Failed to save settings: {e}"}

@app.get("/api/ingestion-status")
def get_ingestion_status():
    status_path = BASE_DIR / "data/raw/ingestion_status.txt"
    if not status_path.exists():
        return {
            "scanned": "N/A",
            "solexs": {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
            "hel1os": {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
            "noaa": {"present": False},
            "extraction": {"newly": 0, "skipped": 0}
        }
    
    try:
        with open(status_path, "r") as f:
            lines = f.readlines()
    except Exception as e:
        return {"error": f"Failed to read status file: {e}"}
        
    result = {
        "scanned": "N/A",
        "solexs": {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
        "hel1os": {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
        "noaa": {"present": False},
        "extraction": {"newly": 0, "skipped": 0}
    }
    
    current_section = None
    for line in lines:
        line_str = line.strip()
        if not line_str:
            continue
        if "Scan timestamp:" in line_str:
            result["scanned"] = line_str.split("Scan timestamp:", 1)[1].strip()
        elif "SOLEXS INGESTION STATS:" in line_str:
            current_section = "solexs"
        elif "HEL1OS INGESTION STATS:" in line_str:
            current_section = "hel1os"
        elif "NOAA CATALOG STATS:" in line_str:
            current_section = "noaa"
        elif "EXTRACTION OVERVIEW:" in line_str:
            current_section = "extraction"
        elif line_str.startswith("- ") and current_section:
            key_val = line_str[2:].split(":", 1)
            if len(key_val) == 2:
                key, val = key_val[0].strip(), key_val[1].strip()
                if current_section == "solexs":
                    if "zip" in key.lower():
                        result["solexs"]["zips"] = int(val.replace(",", "")) if val.replace(",", "").isdigit() else val
                    elif "data file" in key.lower():
                        result["solexs"]["files"] = int(val.replace(",", "")) if val.replace(",", "").isdigit() else val
                    elif "date range" in key.lower():
                        result["solexs"]["range"] = val
                    elif "size" in key.lower():
                        result["solexs"]["size"] = val
                elif current_section == "hel1os":
                    if "zip" in key.lower():
                        result["hel1os"]["zips"] = int(val.replace(",", "")) if val.replace(",", "").isdigit() else val
                    elif "data file" in key.lower():
                        result["hel1os"]["files"] = int(val.replace(",", "")) if val.replace(",", "").isdigit() else val
                    elif "date range" in key.lower():
                        result["hel1os"]["range"] = val
                    elif "size" in key.lower():
                        result["hel1os"]["size"] = val
                elif current_section == "noaa":
                    if "present" in key.lower():
                        result["noaa"]["present"] = (val.lower() == "true")
                elif current_section == "extraction":
                    if "newly" in key.lower():
                        result["extraction"]["newly"] = int(val.replace(",", "")) if val.replace(",", "").isdigit() else val
                    elif "skipped" in key.lower():
                        result["extraction"]["skipped"] = int(val.replace(",", "")) if val.replace(",", "").isdigit() else val
                        
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
