import os
import torch
import torch.nn as nn
import pandas as pd
import numpy as np

# 1. Define baseline LSTM model
class SolarFlareLSTM(nn.Module):
    def __init__(self, input_dim, hidden_dim=64, num_layers=2):
        super(SolarFlareLSTM, self).__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_dim, 1)
        self.sigmoid = nn.Sigmoid()
        
    def forward(self, x):
        # x shape: (batch_size, sequence_length, input_dim)
        lstm_out, _ = self.lstm(x)
        # Gather output of the last sequence step
        last_step_out = lstm_out[:, -1, :]
        out = self.sigmoid(self.fc(last_step_out))
        return out

def test_model_training():
    """
    CSE 1 Scratch Template: Initialize LSTM and feed dummy data to verify shapes.
    """
    print("=== Testing PyTorch LSTM Modeling ===")
    
    # Model parameters
    sequence_length = 60 # 60 minutes lookback
    input_features_count = 5 # e.g. soft X-ray, hard X-ray, brightening, hardening, derivatives
    batch_size = 8
    
    # Initialize model
    model = SolarFlareLSTM(input_dim=input_features_count)
    print(model)
    
    # Mock data: (batch_size, sequence_length, features)
    mock_input = torch.randn(batch_size, sequence_length, input_features_count)
    print(f"\nMock input shape: {mock_input.shape}")
    
    # Forward pass
    with torch.no_grad():
        output = model(mock_input)
    print(f"Prediction output shape: {output.shape} (value range: [0, 1])")
    print("Sample outputs:\n", output)
    
    # Class-weighted Loss checklist
    # Standard BCE loss fails on rare events. We configure pos_weight in the loss function:
    # pos_weight = negative_samples / positive_samples
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([9.2]))
    print(f"\nLoss configured successfully with pos_weight=9.2")

if __name__ == "__main__":
    test_model_training()
