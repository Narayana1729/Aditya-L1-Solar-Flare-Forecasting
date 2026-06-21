import numpy as np
import pandas as pd

def compute_confusion_counts(y_true, y_pred):
    """Compute true positives, false positives, true negatives, and false negatives.
    
    Parameters:
    -----------
    y_true : array-like of bool
        Ground truth binary labels.
    y_pred : array-like of bool
        Predicted binary labels.
        
    Returns:
    --------
    tp, fp, tn, fn : int
        Confusion matrix counts.
    """
    y_true = np.asarray(y_true, dtype=bool)
    y_pred = np.asarray(y_pred, dtype=bool)
    
    tp = np.sum(y_true & y_pred)
    fp = np.sum((~y_true) & y_pred)
    tn = np.sum((~y_true) & (~y_pred))
    fn = np.sum(y_true & (~y_pred))
    
    return int(tp), int(fp), int(tn), int(fn)

def true_skill_statistic(y_true, y_pred):
    """Compute the True Skill Statistic (TSS).
    
    TSS = Sensitivity + Specificity - 1 = (TP / (TP + FN)) - (FP / (FP + TN))
    Range: -1 to 1 (1 = perfect skill, 0 = random/no skill).
    """
    tp, fp, tn, fn = compute_confusion_counts(y_true, y_pred)
    
    sensitivity_denom = tp + fn
    specificity_denom = fp + tn
    
    sensitivity = tp / sensitivity_denom if sensitivity_denom > 0 else 0.0
    far_rate = fp / specificity_denom if specificity_denom > 0 else 0.0
    
    return sensitivity - far_rate

def heidke_skill_score(y_true, y_pred):
    """Compute the Heidke Skill Score (HSS).
    
    HSS measures the fractional accuracy improvement over random chance.
    HSS = 2 * (TP*TN - FN*FP) / [(TP+FN)*(FN+TN) + (TP+FP)*(FP+TN)]
    Range: -inf to 1 (1 = perfect skill, 0 = random/no skill, negative = worse than random).
    """
    tp, fp, tn, fn = compute_confusion_counts(y_true, y_pred)
    
    # Cast to float to avoid overflow in large multiplications
    tp, fp, tn, fn = float(tp), float(fp), float(tn), float(fn)
    
    num = 2.0 * (tp * tn - fn * fp)
    denom = (tp + fn) * (fn + tn) + (tp + fp) * (fp + tn)
    
    if denom == 0:
        print("[WARNING] Heidke Skill Score denominator is 0. Returning NaN.")
        return np.nan
        
    return num / denom

def evaluate_at_threshold(y_true, y_prob, threshold):
    """Evaluate binary prediction metrics at a specific probability threshold.
    
    Parameters:
    -----------
    y_true : array-like of bool
        Ground truth labels.
    y_prob : array-like of float
        Predicted probabilities.
    threshold : float
        Decision threshold (between 0 and 1).
        
    Returns:
    --------
    metrics : dict
        A dictionary containing TSS, HSS, precision, recall, and False Alarm Rate (FAR).
    """
    y_true = np.asarray(y_true, dtype=bool)
    y_prob = np.asarray(y_prob, dtype=float)
    y_pred = y_prob >= threshold
    
    tp, fp, tn, fn = compute_confusion_counts(y_true, y_pred)
    
    tss = true_skill_statistic(y_true, y_pred)
    hss = heidke_skill_score(y_true, y_pred)
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    far = fp / (fp + tn) if (fp + tn) > 0 else 0.0  # False Alarm Rate (FP / (FP + TN))
    
    # False Alarm Ratio (FP / (TP + FP)), often called FAR in some papers.
    # We include both for clarity: false_alarm_rate (FAR) and false_alarm_ratio (FAR_ratio)
    far_ratio = fp / (tp + fp) if (tp + fp) > 0 else 0.0
    
    return {
        "threshold": float(threshold),
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "tss": float(tss),
        "hss": float(hss),
        "precision": float(precision),
        "recall": float(recall),
        "false_alarm_rate": float(far),
        "false_alarm_ratio": float(far_ratio)
    }

