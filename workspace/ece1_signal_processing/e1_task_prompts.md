# ECE Person 1 — Signal Lead stand-alone task prompts

Here are the six standalone task prompts for ECE Person 1 (Signal Lead). Each task prompt is designed to be self-contained and copy-pasted into a fresh agent session.

---

## 1. PRADAN Portal Data Ingestion

I'm working on a solar flare forecasting project (ISRO Bharatiya Antariksh Hackathon 2026, problem statement: solar flare nowcasting/forecasting using Aditya-L1 SoLEXS + HEL1OS data). My role is the Signal Lead. This is the first task: set up the raw data directories and verify the presence of level-1 or level-2 files downloaded from the ISRO ISSDC PRADAN portal. (Note: if you encounter PRADAN site downtime or credentials issues, retrieve raw files using the fallback Kaggle mirror coordinates: `narayana1729/aditya-l1-solar-flare-raw-mirror`).

Set up raw data directories at:
- `./data/raw/solexs/` for SoLEXS Level 2 FITS/CDF light curve files.
- `./data/raw/hel1os/` for HEL1OS Level 1 CZT/CdTe FITS event/light curve files.
- `./data/raw/noaa/` for the NOAA GOES solar flare event catalog (`goes_flares.csv`).

TASK:
1. Scan the raw directories for files downloaded from the PRADAN portal (dating from July 2024 onwards).
2. Report the number of files, directory structure, extensions (e.g. `.lc.gz`, `.fits`, `.zip`), and total size of data for each instrument.
3. Automatically identify and extract any `.zip` packages found in these directories to make sure the pipeline scripts can recursively load `.fits` and `.lc.gz` files.
4. If no files exist, stop and notify me immediately.
5. Write an ingestion status summary to `./data/raw/ingestion_status.txt` outlining the file count, size, zip files found, extracted files, and datetime ranges derived from file naming conventions (e.g. `AL1_SLX_L1_20240701_v1.1` represents July 1st, 2024).

VERIFICATION (do this before finishing):
- Print a tree structure or detailed listing of the folders.
- Confirm `./data/raw/ingestion_status.txt` is created and print its contents.

Do not write parsing or preprocessing code yet — just prepare the folder structure, extract zips, and verify.

---

## 2. SoLEXS FITS Parsing

Continuing the same project (solar flare forecasting, Aditya-L1 Signal Lead). Previous step unzipped and organized the raw SoLEXS files in `./data/raw/solexs/` — confirm at least one unzipped `.lc.gz` or `.fits` file exists under `./data/raw/solexs/` before proceeding; if none exist, stop and tell me.

This task: build a Python script `parse_solexs_fits.py` under `workspace/ece1_signal_processing/` to load a raw FITS light curve, inspect headers, and extract time and counts arrays.

Steps:
1. Use the `astropy.io.fits` library to open the first raw SoLEXS `.lc.gz` or `.fits` file.
2. Inspect the FITS HDU list and print the headers (key metadata like observer, instrument, detector, target, start/end times).
3. Extract the time column (typically `TIME` in seconds) and the flux/count column (typically `COUNTS` or `RATE`).
4. IMPORTANT — Avoid the **Astropy Closed-File Reference Bug**: Astropy uses lazy memory-mapping (`memmap`). To prevent closed-file `KeyError` or `ValueError` issues after exiting the `fits.open()` context, cast the extracted data arrays to memory (e.g. using `.astype(float)`) *inside* the context block before closing the file.
5. Convert the time array (seconds) to pandas datetimes (typically using `pd.to_datetime(times, unit='s')` or similar depending on epoch).
6. Save a quick metadata and data preview report to `./workspace/ece1_signal_processing/fits_parsing_preview.txt` containing the header metadata and the first 10 rows of the extracted time-series dataframe (columns: timestamp, solexs_counts).

VERIFICATION:
- Print the FITS HDU list and target header parameters.
- Print the head and tail of the parsed dataframe.
- Verify that `fits_parsing_preview.txt` exists and matches the printed dataframe format.

Do not resample or preprocess yet — that's a separate task.

---

## 3. Data Preprocessing & Calibration

Continuing the same project (solar flare forecasting, Aditya-L1 Signal Lead). Previous step established FITS parsing. Confirm unzipped SoLEXS files exist under `./data/raw/solexs/` before proceeding.

This task: build a preprocessing script `preprocess_solexs.py` under `workspace/ece1_signal_processing/` to clean, resample, and baseline-calibrate the SoLEXS data.

Steps:
1. Load all SoLEXS `.lc.gz` files from `./data/raw/solexs/` into a single pandas dataframe. Detect which detector is being loaded (check filename/path: `sdd1` or `sdd2`, typically `sdd2` has `sdd2` or `5002` in path). Map time columns to datetime objects.
2. Sort by timestamp and handle duplicate timestamps (average duplicate flux readings).
3. Resample to a consistent 1-minute cadence using `.resample('1min').mean()`.
4. Gaps and NaNs: Apply forward-fill (`ffill()`) for gaps, then drop any remaining NaNs (`dropna()`). Do NOT use backward fill (`bfill()`) to avoid **temporal look-ahead bias** (leaking future data into past timestamps).
5. Background Subtraction: Solar X-ray flux contains background variations. Calculate a rolling 5th percentile baseline over a 6-hour (360-minute) window (`min_periods=1` to avoid losing rows at boundaries). Subtract this baseline from the raw counts to obtain a background-subtracted count column (e.g. `solexs_sdd2_counts_clean`). Keep the raw counts intact as a separate column.
6. Normalization: Add z-score normalized columns for both raw and background-subtracted counts.
7. Save the processed dataset to `./data/processed/solexs_preprocessed.csv`.

