import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import type { Category, ConfBand, FilterState, LayerId, Severity, ViewId, WeatherEvent } from '../types';
import { T_MAX, T_MIN, eventsAt, snapshot, type Snapshot } from '../data/engine';

export type Basemap = 'light' | 'dark' | 'satellite';

export interface Toast {
  id: string;
  kind: 'info' | 'warn' | 'alert' | 'ok';
  title: string;
  msg?: string;
}

export interface Place {
  name: string;
  kind: string;
  lat: number;
  lon: number;
  zoom: number;
  state?: string;
}

const DEFAULT_FILTERS: FilterState = {
  categories: [],
  severities: [],
  timeWindow: 'all',
  confidence: 'ALL',
};

/**
 * The single weather type the map is currently dedicated to.
 *
 * Mixing ten hazard types on one map makes every marker ambiguous — a violet
 * dot could be a cyclone or a low-pressure system. Isolating one type at a
 * time turns the map into a single readable question: "where is THIS hazard
 * right now?". `null` means every type at once, which stays available as the
 * overview.
 */
export const FOCUS_ORDER: Category[] = [
  'heat',
  'thunderstorm',
  'cyclone',
  'rainfall',
  'flood',
  'wind',
  'cold',
  'pressure',
  'drought',
  'compound',
];

/**
 * The map opens clean: events only, no colour rasters.
 * Weather layers are opt-in from the single "Layers" button, so the first
 * thing a new user sees is India and the events on it.
 */
const DEFAULT_LAYERS: Record<LayerId, boolean> = {
  anomaly: false,
  risk: false,
  temp: false,
  rain: false,
  storm: false,
  wind: false,
  pressure: false,
  humidity: false,
};

const ONBOARDING_KEY = 'sihtrack.onboarded.v1';

interface Store {
  /* navigation */
  view: ViewId;
  setView: (v: ViewId) => void;
  moreOpen: boolean;
  setMoreOpen: (b: boolean) => void;