def lead_time_distribution(flare_events, predicted_alert_times, max_window_mins=90):
    """Compute lead times for predicted flare alerts.
    
    For each actual flare start time, find the nearest alert in the lookback window
    [flare_start - max_window_mins, flare_start] and calculate:
    lead_time = alert_time - actual_flare_start.
    
    Since the alert should precede the flare, lead times will be negative (or zero).
    A lead time of -15 minutes indicates a warning was issued 15 minutes before the flare.
    
    Parameters:
    -----------
    flare_events : list or array-like of datetime
        Actual flare start times.
    predicted_alert_times : list or array-like of datetime
        Model alert trigger times.
    max_window_mins : int, default 90
        Maximum time before a flare start to search for a preceding alert.
        
    Returns:
    --------
    results : dict
        A dictionary with the list of matched lead times (in minutes), matched/missed counts,
        and summary statistics (mean, median, min, max lead time).
    """
    flare_events = sorted(pd.to_datetime(list(flare_events)))
    predicted_alert_times = sorted(pd.to_datetime(list(predicted_alert_times)))
    
    lead_times_min = []
    matched_count = 0
    missed_count = 0
    
    for f_start in flare_events:
        # Filter alerts that are <= f_start and >= f_start - max_window
        window_start = f_start - pd.Timedelta(minutes=max_window_mins)
        valid_alerts = [a for a in predicted_alert_times if window_start <= a <= f_start]
        
        if valid_alerts:
            # Select the nearest alert before the flare (which is the maximum alert time)
            nearest_alert = max(valid_alerts)
            # Calculate lead time in minutes (negative or zero)
            lead_time_td = nearest_alert - f_start
            lead_time_min = lead_time_td.total_seconds() / 60.0
            lead_times_min.append(lead_time_min)
            matched_count += 1
        else:
            missed_count += 1
            
    summary_stats = {}
    if lead_times_min:
        summary_stats = {
            "mean_mins": float(np.mean(lead_times_min)),
            "median_mins": float(np.median(lead_times_min)),
            "min_mins": float(np.min(lead_times_min)),  # Earliest alert (most negative)
            "max_mins": float(np.max(lead_times_min))   # Latest alert (closest to 0)
        }
    else:
        summary_stats = {
            "mean_mins": None,
            "median_mins": None,
            "min_mins": None,
            "max_mins": None
        }
        
    return {
        "lead_times": lead_times_min,
        "matched_count": matched_count,
        "missed_count": missed_count,
        "total_flares": len(flare_events),
        "detection_rate": matched_count / len(flare_events) if len(flare_events) > 0 else 0.0,
        "summary": summary_stats
    }

if __name__ == "__main__":
    print("==============================================")
    print("Running space_weather_metrics.py Self-Test...")
    print("==============================================")
    
    # 1. Generate synthetic data matching the real ~10.45% flare ratio
    np.random.seed(42)
    n_samples = 1000
    
    # y_true: ~10.45% True (prevalence of flare states)
    y_true = np.random.rand(n_samples) < 0.1045
    
    # Generate y_prob with mixed accuracy (add noise to true labels)
    noise = np.random.normal(0, 0.25, n_samples)
    y_prob = np.clip(np.where(y_true, 0.7 + noise, 0.2 + noise), 0, 1)
    
    print(f"Generated synthetic dataset with {n_samples} rows.")
    print(f"  Prevalence of True labels: {np.sum(y_true)} ({np.sum(y_true)/n_samples*100:.2f}%)")
    
    # 2. Evaluate at threshold 0.5
    print("\n2. Evaluating at threshold = 0.5:")
    y_pred = y_prob >= 0.5
    tp, fp, tn, fn = compute_confusion_counts(y_true, y_pred)
    print(f"  Confusion Matrix: TP={tp}, FP={fp}, TN={tn}, FN={fn}")
    
    tss = true_skill_statistic(y_true, y_pred)
    hss = heidke_skill_score(y_true, y_pred)
    print(f"  True Skill Statistic (TSS): {tss:.4f}")
    print(f"  Heidke Skill Score (HSS):   {hss:.4f}")
    
    # 3. Evaluate across thresholds
    print("\n3. Evaluating across multiple thresholds:")
    for th in [0.3, 0.5, 0.7]:
        res = evaluate_at_threshold(y_true, y_prob, th)
        print(f"  Threshold {th:.1f} -> TSS={res['tss']:.4f}, HSS={res['hss']:.4f}, Precision={res['precision']:.4f}, Recall={res['recall']:.4f}, FAR={res['false_alarm_rate']:.4f}")
        
    # 4. Lead time distribution test
    print("\n4. Testing Lead Time Distribution Function:")
    # Suppose we have 5 actual flare start times (e.g. 5 days)
    base_time = pd.Timestamp("2026-06-20 12:00:00")
    actual_starts = [
        base_time + pd.Timedelta(days=i) for i in range(5)
    ]
    # Alert times: alerts fired before starts with varying lead times
    predicted_alerts = [
        actual_starts[0] - pd.Timedelta(minutes=15),  # Warned 15 mins before
        actual_starts[1] - pd.Timedelta(minutes=45),  # Warned 45 mins before
        # Flare 2 missed (no alert)
        actual_starts[3] - pd.Timedelta(minutes=5),   # Warned 5 mins before
        actual_starts[4] - pd.Timedelta(minutes=72),  # Warned 72 mins before
        # Extra alert that shouldn't match (120 mins before actual_starts[2], too far)
        actual_starts[2] - pd.Timedelta(minutes=120)
    ]
    
    lt_res = lead_time_distribution(actual_starts, predicted_alerts, max_window_mins=90)
    print(f"  Actual starts: {[str(t) for t in actual_starts]}")
    print(f"  Triggered alerts: {[str(t) for t in predicted_alerts]}")
    print(f"  Calculated lead times (mins): {lt_res['lead_times']}")
    print(f"  Detection rate: {lt_res['detection_rate'] * 100:.1f}% (Matched={lt_res['matched_count']}, Missed={lt_res['missed_count']})")
    print(f"  Summary stats: {lt_res['summary']}")
    
    print("\n[SUCCESS] Self-test complete.")
