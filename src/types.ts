/**
 * SIHTRACK — domain model
 * SIH26078 · AI-Driven Spatio-Temporal Tracking of Extreme Weather Anomalies
 * in Medium-Range Forecasts
 *
 * NOTE: every value in this prototype is DEMO / SIMULATED data produced by a
 * deterministic engine (see src/data/engine.ts). Nothing here is an official
 * meteorological forecast.
 */

export type Category =
  | 'rainfall'
  | 'cyclone'
  | 'wind'
  | 'heat'
  | 'cold'
  | 'pressure'
  | 'drought'
  | 'flood'
  | 'thunderstorm'
  | 'compound';

export type Severity = 'NORMAL' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type ConfBand = 'LOW' | 'MEDIUM' | 'HIGH';
export type Trend = 'INTENSIFYING' | 'STEADY' | 'WEAKENING' | 'DISSIPATING';
export type LayerId =
  | 'temp'
  | 'rain'
  | 'storm'
  | 'wind'
  | 'pressure'
  | 'humidity'
  | 'anomaly'
  | 'risk';

export type ViewId =
  | 'map'
  | 'overview'
  | 'events'
  | 'analytics'
  | 'forecast'
  | 'tracking'
  | 'historical'
  | 'ai'
  | 'alerts'
  | 'system'
  | 'architecture'
  | 'about';

/** A keyframe on an event's spatio-temporal track, in hours relative to NOW. */
export interface TrackKey {
  t: number;
  lat: number;
  lon: number;
  /** 0..100 event intensity */
  intensity: number;
  /** km² affected footprint */
  extent: number;
  /** km/h translation speed */
  speed: number;
  /** 0..100 model confidence at this lead time */
  conf: number;
  /** 0..100 anomaly score relative to climatology */
  anomaly: number;
}

/** Static definition used by the generator. */
export interface EventSeed {
  id: string;
  name: string;
  category: Category;
  subtype: string;
  /** named place the event is currently anchored on */
  anchor: string;
  /** administrative regions the event is expected to cross, in order */
  corridor: string[];
  track: TrackKey[];
  /** if true the event is part of the compound-extreme demo cluster */
  compound?: boolean;
  headline: string;
  evolution: string;
}

/** Fully resolved event state for a given instant. */
export interface WeatherEvent {
  id: string;
  name: string;
  category: Category;
  categoryLabel: string;
  subtype: string;
  anchor: string;
  corridor: string[];

  lat: number;
  lon: number;

  intensity: number;
  anomalyScore: number;
  confidence: number;
  confBand: ConfBand;
  severity: Severity;
  trend: Trend;
  extentKm2: number;
  speedKmph: number;
  headingDeg: number;
  headingLabel: string;

  /** hours since first detection, at the current cursor */
  durationH: number;
  detectedAt: number; // hour offset at which the event crosses the detection threshold
  firstSeenLabel: string;
  lastSeenLabel: string;

  status: string;
  forecastStatus: string;

  /** corridor of certainty (km) at the cursor */
  uncertaintyKm: number;
  /** hour offset at which confidence drops below the usable-forecast threshold */
  skilledUntilH: number;

  /** ordered, timestamped positions for drawing */
  history: TrackKey[];
  predicted: TrackKey[];
  /** every sampled point, used for charts */
  series: TrackKey[];
  current: TrackKey;

  /** ETA per downstream region */
  etas: { region: string; etaH: number; intensity: number; confidence: number }[];

  headline: string;
  evolution: string;
  aiSummary: string;
  drivers: string[];
  /** part of the compound-extreme overlap demo cluster */
  compound: boolean;
}

export interface RegionRisk {
  name: string;
  lat: number;
  lon: number;
  riskScore: number;
  hazard: string;
  trend: Trend;
  eventIds: string[];
}

export interface CompoundGroup {
  id: string;
  eventIds: string[];
  score: number;
  label: string;
  drivers: string[];
  regions: string[];
}

export interface AlertItem {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  eventId?: string;
  issuedAt: number;
  region: string;
  read: boolean;
}

export interface FilterState {
  categories: Category[];
  severities: Severity[];
  timeWindow: 'all' | 'last6' | 'last24' | 'next24' | 'next72' | 'next5d';
  confidence: 'ALL' | ConfBand;
}

export interface FieldLayerMeta {
  id: LayerId;
  label: string;
  icon: string;
  unit: string;
  description: string;
  kind: 'field' | 'vector' | 'events';
}