  /* time machine */
  currentTime: number;
  setTime: (t: number) => void;
  nudgeTime: (d: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  playSpeed: number;
  setPlaySpeed: (s: number) => void;
  direction: 1 | -1;
  setDirection: (d: 1 | -1) => void;

  /* map */
  basemap: Basemap;
  setBasemap: (b: Basemap) => void;
  layers: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;
  setLayers: (l: Partial<Record<LayerId, boolean>>) => void;
  setAllLayers: (on: boolean) => void;
  showTracks: boolean;
  showCorridors: boolean;
  showEta: boolean;
  showLabels: boolean;
  showStateLabels: boolean;
  clusterEvents: boolean;
  toggle: (k: 'showTracks' | 'showCorridors' | 'showEta' | 'showLabels' | 'showStateLabels' | 'clusterEvents') => void;
  resetView: () => void;
  resetViewNonce: number;
  flyTo: Place | null;
  requestFlyTo: (p: Place | null) => void;

  /* selection */
  selectedEventId: string | null;
  selectEvent: (id: string | null, opts?: { fly?: boolean }) => void;
  /** the event currently being tracked in the detail drawer */
  trackedEventId: string | null;
  setTrackedEventId: (id: string | null) => void;
  selectedRegion: string | null;
  setSelectedRegion: (r: string | null) => void;

  /* filters */
  filters: FilterState;
  setFilters: (f: Partial<FilterState>) => void;
  toggleCategory: (c: Category) => void;
  toggleSeverity: (s: Severity) => void;
  resetFilters: () => void;

  /* single-hazard map focus — one dedicated map per weather type */
  focusCategory: Category | null;
  setFocusCategory: (c: Category | null) => void;

  /* single-event map focus — the map carries exactly one event at a time */
  focusEventId: string | null;
  setFocusEventId: (id: string | null) => void;

  /* redesign ui mode + theme (no new time state: currentTime stays the clock) */
  uiMode: 'browse' | 'track';
  trackEvent: (id: string) => void;
  stopTracking: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  /** the one event-detail surface; the map screen owns it */
  drawerOpen: boolean;
  setDrawerOpen: (b: boolean) => void;

  /* ui chrome */
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
  layersOpen: boolean;
  setLayersOpen: (b: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (b: boolean) => void;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'> & { id?: string }) => void;
  dismissToast: (id: string) => void;

  /* onboarding */
  onboarded: boolean;
  skipOnboarding: () => void;
  startOnboarding: () => void;

  mobileSheet: null | 'layers' | 'events' | 'alerts' | 'detail';
  setMobileSheet: (v: null | 'layers' | 'events' | 'alerts' | 'detail') => void;

  readAlerts: string[];
  markAlertRead: (id: string) => void;
  markAllRead: () => void;

  /* user location */
  userLocation: { lat: number; lon: number; accuracy?: number } | null;
  setUserLocation: (loc: { lat: number; lon: number; accuracy?: number } | null) => void;
  locationModalOpen: boolean;
  setLocationModalOpen: (b: boolean) => void;

  /* data source mode */
  dataSourceMode: 'REAL' | 'DEMO';
  setDataSourceMode: (m: 'REAL' | 'DEMO') => void;
  dataSourceMeta: {
    source: string;
    model: string;
    runTime: string;
    leadTime: string;
    resolution: string;
    isReal: boolean;
    status: string;
  };
  setDataSourceMeta: (meta: any) => void;
}

const clampT = (t: number) => Math.max(T_MIN, Math.min(T_MAX, t));
const readFlag = (key: string) => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (key: string) => {
  try {
    localStorage?.setItem(key, '1');
  } catch {
    /* private mode — the guide simply shows again next session */
  }
};

export const useStore = create<Store>((set, get) => ({
  view: 'map',
  setView: (view) => set({ view, moreOpen: false, mobileSheet: null }),
  moreOpen: false,
  setMoreOpen: (moreOpen) => set({ moreOpen }),

  currentTime: 0,
  setTime: (t) => set({ currentTime: clampT(t) }),
  nudgeTime: (d) => set((s) => ({ currentTime: clampT(s.currentTime + d) })),
  playing: false,
  setPlaying: (playing) => set({ playing }),
  playSpeed: 6,
  setPlaySpeed: (playSpeed) => set({ playSpeed }),
  direction: 1,
  setDirection: (direction) => set({ direction }),

  basemap: 'dark',
  setBasemap: (basemap) => set({ basemap }),
  layers: { ...DEFAULT_LAYERS },
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setLayers: (l) => set((s) => ({ layers: { ...s.layers, ...l } })),
  setAllLayers: (on) =>
    set(() => {
      const next = { ...DEFAULT_LAYERS };
      (Object.keys(next) as LayerId[]).forEach((k) => (next[k] = on));
      return { layers: next };
    }),
  showTracks: true,
  showCorridors: true,
  showEta: true,
  showLabels: false,
  showStateLabels: true,
  clusterEvents: true,
  toggle: (k) => set((s) => ({ [k]: !s[k] } as any)),
  resetView: () => set((s) => ({ resetViewNonce: s.resetViewNonce + 1, flyTo: null })),
  resetViewNonce: 0,
  flyTo: null,
  requestFlyTo: (flyTo) => set({ flyTo }),

  selectedEventId: null,
  trackedEventId: null,
  selectEvent: (id, opts) =>
    set((s) => {
      const ev = id ? eventsAt(s.currentTime).find((e) => e.id === id) : null;
      return {
        selectedEventId: id,
        trackedEventId: id,
        selectedRegion: null,
        flyTo: opts?.fly && ev ? { name: ev.anchor, kind: 'Event', lat: ev.lat, lon: ev.lon, zoom: 6.6 } : s.flyTo,
        mobileSheet: id ? 'detail' : s.mobileSheet,
      };
    }),
  setTrackedEventId: (trackedEventId) => set({ trackedEventId }),
  selectedRegion: null,
  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),

  filters: { ...DEFAULT_FILTERS },
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),

  focusCategory: null,
  setFocusCategory: (focusCategory) =>
    set((s) =>
      s.focusCategory === focusCategory
        ? s
        : {
            focusCategory,
            /* the dedicated map owns the selection: a tracked event of another
               type is no longer on the map, so its drawer would show an empty
               view. Starting clean makes each type's map self-explanatory. */
            trackedEventId: null,
            selectedEventId: null,
            focusEventId: null,
          },
    ),

  focusEventId: null,
  setFocusEventId: (focusEventId) =>
    set((s) => ({
      focusEventId,
      /* stepping through events on the map follows the event, so the drawer and
         the selection move with it rather than describing something else */
      selectedEventId: focusEventId,
      trackedEventId: focusEventId,
    })),

  uiMode: 'browse',
  trackEvent: (id) =>
    set({ selectedEventId: id, trackedEventId: id, focusEventId: id, uiMode: 'track', drawerOpen: true }),
  stopTracking: () => set({ uiMode: 'browse' }),
  /* the one event-detail surface; the map screen owns it. The map always
     carries exactly one event, so its drawer is open unless the user closes it. */
  drawerOpen: true,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

  theme: 'dark',
  setTheme: (theme) => {
    /* the theme lives on <html> so the CSS variables in theme.css flip */
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
    set({ theme });
  },

  toggleCategory: (c) =>
    set((s) => ({
      filters: {
        ...s.filters,
        categories: s.filters.categories.includes(c)
          ? s.filters.categories.filter((x) => x !== c)
          : [...s.filters.categories, c],
      },
    })),
  toggleSeverity: (sv) =>
    set((s) => ({
      filters: {
        ...s.filters,
        severities: s.filters.severities.includes(sv)
          ? s.filters.severities.filter((x) => x !== sv)
          : [...s.filters.severities, sv],
      },
    })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  layersOpen: false,
  setLayersOpen: (layersOpen) => set({ layersOpen }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  toasts: [],
  pushToast: (t) => {
    const id = t.id ?? Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts.filter((x) => x.id !== id), { ...t, id }].slice(-3) }));
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  onboarded: readFlag(ONBOARDING_KEY),
  skipOnboarding: () => {
    writeFlag(ONBOARDING_KEY);
    set({ onboarded: true });
  },
  startOnboarding: () => set({ onboarded: false }),

  mobileSheet: null,
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),

