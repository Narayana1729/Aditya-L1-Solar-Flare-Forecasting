"""
backend/main.py  —  Aditya-L1 Solar Flare Forecasting API  v2.0
================================================================
Now powered by the Stacking Ensemble (LightGBM + MAPIE) from models/inference.py.

Key changes vs v1.0:
  • Removed: inline SolarFlareLSTM class, old scaler/lstm_model.pt loading,
             compute_lstm_probs(), ENABLE_HEAVY_INFERENCE path
  • Added:   sys.path import of models/inference.py, slim 7-column merge from
             features_with_precursors.csv at startup, /api/predict, /api/shap
  • Updated: /api/realtime returns 15m / 30m / 60m predictions + conformal
             intervals + TSS-optimised alert levels from optimal_thresholds.json
  • Updated: /api/metrics returns stacking ensemble performance alongside legacy
"""

import os
import sys
import json
import threading
from pathlib import Path
from contextlib import asynccontextmanager

import pandas as pd
import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Path setup ─────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# Make models/ importable so inference.py can resolve its own asset paths
sys.path.insert(0, str(BASE_DIR / "models"))
from inference import (          # noqa: E402  (import after sys.path patch)
    predict_flare_probability,
    get_feature_importance_for_dashboard,
    load_assets_lazy,
)

# ── Inference feature columns (same 7 used by models/inference.py) ─────────────
INFERENCE_FEATURE_COLS = [
    "flux_long_raw",
    "flux_long_baseline",
    "flux_long_zscore",
    "solexs_flux_accel",
    "minutes_since_last_flare",
    "flux_prominence_10m",
    "flux_prominence_30m",
]

# ── Global state ───────────────────────────────────────────────────────────────
dashboard_df: pd.DataFrame | None = None   # simulation data + merged features
ensemble_metrics: dict = {}                # results/ensemble_results.json
legacy_metrics: dict = {}                  # data/processed/evaluation_metrics.json
optimal_thresholds: dict = {}              # models/optimal_thresholds.json
features_available: bool = False           # True once LightGBM feature cols are merged

