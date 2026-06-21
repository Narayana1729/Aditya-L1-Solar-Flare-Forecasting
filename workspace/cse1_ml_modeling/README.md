# CSE 1 — ML Lead Sandbox

Welcome to your independent workspace! You can write, test, and optimize your machine learning models here.

## Focus Areas
*   Sequential modeling: PyTorch LSTM architectures processing 60-minute lookback windows.
*   Class-weighted Loss: Handling extreme class imbalance via pos-weighted BCE.
*   Chronological splits: Ensuring no look-ahead/leaking bias during training and validation.
*   Feature scaling and normalization: Saving scalers (`scaler.pkl`) alongside checkpoints.

## Scripts
*   [train_scratch.py](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/workspace/cse1_ml_modeling/train_scratch.py): A template script to start testing your PyTorch model architectures.

## Reference Code in Main Pipeline
*   [train_lstm.py](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/src/models/train_lstm.py)
*   [build_features.py](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/src/features/build_features.py)
*   [ensemble_forecast.py](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/src/models/ensemble_forecast.py)
