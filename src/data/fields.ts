/**
 * SYNTHETIC METEOROLOGICAL FIELD SYNTHESIS
 * -------------------------------------------------------------------
 * Builds a continuous gridded field for every weather layer at any timeline
 * value, from a climatological background plus a Gaussian response for each
 * detected event. Output is rasterised to a canvas and pushed to the map as
 * an imagery source, which is what gives the smooth heatmap morphing.
 *
 * DEMO / SIMULATED — not a real meteorological analysis.
 */
import type { LayerId, WeatherEvent } from '../types';
import { RAMPS, clamp, hexToRgba, makeLut, noise2 } from '../lib/utils';

export const BOUNDS = { lon0: 66, lon1: 98, lat0: 6, lat1: 38 };
export const NX = 57;
export const NY = 57;

export const LAYER_ORDER: LayerId[] = ['anomaly', 'risk', 'temp', 'rain', 'storm', 'wind', 'pressure', 'humidity'];

export interface LayerMeta {
  id: LayerId;
  label: string;
  icon: string;
  unit: string;
  description: string;
  rampKey: keyof typeof RAMPS;
  /** colour scale extremes for the legend */
  scale: number[];
  ticks: number[];
  overlay: 'raster' | 'vector' | 'events';
}

export const LAYERS: Record<LayerId, LayerMeta> = {
  temp: {
    id: 'temp', label: 'Temperature Anomaly', icon: 'temp', unit: '°C', overlay: 'raster', rampKey: 'temp',
    description: 'Departure of 2 m temperature from the 30-year daily climatology.',
    scale: [-8, 14], ticks: [-8, -4, 0, 4, 8, 12],
  },
  rain: {
    id: 'rain', label: 'Rainfall Anomaly', icon: 'rain', unit: 'mm/day', overlay: 'raster', rampKey: 'rain',
    description: '24-hour rainfall accumulation anomaly against climatological normal.',
    scale: [0, 110], ticks: [0, 25, 50, 75, 100],
  },
  storm: {
    id: 'storm', label: 'Storm / Cyclone', icon: 'storm', unit: 'kt', overlay: 'events', rampKey: 'wind',
    description: 'Active cyclonic systems with centre fix, motion vector and predicted track.',
    scale: [0, 100], ticks: [0, 25, 50, 75, 100],
  },
  wind: {
    id: 'wind', label: 'Wind', icon: 'wind', unit: 'km/h', overlay: 'vector', rampKey: 'wind',
    description: '10 m wind speed anomaly with animated direction vectors.',
    scale: [0, 90], ticks: [0, 20, 40, 60, 80],
  },
  pressure: {
    id: 'pressure', label: 'Pressure', icon: 'pressure', unit: 'hPa', overlay: 'raster', rampKey: 'pressure',
    description: 'Mean sea-level pressure anomaly — low- and high-pressure centres.',
    scale: [-18, 18], ticks: [-18, -9, 0, 9, 18],
  },
  humidity: {
    id: 'humidity', label: 'Humidity', icon: 'humidity', unit: '%', overlay: 'raster', rampKey: 'humidity',
    description: 'Relative humidity anomaly at 850 hPa.',
    scale: [-30, 40], ticks: [-30, -15, 0, 20, 40],
  },
  anomaly: {
    id: 'anomaly', label: 'Extreme Weather Anomaly', icon: 'anomaly', unit: 'index', overlay: 'raster', rampKey: 'anomaly',
    description: 'Combined multi-variable anomaly magnitude — where weather is behaving unusually.',
    scale: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1],
  },
  risk: {
    id: 'risk', label: 'Composite Extreme Risk', icon: 'risk', unit: 'index', overlay: 'raster', rampKey: 'risk',
    description: 'Hazard intensity × spatial extent × forecast confidence — the operational risk layer.',
    scale: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1],
  },
};

export type Grid = Float32Array;

const idx = (ix: number, iy: number) => iy * NX + ix;
const gx = (ix: number) => BOUNDS.lon0 + (ix / (NX - 1)) * (BOUNDS.lon1 - BOUNDS.lon0);
const gy = (iy: number) => BOUNDS.lat0 + (iy / (NY - 1)) * (BOUNDS.lat1 - BOUNDS.lat0);

