"""
SIHTRACK Demo Weather Provider (SIH26078)
Deterministic, high-fidelity simulated meteorological engine.
Guarantees 100% continuity for all existing SIHTRACK benchmark events:
- Cyclone Biparjoy trajectory (Arabian Sea to Gujarat/Rajasthan)
- Monsoon Low-Pressure Depression (Bay of Bengal to Central India)
- North-Western Plains Severe Heat Anomaly
- Western Ghats Orographic Extreme Rainfall Anomaly
- Western Himalayan Extreme Cold & Snow Anomaly
"""
import math
from typing import Dict, Any, List, Optional
from datetime import datetime

from backend.providers.base import WeatherProvider


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return r * 2 * math.asin(min(1.0, math.sqrt(a)))


class DemoProvider(WeatherProvider):
    """
    Standard Demo & Benchmark Provider.
    Retains full fidelity when offline or when external credentials are not configured.
    """

    def __init__(self):
        self.provider_name = "DEMO SIMULATION ENGINE"
        self.resolution = "0.25° (approx 27 km)"
        self.cycle = "00Z Medium-Range Forecast Benchmark"
        self.model_name = "SIHTRACK Deterministic Physics Engine"

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "mode": "DEMO MODE",
            "source": self.provider_name,
            "model": self.model_name,
            "run_time": "00:00 UTC",
            "lead_time": "+120h",
            "resolution": self.resolution,
            "updated_at": datetime.utcnow().strftime("%H:%M UTC"),
            "status": "OPERATIONAL (DEMO)",
            "is_real_data": False,
        }

    def get_events(self, t: float = 0.0) -> List[Dict[str, Any]]:
        """Returns standard meteorological events resolved at relative hour t."""
        # 5 Benchmark Extreme Weather Anomalies
        events = [
            {
                "id": "CY-2401",
                "name": "Severe Cyclonic Storm (Arabian Sea)",
                "category": "cyclone",
                "categoryLabel": "Cyclone / Severe Storm",
                "subtype": "Very Severe Cyclonic Storm (VSCS)",
                "anchor": "Saurashtra Coast",
                "corridor": ["Kutch", "Jamnagar", "Rajkot", "Jodhpur", "Bikaner"],
                "lat": round(21.4 + 0.075 * t + 0.0004 * (t**1.3), 3),
                "lon": round(68.2 + 0.055 * t - 0.0003 * (t**1.3), 3),
                "intensity": min(100.0, max(45.0, 92.0 - 0.12 * abs(t - 18))),
                "anomalyScore": 94.0,
                "confidence": max(68.0, 94.0 - 0.28 * max(0.0, t)),
                "confBand": "HIGH" if t < 24 else "MEDIUM",
                "severity": "EXTREME",
                "trend": "INTENSIFYING" if t < 12 else "WEAKENING" if t > 36 else "STEADY",
                "extentKm2": 48500.0,
                "speedKmph": 24.5,
                "headingDeg": 38.0,
                "headingLabel": "NE",
                "durationH": 64.0,
                "detectedAt": -48.0,
                "uncertaintyKm": round(25.0 + 1.2 * max(0.0, t), 1),
                "skilledUntilH": 72.0,
                "headline": "Severe cyclonic vortex tracking NE toward Gujarat coast with wind gusts >145 km/h.",
                "evolution": "Peak intensity reached at +18h before landfall; rapid weakening thereafter over Rajasthan.",
                "aiSummary": "ConvLSTM spatio-temporal model predicts coastal crossing near Jakhau port within 18-24h window with high trajectory confidence.",
                "drivers": ["Warm SST >31°C", "Low vertical wind shear", "High mid-tropospheric moisture"],
                "compound": False,
                "conditions": {
                    "temperature": "29.4°C",
                    "rainfall": "165 mm/day",
                    "wind": "135 km/h",
                    "pressure": "964 hPa",
                    "humidity": "94%"
                },
                "history": [
                    {"t": -24, "lat": 19.6, "lon": 66.8, "intensity": 82, "extent": 42000, "speed": 18, "conf": 96, "anomaly": 91},
                    {"t": -12, "lat": 20.5, "lon": 67.5, "intensity": 88, "extent": 45000, "speed": 21, "conf": 95, "anomaly": 93},
                    {"t": 0, "lat": 21.4, "lon": 68.2, "intensity": 92, "extent": 48500, "speed": 24, "conf": 94, "anomaly": 94},
                ],
                "predicted": [
                    {"t": 12, "lat": 22.4, "lon": 69.0, "intensity": 90, "extent": 51000, "speed": 25, "conf": 90, "anomaly": 92},
                    {"t": 24, "lat": 23.5, "lon": 69.9, "intensity": 84, "extent": 46000, "speed": 27, "conf": 86, "anomaly": 88},
                    {"t": 48, "lat": 25.2, "lon": 71.4, "intensity": 66, "extent": 38000, "speed": 29, "conf": 76, "anomaly": 78},
                    {"t": 72, "lat": 26.8, "lon": 73.1, "intensity": 48, "extent": 29000, "speed": 31, "conf": 68, "anomaly": 65},
                ],
                "etas": [
                    {"region": "Kutch", "etaH": 8, "intensity": 92, "confidence": 92},
                    {"region": "Jamnagar", "etaH": 16, "intensity": 89, "confidence": 88},
                    {"region": "Rajkot", "etaH": 28, "intensity": 80, "confidence": 84},
                    {"region": "Jodhpur", "etaH": 52, "intensity": 62, "confidence": 74},
                ]
            },
            {
                "id": "RF-1082",
                "name": "Monsoon Deep Depression & Extreme Rainfall",
                "category": "rainfall",
                "categoryLabel": "Extreme Rainfall Anomaly",
                "subtype": "Mesoscale Convective Complex",
                "anchor": "Odisha Coast",
                "corridor": ["Puri", "Bhubaneswar", "Cuttack", "Sambalpur", "Raipur"],
                "lat": round(19.8 + 0.065 * t, 3),
                "lon": round(86.1 - 0.080 * t, 3),
                "intensity": min(96.0, max(50.0, 88.0 - 0.08 * t)),
                "anomalyScore": 91.0,
                "confidence": max(65.0, 92.0 - 0.30 * max(0.0, t)),
                "confBand": "HIGH" if t < 30 else "MEDIUM",
                "severity": "EXTREME",
                "trend": "STEADY",
                "extentKm2": 42000.0,
                "speedKmph": 22.0,
                "headingDeg": 308.0,
                "headingLabel": "NW",
                "durationH": 72.0,
                "detectedAt": -36.0,
                "uncertaintyKm": round(28.0 + 1.4 * max(0.0, t), 1),
                "skilledUntilH": 72.0,
                "headline": "Active monsoon depression over coastal Odisha causing rainfall exceeding 99th climatological percentile.",
                "evolution": "Moving west-northwestward into Chhattisgarh and eastern Madhya Pradesh.",
                "aiSummary": "Spatio-temporal tracking linkages indicate sustained moisture inflow from Bay of Bengal with continuous track persistence.",
                "drivers": ["Bay of Bengal low-pressure system", "Active monsoon trough", "Anomalous precipitable water >65 mm"],
                "compound": False,
                "conditions": {
                    "temperature": "26.8°C",
                    "rainfall": "198 mm/day",
                    "wind": "65 km/h",
                    "pressure": "992 hPa",
                    "humidity": "96%"
                },
                "history": [
                    {"t": -24, "lat": 18.2, "lon": 88.0, "intensity": 80, "extent": 36000, "speed": 18, "conf": 95, "anomaly": 86},
                    {"t": -12, "lat": 19.0, "lon": 87.0, "intensity": 85, "extent": 39000, "speed": 20, "conf": 93, "anomaly": 89},
                    {"t": 0, "lat": 19.8, "lon": 86.1, "intensity": 88, "extent": 42000, "speed": 22, "conf": 92, "anomaly": 91},
                ],
                "predicted": [
                    {"t": 12, "lat": 20.6, "lon": 85.1, "intensity": 87, "extent": 44000, "speed": 22, "conf": 88, "anomaly": 90},
                    {"t": 24, "lat": 21.4, "lon": 84.1, "intensity": 83, "extent": 45000, "speed": 23, "conf": 84, "anomaly": 87},
                    {"t": 48, "lat": 22.8, "lon": 82.2, "intensity": 75, "extent": 41000, "speed": 24, "conf": 75, "anomaly": 80},
                    {"t": 72, "lat": 24.1, "lon": 80.3, "intensity": 62, "extent": 35000, "speed": 25, "conf": 65, "anomaly": 71},
                ],
                "etas": [
                    {"region": "Bhubaneswar", "etaH": 4, "intensity": 88, "confidence": 91},
                    {"region": "Cuttack", "etaH": 9, "intensity": 87, "confidence": 89},
                    {"region": "Sambalpur", "etaH": 26, "intensity": 82, "confidence": 83},
                    {"region": "Raipur", "etaH": 46, "intensity": 76, "confidence": 76},
                ]
            },
            {
                "id": "HW-3021",
                "name": "Northern Plains Severe Heatwave Anomaly",
                "category": "heat",
                "categoryLabel": "Severe Heatwave",
                "subtype": "Synoptic Ridge Subsidence",
                "anchor": "Delhi NCR / Haryana",
                "corridor": ["Delhi", "Bareilly", "Agra", "Gwalior", "Jaipur"],
                "lat": round(28.6 + 0.012 * t, 3),
                "lon": round(77.2 + 0.018 * t, 3),
                "intensity": min(95.0, max(60.0, 84.0 + 0.15 * math.sin(t * 0.1))),
                "anomalyScore": 86.0,
                "confidence": 91.0,
                "confBand": "HIGH",
                "severity": "HIGH",
                "trend": "STEADY",
                "extentKm2": 65000.0,
                "speedKmph": 8.0,
                "headingDeg": 115.0,
                "headingLabel": "ESE",
                "durationH": 96.0,
                "detectedAt": -48.0,
                "uncertaintyKm": 35.0,
                "skilledUntilH": 96.0,
                "headline": "Surface temperature anomaly +5.8°C above 30-year climatological normal across Indo-Gangetic plains.",
                "evolution": "Persistent anti-cyclonic subsidence maintaining severe heat wave conditions across Delhi and Western UP.",
                "aiSummary": "Ensemble divergence remains narrow (<1.2°C), indicating persistent dry north-westerly advection for the next 72 hours.",
                "drivers": ["Mid-tropospheric anticyclone", "Dry north-westerly winds from Thar", "Clear sky insolation"],
                "compound": False,
                "conditions": {
                    "temperature": "46.2°C",
                    "rainfall": "0 mm/day",
                    "wind": "22 km/h",
                    "pressure": "1002 hPa",
                    "humidity": "24%"
                },
                "history": [
                    {"t": -24, "lat": 28.3, "lon": 76.8, "intensity": 82, "extent": 62000, "speed": 6, "conf": 93, "anomaly": 84},
                    {"t": -12, "lat": 28.5, "lon": 77.0, "intensity": 83, "extent": 64000, "speed": 7, "conf": 92, "anomaly": 85},
                    {"t": 0, "lat": 28.6, "lon": 77.2, "intensity": 84, "extent": 65000, "speed": 8, "conf": 91, "anomaly": 86},
                ],
                "predicted": [
                    {"t": 12, "lat": 28.7, "lon": 77.4, "intensity": 85, "extent": 66000, "speed": 8, "conf": 90, "anomaly": 87},
                    {"t": 24, "lat": 28.8, "lon": 77.7, "intensity": 85, "extent": 66000, "speed": 8, "conf": 89, "anomaly": 87},
                    {"t": 48, "lat": 29.0, "lon": 78.1, "intensity": 82, "extent": 63000, "speed": 9, "conf": 85, "anomaly": 84},
                    {"t": 72, "lat": 29.1, "lon": 78.5, "intensity": 78, "extent": 59000, "speed": 9, "conf": 80, "anomaly": 81},
                ],
                "etas": [
                    {"region": "Bareilly", "etaH": 18, "intensity": 85, "confidence": 89},
                    {"region": "Agra", "etaH": 22, "intensity": 84, "confidence": 88},
                    {"region": "Jaipur", "etaH": 36, "intensity": 81, "confidence": 85},
                ]
            },
            {
                "id": "CW-4105",
                "name": "Western Himalayan Cold Anomaly & Snow Surge",
                "category": "cold",
                "categoryLabel": "Severe Cold Anomaly",
                "subtype": "Western Disturbance Trough",
                "anchor": "Kashmir / Ladakh",
                "corridor": ["Srinagar", "Leh", "Shimla", "Manali", "Dehradun"],
                "lat": round(34.1 + 0.015 * t, 3),
                "lon": round(75.5 + 0.045 * t, 3),
                "intensity": 78.0,
                "anomalyScore": 82.0,
                "confidence": 89.0,
                "confBand": "HIGH",
                "severity": "MODERATE",
                "trend": "STEADY",
                "extentKm2": 38000.0,
                "speedKmph": 28.0,
                "headingDeg": 72.0,
                "headingLabel": "ENE",
                "durationH": 48.0,
                "detectedAt": -24.0,
                "uncertaintyKm": 42.0,
                "skilledUntilH": 72.0,
                "headline": "Upper-level western disturbance bringing freezing temperatures and sub-zero anomalies to northern highlands.",
                "evolution": "Moving eastward along southern slopes of Himalayas with intense precipitation at high altitudes.",
                "aiSummary": "Trajectory tracking aligns with jet stream axis at 250 hPa, maintaining high forecast skill across Himachal and Uttarakhand.",
                "drivers": ["Upper-tropospheric westerly trough", "Sub-tropical jet stream", "Cold air damming"],
                "compound": False,
                "conditions": {
                    "temperature": "-6.8°C",
                    "rainfall": "42 mm/day",
                    "wind": "58 km/h",
                    "pressure": "988 hPa",
                    "humidity": "88%"
                },
                "history": [
                    {"t": -24, "lat": 33.7, "lon": 74.4, "intensity": 74, "extent": 34000, "speed": 26, "conf": 92, "anomaly": 78},
                    {"t": 0, "lat": 34.1, "lon": 75.5, "intensity": 78, "extent": 38000, "speed": 28, "conf": 89, "anomaly": 82},
                ],
                "predicted": [
                    {"t": 24, "lat": 34.5, "lon": 76.6, "intensity": 79, "extent": 39000, "speed": 28, "conf": 85, "anomaly": 83},
                    {"t": 48, "lat": 34.8, "lon": 77.8, "intensity": 72, "extent": 35000, "speed": 29, "conf": 79, "anomaly": 76},
                ],
                "etas": [
                    {"region": "Leh", "etaH": 14, "intensity": 79, "confidence": 87},
                    {"region": "Shimla", "etaH": 32, "intensity": 74, "confidence": 81},
                ]
            },
            {
                "id": "TH-5092",
                "name": "Severe Convective Thunderstorm & Gale Wind Cluster",
                "category": "thunderstorm",
                "categoryLabel": "Severe Thunderstorm",
                "subtype": "Mesoscale Squall Line (Kalbaishakhi)",
                "anchor": "Gangetic West Bengal",
                "corridor": ["Kolkata", "Howrah", "Midnapore", "Balasore", "Barisal"],
                "lat": round(22.6 + 0.045 * t, 3),
                "lon": round(88.4 + 0.035 * t, 3),
                "intensity": 82.0,
                "anomalyScore": 85.0,
                "confidence": 86.0,
                "confBand": "HIGH",
                "severity": "HIGH",
                "trend": "INTENSIFYING",
                "extentKm2": 28000.0,
                "speedKmph": 42.0,
                "headingDeg": 145.0,
                "headingLabel": "SE",
                "durationH": 24.0,
                "detectedAt": -12.0,
                "uncertaintyKm": 32.0,
                "skilledUntilH": 48.0,
                "headline": "High CAPE (>3800 J/kg) triggering severe squall lines with wind gusts up to 85 km/h and intense lightning.",
                "evolution": "Rapid nocturnal expansion toward the Bay of Bengal coastline.",
                "aiSummary": "Radar convective signature and high lapse rates indicate intense multi-cell thunderstorm evolution over southern Bengal delta.",
                "drivers": ["Dry line dry/moist air collision", "Extreme thermodynamic instability", "Strong low-level wind shear"],
                "compound": False,
                "conditions": {
                    "temperature": "27.2°C",
                    "rainfall": "112 mm/day",
                    "wind": "85 km/h",
                    "pressure": "998 hPa",
                    "humidity": "92%"
                },
                "history": [
                    {"t": -12, "lat": 23.1, "lon": 87.9, "intensity": 75, "extent": 22000, "speed": 38, "conf": 89, "anomaly": 80},
                    {"t": 0, "lat": 22.6, "lon": 88.4, "intensity": 82, "extent": 28000, "speed": 42, "conf": 86, "anomaly": 85},
                ],
                "predicted": [
                    {"t": 12, "lat": 22.0, "lon": 88.9, "intensity": 85, "extent": 32000, "speed": 44, "conf": 82, "anomaly": 87},
                    {"t": 24, "lat": 21.4, "lon": 89.4, "intensity": 71, "extent": 26000, "speed": 45, "conf": 76, "anomaly": 75},
                ],
                "etas": [
                    {"region": "Kolkata", "etaH": 3, "intensity": 83, "confidence": 88},
                    {"region": "Balasore", "etaH": 11, "intensity": 85, "confidence": 84},
                ]
            }
        ]
        return events

    def get_event_by_id(self, event_id: str, t: float = 0.0) -> Optional[Dict[str, Any]]:
        events = self.get_events(t)
        for e in events:
            if e["id"] == event_id:
                return e
        return None

    def get_forecast(self, event_id: Optional[str] = None, lead_hours: int = 120) -> Dict[str, Any]:
        events = self.get_events(0.0)
        selected = events[0]
        if event_id:
            for e in events:
                if e["id"] == event_id:
                    selected = e
                    break
        return {
            "event_id": selected["id"],
            "name": selected["name"],
            "category": selected["category"],
            "horizon_hours": lead_hours,
            "forecast_trajectory": selected["predicted"],
            "confidence_envelope_km": selected["uncertaintyKm"],
            "model": "SIHTRACK Medium-Range Neural Tracker",
        }

    def get_track(self, event_id: str) -> Dict[str, Any]:
        ev = self.get_event_by_id(event_id, 0.0) or self.get_events(0.0)[0]
        return {
            "id": ev["id"],
            "name": ev["name"],
            "history": ev["history"],
            "current": {"lat": ev["lat"], "lon": ev["lon"], "intensity": ev["intensity"], "t": 0},
            "predicted": ev["predicted"],
            "uncertainty_corridor": [
                {"lat": p["lat"], "lon": p["lon"], "halfWidthKm": round(25.0 + 1.4 * p["t"], 1)}
                for p in ev["predicted"]
            ],
        }

    def get_field(self, layer: str, t: float = 0.0) -> Dict[str, Any]:
        # Field raster bounds
        return {
            "layer": layer,
            "t": t,
            "bounds": {"lat0": 6.0, "lat1": 38.0, "lon0": 68.0, "lon1": 98.0},
            "nx": 64,
            "ny": 64,
            "min_val": 0.0,
            "max_val": 100.0,
            "status": "ready",
        }

    def get_wind(self, t: float = 0.0) -> Dict[str, Any]:
        return {
            "t": t,
            "nx": 48,
            "ny": 48,
            "bounds": {"lat0": 6.0, "lat1": 38.0, "lon0": 68.0, "lon1": 98.0},
            "status": "ready",
        }

    def get_alerts(self, t: float = 0.0) -> List[Dict[str, Any]]:
        events = self.get_events(t)
        alerts = []
        for e in events:
            if e["severity"] in ["EXTREME", "HIGH"]:
                alerts.append({
                    "id": f"ALT-{e['id']}",
                    "severity": e["severity"],
                    "title": f"Extreme Weather Advisory: {e['name']}",
                    "body": e["headline"],
                    "eventId": e["id"],
                    "issuedAt": int(datetime.utcnow().timestamp() * 1000),
                    "region": e["anchor"],
                    "corridor": e["corridor"],
                    "read": False,
                })
        return alerts

    def get_risk_regions(self, t: float = 0.0) -> List[Dict[str, Any]]:
        return [
            {"name": "Gujarat Coastal Zone", "lat": 22.3, "lon": 69.5, "riskScore": 92, "hazard": "Cyclone & Storm Surge", "trend": "INTENSIFYING", "eventIds": ["CY-2401"]},
            {"name": "Odisha Coastal Delta", "lat": 20.2, "lon": 85.8, "riskScore": 88, "hazard": "Extreme Rainfall & Flash Flood", "trend": "STEADY", "eventIds": ["RF-1082"]},
            {"name": "Delhi National Capital Region", "lat": 28.6, "lon": 77.2, "riskScore": 84, "hazard": "Severe Heatwave & High WBGT", "trend": "STEADY", "eventIds": ["HW-3021"]},
            {"name": "South Bengal Estuary", "lat": 22.4, "lon": 88.5, "riskScore": 79, "hazard": "Severe Convective Squall Line", "trend": "INTENSIFYING", "eventIds": ["TH-5092"]},
            {"name": "Western Himalayan Highlands", "lat": 34.0, "lon": 75.8, "riskScore": 75, "hazard": "Extreme Cold & Snow Blizzard", "trend": "STEADY", "eventIds": ["CW-4105"]},
        ]

    def get_stats(self, t: float = 0.0) -> Dict[str, Any]:
        events = self.get_events(t)
        extreme_count = sum(1 for e in events if e["severity"] == "EXTREME")
        high_count = sum(1 for e in events if e["severity"] == "HIGH")
        avg_int = sum(e["intensity"] for e in events) / max(1, len(events))
        avg_conf = sum(e["confidence"] for e in events) / max(1, len(events))
        max_anom = max(e["anomalyScore"] for e in events) if events else 0.0

        return {
            "activeCount": len(events),
            "extremeCount": extreme_count,
            "highCount": high_count,
            "avgIntensity": round(avg_int, 1),
            "avgConfidence": round(avg_conf, 1),
            "maxAnomaly": round(max_anom, 1),
            "mode": "DEMO MODE",
            "cycle": self.cycle,
        }

    def get_nearby_events(self, user_lat: float, user_lon: float, t: float = 0.0) -> List[Dict[str, Any]]:
        """Calculates distance from user location to all active events, sorted ascending."""
        events = self.get_events(t)
        nearby = []
        for e in events:
            dist = round(_haversine_km(user_lat, user_lon, e["lat"], e["lon"]), 1)
            
            # Compass direction from user to event
            la1, la2 = math.radians(user_lat), math.radians(e["lat"])
            dlon = math.radians(e["lon"] - user_lon)
            y = math.sin(dlon) * math.cos(la2)
            x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(dlon)
            deg = (math.degrees(math.atan2(y, x)) + 360) % 360
            compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
            direction = compass[round(deg / 22.5) % 16]

            nearby.append({
                "eventId": e["id"],
                "name": e["name"],
                "category": e["category"],
                "categoryLabel": e["categoryLabel"],
                "distanceKm": dist,
                "direction": direction,
                "severity": e["severity"],
                "intensity": e["intensity"],
                "confidence": e["confidence"],
                "anchor": e["anchor"],
                "etaHours": e.get("etas", [{}])[0].get("etaH", 0) if dist < 300 else None,
            })

        nearby.sort(key=lambda x: x["distanceKm"])
        return nearby
