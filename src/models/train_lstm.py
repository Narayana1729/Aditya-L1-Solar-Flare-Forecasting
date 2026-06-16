import os
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
import joblib

# Set random seed for reproducibility
torch.manual_seed(42)
np.random.seed(42)

class SolarFlareDataset(Dataset):
    """
    Custom PyTorch Dataset for sliding window time-series sequences.
    """
    def __init__(self, features, targets, lookback=30):
        self.features = torch.tensor(features, dtype=torch.float32)
        self.targets = torch.tensor(targets, dtype=torch.float32)
        self.lookback = lookback

    def __len__(self):
        return len(self.features) - self.lookback

    def __getitem__(self, idx):
        # Slice lookback window of features
        x = self.features[idx : idx + self.lookback]
        # Target corresponds to the end of the window (plus the forecasting horizon)
        y = self.targets[idx + self.lookback]
        return x, y

class SolarFlareLSTM(nn.Module):
    """
    PyTorch LSTM Architecture for Solar Flare Forecasting.
    """
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
        # LSTM output: (batch_size, seq_len, hidden_dim)
        out, _ = self.lstm(x)
        # Take the output of the last sequence step
        out = out[:, -1, :]
        out = self.dropout(out)
        logits = self.fc(out)
        return logits.squeeze(-1)

def prepare_data(input_path, lookback=30, forecast_horizon=30):
    """Load, label, split, and scale features for sequence modeling."""
    df = pd.read_csv(input_path)
    
    # 1. Define target: 1 if a flare of class >= C peaks in the next forecast_horizon minutes
    df['is_flare'] = (df['flare_class'] != 'quiet') & (df['flare_class'].str[0].isin(['C', 'M', 'X']))
    # Shift target backward so that we are predicting forward
    df['target'] = df['is_flare'].shift(-forecast_horizon).fillna(0).astype(int)
    
    # Drop intermediate columns
    df = df.drop(columns=['is_flare'])
    
    # 2. Select model features (all log-transformed, rolling, lag features, and physics_precursor_score)
    exclude_cols = ['timestamp', 'flare_class', 'target']
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    
    # Drop rows with NaNs in features
    df = df.dropna(subset=feature_cols)
    
    X_raw = df[feature_cols].values
    y_raw = df['target'].values
    
    # 3. Chronological Split (80% train, 20% validation/test)
    split_idx = int(len(df) * 0.8)
    
    X_train_raw = X_raw[:split_idx]
    y_train = y_raw[:split_idx]
    
    X_val_raw = X_raw[split_idx:]
    y_val = y_raw[split_idx:]
    
    # 4. Standard Scale features
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)
    X_val = scaler.transform(X_val_raw)
    
    # Save scaler for inference/dashboard
    os.makedirs("data/processed", exist_ok=True)
    joblib.dump(scaler, "data/processed/scaler.pkl")
    
    # Save the feature columns listing so we know the order
    with open("data/processed/feature_cols.txt", "w") as f:
        f.write("\n".join(feature_cols))
        
    return X_train, y_train, X_val, y_val, len(feature_cols)

def train_model():
    print("Preparing dataset splits and scaling features...")
    X_train, y_train, X_val, y_val, input_dim = prepare_data(
        "data/processed/features_with_precursors.csv", 
        lookback=30, 
        forecast_horizon=30
    )
    
    print(f"Features dimension: {input_dim}")
    
    # Create Datasets and DataLoaders
    train_dataset = SolarFlareDataset(X_train, y_train, lookback=30)
    val_dataset = SolarFlareDataset(X_val, y_val, lookback=30)
    
    train_loader = DataLoader(train_dataset, batch_size=512, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=512, shuffle=False)
    
    # Instantiate Model
    model = SolarFlareLSTM(input_dim=input_dim, hidden_dim=64, num_layers=2)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device)
    print(f"Using device: {device}")
    
    # Calculate pos_weight for BCE loss to handle severe class imbalance
    num_pos = np.sum(y_train)
    num_neg = len(y_train) - num_pos
    pos_weight = torch.tensor([num_neg / num_pos], dtype=torch.float32).to(device)
    print(f"Class imbalance weight (pos_weight): {pos_weight.item():.4f}")
    
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    
    # Train Loop (5 epochs is sufficient for demonstration and training speed)
    epochs = 5
    best_val_loss = float('inf')
    
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * batch_x.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # Validation evaluation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                outputs = model(batch_x)
                loss = criterion(outputs, batch_y)
                val_loss += loss.item() * batch_x.size(0)
                
        val_loss /= len(val_loader.dataset)
        
        print(f"Epoch {epoch}/{epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")
        
        # Save best model weights
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), "data/processed/lstm_model.pt")
            print("  --> Saved new best model weights.")

    print("\n[SUCCESS] Model training complete!")

if __name__ == "__main__":
    train_model()