/** amplitude per category, per layer */
const CAT_AMP: Record<LayerId, Partial<Record<string, number>>> = {
  temp: { heat: 1.55, cold: -1.85, cyclone: -0.85, drought: 1.25, thunderstorm: 0.45, pressure: -0.5, wind: 0.35, rainfall: -0.4, flood: -0.45, compound: -1.0 },
  rain: { rainfall: 1.25, flood: 1.35, cyclone: 1.4, thunderstorm: 1.05, pressure: 0.55, drought: -0.6, compound: 1.5, heat: -0.3, cold: 0.25, wind: 0.2 },
  storm: { cyclone: 1.0, pressure: 0.35 },
  wind: { cyclone: 1.05, wind: 0.95, thunderstorm: 0.65, pressure: 0.3, compound: 0.9, heat: 0.15 },
  pressure: { pressure: -1.05, cyclone: -1.15, heat: -0.6, cold: 0.7, compound: -0.95, thunderstorm: -0.4, drought: 0.45 },
  humidity: { rainfall: 1.1, flood: 1.05, cyclone: 1.0, thunderstorm: 0.75, heat: -1.0, drought: -1.15, cold: 0.5, compound: 0.9, pressure: 0.4 },
  anomaly: {
    rainfall: 1, flood: 1.05, cyclone: 1.08, thunderstorm: 1, pressure: 0.82, heat: 0.95, cold: 0.92,
    wind: 0.95, drought: 0.88, compound: 1.12,
  },
  risk: {
    compound: 1.15, cyclone: 1.1, flood: 1.05, rainfall: 1, heat: 0.9, wind: 0.92,
    thunderstorm: 0.88, pressure: 0.7, drought: 0.66, cold: 0.6,
  },
};

/** climatological background pattern (smooth, deterministic, no randomness at runtime) */
function background(layer: LayerId, lon: number, lat: number, t: number): number {
  const u = (lon - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0);
  const v = (lat - BOUNDS.lat0) / (BOUNDS.lat1 - BOUNDS.lat0);
  const drift = t * 0.012;
  const n = noise2(u * 3.1 + drift, v * 3.1 - drift * 0.4, 11) * 0.5 + noise2(u * 7.3, v * 7.3, 23) * 0.25;
  const nm = noise2(u * 2.2 + drift * 1.6, v * 2.2, 31);
  switch (layer) {
    case 'temp':
      return (1 - v) * 5.2 - 2.1 + n * 2.4; // warmer south
    case 'rain':
      return 6 + n * 16 + Math.exp(-((lat - 19) ** 2) / 90) * 12 - Math.exp(-((lon - 72) ** 2) / 14) * 8;
    case 'wind':
      return 9 + nm * 9 + Math.exp(-((lat - 12) ** 2) / 160) * 6;
    case 'pressure':
      return n * 2.6 + (v - 0.5) * 3.2;
    case 'humidity':
      return 4 + n * 10 + (1 - v) * 8;
    case 'anomaly':
      return clamp(0.05 + Math.abs(n) * 0.16 + Math.abs(nm) * 0.08, 0, 0.45);
    case 'risk':
      return clamp(0.04 + Math.abs(n) * 0.1 + Math.abs(nm) * 0.05, 0, 0.3);
    case 'storm':
      return 0;
    default:
      return 0;
  }
}

