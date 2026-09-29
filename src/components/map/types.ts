import type { WeatherEvent } from '../../types';

/* ------------------------------------------------------------------ */
/* shared engine contracts                                             */
/*                                                                     */
/* These types are the contract between the map engine and the React  */
/* overlays. The engine can be swapped without touching the UI, which  */
/* is exactly what happened when the MapLibre engine was replaced by   */
/* the Google Maps engine.                                             */
/* ------------------------------------------------------------------ */

export type Basemap = 'light' | 'dark' | 'satellite';

export interface BasemapStatus {
  /** which provider actually answered */
  provider: string;
  /** true when the app could not reach any map service */
  offline: boolean;
  loading: boolean;
}

export interface EngineCallbacks {
  onSelect: (id: string | null) => void;
  onMove?: (lon: number, lat: number, zoom: number, bearing: number) => void;
  onReady?: () => void;
  onBaseStatus?: (status: BasemapStatus) => void;
  /** surfaced to the user when the map itself cannot start */
  onFatal?: (message: string, hint: string) => void;
}

export interface EventRenderOpts {
  showTracks: boolean;
  showCorridors: boolean;
  showEta: boolean;
  showLabels: boolean;
  showDistricts: boolean;
  showStateLabels: boolean;
  selectedId: string | null;
  hiddenIds: Set<string>;
  /** hours relative to NOW */
  t: number;
  cluster: boolean;
}

/** The narrow slice of the engine the React overlays need. */
export interface MapEngineLike {
  flyTo(lon: number, lat: number, zoom?: number, duration?: number): void;
  fitTo(events: WeatherEvent[], pad?: number): void;
  focusEvent(e: WeatherEvent): void;
  reset(): void;
  zoomBy(delta: number): void;
  toggleFullscreen(): void;
  resize(): void;
}

/** The full surface the map container drives. */
export interface MapEngineLikeFull extends MapEngineLike {
  setBasemap(kind: Basemap): void;
  setStateLabelsVisible(on: boolean): void;
  setField(layer: string, grid: unknown): void;
  setLayerVisibility(vis: Record<string, boolean>): void;
  updateEvents(events: WeatherEvent[], o: EventRenderOpts): void;
  setWindField(vec: unknown): void;
  /** redesign animated track layer for the single on-map event */
  setTrackedEvent(ev: WeatherEvent | null, cursorHour: number, playing: boolean): void;
  updateTrackedTime(cursorHour: number, playing: boolean): void;
  setUserLocation(loc: { lat: number; lon: number; accuracy?: number } | null): void;
  destroy(): void;
}
