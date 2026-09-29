/**
 * USER-FACING LANGUAGE
 * -------------------------------------------------------------------
 * The main screen speaks plain language. Technical terminology is kept for
 * the AI / System area only. Every label here is intentionally short enough
 * to be understood in under a second, and every non-obvious control has a
 * tooltip string so first-time users are never guessing.
 */
import type { Category, ConfBand, Severity, Trend } from '../types';

/** Severity: colour is never the only signal — a clean symbol always accompanies it. */
export const SEV_UI: Record<Severity, { label: string; icon: string; color: string; plain: string }> = {
  EXTREME: { label: 'Extreme', icon: '●', color: '#ef4444', plain: 'Most serious — act now' },
  HIGH: { label: 'High', icon: '▲', color: '#f97316', plain: 'Serious — keep watch' },
  MODERATE: { label: 'Moderate', icon: '■', color: '#eab308', plain: 'Unusual but manageable' },
  NORMAL: { label: 'Normal', icon: '✓', color: '#22c55e', plain: 'Within usual range' },
};

export const SEV_ORDER_UI: Severity[] = ['EXTREME', 'HIGH', 'MODERATE', 'NORMAL'];

export const CONF_UI: Record<ConfBand, { label: string; plain: string }> = {
  HIGH: { label: 'High confidence', plain: 'Very reliable' },
  MEDIUM: { label: 'Medium confidence', plain: 'Fairly reliable' },
  LOW: { label: 'Low confidence', plain: 'Treat with caution' },
};

export const TREND_UI: Record<Trend, { label: string; icon: string; color: string; plain: string }> = {
  INTENSIFYING: { label: 'Intensifying', icon: '▲', color: '#ef4444', plain: 'Getting stronger' },
  STEADY: { label: 'Steady', icon: '■', color: '#eab308', plain: 'About the same' },
  WEAKENING: { label: 'Weakening', icon: '▼', color: '#38bdf8', plain: 'Getting weaker' },
  DISSIPATING: { label: 'Fading', icon: '◦', color: '#7b8ba6', plain: 'Almost over' },
};

/**
 * Renames the engine's technical category labels for the primary surfaces.
 * `technical` keeps the original wording for the AI / System pages.
 */
export const CAT_PLAIN: Record<Category, string> = {
  rainfall: 'Extreme Rainfall',
  cyclone: 'Cyclone / Storm',
  wind: 'Severe Wind',
  heat: 'Heat',
  cold: 'Cold',
  pressure: 'Low Pressure',
  drought: 'Drought',
  flood: 'Flood',
  thunderstorm: 'Thunderstorm',
  compound: 'Compound Extreme',
};

export const EVENT_TYPE_ICON: Record<Category, string> = {
  rainfall: 'rain',
  cyclone: 'cyclone',
  wind: 'wind',
  heat: 'heat',
  cold: 'cold',
  pressure: 'pressure',
  drought: 'drought',
  flood: 'flood',
  thunderstorm: 'thunderstorm',
  compound: 'compound',
};

/* ------------------------------------------------------------------ */
/* Tooltips — one place, so wording stays consistent                    */
/* ------------------------------------------------------------------ */
export const TIPS = {
  layers: 'Show or hide weather layers on the map',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fullscreen: 'Fullscreen the map',
  resetView: 'Reset the map to the India view',
  fitEvents: 'Zoom to show all visible events',
  track: 'View how this event moved and where it may go',
  confidence: 'How reliable the current forecast is',
  timeline: 'Explore the event through time',
  basemap: 'Change the background map style',
  play: 'Play the timeline to animate the forecast',
  pause: 'Pause the timeline',
  cluster: 'Several events are close together — click to zoom in and separate them',
  demo: 'This application runs on simulated demonstration data — it is not an official weather forecast',
  search: 'Search for a state, city, district or event',
};

/* ------------------------------------------------------------------ */
/* Weather layer catalogue for the single "Layers" panel                */
/* ------------------------------------------------------------------ */
export interface LayerUi {
  id: string;
  label: string;
  hint: string;
  icon: string;
  group: 'events' | 'weather';
}