stream_lock = threading.Lock()
stream_index: int = 0
stream_date: str | None = None


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global dashboard_df, ensemble_metrics, legacy_metrics
    global optimal_thresholds, features_available

    # 1. Legacy evaluation metrics (kept for backward-compat with old dashboard fields)
    legacy_path = BASE_DIR / "data/processed/evaluation_metrics.json"
    if legacy_path.exists():
        with open(legacy_path) as f:
            legacy_metrics = json.load(f)
        print("[SUCCESS] Loaded legacy evaluation_metrics.json.")
    else:
        print("[WARNING] legacy evaluation_metrics.json not found — using defaults.")

    # 2. Stacking ensemble performance metrics
    ensemble_path = BASE_DIR / "results/ensemble_results.json"
    if ensemble_path.exists():
        with open(ensemble_path) as f:
            ensemble_metrics = json.load(f)
        tss_30 = ensemble_metrics.get("30m", {}).get("tss", 0)
        tss_60 = ensemble_metrics.get("60m", {}).get("tss", 0)
        print(f"[SUCCESS] Stacking Ensemble metrics: TSS_30m={tss_30:.3f}, TSS_60m={tss_60:.3f}")
    else:
        print("[WARNING] results/ensemble_results.json not found.")

    # 3. Pre-load LightGBM + MAPIE models + TSS-optimised thresholds
    try:
        load_assets_lazy()
        thresh_path = BASE_DIR / "models/optimal_thresholds.json"
        with open(thresh_path) as f:
            optimal_thresholds = json.load(f)
        print("[SUCCESS] LightGBM + MAPIE inference assets loaded.")
        print(f"          Decision thresholds: 15m={optimal_thresholds.get('15m', '?'):.3f}, "
              f"30m={optimal_thresholds.get('30m', '?'):.3f}, "
              f"60m={optimal_thresholds.get('60m', '?'):.3f}")
    except Exception as e:
        print(f"[ERROR] Could not load inference assets: {e}")

    # 4. Dashboard simulation CSV
    data_path = BASE_DIR / "data/processed/dashboard_data.csv"
    if data_path.exists():
        print(f"Loading dashboard simulation data from {data_path}...")
        df = pd.read_csv(data_path)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)
        dashboard_df = df.replace({np.nan: None})
        print(f"[SUCCESS] Loaded {len(dashboard_df):,} rows of dashboard simulation data.")
    else:
        print(f"[ERROR] dashboard_data.csv not found at {data_path}! "
              "Run: python src/data/create_dashboard_data.py")

    # 5. Merge the 7 LightGBM feature columns from features_with_precursors.csv
    #    We read ONLY those 8 columns (7 features + timestamp) so the 4 GB file
    #    is never fully loaded into RAM (~50–80 MB resident after the merge).
    features_path = BASE_DIR / "data/processed/features_with_precursors.csv"
    if features_path.exists() and dashboard_df is not None:
        print("[INFO] Merging LightGBM feature columns from features_with_precursors.csv "
              "(reads 8 of ~200 columns, may take ~2 min on first run)…")
        try:
            slim_df = pd.read_csv(
                features_path,
                usecols=["timestamp"] + INFERENCE_FEATURE_COLS,
                low_memory=False,
            )
            slim_df["timestamp"] = pd.to_datetime(slim_df["timestamp"])
            dashboard_df = dashboard_df.merge(slim_df, on="timestamp", how="left")
            dashboard_df = dashboard_df.replace({np.nan: None})
            features_available = True
            print(f"[SUCCESS] Merged {len(INFERENCE_FEATURE_COLS)} inference feature columns. "
                  "Stacking Ensemble will run live per request.")
        except Exception as e:
            print(f"[ERROR] Feature merge failed — falling back to pre-computed ensemble_prob: {e}")
    elif dashboard_df is not None:
        print("[WARNING] features_with_precursors.csv not found. "
              "Serving pre-computed ensemble_prob from dashboard_data.csv.")

    yield  # ← app runs here

    # Teardown (nothing to clean up for now)


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Aditya-L1 Solar Flare Forecasting API",
    description=(
        "Serves predictions from the Stacking Ensemble (LightGBM + MAPIE conformal intervals) "
        "trained on 1,029,597 minutes of Aditya-L1 SoLEXS + HEL1OS telemetry. "
        "Best model: Stacking Ensemble 60m — TSS 0.227, HSS 0.174."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Internal helpers ───────────────────────────────────────────────────────────

def classify_alert(prob: float, horizon: int) -> str:
    """
    Map a flare probability to QUIET / WATCH / WARNING using the TSS-optimised
    thresholds from models/optimal_thresholds.json.
    Watch threshold = 60 % of warning threshold (symmetric buffer zone).
    """
    thresh = optimal_thresholds.get(f"{horizon}m", 0.45)
    watch_thresh = thresh * 0.6
    if prob >= thresh:
        return "WARNING"
    elif prob >= watch_thresh:
        return "WATCH"
    return "QUIET"


def run_ensemble_for_row(row_dict: dict) -> dict:
    """
    Extract the 7 LightGBM features from a dashboard row dict and run
    predict_flare_probability() for all three forecast horizons.

    Returns a dict keyed "15m" / "30m" / "60m", each containing:
        probability, alert_level, confidence_interval, model_used
    Any horizon whose inference fails returns None.
    Falls back gracefully (returns all Nones) if any required feature is missing.
    """
    predictions: dict = {"15m": None, "30m": None, "60m": None}

    feature_dict: dict = {}
    for col in INFERENCE_FEATURE_COLS:
        val = row_dict.get(col)
        if val is None:
            return predictions          # Feature unavailable — caller uses fallback
        feature_dict[col] = float(val)

    for horizon in [15, 30, 60]:
        try:
            pred = predict_flare_probability(feature_dict, horizon_minutes=horizon)
            predictions[f"{horizon}m"] = pred
        except Exception as exc:
            print(f"[WARNING] Inference error at {horizon}m: {exc}")

    return predictions


def make_warning_status(prob: float, horizon: int = 30) -> tuple[str, str]:
    """Convert a probability → (UI status string, description)."""
    level = classify_alert(prob, horizon)
    descriptions = {
        "WARNING": f"CRITICAL: Solar Flare Peak Imminent (<{horizon}m)",
        "WATCH":   "WARNING: Precursor heating/hardening detected",
        "QUIET":   "QUIET: Normal solar background activity",
    }
    ui_colors = {"WARNING": "RED", "WATCH": "YELLOW", "QUIET": "GREEN"}
    return ui_colors[level], descriptions[level]


def annotate_with_ensemble(rec: dict) -> dict:
    """
    Runs the stacking ensemble for a single data record dict and injects
    multi-horizon keys in-place. Returns the mutated dict.
    Falls back to pre-computed 'ensemble_prob' from the CSV if features are absent.
    """
    preds = run_ensemble_for_row(rec)

    for horizon_key in ["15m", "30m", "60m"]:
        p = preds.get(horizon_key)
        if p is not None:
            h = horizon_key[:-1]   # "15", "30", "60"
            rec[f"prob_{horizon_key}"]        = p["probability"]
            rec[f"alert_level_{horizon_key}"] = p["alert_level"]
            rec[f"ci_lower_{horizon_key}"]    = p["confidence_interval"][0]
            rec[f"ci_upper_{horizon_key}"]    = p["confidence_interval"][1]

    # Keep 'ensemble_prob' pointing at the 30m stacking ensemble for
    # backward compatibility with existing dashboard consumers
    if preds["30m"] is not None:
        rec["ensemble_prob"] = preds["30m"]["probability"]

    return rec


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/api/metrics")
def get_metrics():
    """
    Returns both the stacking ensemble skill metrics and the legacy LSTM metrics.
    The dashboard header should display 'best_tss' and 'best_hss'.
    """
    return {
        # ── New: Stacking Ensemble results per horizon ──
        "stacking_ensemble": ensemble_metrics,
        "best_model":        "Stacking Ensemble 60m",
        "best_tss":          ensemble_metrics.get("60m", {}).get("tss", 0.0),
        "best_hss":          ensemble_metrics.get("60m", {}).get("hss", 0.0),
        "optimal_thresholds": optimal_thresholds,
        "features_available": features_available,
        # ── Legacy fields kept for backward compat ──
        "legacy":        legacy_metrics,
        "threshold":     optimal_thresholds.get("30m", 0.31),
        "weight_lstm":   legacy_metrics.get("weight_lstm", 0.7),
        "weight_physics": legacy_metrics.get("weight_physics", 0.3),
    }


@app.get("/api/flare-dates")
def get_flare_dates():
    """All calendar dates that contain at least one non-quiet flare event."""
    if dashboard_df is None:
        return []
    df_flares = dashboard_df[dashboard_df["flare_class"] != "quiet"]
    return sorted(df_flares["timestamp"].dt.strftime("%Y-%m-%d").unique())


@app.get("/api/flare-dates-grouped")
def get_flare_dates_grouped():
    """Flare dates grouped by year — used by the date-picker sidebar."""
    if dashboard_df is None:
        return {}
    df_flares = dashboard_df[dashboard_df["flare_class"] != "quiet"]
    dates = sorted(df_flares["timestamp"].dt.strftime("%Y-%m-%d").unique())
    grouped: dict = {}
    for d in dates:
        grouped.setdefault(d[:4], []).append(d)
    return grouped


@app.get("/api/data")
def get_data(date: str = Query(None, description="Date in YYYY-MM-DD format")):
    """Return all telemetry rows for a given date (or the first flare date)."""
    if dashboard_df is None:
        return []
    if date:
        try:
            target_date = pd.to_datetime(date).date()
            df_filtered = dashboard_df[dashboard_df["timestamp"].dt.date == target_date]
        except Exception:
            return {"error": "Invalid date format. Use YYYY-MM-DD."}
    else:
        df_flares = dashboard_df[dashboard_df["flare_class"] != "quiet"]
        if df_flares.empty:
            return []
        target_date = df_flares["timestamp"].dt.date.min()
        df_filtered = dashboard_df[dashboard_df["timestamp"].dt.date == target_date]

    records = []
    for _, row in df_filtered.iterrows():
        rec = row.to_dict()
        rec["timestamp"] = row["timestamp"].isoformat()
        records.append(rec)
    return records


@app.get("/api/realtime")
def get_realtime(reset: bool = False):
    """
    Streaming simulation endpoint.  Advances one minute per call.

    Each response now includes stacking ensemble predictions for all three
    forecast horizons (15m / 30m / 60m) with 90% MAPIE conformal intervals
    and TSS-optimised alert levels.

    Falls back to pre-computed 'ensemble_prob' if the 7 LightGBM feature
    columns were not merged at startup (i.e. features_available == False).
    """
    global stream_index, stream_date

    if dashboard_df is None:
        return {"error": "No data loaded"}

    with stream_lock:
        if reset:
            stream_index = 0

        # Default to the first date that has flare activity
        if stream_date is None:
            df_flares = dashboard_df[dashboard_df["flare_class"] != "quiet"]
            if df_flares.empty:
                return {"error": "No flare data available"}
            stream_date = df_flares["timestamp"].dt.strftime("%Y-%m-%d").min()

        target_date = pd.to_datetime(stream_date).date()
        df_day = (
            dashboard_df[dashboard_df["timestamp"].dt.date == target_date]
            .reset_index(drop=True)
        )
        if df_day.empty:
            return {"error": f"No data found for simulation date {stream_date}"}

        if stream_index >= len(df_day):
            stream_index = 0  # loop the day

        # Sliding 30-point lookback window
        start_slice = max(0, stream_index - 30)
        history_slice = df_day.iloc[start_slice : stream_index + 1]

        history_records = []
        for _, r in history_slice.iterrows():
            rec = r.to_dict()
            rec["timestamp"] = r["timestamp"].isoformat()
            # ── Stacking Ensemble inference ──────────────────────────────
            rec = annotate_with_ensemble(rec)
            history_records.append(rec)

        row = history_records[-1]
        stream_index += 1
        curr_idx      = stream_index - 1
        total_idx     = len(df_day)
        curr_date_out = stream_date

    # Primary alert signal: 30m stacking ensemble (highest TSS for mid-range)
    primary_prob = float(row.get("ensemble_prob") or row.get("prob_30m") or 0.0)
    status, desc = make_warning_status(primary_prob, horizon=30)

    return {
        "current":        row,
        "history":        history_records,
        "warning_status": status,
        "warning_desc":   desc,
        "currentIndex":   curr_idx,
        "totalIndex":     total_idx,
        "simulationDate": curr_date_out,
        # Surface model metadata for the dashboard info panel
        "model_info": {
            "primary":          "Stacking Ensemble (LightGBM + MAPIE)",
            "horizons":         ["15m", "30m", "60m"],
            "features_live":    features_available,
            "tss_15m":          ensemble_metrics.get("15m", {}).get("tss", 0.0),
            "tss_30m":          ensemble_metrics.get("30m", {}).get("tss", 0.0),
            "tss_60m":          ensemble_metrics.get("60m", {}).get("tss", 0.0),
        },
    }


@app.post("/api/set-simulation-date")
def set_simulation_date(
    date: str = Query(..., description="Simulation date in YYYY-MM-DD format")
):
    """Jump the simulation stream to a specific date and reset the playhead."""
    global stream_index, stream_date
    if dashboard_df is None:
        return {"error": "No data loaded"}
    try:
        target_date = pd.to_datetime(date).date()
        df_check = dashboard_df[dashboard_df["timestamp"].dt.date == target_date]
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
    """Persist user-adjusted ensemble weights and alert threshold to disk."""
    global legacy_metrics
    metrics_path = BASE_DIR / "data/processed/evaluation_metrics.json"
    legacy_metrics["weight_lstm"]   = settings.weight_lstm
    legacy_metrics["weight_physics"] = settings.weight_physics
    legacy_metrics["threshold"]     = settings.threshold
    try:
        with open(metrics_path, "w") as f:
            json.dump(legacy_metrics, f, indent=4)
        return {"success": True, "message": "Settings updated successfully"}
    except Exception as e:
        return {"error": f"Failed to save settings: {e}"}


# ── NEW: /api/predict ──────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """
    Input schema for real-time single-row stacking ensemble inference.
    Accepts internal model column names OR SoLEXS telemetry aliases — the
    mapping is handled automatically inside models/inference.py.
    """
    flux_long_raw:            float   # solexs_sdd2_counts_clean
    flux_long_baseline:       float   # 30-min rolling baseline
    flux_long_zscore:         float   # z-score vs baseline
    solexs_flux_accel:        float   # dFlux/dt (Neupert proxy)
    minutes_since_last_flare: float   # sympathetic flare recurrence
    flux_prominence_10m:      float   # 10-min peak-to-baseline ratio
    flux_prominence_30m:      float   # 30-min peak-to-baseline ratio


@app.post("/api/predict")
def predict_multi_horizon(req: PredictRequest):
    """
    Run the Stacking Ensemble (LightGBM) for all three forecast horizons.

    Returns for each horizon:
      • probability          — flare probability in [0, 1]
      • alert_level          — QUIET | WATCH | WARNING (TSS-optimised)
      • confidence_interval  — 90% MAPIE conformal interval [lower, upper]
      • model_used           — model identifier string

    Example request body:
    {
        "flux_long_raw": 1420.5,
        "flux_long_baseline": 1150.0,
        "flux_long_zscore": 1.25,
        "solexs_flux_accel": 12.4,
        "minutes_since_last_flare": 120.0,
        "flux_prominence_10m": 270.5,
        "flux_prominence_30m": 410.2
    }
    """
    feature_dict = {
        "flux_long_raw":            req.flux_long_raw,
        "flux_long_baseline":       req.flux_long_baseline,
        "flux_long_zscore":         req.flux_long_zscore,
        "solexs_flux_accel":        req.solexs_flux_accel,
        "minutes_since_last_flare": req.minutes_since_last_flare,
        "flux_prominence_10m":      req.flux_prominence_10m,
        "flux_prominence_30m":      req.flux_prominence_30m,
    }

    results = {}
    for horizon in [15, 30, 60]:
        try:
            pred = predict_flare_probability(feature_dict, horizon_minutes=horizon)
            # Convert tuple → list for JSON serialisation
            pred["confidence_interval"] = list(pred["confidence_interval"])
            results[f"{horizon}m"] = pred
        except Exception as e:
            results[f"{horizon}m"] = {"error": str(e)}

    return results


# ── NEW: /api/shap ─────────────────────────────────────────────────────────────

@app.get("/api/shap")
def get_shap_importances():
    """
    Returns the top-10 features ranked by mean absolute SHAP value
    from the LightGBM 60m model.  Used to power the feature importance
    bar chart widget in the dashboard.

    Response:
      { "features": [{"feature": "flux_long_raw", "shap_value": 0.756}, ...] }
    """
    try:
        importances = get_feature_importance_for_dashboard()
        return {"features": importances}
    except Exception as e:
        return {"error": str(e), "features": []}


# ── Existing: /api/ingestion-status ───────────────────────────────────────────

@app.get("/api/ingestion-status")
def get_ingestion_status():
    """Reads ingestion_status.txt written by download_pradan.py."""
    status_path = BASE_DIR / "data/raw/ingestion_status.txt"
    if not status_path.exists():
        return {
            "scanned":    "N/A",
            "solexs":     {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
            "hel1os":     {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
            "noaa":       {"present": False},
            "extraction": {"newly": 0, "skipped": 0},
        }
    try:
        with open(status_path) as f:
            lines = f.readlines()
    except Exception as e:
        return {"error": f"Failed to read status file: {e}"}

    result = {
        "scanned":    "N/A",
        "solexs":     {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
        "hel1os":     {"zips": 0, "files": 0, "range": "N/A", "size": "N/A"},
        "noaa":       {"present": False},
        "extraction": {"newly": 0, "skipped": 0},
    }
    current_section = None

    for line in lines:
        s = line.strip()
        if not s:
            continue
        if "Scan timestamp:" in s:
            result["scanned"] = s.split("Scan timestamp:", 1)[1].strip()
        elif "SOLEXS INGESTION STATS:" in s:
            current_section = "solexs"
        elif "HEL1OS INGESTION STATS:" in s:
            current_section = "hel1os"
        elif "NOAA CATALOG STATS:" in s:
            current_section = "noaa"
        elif "EXTRACTION OVERVIEW:" in s:
            current_section = "extraction"
        elif s.startswith("- ") and current_section:
            parts = s[2:].split(":", 1)
            if len(parts) != 2:
                continue
            key, val = parts[0].strip().lower(), parts[1].strip()
            safe_int = lambda v: int(v.replace(",", "")) if v.replace(",", "").isdigit() else v  # noqa
            if current_section == "solexs":
                if "zip"       in key: result["solexs"]["zips"]  = safe_int(val)
                elif "data file" in key: result["solexs"]["files"] = safe_int(val)
                elif "date range" in key: result["solexs"]["range"] = val
                elif "size"    in key: result["solexs"]["size"]  = val
            elif current_section == "hel1os":
                if "zip"       in key: result["hel1os"]["zips"]  = safe_int(val)
                elif "data file" in key: result["hel1os"]["files"] = safe_int(val)
                elif "date range" in key: result["hel1os"]["range"] = val
                elif "size"    in key: result["hel1os"]["size"]  = val
            elif current_section == "noaa":
                if "present"   in key: result["noaa"]["present"] = val.lower() == "true"
            elif current_section == "extraction":
                if "newly"     in key: result["extraction"]["newly"]   = safe_int(val)
                elif "skipped" in key: result["extraction"]["skipped"] = safe_int(val)

    return result


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
