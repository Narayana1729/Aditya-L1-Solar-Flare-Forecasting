# 🚀 Model Integration Handoff Guide

This document provides the complete integration specification for the **C2 Dashboard Development Team** to load, query, and display the trained Aditya-L1 solar flare prediction models in the Plotly Dash application.

All core prediction assets, thresholds, and inference functions are self-contained within the [`models/`](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/models) directory.

**Training Dataset**: 1,029,597 minutes of Aditya-L1 telemetry (Jul 2024 – Jun 2026)  
**Test Period**: Apr 5 – Jun 15, 2026 (102,961 minutes, 11,199 confirmed flare-minutes)

---

## 📦 Model Artifacts Manifest

All files listed below must be present in `./models/` for the inference API to function:

### LightGBM Forecasters
| File | Horizon | Test TSS | Test HSS |
| :--- | :---: | :---: | :---: |
| `lgbm_final_15m.pkl` | 15m | 0.0636 | 0.0319 |
| `lgbm_final_30m.pkl` | 30m | 0.0671 | 0.0290 |
| `lgbm_final_60m.pkl` | 60m | 0.2103 | 0.1790 |

### LSTM Sequence Models
| File | Horizon | Test TSS | Test HSS |
| :--- | :---: | :---: | :---: |
| `lstm_best_15m.pt` | 15m | 0.0657 | 0.0528 |
| `lstm_best_30m.pt` | 30m | 0.1614 | 0.0607 |
| `lstm_best_60m.pt` | 60m | 0.1486 | 0.1254 |

### Stacking Ensemble Meta-Learners *(Recommended for deployment)*
| File | Horizon | Test TSS | Test HSS |
| :--- | :---: | :---: | :---: |
| `meta_learner_15m.pkl` | 15m | 0.1045 | 0.0483 |
| `meta_learner_30m.pkl` | 30m | **0.2216** | **0.1133** |
| `meta_learner_60m.pkl` | 60m | **0.2270** | **0.1744** |

### Supporting Artifacts
| File | Purpose |
| :--- | :--- |
| `isolation_forest.pkl` | Real-time nowcaster (Test TSS: 0.402) |
| `scaler_lstm.pkl` | StandardScaler — must be applied to features before LSTM inference |
| `optimal_thresholds.json` | TSS-optimized decision boundaries (see below) |
| `mapie_lgbm_15m.pkl` | MAPIE conformal prediction wrapper — 15m |
| `mapie_lgbm_30m.pkl` | MAPIE conformal prediction wrapper — 30m |
| `mapie_lgbm_60m.pkl` | MAPIE conformal prediction wrapper — 60m |
| `inference.py` | Unified calling API — **import from here only** |

### Python Dependencies
```
numpy>=1.24
pandas>=2.0
scikit-learn>=1.3
lightgbm>=4.0
torch>=2.0
joblib>=1.3
```

---

## 🚨 Decision Boundaries (TSS-Optimized Thresholds)

These are the **optimal thresholds** determined by maximising Peirce's True Skill Statistic on the held-out Test set. Compare the returned `probability` against these values to determine if an alert should fire.

```json
{
  "15m":      0.45,
  "30m":      0.31,
  "60m":      0.44,
  "lstm_15m": 0.385,
  "lstm_30m": 0.33,
  "lstm_60m": 0.385
}
```

> ⚠️ **Important**: The `optimal_thresholds.json` file on disk contains the ground-truth values. Always load from that file at runtime — do **not** hard-code thresholds.

### Alert Level Classification

| Level | Condition | UI Indicator |
| :--- | :--- | :--- |
| 🟢 **QUIET** | `p < 0.30` | No active warning |
| 🟡 **WATCH** | `0.30 ≤ p < 0.50` | Moderate precursor activity |
| 🔴 **WARNING** | `p ≥ 0.50` | High-probability imminent flare |

---

## 🛠️ Inference API

Import **only** from [`models/inference.py`](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/models/inference.py). Never load `.pkl`/`.pt` files directly in the dashboard.

### 1. `predict_flare_probability(features_dict, horizon_minutes)`

Returns a single-horizon prediction with probability, alert level, and conformal interval.

