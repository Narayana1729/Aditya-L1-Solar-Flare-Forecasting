import pandas as pd
import os

def main():
    print("==================================================")
    print("Creating Optimized Dashboard Dataset")
    print("==================================================")
    
    features_path = "data/processed/features_with_precursors.csv"
    preds_path = "data/processed/validation_predictions.csv"
    output_path = "data/processed/dashboard_data.csv"
    
    if not os.path.exists(features_path) or not os.path.exists(preds_path):
        print("Error: Required processed data files do not exist.")
        return
        
    print(f"Loading predictions from {preds_path}...")
    df_preds = pd.read_csv(preds_path)
    print(f"Predictions loaded: {df_preds.shape}")
    
    print(f"Loading select columns from {features_path}...")
    # List the raw instrument columns we want to display on the dashboard
    use_cols = [
        'timestamp', 
        'solexs_sdd2_counts', 
        'hel1os_czt1_20_to_40_ctr', 
        'hel1os_czt1_80_to_150_ctr', 
        'hel1os_cdte1_5_to_20_ctr',
        'solexs_brightening',
        'spectral_hardening',
        'microflare_score'
    ]
    
    # Check which columns exist in features file
    df_head = pd.read_csv(features_path, nrows=5)
    existing_cols = [col for col in use_cols if col in df_head.columns]
    print(f"Existing columns to load: {existing_cols}")
    
    df_features = pd.read_csv(features_path, usecols=existing_cols)
    print(f"Features loaded: {df_features.shape}")
    
    # Merge on timestamp
    print("Merging predictions and raw instrument counts...")
    df_dashboard = pd.merge(df_preds, df_features, on='timestamp', how='inner')
    
    # Save the optimized file
    df_dashboard.to_csv(output_path, index=False)
    print(f"\n[SUCCESS] Saved optimized dashboard dataset to: {output_path}")
    print(f"Shape: {df_dashboard.shape}")
    print(f"Columns: {list(df_dashboard.columns)}")

if __name__ == "__main__":
    main()