  readAlerts: [],
  markAlertRead: (id) => set((s) => (s.readAlerts.includes(id) ? s : { readAlerts: [...s.readAlerts, id] })),
  markAllRead: () => {
    const s = get();
    const snap = snapshot(s.currentTime);
    set({ readAlerts: snap.alerts.map((a) => a.id) });
  },

  /* user location */
  userLocation: null,
  setUserLocation: (userLocation) => set({ userLocation }),
  locationModalOpen: false,
  setLocationModalOpen: (locationModalOpen) => set({ locationModalOpen }),

  /* data source mode */
  dataSourceMode: 'REAL',
  setDataSourceMode: (dataSourceMode) => set({ dataSourceMode }),
  dataSourceMeta: {
    source: 'ECMWF IFS / Open-Meteo Operational',
    model: 'ECMWF Integrated Forecasting System (0.25°)',
    runTime: '00Z Operational Run',
    leadTime: '+120h Medium-Range',
    resolution: '0.25° (~27 km)',
    isReal: true,
    status: 'REAL DATA ACTIVE',
  },
  setDataSourceMeta: (dataSourceMeta) => set({ dataSourceMeta }),
}));

/* ------------------------------------------------------------------ */
/* selectors / hooks                                                   */
/* ------------------------------------------------------------------ */
const SNAPSHOT_CACHE = new Map<number, Snapshot>();
export function getSnapshot(t: number): Snapshot {
  const key = Math.round(t * 2) / 2;
  let s = SNAPSHOT_CACHE.get(key);
  if (!s) {
    if (SNAPSHOT_CACHE.size > 400) SNAPSHOT_CACHE.clear();
    s = snapshot(key);
    SNAPSHOT_CACHE.set(key, s);
  }
  return s;
}

export function useSnapshot(): Snapshot {
  const t = useStore((s) => s.currentTime);
  return getSnapshot(t);
}

