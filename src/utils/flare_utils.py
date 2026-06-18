"""
flare_utils.py
==============
Shared utility functions for flare classification and target labeling.

Single source of truth — used across:
  - src/models/train_lstm.py
  - src/models/ensemble_forecast.py
  - src/data/create_dashboard_data.py
  - src/data/merge_data.py

Any change to the flare definition (e.g. including B-class events)
only needs to be made here.
"""
import pandas as pd
import numpy as np

# Flare classes considered as positive events
ACTIVE_FLARE_CLASSES = frozenset(['C', 'M', 'X'])


def make_is_flare(flare_class_series: pd.Series) -> pd.Series:
    """
    Return a boolean Series: True where flare_class is a C, M, or X-class event.

    Handles NaN values safely by treating them as 'quiet'.
    Works regardless of whether flare_class is stored as a string or is NaN.

    Parameters
    ----------
    flare_class_series : pd.Series
        Column containing GOES class strings like 'M5.2', 'C1.0', 'quiet', etc.

    Returns
    -------
    pd.Series (bool)
    """
    fc = flare_class_series.fillna('quiet').astype(str)
    return (fc != 'quiet') & (fc.str[0].str.upper().isin(ACTIVE_FLARE_CLASSES))


def make_target(flare_class_series: pd.Series, forecast_horizon: int = 30) -> pd.Series:
    """
    Return a forward-shifted binary target column for supervised learning.

    Target = 1 if a C/M/X flare is *active* forecast_horizon steps ahead.

    Parameters
    ----------
    flare_class_series : pd.Series
        Column containing GOES class strings.
    forecast_horizon : int
        Number of time steps (minutes at 1-min cadence) to look ahead.

    Returns
    -------
    pd.Series (int, 0 or 1)
    """
    is_flare = make_is_flare(flare_class_series)
    return is_flare.shift(-forecast_horizon).fillna(False).astype(int)


def class_severity(goes_class: str) -> float:
    """
    Convert a GOES flare class string (e.g. 'M5.2') to a numeric severity score.

    Used for sorting overlapping flare labels so that the highest-class
    event wins when multiple flares overlap the same timestamp.

    Parameters
    ----------
    goes_class : str
        A GOES class string such as 'M5.2', 'X1.0', 'C3.4'.

    Returns
    -------
    float  (0.0 if unparseable)
    """
    if not isinstance(goes_class, str) or len(goes_class) < 2:
        return 0.0
    letter = goes_class[0].upper()
    try:
        num = float(goes_class[1:])
    except ValueError:
        num = 0.0
    mapping = {'B': 10, 'C': 100, 'M': 1000, 'X': 10000}
    return mapping.get(letter, 0.0) * num


def tss_score(tp: int, fp: int, fn: int, tn: int) -> float:
    """
    True Skill Statistic (Peirce Skill Score) — standard metric in heliophysics.

    TSS = TP/(TP+FN) - FP/(FP+TN)  =  sensitivity - (1 - specificity)
    Range: [-1, 1].  Perfect forecast = 1.  No skill = 0.
    """
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    false_alarm_rate = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    return sensitivity - false_alarm_rate


def hss_score(tp: int, fp: int, fn: int, tn: int) -> float:
    """
    Heidke Skill Score — measures improvement over random chance.

    HSS = 2*(TP*TN - FP*FN) / ((TP+FN)*(FN+TN) + (TP+FP)*(FP+TN))
    Range: [-inf, 1].  Perfect = 1.  No skill = 0.
    """
    numerator = 2.0 * (tp * tn - fp * fn)
    denominator = (tp + fn) * (fn + tn) + (tp + fp) * (fp + tn)
    return numerator / denominator if denominator != 0 else 0.0
