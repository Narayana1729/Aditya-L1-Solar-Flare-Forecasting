import os
import sys
import json
import joblib
import pandas as pd
import numpy as np
import lightgbm as lgb
import optuna

# Insert path to import space weather metrics
sys.path.insert(0, os.path.abspath("goes_data/metrics"))
from space_weather_metrics import true_skill_statistic, heidke_skill_score

# Set optuna verbosity to warning to avoid flooding logs
optuna.logging.set_verbosity(optuna.logging.WARNING)

def find_optimal_threshold(y_true, y_prob):
    thresholds = np.arange(0.05, 0.955, 0.005)
    best_tss = -2.0
    best_thresh = 0.5
    best_hss = -2.0
    
    for th in thresholds:
        y_pred = y_prob >= th
        tss = true_skill_statistic(y_true.astype(bool), y_pred)
        if tss > best_tss:
            best_tss = tss
            best_thresh = th
            best_hss = heidke_skill_score(y_true.astype(bool), y_pred)
            
    return float(best_thresh), float(best_tss), float(best_hss)

def main():
    print("==========================================")
    print("Solar Flare Forecasting - LightGBM Fine-tuning (Full Dataset)")
    print("==========================================")
    
    # 1. Load aditya_features_enhanced_full.csv
    aditya_path = "./features/aditya_features_enhanced_full.csv"
    if not os.path.exists(aditya_path):
        print(f"ERROR: Dataset not found at {aditya_path}. Run build_full_aditya_dataset.py first.")
        return
        
    print(f"Loading Aditya full dataset from {aditya_path}...")
    df_aditya = pd.read_csv(aditya_path)
    
    # Map SoLEXS features in Aditya to GOES names:
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
    
    # 2. Chronological split of Aditya-L1 data
    print("Splitting Aditya-L1 data chronologically (70% Train, 15% Val, 15% Test)...")
    df_aditya['timestamp'] = pd.to_datetime(df_aditya['timestamp'])
    df_aditya = df_aditya.sort_values('timestamp').reset_index(drop=True)
    
    n_rows = len(df_aditya)
    train_idx = int(n_rows * 0.7)
    val_idx = int(n_rows * 0.85)
    
    df_train = df_aditya.iloc[:train_idx].copy()
    df_val = df_aditya.iloc[train_idx:val_idx].copy()
    
    print(f"Train set:      {len(df_train)} rows ({df_train['timestamp'].min()} to {df_train['timestamp'].max()})")
    print(f"Validation set: {len(df_val)} rows ({df_val['timestamp'].min()} to {df_val['timestamp'].max()})")
    
    horizons = ["15min", "30min", "60min"]
    aditya_results = {}
    optimal_thresholds = {}
    
    # We will use TimeSeriesSplit for CV
    from sklearn.model_selection import TimeSeriesSplit
    
    for horizon in horizons:
        horizon_short = horizon.replace("min", "m")
        target_col = f"flare_within_{horizon}"
        print(f"\n------------------------------------------")
        print(f"Fine-tuning LightGBM for horizon: {horizon} ({target_col})")
        print(f"------------------------------------------")
        
        # Prepare arrays
        X_train_full = df_train[feature_cols].values
        y_train_full = df_train[target_col].astype(int).values
        
        X_val = df_val[feature_cols].values
        y_val = df_val[target_col].astype(int).values
        
        # Define Optuna objective function
        def objective(trial):
            params = {
                'objective': 'binary',
                'is_unbalance': True,
                'learning_rate': trial.suggest_float('lr', 0.01, 0.2, log=True),
                'num_leaves': trial.suggest_int('num_leaves', 31, 255),
                'max_depth': trial.suggest_int('max_depth', 4, 12),
                'min_child_samples': trial.suggest_int('min_child_samples', 20, 200),
                'subsample': trial.suggest_float('subsample', 0.5, 1.0),
                'colsample_bytree': trial.suggest_float('colsample', 0.5, 1.0),
                'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
                'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
                'n_estimators': 500,
                'verbose': -1
            }
            
            tscv = TimeSeriesSplit(n_splits=5)
            tss_scores = []
            
            for train_i, val_i in tscv.split(X_train_full):
                model = lgb.LGBMClassifier(**params)
                model.fit(
                    X_train_full[train_i], y_train_full[train_i],
                    eval_set=[(X_train_full[val_i], y_train_full[val_i])],
                    callbacks=[lgb.early_stopping(30, verbose=False)]
                )
                probs = model.predict_proba(X_train_full[val_i])[:, 1]
                best_tss = max(
                    true_skill_statistic(y_train_full[val_i].astype(bool), (probs >= t).astype(int))
                    for t in np.arange(0.1, 0.9, 0.05)
                )
                tss_scores.append(best_tss)
                
            return np.mean(tss_scores)
            
        print("Running Optuna hyperparameter optimization...")
        study = optuna.create_study(direction='maximize')
        study.optimize(objective, n_trials=30, timeout=300)
        
        print("Best params found:")
        print(json.dumps(study.best_params, indent=2))
        
        # Train final model with best params on full Aditya-L1 training set, warm-started from pretrained model
        print("\nTraining final fine-tuned model...")
        best_params = {
            'objective': 'binary',
            'is_unbalance': True,
            'learning_rate': study.best_params['lr'],
            'num_leaves': study.best_params['num_leaves'],
            'max_depth': study.best_params['max_depth'],
            'min_child_samples': study.best_params['min_child_samples'],
            'subsample': study.best_params['subsample'],
            'colsample_bytree': study.best_params['colsample'],
            'reg_alpha': study.best_params['reg_alpha'],
            'reg_lambda': study.best_params['reg_lambda'],
            'n_estimators': 500,
            'verbose': -1
        }
        
        goes_model_file = f"./models/lgbm_pretrained_goes_{horizon_short}.pkl"
        pretrained_model = None
        if os.path.exists(goes_model_file):
            print(f"Loading pretrained GOES model: {goes_model_file}")
            pretrained_model = joblib.load(goes_model_file)
            
        final_model = lgb.LGBMClassifier(**best_params)
        final_model.fit(
            X_train_full, y_train_full,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(30, verbose=False)],
            init_model=pretrained_model
        )
        
        # Threshold tuning on Aditya-L1 validation set
        print("Running threshold tuning on Aditya validation set...")
        y_prob_val = final_model.predict_proba(X_val)[:, 1]
        opt_th, tss_val, hss_val = find_optimal_threshold(y_val, y_prob_val)
        
        print(f"Optimal threshold: {opt_th:.3f}")
        print(f"Validation TSS:    {tss_val:.4f}")
        print(f"Validation HSS:    {hss_val:.4f}")
        
        # Save final model
        final_model_path = f"./models/lgbm_final_{horizon_short}.pkl"
        joblib.dump(final_model, final_model_path)
        print(f"Saved fine-tuned model to: {final_model_path}")
        
        optimal_thresholds[horizon_short] = opt_th
        aditya_results[horizon_short] = {
            "tss": tss_val,
            "hss": hss_val,
            "optimal_threshold": opt_th
        }
        
    # Save optimal thresholds
    thresholds_path = "./models/optimal_thresholds.json"
    with open(thresholds_path, 'w') as jf:
        json.dump(optimal_thresholds, jf, indent=4)
    print(f"\nSaved optimal thresholds to: {thresholds_path}")
    
    # Save results to json
    results_path = "./results/lgbm_aditya_results.json"
    with open(results_path, 'w') as jf:
        json.dump(aditya_results, jf, indent=4)
    print(f"Saved Aditya results to: {results_path}")

if __name__ == "__main__":
    main()
