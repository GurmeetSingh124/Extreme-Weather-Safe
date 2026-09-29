"""
SIHTRACK Scientific Anomaly Detection Engine
Computes standardized anomalies, deviations from ERA5 30-year climatological baselines,
and non-parametric percentile thresholds for skewed precipitation distributions.
"""
import numpy as np
from typing import Dict, Any, Tuple, Optional


class AnomalyDetector:
    """
    Standardized & Percentile-Based Meteorological Anomaly Detector.
    Supports temperature z-scores, precipitation non-Gaussian percentiles,
    and geopotential height / vorticity anomalies.
    """

    def __init__(self, baseline_period: str = "1991-2020 ERA5 Climatology"):
        self.baseline_period = baseline_period
        # Standardized deviation thresholds for meteorological classification
        self.z_thresholds = {
            "moderate": 1.5,
            "high": 2.2,
            "extreme": 3.0
        }
        # Non-parametric percentiles for precipitation and extreme convective indices
        self.precip_percentile_thresholds = {
            "moderate": 90.0,
            "high": 95.0,
            "extreme": 99.0
        }

    def compute_continuous_anomaly(
        self,
        forecast_grid: np.ndarray,
        climatological_mean: np.ndarray,
        climatological_std: Optional[np.ndarray] = None,
        variable: str = "temperature"
    ) -> Dict[str, Any]:
        """
        Computes absolute deviation ($T - \\mu$) and standardized z-score ($z = (T - \\mu)/\\sigma$).
        """
        # Absolute anomaly
        raw_anomaly = forecast_grid - climatological_mean
        
        # Standardized anomaly (z-score)
        if climatological_std is not None:
            # Avoid division by zero with small epsilon
            std_safe = np.maximum(climatological_std, 1e-4)
            z_score = raw_anomaly / std_safe
        else:
            z_score = np.zeros_like(raw_anomaly)

        # Binary anomaly masks based on standard deviations
        extreme_mask = np.abs(z_score) >= self.z_thresholds["extreme"]
        high_mask = (np.abs(z_score) >= self.z_thresholds["high"]) & ~extreme_mask
        moderate_mask = (np.abs(z_score) >= self.z_thresholds["moderate"]) & ~extreme_mask & ~high_mask

        return {
            "variable": variable,
            "baseline_period": self.baseline_period,
            "raw_anomaly": raw_anomaly,
            "z_score": z_score,
            "max_z_score": float(np.max(np.abs(z_score))),
            "mean_z_score": float(np.mean(np.abs(z_score))),
            "extreme_mask": extreme_mask,
            "high_mask": high_mask,
            "moderate_mask": moderate_mask,
        }

    def compute_precipitation_anomaly(
        self,
        precip_grid: np.ndarray,
        climatological_p95: np.ndarray,
        climatological_p99: np.ndarray,
    ) -> Dict[str, Any]:
        """
        Computes percentile-based extreme rainfall anomaly.
        Rainfall distributions are Gamma/Weibull distributed (non-Gaussian),
        so rank-based percentiles prevent false alarms.
        """
        extreme_rain_mask = precip_grid >= climatological_p99
        heavy_rain_mask = (precip_grid >= climatological_p95) & ~extreme_rain_mask

        # Ratio relative to 95th percentile
        safe_p95 = np.maximum(climatological_p95, 0.5)
        ratio = precip_grid / safe_p95

        return {
            "variable": "precipitation",
            "baseline_period": self.baseline_period,
            "extreme_mask": extreme_rain_mask,
            "heavy_mask": heavy_rain_mask,
            "ratio_to_p95": ratio,
            "max_rainfall_rate": float(np.max(precip_grid)),
            "area_above_p99_cells": int(np.sum(extreme_rain_mask)),
        }