/** Build the full grid for a layer at time t. */
const GRID_CACHE = new Map<string, Grid>();
export function buildGrid(layer: LayerId, t: number, events: WeatherEvent[]): Grid {
  const roundedT = Math.round(t * 2) / 2;
  const key = `${layer}_${roundedT}_${events.length}_${events[0]?.id ?? ''}_${events[0]?.lat.toFixed(1) ?? ''}`;
  const hit = GRID_CACHE.get(key);
  if (hit) return hit;

  const g = new Float32Array(NX * NY);
  const scale = LAYERS[layer].scale[1];
  for (let iy = 0; iy < NY; iy++) {
    const lat = gy(iy);
    for (let ix = 0; ix < NX; ix++) {
      g[idx(ix, iy)] = background(layer, gx(ix), lat, t);
    }
  }
  for (const e of events) {
    const amp = CAT_AMP[layer][e.category];
    if (amp === undefined || Math.abs(amp) < 0.001) continue;
    const strength = layer === 'anomaly' || layer === 'risk'
      ? (0.6 * e.intensity + 0.4 * e.anomalyScore) / 100
      : layer === 'temp' || layer === 'pressure'
      ? e.anomalyScore / 100
      : e.intensity / 100;
    const radiusKm = Math.sqrt(e.extentKm2 / Math.PI) * 0.62;
    const sigma = Math.max(0.55, radiusKm / 105);
    const peak = amp * strength * scale * (layer === 'storm' ? 1 : 0.86);
    const s2 = 2 * sigma * sigma;
    const span = sigma * 3.2;
    const ix0 = clamp(Math.floor(((e.lon - span - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0)) * (NX - 1)), 0, NX - 1);
    const ix1 = clamp(Math.ceil(((e.lon + span - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0)) * (NX - 1)), 0, NX - 1);
    const iy0 = clamp(Math.floor(((e.lat - span - BOUNDS.lat0) / (BOUNDS.lat1 - BOUNDS.lat0)) * (NY - 1)), 0, NY - 1);
    const iy1 = clamp(Math.ceil(((e.lat + span - BOUNDS.lat0) / (BOUNDS.lat1 - BOUNDS.lat0)) * (NY - 1)), 0, NY - 1);
    for (let iy = iy0; iy <= iy1; iy++) {
      const dy = gy(iy) - e.lat;
      for (let ix = ix0; ix <= ix1; ix++) {
        const dx = (gx(ix) - e.lon) * Math.cos((e.lat * Math.PI) / 180);
        const d2 = dx * dx + dy * dy;
        g[idx(ix, iy)] += peak * Math.exp(-d2 / s2);
      }
    }
  }
  if (layer === 'anomaly' || layer === 'risk') {
    for (let i = 0; i < g.length; i++) g[i] = clamp(g[i], 0, 1);
  }
  if (GRID_CACHE.size > 120) GRID_CACHE.clear();
  GRID_CACHE.set(key, g);
  return g;
}

/* ------------------------------------------------------------------ */
/* wind vector field                                                   */
/* ------------------------------------------------------------------ */
export interface VecField {
  u: Float32Array;
  v: Float32Array;
  speed: Float32Array;
}

export function buildWindVectors(t: number, events: WeatherEvent[]): VecField {
  const u = new Float32Array(NX * NY);
  const v = new Float32Array(NX * NY);
  const speed = new Float32Array(NX * NY);
  const drift = t * 0.012;
  for (let iy = 0; iy < NY; iy++) {
    const lat = gy(iy);
    for (let ix = 0; ix < NX; ix++) {
      const lon = gx(ix);
      const uu = (lon - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0);
      const vv = (lat - BOUNDS.lat0) / (BOUNDS.lat1 - BOUNDS.lat0);
      // background monsoon south-westerly / westerly flow
      const n = noise2(uu * 4.5 + drift, vv * 4.5, 5);
      let ax = 22 + n * 10;
      let ay = -8 + noise2(uu * 6.1, vv * 6.1, 9) * 9;
      for (const e of events) {
        const rot = e.category === 'cyclone' || e.category === 'pressure';
        const strength = rot ? (0.6 * e.intensity + 0.4 * e.anomalyScore) / 100 : e.intensity / 190;
        const radiusKm = Math.sqrt(e.extentKm2 / Math.PI) * 0.62;
        const sigma = Math.max(0.6, radiusKm / 110);
        const dx = (lon - e.lon) * Math.cos((e.lat * Math.PI) / 180);
        const dy = lat - e.lat;
        const d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 / (2 * sigma * sigma));
        if (g < 0.01) continue;
        const mag = 78 * strength * g * (rot ? 1 : 0.85);
        if (rot) {
          // counter-clockwise (cyclonic) rotation about the centre
          const len = Math.sqrt(d2) || 0.0001;
          ax += (-dy / len) * mag;
          ay += (dx / len) * mag;
        } else {
          ax += mag * Math.cos((e.headingDeg * Math.PI) / 180);
          ay += mag * Math.sin((e.headingDeg * Math.PI) / 180) * -1;
        }
      }
      u[idx(ix, iy)] = ax;
      v[idx(ix, iy)] = ay;
      speed[idx(ix, iy)] = Math.sqrt(ax * ax + ay * ay);
    }
  }
  return { u, v, speed };
}