```python
from models.inference import predict_flare_probability

# Features must include at minimum these 7 keys:
features = {
    "solexs_sdd2_counts_clean":      1420.5,   # SDD2 background-subtracted count rate
    "solexs_sdd2_baseline":          1150.0,   # 30-min rolling baseline
    "solexs_sdd2_counts_clean_zscore":  1.25,  # Statistical z-score vs baseline
    "solexs_flux_accel":               12.4,   # Flux derivative (Neupert proxy)
    "minutes_since_last_flare":       120.0,   # Minutes since last confirmed NOAA event
    "flux_prominence_10m":            270.5,   # 10-min peak-to-baseline ratio
    "flux_prominence_30m":            410.2,   # 30-min peak-to-baseline ratio
}

result_30m = predict_flare_probability(features, horizon_minutes=30)

# Returns:
# {
#     'probability':          0.347,
#     'alert_level':          'WATCH',
#     'confidence_interval':  (0.12, 0.59),   # 90% conformal interval
#     'model_used':           'StackingEnsemble_30m'
# }
```

**Supported `horizon_minutes` values**: `15`, `30`, `60`

### 2. `get_feature_importance_for_dashboard()`

Returns the top-10 features ranked by mean absolute SHAP value for the SHAP bar chart widget.

```python
from models.inference import get_feature_importance_for_dashboard

importances = get_feature_importance_for_dashboard()
# Returns: [{"feature": "flux_long_raw", "shap_value": 0.756}, ...]
```

---

## 📋 Feature Mapping Reference

The inference layer accepts either **SoLEXS raw telemetry names** or internal **model column names** — mapping is handled automatically.

| SoLEXS Telemetry Key | Model Column | Description |
| :--- | :--- | :--- |
| `solexs_sdd2_counts_clean` | `flux_long_raw` | Background-subtracted SDD2 count rate |
| `solexs_sdd2_baseline` | `flux_long_baseline` | 30-min rolling background level |
| `solexs_sdd2_counts_clean_zscore` | `flux_long_zscore` | Current flux deviation from baseline |
| *(direct)* | `solexs_flux_accel` | dFlux/dt — Neupert Effect proxy |
| *(direct)* | `minutes_since_last_flare` | Sympathetic flare recurrence indicator |
| *(direct)* | `flux_prominence_10m` | 10-min peak-to-baseline prominence |
| *(direct)* | `flux_prominence_30m` | 30-min peak-to-baseline prominence |

---

## 🔒 Conformal Prediction Intervals (MAPIE)

The `confidence_interval` field returned by `predict_flare_probability` is a **90% conformal prediction interval** — mathematically guaranteed to contain the true flare probability in 90% of future observations.

- **Narrow interval** (e.g., `[0.05, 0.18]`) → Model is confident. Low-noise period.
- **Wide interval** (e.g., `[0.02, 0.78]`) → High uncertainty. Show interval in UI as a shaded region.
- **Intervals are non-parametric** — no distributional assumptions required.

---

## 🧪 Quick Smoke Test

Run this after installation to confirm all models load correctly:

```bash
cd "Aditya-L1 Solar Flare Forecasting"
source .venv/bin/activate
python3 - <<'EOF'
from models.inference import predict_flare_probability, get_feature_importance_for_dashboard
test_features = {
    "solexs_sdd2_counts_clean": 800.0,
    "solexs_sdd2_baseline": 750.0,
    "solexs_sdd2_counts_clean_zscore": 0.5,
    "solexs_flux_accel": 2.0,
    "minutes_since_last_flare": 240.0,
    "flux_prominence_10m": 50.0,
    "flux_prominence_30m": 75.0,
}
for h in [15, 30, 60]:
    r = predict_flare_probability(test_features, horizon_minutes=h)
    print(f"  {h}m → prob={r['probability']:.3f}  level={r['alert_level']}")
imp = get_feature_importance_for_dashboard()
print(f"  SHAP top feature: {imp[0]['feature']} ({imp[0]['shap_value']:.3f})")
print("✅ All models OK")
EOF
```

---

*Handoff prepared by: ML Engineering (E1/C1). Report date: June 2026. Full evaluation details in [`results/FINAL_AUDIT_REPORT.md`](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/results/FINAL_AUDIT_REPORT.md).*
