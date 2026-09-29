"""
SIHTRACK Meteorological Data Quality & Validation Engine
Ensures strict physical bounds, coordinate domain containment, and grid consistency.
"""
import logging
from typing import Dict, Any, List, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SIHTRACK-Validation")

# Physical Meteorological Bounds
MIN_TEMPERATURE_C = -50.0  # Himalayan extreme min
MAX_TEMPERATURE_C = 60.0   # Thar desert extreme max
MAX_WIND_SPEED_MS = 120.0  # Category 5+ super-cyclone max gust
MIN_PRESSURE_HPA = 650.0   # Station pressure at high elevation (Himalayan/Western Ghats) to super-cyclones
MAX_PRESSURE_HPA = 1085.0  # Continental high boundary
MIN_LAT, MAX_LAT = 4.0, 42.0     # Extended Indian subcontinent domain
MIN_LON, MAX_LON = 65.0, 102.0   # Extended Bay of Bengal to Arabian Sea domain


class ValidationError(Exception):
    pass


def validate_coordinates(lat: float, lon: float, location_name: str = "Unknown") -> bool:
    """Verifies that latitude and longitude fall strictly within the South Asian meteorological domain."""
    if not (MIN_LAT <= lat <= MAX_LAT) or not (MIN_LON <= lon <= MAX_LON):
        logger.warning(
            f"Coordinate out of domain bounds: ({lat:.3f}, {lon:.3f}) for '{location_name}'. "
            f"Expected lat [{MIN_LAT}, {MAX_LAT}], lon [{MIN_LON}, {MAX_LON}]."
        )
        return False
    return True


def validate_weather_values(
    temperature: Optional_float = None,
    rainfall_rate: Optional_float = None,
    wind_speed: Optional_float = None,
    pressure: Optional_float = None,
    humidity: Optional_float = None
) -> Tuple[bool, List[str]]:
    """Checks physical plausibility of meteorological observations/forecasts."""
    issues = []
    
    if temperature is not None:
        if temperature < MIN_TEMPERATURE_C or temperature > MAX_TEMPERATURE_C:
            issues.append(f"Temperature {temperature}°C out of physical range [{MIN_TEMPERATURE_C}, {MAX_TEMPERATURE_C}]°C")
            
    if rainfall_rate is not None:
        if rainfall_rate < 0.0:
            issues.append(f"Negative precipitation rate: {rainfall_rate} mm/h is unphysical")
        elif rainfall_rate > 500.0:
            issues.append(f"Precipitation rate {rainfall_rate} mm/h exceeds cloudburst threshold (>500mm/h)")
            
    if wind_speed is not None:
        if wind_speed < 0.0 or wind_speed > MAX_WIND_SPEED_MS:
            issues.append(f"Wind speed {wind_speed} m/s out of range [0, {MAX_WIND_SPEED_MS}]")
            
    if pressure is not None:
        if pressure < MIN_PRESSURE_HPA or pressure > MAX_PRESSURE_HPA:
            issues.append(f"Atmospheric pressure {pressure} hPa out of range [{MIN_PRESSURE_HPA}, {MAX_PRESSURE_HPA}]")
            
    if humidity is not None:
        if humidity < 0.0 or humidity > 100.0:
            issues.append(f"Relative humidity {humidity}% out of valid [0, 100]% range")
            
    if issues:
        for iss in issues:
            logger.warning(f"[Data QA] {iss}")
        return False, issues
    return True, []


def sanitize_grid(data: List[float], min_val: float, max_val: float, default_val: float) -> List[float]:
    """Sanitizes grid cells against NaN/Inf and clips outliers."""
    clean = []
    for val in data:
        if val is None or val != val:  # NaN check
            clean.append(default_val)
        elif val < min_val:
            clean.append(min_val)
        elif val > max_val:
            clean.append(max_val)
        else:
            clean.append(float(val))
    return clean

Optional_float = type(None) | float
