import os
import json
import pandas as pd
import numpy as np

def compute_manual_class_weights(series):
    """Compute balanced class weights manually.
    
    Equivalent to sklearn.utils.class_weight.compute_class_weight('balanced', classes=[False, True], y=series)
    Formula: n_samples / (n_classes * bincount)
    """
    total = len(series)
    counts = series.value_counts()
    
    # Ensure both True and False are represented to avoid KeyError
    n_false = counts.get(False, 0)
    n_true = counts.get(True, 0)
    
    w_false = total / (2.0 * n_false) if n_false > 0 else 1.0
    w_true = total / (2.0 * n_true) if n_true > 0 else 1.0
    
    return {
        "0": float(w_false),  # class 0 corresponds to False
        "1": float(w_true)    # class 1 corresponds to True
    }

def main():
    print("==============================================")
    print("GOES Class Imbalance Quantification & Weights (E2)")
    print("==============================================")

    labeled_path = "./goes_data/processed/goes_labeled.csv"
    processed_dir = "./goes_data/processed/"
    os.makedirs(processed_dir, exist_ok=True)
    
    if not os.path.exists(labeled_path):
        print(f"ERROR: Labeled dataset not found at {labeled_path}")
        return
        
    print(f"Loading labeled dataset from {labeled_path}...")
    df = pd.read_csv(labeled_path)
    
    total_rows = len(df)
    
    # 1. Quantify Imbalance
    print("\n1. Quantifying Class Imbalance:")
    imbalance_stats = {}
    
    target_cols = ['is_flare', 'flare_within_15min', 'flare_within_30min', 'flare_within_60min']
    
    for col in target_cols:
        counts = df[col].value_counts()
        n_false = counts.get(False, 0)
        n_true = counts.get(True, 0)
        
        pct_false = (n_false / total_rows) * 100
        pct_true = (n_true / total_rows) * 100
        
        print(f"Column '{col}':")
        print(f"  False: {n_false} ({pct_false:.3f}%)")
        print(f"  True:  {n_true} ({pct_true:.3f}%)")
        
        imbalance_stats[col] = {
            "false_count": int(n_false),
            "true_count": int(n_true),
            "false_percent": float(pct_false),
            "true_percent": float(pct_true)
        }

    # 2. Compute Class Weights
    print("\n2. Computing Class Weights (Balanced Mode):")
    class_weights = {}
    
    for col in target_cols:
        weights = compute_manual_class_weights(df[col])
        class_weights[col] = weights
        print(f"Weights for '{col}':")
        print(f"  Class 0 (False): {weights['0']:.4f}")
        print(f"  Class 1 (True):  {weights['1']:.4f}")
        
    # Save class weights to JSON
    weights_path = os.path.join(processed_dir, "class_weights.json")
    with open(weights_path, 'w') as jf:
        json.dump(class_weights, jf, indent=4)
    print(f"[SUCCESS] Class weights saved to: {weights_path}")

    # 3. Create Stratified/Balanced Sample for Exploratory Work
    print("\n3. Creating Stratified/Balanced Exploratory Sample...")
    # All flare rows
    flare_df = df[df['is_flare'] == True]
    n_flares = len(flare_df)
    
    # Equal number of random quiet rows
    quiet_df = df[df['is_flare'] == False]
    
    # Set seed for reproducibility
    np.random.seed(42)
    quiet_sample_df = quiet_df.sample(n=n_flares, random_state=42)
    
    # Combine and sort by timestamp index
    balanced_sample_df = pd.concat([flare_df, quiet_sample_df], axis=0)
    balanced_sample_df = balanced_sample_df.sort_values('timestamp').reset_index(drop=True)
    
    balanced_sample_path = os.path.join(processed_dir, "goes_balanced_sample.csv")
    
    # Write exploratory warning comment, then the CSV content
    with open(balanced_sample_path, 'w') as f:
        f.write("# exploratory only, not for final model training\n")
        balanced_sample_df.to_csv(f, index=False)
        
    print(f"[SUCCESS] Balanced exploratory sample saved to: {balanced_sample_path}")
    print(f"Sample shape: {balanced_sample_df.shape} (vs full dataset shape: {df.shape})")

    # 4. Write Class Imbalance Notes
    notes_path = os.path.join(processed_dir, "class_imbalance_notes.txt")
    print(f"\nWriting class imbalance notes to {notes_path}...")
    
    notes_content = f"""==============================================
Class Imbalance Analysis & Handling Guidelines
==============================================
Generated At: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}

1. CLASS IMBALANCE RATIOS FOUND:
"""
    for col in target_cols:
        stat = imbalance_stats[col]
        notes_content += f"""  - Target: '{col}'
      Class 0 (False): {stat['false_count']} rows ({stat['false_percent']:.3f}%)
      Class 1 (True):  {stat['true_count']} rows ({stat['true_percent']:.3f}%)
"""
    
    notes_content += """
2. WHY SMOTE / RESAMPLING WAS AVOIDED:
  - Temporal Autocorrelation: Synthetic oversampling (like SMOTE) interpolates between high-dimensional features. This breaks the sequential temporal autocorrelation of time-series, which is the foundational signal needed for Recurrent Neural Networks (LSTM/GRU) or convolutional architectures.
  - Physical Implausibility: Synthetically generated solar X-ray flux values do not follow the physical solar-flare rise-and-decay decay profile (fast rise, slow exponential decay). SMOTE would create physically implausible peaks and noise that corrupt training signals.
  - Test Set Integrity: Resampling the training set can lead to leakages if not carefully split chronologically first.

3. DOWNSTREAM INTEGRATION IN MODEL LOSS (C1 Handoff):
  - The computed class weights in `class_weights.json` are designed to be plugged directly into loss functions.
  - In PyTorch, use `nn.BCEWithLogitsLoss(pos_weight=torch.tensor([weight_class_1]))` for binary targets.
  - This avoids modifying the underlying physical time-series timeline while forcing the optimizer to penalize false negatives on rare flare events appropriately.
"""
    
    with open(notes_path, 'w') as nf:
        nf.write(notes_content)
        
    print("Class imbalance notes successfully written.")

if __name__ == "__main__":
    main()