export function passesFilters(e: WeatherEvent, f: FilterState, t: number, focus?: Category | null): boolean {
  if (focus && e.category !== focus) return false;
  if (f.categories.length && !f.categories.includes(e.category)) return false;
  if (f.severities.length && !f.severities.includes(e.severity)) return false;
  if (f.confidence !== 'ALL' && e.confBand !== (f.confidence as ConfBand)) return false;
  switch (f.timeWindow) {
    case 'last6':
      return e.durationH <= 6 || e.detectedAt >= t - 6;
    case 'last24':
      return e.detectedAt >= t - 24;
    case 'next24':
      return e.predicted.some((p) => p.t <= t + 24);
    case 'next72':
      return e.predicted.some((p) => p.t <= t + 72);
    case 'next5d':
      return e.predicted.some((p) => p.t <= t + 120);
    default:
      return true;
  }
}

export function useVisibleEvents(): { all: WeatherEvent[]; visible: WeatherEvent[]; hiddenIds: Set<string> } {
  const snap = useSnapshot();
  const filters = useStore((s) => s.filters);
  const focus = useStore((s) => s.focusCategory);
  const hidden = new Set<string>();
  const visible = snap.events.filter((e) => {
    if (passesFilters(e, filters, snap.t, focus)) return true;
    hidden.add(e.id);
    return false;
  });
  return { all: snap.events, visible, hiddenIds: hidden };
}

/**
 * How many events each hazard type would show, ignoring the focus itself so the
 * rail can display "what is over there" for every type at once. The active
 * severity, confidence and time filters still apply, because those genuinely
 * describe the current question.
 */
export function categoryCounts(f: FilterState, t: number): Record<Category, number> {
  const snap = getSnapshot(t);
  const out = Object.fromEntries(FOCUS_ORDER.map((c) => [c, 0])) as Record<Category, number>;
  for (const e of snap.events) {
    if (e.category in out && passesFilters(e, f, t, null)) out[e.category] += 1;
  }
  return out;
}

export const activeFiltersCount = (f: FilterState) =>
  f.categories.length + f.severities.length + (f.timeWindow !== 'all' ? 1 : 0) + (f.confidence !== 'ALL' ? 1 : 0);

/**
 * What the map itself is allowed to draw: exactly one event.
 *
 * A map carrying a dozen markers forces the reader to work out which one they
 * care about before they can read anything. So the map shows a single event —
 * its track, corridor, arrival times and detail drawer all describe that one
 * event — and the rest of the set is kept as a switchable list beside it.
 *
 * The list still comes from `useVisibleEvents`, so the hazard type and the
 * filters narrow the choices without this hook having to know about either.
 */
export function useMapFocus(): {
  /** every event the current type/filters allow, in switch order */
  list: WeatherEvent[];
  /** the one event the map is drawing */
  active: WeatherEvent | null;
  /** its 1-based position in `list` */
  index: number;
  /** ids the engine must not draw, so only `active` reaches the map */
  hiddenIds: Set<string>;
  step: (delta: number) => void;
  goTo: (id: string) => void;
} {
  const { all, visible } = useVisibleEvents();
  const focusEventId = useStore((s) => s.focusEventId);
  const setFocusEventId = useStore((s) => s.setFocusEventId);
  const selectEvent = useStore((s) => s.selectEvent);

  /* a focus that points at a filtered-out or vanished event must not strand the
     map on a blank panel, so it falls back to the first available event */
  const resolved = visible.find((e) => e.id === focusEventId) ?? visible[0] ?? null;
  const active = resolved;
  const index = active ? visible.findIndex((e) => e.id === active.id) : -1;

  const hidden = useMemo(() => {
    const h = new Set<string>();
    for (const e of all) if (e.id !== active?.id) h.add(e.id);
    return h;
  }, [all, active?.id]);

  const goTo = useCallback(
    (id: string) => {
      setFocusEventId(id);
      selectEvent(id, { fly: true });
    },
    [setFocusEventId, selectEvent]
  );

  const step = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const from = index < 0 ? 0 : index;
      const next = visible[(from + delta + visible.length) % visible.length];
      if (next) goTo(next.id);
    },
    [visible, index, goTo]
  );

  return { list: visible, active, index, hiddenIds: hidden, step, goTo };
}