export const WEATHER_LAYERS: LayerUi[] = [
  { id: 'anomaly', label: 'Weather Anomaly', hint: 'Where the weather is behaving unusually', icon: 'anomaly', group: 'weather' },
  { id: 'temp', label: 'Temperature', hint: 'How much hotter or colder than usual', icon: 'temp', group: 'weather' },
  { id: 'rain', label: 'Rainfall', hint: 'How much more or less rain than usual', icon: 'rain', group: 'weather' },
  { id: 'wind', label: 'Wind', hint: 'Wind speed and direction', icon: 'wind', group: 'weather' },
  { id: 'pressure', label: 'Pressure', hint: 'High and low pressure centres', icon: 'pressure', group: 'weather' },
  { id: 'humidity', label: 'Humidity', hint: 'Moisture in the air', icon: 'humidity', group: 'weather' },
  { id: 'storm', label: 'Storms', hint: 'Active cyclonic systems', icon: 'storm', group: 'weather' },
  { id: 'risk', label: 'Composite Risk', hint: 'Severity × area × confidence combined into one score', icon: 'risk', group: 'weather' },
];

/* ------------------------------------------------------------------ */
/* India view                                                          */
/* ------------------------------------------------------------------ */
export const INDIA_CENTER: [number, number] = [80.5, 22.4];
export const INDIA_ZOOM = 4.05;
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [66.0, 5.5],
  [98.5, 38.5],
];

/* ==================================================================== */
/* REDESIGN TOKENS (from sihtrack-redesign)                             */
/*                                                                     */
/* The redesign shipped its own `Severity` / `LayerId` types. Those    */
/* would collide with this project's domain types, so the tokens are  */
/* merged in here against the existing `Severity` / `Category` and     */
/* exported under redesign names. One scale, one source of truth.     */
/* ==================================================================== */

/** Hazard aliases used by the redesigned UI, mapped onto real categories. */
export type HazardType =
  | 'heat' | 'convection' | 'cyclone' | 'rainfall' | 'flood'
  | 'wind' | 'cold' | 'pressure' | 'drought' | 'compound';

/** The redesign names convection; the domain model calls it thunderstorm. */
export const HAZARD_TO_CATEGORY: Record<HazardType, Category> = {
  heat: 'heat', convection: 'thunderstorm', cyclone: 'cyclone', rainfall: 'rainfall',
  flood: 'flood', wind: 'wind', cold: 'cold', pressure: 'pressure',
  drought: 'drought', compound: 'compound',
};

export const CATEGORY_TO_HAZARD: Record<Category, HazardType> = {
  heat: 'heat', thunderstorm: 'convection', cyclone: 'cyclone', rainfall: 'rainfall',
  flood: 'flood', wind: 'wind', cold: 'cold', pressure: 'pressure',
  drought: 'drought', compound: 'compound',
};

/** The composite score scale the redesign documents: Normal <55, Moderate 55-67, High 68-81, Extreme >=82. */
export function severityFromScore(score: number): Severity {
  if (score >= 82) return 'EXTREME';
  if (score >= 68) return 'HIGH';
  if (score >= 55) return 'MODERATE';
  return 'NORMAL';
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  NORMAL: '#22c55e', MODERATE: '#eab308', HIGH: '#f97316', EXTREME: '#ef4444',
};
export const SEVERITY_LABEL: Record<Severity, string> = {
  NORMAL: 'NORMAL', MODERATE: 'MODERATE', HIGH: 'HIGH', EXTREME: 'EXTREME',
};
export const FORECAST_COLOR = '#9aa6ff';

/** Calm neutral basemaps so the weather overlay stays the subject. */
export const MAP_STYLE_DARK: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0e1420' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5b667a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e1420' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#2a3548' }, { weight: 0.8 }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#151d2c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0f19' }] },
];
export const MAP_STYLE_LIGHT: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#eef1f6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b768a' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#c3ccdb' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d8e2f0' }] },
];