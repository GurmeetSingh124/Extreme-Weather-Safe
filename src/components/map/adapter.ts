/**
 * ONE place that turns a domain event into what the redesigned UI needs.
 *
 * Adapted to this project's real `WeatherEvent` (src/types.ts) rather than the
 * guessed field names the redesign shipped with. Every field below comes from
 * the deterministic engine, so nothing here invents data.
 */
import { CATEGORY_TO_HAZARD, type HazardType } from '../../lib/design';
import { CAT_META } from '../../lib/utils';
import type { Category, WeatherEvent } from '../../types';

export interface LatLng {
  lat: number;
  lng: number;
}
export interface TimedPoint extends LatLng {
  /** hours relative to NOW — past negative, future positive */
  t: number;
}
export interface ForecastStep {
  hours: number;
  region: string;
  intensity: number;
  confidence: number;
}
export interface EventView {
  id: string;
  type: HazardType;
  title: string;
  region: string;
  severity: WeatherEvent['severity'];
  intensity: number;
  confidence: number;
  direction: string;
  speedKmh: number;
  position: LatLng;
  /** past (t<0), now (t=0), future (t>0), sorted by t */
  track: TimedPoint[];
  forecast: ForecastStep[];
  conditions: Record<string, string>;
  insight: string;
  states: { key: 'detected' | 'intensified' | 'current' | 'forecast'; label: string }[];
  alert?: { severity: WeatherEvent['severity']; regions: string[] };
  /** kept so callers that need the raw event do not have to look it up again */
  source: WeatherEvent;
}

/** The engine's `series` is already the full past + forecast track with signed
 *  `t`, which is exactly the shape `positionAt`/`samplePath` expect. */
function toTrack(e: WeatherEvent): TimedPoint[] {
  return e.series.map((k) => ({ lat: k.lat, lng: k.lon, t: k.t }));
}

/**
 * Conditions are derived from the event's own measurements rather than invented:
 * each field states the value the engine actually carries for this hazard.
 */
function toConditions(e: WeatherEvent): Record<string, string> {
  const unit = CAT_META[e.category].unit;
  return {
    Hazard: e.categoryLabel,
    Subtype: e.subtype,
    Intensity: `${Math.round(e.intensity)}% (${unit})`,
    'Affected area': `${Math.round(e.extentKm2).toLocaleString()} km²`,
    Confidence: `${Math.round(e.confidence)}% (${e.confBand})`,
    'Uncertainty': `± ${Math.round(e.uncertaintyKm)} km`,
    'Skilled until': `+${Math.round(e.skilledUntilH)} h`,
    Duration: `${Math.round(e.durationH)} h tracked`,
  };
}

function toStates(e: WeatherEvent): EventView['states'] {
  return [
    { key: 'detected', label: e.firstSeenLabel.split(',')[0] || 'Detected' },
    { key: 'intensified', label: e.trend },
    { key: 'current', label: 'Now' },
    { key: 'forecast', label: e.forecastStatus },
  ];
}

export function toEventView(e: WeatherEvent): EventView {
  return {
    id: e.id,
    type: CATEGORY_TO_HAZARD[e.category as Category],
    title: e.name,
    region: e.anchor,
    severity: e.severity,
    intensity: Math.round(e.intensity),
    confidence: Math.round(e.confidence),
    direction: e.headingLabel,
    speedKmh: Math.round(e.speedKmph),
    position: { lat: e.lat, lng: e.lon },
    track: toTrack(e),
    forecast: e.etas.map((x) => ({
      hours: Math.round(x.etaH),
      region: x.region,
      intensity: Math.round(x.intensity),
      confidence: Math.round(x.confidence),
    })),
    conditions: toConditions(e),
    insight: e.aiSummary,
    states: toStates(e),
    source: e,
  };
}
