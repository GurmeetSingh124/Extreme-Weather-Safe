"""
SIHTRACK — Extreme Weather Intelligence & Tracking Platform
Weather Data Provider Abstraction Layer (SIH26078)
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime


class WeatherProvider(ABC):
    """
    Abstract interface for meteorological data ingestion and processing.
    Decouples GIS visualization from underlying data pipelines (ECMWF, Open-Meteo, NCMRWF, Demo).
    """

    @abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """Returns provenance, model cycle, resolution, and operational status."""
        pass

    @abstractmethod
    def get_events(self, t: float = 0.0) -> List[Dict[str, Any]]:
        """Returns detected extreme anomaly event objects for a timeline step."""
        pass

    @abstractmethod
    def get_event_by_id(self, event_id: str, t: float = 0.0) -> Optional[Dict[str, Any]]:
        """Returns detailed canonical record for a specific event."""
        pass

    @abstractmethod
    def get_forecast(self, event_id: Optional[str] = None, lead_hours: int = 120) -> Dict[str, Any]:
        """Returns medium-range trajectory and intensity projection."""
        pass

    @abstractmethod
    def get_track(self, event_id: str) -> Dict[str, Any]:
        """Returns historical, current, and forecast trajectory points + confidence envelope."""
        pass

    @abstractmethod
    def get_field(self, layer: str, t: float = 0.0) -> Dict[str, Any]:
        """Returns gridded field raster (temperature anomaly, precipitation, vorticity, etc.)."""
        pass

    @abstractmethod
    def get_wind(self, t: float = 0.0) -> Dict[str, Any]:
        """Returns gridded U/V vector field for wind streamline visualization."""
        pass

    @abstractmethod
    def get_alerts(self, t: float = 0.0) -> List[Dict[str, Any]]:
        """Returns priority hazard advisories for active extreme events."""
        pass

    @abstractmethod
    def get_risk_regions(self, t: float = 0.0) -> List[Dict[str, Any]]:
        """Returns administrative region vulnerability and composite risk scores."""
        pass

    @abstractmethod
    def get_stats(self, t: float = 0.0) -> Dict[str, Any]:
        """Returns aggregate metrics: active counts, mean intensity, mean confidence, max anomaly."""
        pass
