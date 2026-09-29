"""
SIHTRACK Extreme Weather Intelligence & Tracking Platform
Operational FastAPI RESTful API Server (SIH26078)
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.providers.base import WeatherProvider
from backend.providers.demo import DemoProvider
from backend.providers.open_meteo import OpenMeteoProvider
from backend.providers.ecmwf import ECMWFProvider, NCMRWFProvider
from ml.inference.predictor import TrajectoryPredictor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SIHTRACK-API")

app = FastAPI(
    title="SIHTRACK Extreme Weather Intelligence API",
    description="AI-Driven Spatio-Temporal Tracking of Extreme Weather Anomalies in Medium-Range Forecasts (SIH26078)",
    version="1.0.0",
)

# Enable CORS for frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate providers
demo_provider = DemoProvider()
open_meteo_provider = OpenMeteoProvider(fallback_provider=demo_provider)
ecmwf_provider = ECMWFProvider(fallback=demo_provider)
ncmrwf_provider = NCMRWFProvider(fallback=demo_provider)

# Active provider selection (default to OpenMeteo with Demo fallback)
active_provider: WeatherProvider = open_meteo_provider
predictor = TrajectoryPredictor()


class InferenceRequest(BaseModel):
    event_id: str
    current_lat: float
    current_lon: float
    current_intensity: float
    current_extent: float
    historical_track: Optional[List[Dict[str, Any]]] = None
    horizon_hours: Optional[int] = 48


@app.get("/health")
@app.get("/api/v1/health")
def get_health():
    """Health check & operational runtime status."""
    meta = active_provider.get_metadata()
    return {
        "status": "healthy",
        "service": "SIHTRACK Extreme Weather Intelligence Platform",
        "problem_statement": "SIH26078",
        "provider": meta["source"],
        "model": meta["model"],
        "mode": meta["mode"],
        "data_status": meta["status"],
        "is_real_data": meta["is_real_data"],
        "lead_time": meta["lead_time"],
        "resolution": meta["resolution"],
        "updated_at": meta["updated_at"],
    }


@app.get("/api/v1/events")
def list_events(t: float = Query(0.0, description="Hours offset relative to NOW (-48 to +120)")):
    """Returns detected extreme anomaly event objects for timeline timestamp t."""
    return active_provider.get_events(t)


@app.get("/api/v1/events/{event_id}")
def get_event(event_id: str, t: float = Query(0.0)):
    """Returns canonical record for a single extreme weather event."""
    ev = active_provider.get_event_by_id(event_id, t)
    if not ev:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found.")
    return ev


@app.get("/api/v1/forecast")
def get_forecast(event_id: Optional[str] = Query(None), lead_hours: int = Query(120)):
    """Returns medium-range spatial forecast progression."""
    return active_provider.get_forecast(event_id, lead_hours)


@app.get("/api/v1/track/{event_id}")
def get_track(event_id: str):
    """Returns historical points, current marker, forecast points, and uncertainty envelope."""
    return active_provider.get_track(event_id)


@app.get("/api/v1/field/{layer}")
def get_field(layer: str, t: float = Query(0.0)):
    """Returns gridded scalar raster data (temp, rain, wind, pressure, humidity, anomaly, risk)."""
    return active_provider.get_field(layer, t)


@app.get("/api/v1/alerts")
def get_alerts(t: float = Query(0.0)):
    """Returns prioritized hazard warnings for extreme events."""
    return active_provider.get_alerts(t)


@app.get("/api/v1/regions/risk")
def get_risk_regions(t: float = Query(0.0)):
    """Returns administrative regions affected by active hazards with risk scores."""
    return active_provider.get_risk_regions(t)


@app.get("/api/v1/stats")
def get_stats(t: float = Query(0.0)):
    """Returns summary metrics (active count, severe count, avg intensity, avg confidence)."""
    return active_provider.get_stats(t)


@app.get("/api/v1/location/nearby")
def get_nearby_events(
    lat: float = Query(..., description="User latitude"),
    lon: float = Query(..., description="User longitude"),
    t: float = Query(0.0)
):
    """
    Computes distance and bearing from user coordinates to all active events.
    Sorted by geographic distance ascending.
    """
    if hasattr(active_provider, "get_nearby_events"):
        return active_provider.get_nearby_events(lat, lon, t)
    return []


@app.post("/api/v1/inference")
def run_model_inference(req: InferenceRequest):
    """
    Executes neural ConvLSTM trajectory prediction for an event.
    Outputs future centroid coordinates, intensity, and uncertainty envelope.
    """
    return predictor.predict_event_trajectory(
        event_id=req.event_id,
        current_lat=req.current_lat,
        current_lon=req.current_lon,
        current_intensity=req.current_intensity,
        current_extent=req.current_extent,
        historical_track=req.historical_track or [],
        horizon_hours=req.horizon_hours or 48
    )


@app.get("/api/v1/model/status")
def get_model_status():
    """Returns ML model checkpoint metadata, architecture, and scientific evaluation report."""
    eval_report = {}
    metadata = {}
    feature_config = {}

    if os.path.exists("models/evaluation_report.json"):
        with open("models/evaluation_report.json") as f:
            eval_report = json.load(f)
    if os.path.exists("models/model_metadata.json"):
        with open("models/model_metadata.json") as f:
            metadata = json.load(f)
    if os.path.exists("models/feature_config.json"):
        with open("models/feature_config.json") as f:
            feature_config = json.load(f)

    return {
        "model_loaded": predictor.is_loaded,
        "architecture": "ConvLSTMWeatherTracker",
        "device": str(predictor.device),
        "metadata": metadata,
        "features": feature_config,
        "evaluation": eval_report,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
