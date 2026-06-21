# Space Weather Metrics Library

This directory contains the [space_weather_metrics.py](file:///Users/srimannarayanadeevi/Aditya-L1%20Solar%20Flare%20Forecasting/goes_data/metrics/space_weather_metrics.py) module. It provides standard evaluation functions utilized in solar physics and space weather forecasting (specifically for forecasting Aditya-L1 and GOES solar flares).

These functions are designed to handle highly imbalanced classifications (e.g. flare occurrences representing ~10% of total minutes) without relying on synthetic oversampling, which is physically implausible for time-series flux signals.

---

## 🛠️ Functions Included

### 1. `compute_confusion_counts(y_true, y_pred)`
* **Purpose**: Calculates the standard classification contingency table (True Positives, False Positives, True Negatives, and False Negatives).
* **Inputs**:
  * `y_true`: Array-like (boolean or binary) ground truth labels.
  * `y_pred`: Array-like (boolean or binary) model predictions.
* **Returns**: `(tp, fp, tn, fn)` as a tuple of integers.

### 2. `true_skill_statistic(y_true, y_pred)`
* **Purpose**: Computes the True Skill Statistic (TSS), also known as the Peirce Skill Score. TSS is the standard metric in space weather forecasting because it is independent of the class imbalance ratio.
  * **Equation**: $\text{TSS} = \text{Sensitivity} - \text{False Alarm Rate} = \frac{\text{TP}}{\text{TP} + \text{FN}} - \frac{\text{FP}}{\text{FP} + \text{TN}}$
  * **Range**: $-1$ to $1$ ($1$ is perfect forecast skill, $0$ indicates random chance or no skill).
* **Inputs**: Same as above.
* **Returns**: Float representation of the TSS score.

### 3. `heidke_skill_score(y_true, y_pred)`
* **Purpose**: Computes the Heidke Skill Score (HSS), representing the fractional improvement of accuracy relative to a random forecast.
  * **Equation**: $\text{HSS} = \frac{2 \times (\text{TP}\times\text{TN} - \text{FN}\times\text{FP})}{(\text{TP}+\text{FN})\times(\text{FN}+\text{TN}) + (\text{TP}+\text{FP})\times(\text{FP}+\text{TN})}$
  * **Range**: $-\infty$ to $1$ ($1$ is perfect skill, $0$ represents random chance, negative values are worse than random). Graces division by zero.
* **Inputs**: Same as above.
* **Returns**: Float representation of the HSS score (or `NaN` in case of division by zero).

### 4. `evaluate_at_threshold(y_true, y_prob, threshold)`
* **Purpose**: Convenience function to binarize predicted probabilities at a specific threshold and compute a complete set of validation metrics.
* **Inputs**:
  * `y_true`: Array-like (boolean) ground truth labels.
  * `y_prob`: Array-like (float) of continuous predicted probabilities.
  * `threshold`: Float decision threshold (e.g. `0.5`).
* **Returns**: Dictionary with:
  * `tp`, `fp`, `tn`, `fn`
  * `tss`, `hss`
  * `precision`, `recall`
  * `false_alarm_rate` (Probability of False Detection: $\text{FP}/(\text{FP}+\text{TN})$)
  * `false_alarm_ratio` (False Alarm Ratio: $\text{FP}/(\text{TP}+\text{FP})$)

### 5. `lead_time_distribution(flare_events, predicted_alert_times, max_window_mins=90)`
* **Purpose**: Calculates the lead time warning window for successfully detected flares. It matches each actual flare start time with the nearest preceding alert within a lookback window (default 90 minutes).
  * **Equation**: $\text{lead\_time} = \text{alert\_time} - \text{actual\_flare\_start\_time}$ (returns negative values in minutes; e.g., $-20$ means the warning was issued 20 minutes before flare start).
* **Inputs**:
  * `flare_events`: List of actual flare start timestamps (`pd.Timestamp` or string).
  * `predicted_alert_times`: List of timestamps when the model triggered alerts.
  * `max_window_mins`: Int maximum preceding window (default 90 mins).
* **Returns**: Dictionary containing:
  * `lead_times`: List of lead times in minutes (floats).
  * `matched_count`: Number of flares successfully preceded by an alert in the window.
  * `missed_count`: Number of flares where no alert occurred in the window.
  * `detection_rate`: Fraction of flares detected.
  * `summary`: Stats dictionary containing `mean_mins`, `median_mins`, `min_mins` (earliest warning), and `max_mins` (latest warning).

---

## 🚀 Usage Example for Model Training (C1 Handoff)

```python
from goes_data.metrics.space_weather_metrics import evaluate_at_threshold, lead_time_distribution

# y_true: true labels, y_prob: model output probabilities
y_true = validation_df['flare_within_15min'].values
y_prob = model.predict_proba(validation_df)[:, 1]

# 1. Evaluate general metrics
eval_metrics = evaluate_at_threshold(y_true, y_prob, threshold=0.5)
print(f"Validation HSS: {eval_metrics['hss']:.4f}")
print(f"Validation TSS: {eval_metrics['tss']:.4f}")

# 2. Compute lead time statistics
actual_starts = catalog_df['start_time'].values
alert_triggers = timeline_df[timeline_df['alert_triggered'] == True]['timestamp'].values

lead_stats = lead_time_distribution(actual_starts, alert_triggers, max_window_mins=90)
print(f"Detection Rate: {lead_stats['detection_rate']*100:.1f}%")
print(f"Median Lead Time: {lead_stats['summary']['median_mins']} minutes")
```
