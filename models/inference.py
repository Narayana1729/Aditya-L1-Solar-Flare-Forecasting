import os
import json
import joblib
import numpy as np
import pandas as pd

# Resolve base directory relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Feature names in the exact order expected by the LightGBM models
FEATURE_COLS = [
    'flux_long_raw', 
    'flux_long_baseline', 
    'flux_long_zscore', 
    'solexs_flux_accel', 
    'minutes_since_last_flare', 
    'flux_prominence_10m', 
    'flux_prominence_30m'
]

# Mapping dictionary for SoLEXS to GOES names (for user convenience)
NAME_MAPPING = {
    'solexs_sdd2_counts_clean': 'flux_long_raw',
    'solexs_sdd2_baseline': 'flux_long_baseline',
    'solexs_sdd2_counts_clean_zscore': 'flux_long_zscore'
}

# Global dictionary caches for lazy loading
LGBM_MODELS = {}
MAPIE_MODELS = {}
THRESHOLDS = None

def load_assets_lazy():
    """
    Lazy load LightGBM, MAPIE, and optimal thresholds from models directory.
    """
    global THRESHOLDS
    
    # 1. Load thresholds if not already loaded
    if THRESHOLDS is None:
        thresh_path = os.path.join(BASE_DIR, "optimal_thresholds.json")
        if not os.path.exists(thresh_path):
            raise FileNotFoundError(f"Thresholds file not found at {thresh_path}")
        with open(thresh_path, "r") as f:
            THRESHOLDS = json.load(f)
            
    # 2. Load LightGBM and Mapie models for 15, 30, and 60 min horizons
    for horizon in [15, 30, 60]:
        if horizon not in LGBM_MODELS:
            lgbm_path = os.path.join(BASE_DIR, f"lgbm_final_{horizon}m.pkl")
            if not os.path.exists(lgbm_path):
                # Check for alternative filename (e.g. without 'm')
                lgbm_path_alt = os.path.join(BASE_DIR, f"lgbm_final_{horizon}.pkl")
                if os.path.exists(lgbm_path_alt):
                    lgbm_path = lgbm_path_alt
                else:
                    raise FileNotFoundError(f"LightGBM model not found at {lgbm_path}")
            LGBM_MODELS[horizon] = joblib.load(lgbm_path)
            
        if horizon not in MAPIE_MODELS:
            mapie_path = os.path.join(BASE_DIR, f"mapie_lgbm_{horizon}m.pkl")
            if not os.path.exists(mapie_path):
                # Check for alternative filename
                mapie_path_alt = os.path.join(BASE_DIR, f"mapie_lgbm_{horizon}.pkl")
                if os.path.exists(mapie_path_alt):
                    mapie_path = mapie_path_alt
                else:
                    raise FileNotFoundError(f"MAPIE model not found at {mapie_path}")
            MAPIE_MODELS[horizon] = joblib.load(mapie_path)

def predict_flare_probability(feature_row_dict, horizon_minutes=15):
    """
    Takes a single row of features as a dict and returns flare probability.
    Used by C2's Plotly Dash dashboard for real-time inference.
    
    Args:
        feature_row_dict: dict of feature_name -> value for current timestep
        horizon_minutes: 15, 30, or 60
    
    Returns:
        dict with keys:
            'probability': float [0,1]
            'alert_level': str ('QUIET', 'WATCH', 'WARNING')
            'confidence_interval': tuple (lower, upper) at 90% coverage
            'model_used': str
    """
    # 1. Enforce horizon constraint
    if horizon_minutes not in [15, 30, 60]:
        raise ValueError("horizon_minutes must be 15, 30, or 60")
        
    # 2. Ensure assets are loaded
    load_assets_lazy()
    
    # 3. Map SoLEXS features in input dict if present
    mapped_dict = {}
    for k, v in feature_row_dict.items():
        mapped_key = NAME_MAPPING.get(k, k)
        mapped_dict[mapped_key] = v
        
    # 4. Extract inputs in the strict model order
    X_row = []
    missing_cols = []
    for col in FEATURE_COLS:
        if col in mapped_dict:
            X_row.append(mapped_dict[col])
        else:
            missing_cols.append(col)
            
    if missing_cols:
        raise KeyError(
            f"Missing required features in input dictionary: {missing_cols}. "
            f"Expected keys (or SoLEXS equivalents): {FEATURE_COLS}"
        )
        
    # 5. Build a named DataFrame so LightGBM receives column names it was trained with
    #    (avoids sklearn UserWarning: "X does not have valid feature names")
    X_input = pd.DataFrame([X_row], columns=FEATURE_COLS)

    # 6. Predict probability using LightGBM
    lgbm_model = LGBM_MODELS[horizon_minutes]
    prob = float(lgbm_model.predict_proba(X_input)[0, 1])
    
    # 6. Calculate alert level
    if prob < 0.3:
        alert_level = "QUIET"
    elif prob < 0.5:
        alert_level = "WATCH"
    else:
        alert_level = "WARNING"
        
    # 7. Calculate conformal confidence interval at 90% coverage
    mapie_data = MAPIE_MODELS.get(horizon_minutes)
    q = mapie_data["quantile"]
    lower = max(0.0, prob - q)
    upper = min(1.0, prob + q)
    confidence_interval = [float(lower), float(upper)]   # list → JSON-serialisable

    return {
        'probability':         prob,
        'alert_level':         alert_level,
        'confidence_interval': confidence_interval,
        'model_used':          f"LightGBM_{horizon_minutes}m",
    }

def get_feature_importance_for_dashboard():
    """
    Returns top 10 features and their SHAP values for live display in dashboard.
    Loads from the pre-computed SHAP results to ensure instant loading.
    
    Returns:
        list of dict: [{"feature": name, "shap_value": val}, ...]
    """
    results_dir = os.path.join(BASE_DIR, "..", "results")
    shap_path = os.path.join(results_dir, "shap_top20_features.json")
    
    if os.path.exists(shap_path):
        with open(shap_path, "r") as f:
            top20 = json.load(f)
        return top20[:10]
    else:
        # Fallback values if JSON does not exist
        return [
            {"feature": "flux_long_raw", "shap_value": 0.8652},
            {"feature": "flux_long_zscore", "shap_value": 0.7388},
            {"feature": "flux_long_baseline", "shap_value": 0.4823},
            {"feature": "flux_prominence_30m", "shap_value": 0.1281},
            {"feature": "flux_prominence_10m", "shap_value": 0.0597},
            {"feature": "solexs_flux_accel", "shap_value": 0.0181},
            {"feature": "minutes_since_last_flare", "shap_value": 0.0}
        ][:10]
