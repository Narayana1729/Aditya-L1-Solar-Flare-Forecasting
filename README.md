# 🛰️ Aditya-L1 Solar Flare Forecasting System

An end-to-end hybrid solar flare forecasting pipeline combining time-series deep learning (LSTM) and physics-guided precursor scoring, designed for the Aditya-L1 Mission. 

The system integrates data from the **SoLEXS (Solar Low Energy X-ray Spectrometer)** and **HEL1OS (High Energy L1 Orbiting X-ray Spectrometer)** instruments, fuses them with GOES/NOAA solar catalogs, and serves forecasting analytics via a real-time simulation dashboard.

---

## 🏗️ System Architecture

```
Aditya-L1 Solar Flare Forecasting/
├── backend/            ← FastAPI server (serves simulation and metrics)
├── dashboard/          ← Next.js + v0 dashboard app (visual telemetry, port 3001)
├── landing-page/       ← Next.js + v0 landing page (portal homepage, port 3000)
├── data/
│   ├── raw/            ← SoLEXS, HEL1OS, and GOES catalogs
│   └── processed/      ← Fused datasets, model checkpoints, and evaluation metrics
├── src/
│   ├── data/           ← Data download, ingestion, and merging pipelines
│   ├── features/       ← Lookback feature extraction and scaling
│   ├── models/         ← LSTM training, physics precursor formulation, and ensemble
│   └── utils/          ← Single source-of-truth utility for heliophysics metrics
├── Makefile            ← Pipeline orchestrator
└── requirements.txt    ← Pinned Python dependencies

```

---

## ⚡ Quick Start & Setup

### 1. Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.x` or higher
- **uv** (Optional but highly recommended for fast package management)

### 2. Environment Setup

**Python Environment:**
Using `uv`:
```bash
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```
Using standard `venv`:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Frontend Environment:**
```bash
# Setup dashboard
cd dashboard
npm install

# Setup landing page
cd ../landing-page
npm install
cd ..
```

---

## 🔄 Automated Execution Pipeline

The entire pipeline can be orchestrated sequentially using the provided `Makefile`. Make sure your environment is activated before running:

### 1. Ingestion and Merging
Prepares raw datasets and merges instrument readings with NOAA solar flare logs.
```bash
make data
```
*(Runs `src/data/ingest_data.py` and `src/data/merge_data.py`)*

### 2. Feature Engineering & Precursors
Calculates lookback intervals and extracts physics-guided precursor scores (spectral hardening, emission dynamics).
```bash
make features
```
*(Runs `src/features/build_features.py` and `src/models/physics_precursors.py`)*

### 3. Model Training
Trains the LSTM neural network using POS-weighted BCE loss, custom early stopping, and validates against the chronological split.
```bash
make train
```
*(Runs `src/models/train_lstm.py`)*

### 4. Ensemble Forecasting & Evaluation
Runs grid search to optimize the hybrid ensemble, computes heliophysics-standard metrics (TSS, HSS, F1, Recall), and exports results.
```bash
make evaluate
```
*(Runs `src/models/ensemble_forecast.py`)*

### 5. Generate Dashboard Assets
Prepares synchronized simulation data for the interactive frontend.
```bash
make dashboard-data
```
*(Runs `src/data/create_dashboard_data.py`)*

---

## 📊 Running the Application

To run the telemetry app locally:

### 1. Start the FastAPI Backend
```bash
make backend
```
The server will run at `http://localhost:8000`.

### 2. Start the Frontend Applications
**Landing Page (Port 3000):**
```bash
cd landing-page
npm run dev
```
**Dashboard App (Port 3001):**
```bash
cd dashboard
npm run dev
```

> [!NOTE]
> You can orchestrate the entire machine learning pipeline end-to-end (Steps 1–5) in one command using:
> ```bash
> make all
> ```


---

## 🛡️ Key Features & Fixes Added

- **Look-Ahead Bias Elimination**: Replaced backward fill `bfill()` operations with forward fill + dropna.
- **Thread Safety**: Simulated real-time stream endpoint in FastAPI is fully thread-safe using locking primitives.
- **Unified Logic**: Solar flare classification is centralized under a single source-of-truth utility `src/utils/flare_utils.py` to prevent training/evaluation drift.
- **Standard Heliophysics Evaluation**: Evaluated using **True Skill Statistic (TSS)** and **Heidke Skill Score (HSS)**.