/** bilinear sample of a grid at lon/lat */
export function sampleGrid(g: Grid, lon: number, lat: number) {
  const fx = clamp(((lon - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0)) * (NX - 1), 0, NX - 1);
  const fy = clamp(((lat - BOUNDS.lat0) / (BOUNDS.lat1 - BOUNDS.lat0)) * (NY - 1), 0, NY - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(NX - 1, x0 + 1);
  const y1 = Math.min(NY - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  return (
    g[y0 * NX + x0] * (1 - tx) * (1 - ty) +
    g[y0 * NX + x1] * tx * (1 - ty) +
    g[y1 * NX + x0] * (1 - tx) * ty +
    g[y1 * NX + x1] * tx * ty
  );
}

export function sampleVec(f: VecField, lon: number, lat: number): [number, number] {
  const fx = clamp(((lon - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0)) * (NX - 1), 0, NX - 1);
  const fy = clamp(((lat - BOUNDS.lat0) / (BOUNDS.lat1 - BOUNDS.lat0)) * (NY - 1), 0, NY - 1);
  const li = (g: Float32Array) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(NX - 1, x0 + 1), y1 = Math.min(NY - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    return g[y0 * NX + x0] * (1 - tx) * (1 - ty) + g[y0 * NX + x1] * tx * (1 - ty) + g[y1 * NX + x0] * (1 - tx) * ty + g[y1 * NX + x1] * tx * ty;
  };
  return [li(f.u), li(f.v)];
}

/* ------------------------------------------------------------------ */
/* rasterisation                                                       */
/* ------------------------------------------------------------------ */
const LUT_CACHE = new Map<string, Uint8ClampedArray>();
function lutFor(layer: LayerId) {
  let l = LUT_CACHE.get(layer);
  if (!l) {
    const meta = LAYERS[layer];
    const stops = RAMPS[meta.rampKey].map((s) => [s[0] * (meta.scale[1] / RAMPS[meta.rampKey][RAMPS[meta.rampKey].length - 1][0]), s[1], s[2], s[3]] as [number, number, number, number]);
    l = makeLut(stops);
    LUT_CACHE.set(layer, l);
  }
  return l;
}

/** Mercator Y for a latitude (web-mercator). */
function mercY(lat: number) {
  const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180);
  return 0.5 * Math.log((1 + s) / (1 - s));
}
function invMercY(y: number) {
  return (Math.atan(Math.sinh(y)) * 180) / Math.PI;
}
const Y0 = mercY(BOUNDS.lat0);
const Y1 = mercY(BOUNDS.lat1);

export interface RasterizeOpts {
  width: number;
  height: number;
  /** opacity multiplier */
  alpha?: number;
  /** values below this fraction of the ramp are fully transparent */
  cutoff?: number;
  /** solid single colour mode (used for the storm layer) */
  solid?: { color: string; alpha: number };
}

interface ProjCache {
  w: number;
  h: number;
  x0: Int32Array;
  x1: Int32Array;
  tx: Float32Array;
  y0_NX: Int32Array;
  y1_NX: Int32Array;
  ty: Float32Array;
}
let projCache: ProjCache | null = null;
function getProjCache(w: number, h: number): ProjCache {
  if (projCache && projCache.w === w && projCache.h === h) return projCache;
  const dLon = BOUNDS.lon1 - BOUNDS.lon0;
  const x0 = new Int32Array(w);
  const x1 = new Int32Array(w);
  const tx = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const lon = BOUNDS.lon0 + (x / (w - 1)) * dLon;
    const fx = clamp(((lon - BOUNDS.lon0) / dLon) * (NX - 1), 0, NX - 1);
    const x_0 = Math.floor(fx);
    x0[x] = x_0;
    x1[x] = Math.min(NX - 1, x_0 + 1);
    tx[x] = fx - x_0;
  }

  const y0_NX = new Int32Array(h);
  const y1_NX = new Int32Array(h);
  const ty = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const lat = invMercY(Y1 + (y / (h - 1)) * (Y0 - Y1));
    const fy = clamp(((lat - BOUNDS.lat0) / (BOUNDS.lat1 - BOUNDS.lat0)) * (NY - 1), 0, NY - 1);
    const y_0 = Math.floor(fy);
    y0_NX[y] = y_0 * NX;
    y1_NX[y] = Math.min(NY - 1, y_0 + 1) * NX;
    ty[y] = fy - y_0;
  }

  projCache = { w, h, x0, x1, tx, y0_NX, y1_NX, ty };
  return projCache;
}

