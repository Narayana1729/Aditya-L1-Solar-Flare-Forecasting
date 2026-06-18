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

# Resolve base directory relative to this file
BASE_DIR = Path(__file__).resolve().parent.parent

# Global variables for data caching
dashboard_df = None
metrics = None

# Thread lock for stream state synchronization
stream_lock = threading.Lock()
# Simulated real-time stream state
stream_index = 0
stream_date = None  # will be set dynamically on first request

@asynccontextmanager
async def lifespan(app: FastAPI):
    global dashboard_df, metrics
    
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
        
    yield

app = FastAPI(
    title="Aditya-L1 Solar Flare Forecasting System API",
    description="Backend API serving predictions and solar instrument measurements for Aditya-L1 Mission.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
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
            
        # Get current row and slice of previous 30 points (for the sliding lookback)
        row = df_day.iloc[stream_index].to_dict()
        row['timestamp'] = df_day.iloc[stream_index]['timestamp'].isoformat()
        
        start_slice = max(0, stream_index - 30)
        history_slice = df_day.iloc[start_slice:stream_index+1]
        
        history_records = []
        for _, r in history_slice.iterrows():
            rec = r.to_dict()
            rec['timestamp'] = r['timestamp'].isoformat()
            history_records.append(rec)
            
        # Advance index
        stream_index += 1
        
        curr_idx = stream_index - 1
        total_idx = len(df_day)
        curr_stream_date = stream_date
        
    # Calculate warning level based on ensemble probability
    prob = row['ensemble_prob'] or 0.0
    if prob >= 0.5:
        status = "RED"
        desc = "CRITICAL: Solar Flare Peak Imminent (< 30m)"
    elif prob >= 0.3:
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
