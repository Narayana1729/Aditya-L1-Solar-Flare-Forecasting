# Guide: Downloading and Verifying Aditya-L1 Data

This guide helps you retrieve the necessary Level-1 data files from the ISRO ISSDC PRADAN portal and place them in the project structure so the automated pipeline can ingest and merge them.

---

## Step 1: Download from PRADAN Portal

> [!NOTE]
> **PRADAN Portal Access Status:** Full team access has been verified and confirmed under the core project group credentials. If you need individual access or credentials reset, contact the team Lead.
> 
> **Kaggle Mirror Fallback:** In the event of PRADAN portal downtime, slow download speeds, or credential authorization delays, you can bypass the portal entirely and download the raw dataset (SoLEXS `.lc.gz` and HEL1OS `.fits` files) directly from the verified Kaggle mirror:
> **Kaggle Mirror Coordinates:** `narayana1729/aditya-l1-solar-flare-raw-mirror`
> **Kaggle Link:** [Aditya-L1 Solar Flare Raw Data Mirror (Kaggle)](https://www.kaggle.com/datasets/narayana1729/aditya-l1-solar-flare-raw-mirror)

1. Open your browser and go to the official ISRO ISSDC PRADAN portal:
   [https://pradan.issdc.gov.in/al1](https://pradan.issdc.gov.in/al1)
2. Log in using your approved credentials (or use the Kaggle mirror fallback).
3. Search for data products within your period of interest (we recommend matches to GOES flares from **July 2024 onwards**, such as the active solar flare period in **July 2024** or **October 2024**):
   - **SoLEXS (Solar Low Energy X-ray Spectrometer):** Look for Level-1 data files (`.cdf`).
   - **HEL1OS (High Energy L1 Orbiting X-ray Spectrometer):** Look for Level-1 data files (`.cdf` or `.fits` event/lightcurve data).
4. Download the files to your computer.

---

## Step 2: Organize Files in the Codebase

Move or copy your downloaded files into the respective subdirectories of this project:

*   **SoLEXS Level-1 files** go to:
    `data/raw/solexs/`
    *(Example file names: `aditya_l1_solexs_l1_...cdf`)*

*   **HEL1OS Level-1 files** go to:
    `data/raw/hel1os/`
    *(Example file names: `aditya_l1_hel1os_l1_...cdf`)*

---

## Step 3: Run Ingestion Verification

Once you have placed at least one SoLEXS and one HEL1OS file in the raw directories, run the verification script to inspect the variables and confirm that the files are being parsed correctly:

```bash
source .venv/bin/activate
python3 src/data/verify_ingestion.py
```

This script will automatically detect the files in `data/raw/solexs/` and `data/raw/hel1os/` and print:
- File metadata.
- Available variable names.
- A quick preview of timestamps and values.