/**
 * Rasterise a grid into an ImageData whose vertical axis is uniform in
 * web-mercator space, so features stay geographically aligned on the map.
 */
export function rasterize(layer: LayerId, grid: Grid, opts: RasterizeOpts): ImageData {
  const { width: w, height: h } = opts;
  const img = new ImageData(w, h);
  const data = img.data;
  const meta = LAYERS[layer];
  const [, vmax] = meta.scale;
  const lut = lutFor(layer);
  const lutMin = RAMPS[meta.rampKey][0][0] * (vmax / RAMPS[meta.rampKey][RAMPS[meta.rampKey].length - 1][0]);
  const normFactor = 1 / Math.max(1e-6, vmax - lutMin);
  const cutoff = opts.cutoff ?? 0.04;
  const aMul = opts.alpha ?? 0.82;

  const solid = opts.solid;
  const srgb = solid ? solid.color : null;
  const sMul = solid ? solid.alpha : 0;
  const solidColor = srgb ? parseInt(srgb.slice(1), 16) : 0;
  const cr = (solidColor >> 16) & 255;
  const cg = (solidColor >> 8) & 255;
  const cb = solidColor & 255;

  const proj = getProjCache(w, h);
  const { x0, x1, tx, y0_NX, y1_NX, ty } = proj;

  for (let y = 0; y < h; y++) {
    const r0 = y0_NX[y];
    const r1 = y1_NX[y];
    const tyVal = ty[y];
    const invTy = 1 - tyVal;
    let o = y * w * 4;

    for (let x = 0; x < w; x++) {
      const c0 = x0[x];
      const c1 = x1[x];
      const txVal = tx[x];

      const v = (grid[r0 + c0] * (1 - txVal) + grid[r0 + c1] * txVal) * invTy +
                (grid[r1 + c0] * (1 - txVal) + grid[r1 + c1] * txVal) * tyVal;
      const n = clamp((v - lutMin) * normFactor, 0, 1);

      let a: number;
      if (srgb) {
        a = aMul * sMul * (0.55 + 0.45 * n);
      } else {
        a = aMul * smoothAlpha(n, cutoff);
      }

      if (a <= 0.004) {
        data[o + 3] = 0;
        o += 4;
        continue;
      }

      if (srgb) {
        const sh = 0.5 + 0.5 * n;
        data[o] = cr * sh;
        data[o + 1] = cg * sh;
        data[o + 2] = cb * sh;
      } else {
        const li = Math.round(n * 255) * 4;
        data[o] = lut[li];
        data[o + 1] = lut[li + 1];
        data[o + 2] = lut[li + 2];
      }
      data[o + 3] = Math.round(clamp(a, 0, 1) * 255);
      o += 4;
    }
  }
  return img;
}

function smoothAlpha(n: number, cutoff: number) {
  if (n <= cutoff) return 0;
  const f = clamp((n - cutoff) / (1 - cutoff), 0, 1);
  return Math.pow(f, 0.62);
}

/** CSS gradient string for the layer legend. */
export function legendGradient(layer: LayerId) {
  const meta = LAYERS[layer];
  const stops = RAMPS[meta.rampKey];
  const maxV = meta.scale[1];
  const top = stops[stops.length - 1][0];
  const parts = stops.map((s) => {
    const p = clamp((s[0] * (maxV / top) - meta.scale[0]) / (maxV - meta.scale[0]), 0, 1) * 100;
    return `${hexToRgba(`#${[s[1], s[2], s[3]].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`, 1)} ${p.toFixed(1)}%`;
  });
  return `linear-gradient(90deg, ${parts.join(',')})`;
}