VERIFICATION:
- Print the shape, date range, columns, and head/tail of the final dataframe.
- Confirm there are no NaN values in the dataset.
- Report how many rows were filled or dropped.

---

## 4. HEL1OS Ingestion and Timeline Synchronization

Continuing the same project. Previous step produced `./data/processed/solexs_preprocessed.csv` — confirm it exists before proceeding. Also confirm raw HEL1OS files exist under `./data/raw/hel1os/` (event/light curve files).

This task: build a Python script `sync_hel1os.py` under `workspace/ece1_signal_processing/` to load raw HEL1OS hard X-ray counts, resample them, and merge them with the preprocessed SoLEXS timeline.

Steps:
1. Load HEL1OS light curve `.fits` files from `./data/raw/hel1os/`. Identify the detector from the filename (e.g., `czt1`, `czt2`, `cdte1`, `cdte2`) and the energy band from the FITS extension names (e.g., `20_to_40`, `40_to_60` keV).
2. Extract timestamps (convert `ISOT` column values to pandas datetime objects) and energy count rates (`CTR`).
3. Resample the HEL1OS energy bands to the same 1-minute cadence.
4. Merge the HEL1OS channels with `./data/processed/solexs_preprocessed.csv` using an outer join on the timestamp index.
5. Resolve timeline alignment: Sort the merged index. Clean any missing data introduced by the merge using forward-fill (`ffill()`), followed by dropping remaining NaNs (`dropna()`) to avoid temporal look-ahead bias.
6. Save the synchronized dataset to `./data/processed/aditya_aligned.csv`.

VERIFICATION:
- Print columns of the final dataset (expect columns for SoLEXS counts, HEL1OS CZT count rates, and CDTE count rates).
- Print shape, date range, and percentage of non-null values per column.
- Verify that timestamps are strictly monotonic and consecutive.

---

## 5. Flare Event Labeling

Continuing the same project. Previous step produced `./data/processed/aditya_aligned.csv` — confirm it exists before proceeding. Also confirm that the NOAA flare catalog is downloaded at `./data/raw/noaa/goes_flares.csv` (or `./goes_data/flare_catalog/xrs_flare_report.csv`).

This task: build a labeling script `label_dataset.py` under `workspace/ece1_signal_processing/` to annotate the synchronized Aditya-L1 timeline with solar flare event classes from the NOAA/GOES catalog.

Steps:
1. Load `aditya_aligned.csv` and the NOAA flare catalog CSV.
2. Parse all start, peak, and end timestamps to pandas datetimes.
3. For each flare in the catalog, apply the ~5-second Lagrangian L1-to-Earth travel time offset correction (subtract 5 seconds from the GOES start and end times to align them with Aditya-L1's local instrument time, since Aditya-L1 is closer to the Sun and observes solar events 5 seconds earlier than GOES/Earth: `start_aditya = start - 5s`, `end_aditya = end - 5s`). Find the timestamps in `aditya_aligned.csv` that fall within `[start_aditya, end_aditya]`.
4. Add a `flare_class` column: set it to the flare's GOES classification string (e.g. `C2.1`, `M2.3`, `X1.0`). If multiple flares overlap, assign the highest-class event using the standard severity order (A < B < C < M < X).
5. All non-flare timestamps should be labeled as `quiet`.
6. Add a boolean column `is_flare` (True if `flare_class` != `quiet`, False otherwise).
7. Save the labeled dataset to `./data/processed/aditya_labeled.csv`.

VERIFICATION:
- Print the total row count, flare count, and quiet count.
- Print the value distribution of `flare_class` (counts per class).
- Verify that no future data leaks into the classification (e.g., check that the labeling boundaries strictly match the start and end times in the catalog).
- Confirm the output file `aditya_labeled.csv` exists and read the first 5 rows.

---

## 6. Physics-Informed Feature Extraction

Continuing the same project. Previous step produced `./data/processed/aditya_labeled.csv` — confirm it exists before proceeding.

This task: build a feature engineering script `extract_features.py` under `workspace/ece1_signal_processing/` to construct modeling features based on X-ray telemetry.

Steps:
1. Load `aditya_labeled.csv`.
2. Flux Derivatives: Compute first-order differences (flux rate of change) for both SoLEXS and HEL1OS channels (e.g., `df['flux_diff'] = df['flux'].diff()`).
3. Spectral Index / Hardening Ratios: Compute ratios between hard and soft X-ray bands, and between different hard X-ray bands (e.g., `hel1os_czt1_80_to_150_ctr / (hel1os_czt1_20_to_40_ctr + 1e-5)`), as physical indicators of solar particle acceleration.
4. Rolling Statistics: Compute rolling means, standard deviations, maximums, and minimums for key channels over windows of 10 minutes, 30 minutes, and 60 minutes.
5. Rise-Time/Decay-Time Precursors: Compute rolling accumulation of positive derivatives over the last 10 minutes to act as pre-flare brightening markers.
6. Replace any NaNs introduced by diffs or rolling windows safely using forward fill (`ffill()`), and fill any remaining NaNs at the very start of the dataset with 0.
7. Save the engineered features dataset to `./data/processed/aditya_features.csv`.

VERIFICATION:
- Print the shape of the features dataset and the list of all engineered columns (expect >50 columns).
- Verify that no NaN values exist in the final dataset.
- Print the correlation matrix or description stats for a few key engineered features relative to the `is_flare` column.
