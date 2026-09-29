import type { Category, ConfBand, Severity, Trend } from '../types';

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

/** Session anchor — every simulated timestamp is expressed relative to this. */
export const NOW = Date.now();

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));

/* ------------------------------------------------------------------ *
 * deterministic noise (reproducible demo data, no Math.random)        *
 * ------------------------------------------------------------------ */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** smooth 2D value noise from hashed lattice + bilinear interpolation */
export function noise2(x: number, y: number, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a: number, b: number) => {
    let n = a * 374761393 + b * 668265263 + seed * 1442695040888963407;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

/* ------------------------------------------------------------------ *
 * geodesy                                                             *
 * ------------------------------------------------------------------ */
const R = 6371;
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number) {
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const headingLabel = (deg: number) => COMPASS[Math.round(((deg % 360) / 22.5)) % 16];

/** Catmull-Rom spline through control points → smooth trajectory. */
export function spline(pts: number[][], samplesPerSeg = 8): number[][] {
  if (pts.length < 2) return pts;
  const get = (i: number) => pts[clamp(i, 0, pts.length - 1)];
  const out: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const last = i === pts.length - 2;
    for (let s = 0; s < samplesPerSeg + (last ? 1 : 0); s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * formatting                                                          *
 * ------------------------------------------------------------------ */
export function fmtTime(ts: number, withSeconds = false) {
  const d = new Date(ts);
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  const base = `${hh}:${String(d.getMinutes()).padStart(2, '0')}${withSeconds ? ':' + String(d.getSeconds()).padStart(2, '0') : ''} ${ampm}`;
  return base;
}
export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export function fmtOffset(h: number) {
  const sign = h > 0 ? '+' : h < 0 ? '−' : '';
  const a = Math.abs(h);
  if (a >= 24) {
    const d = Math.floor(a / 24);
    const r = Math.round(a % 24);
    return `${sign}${d}d${r ? ' ' + r + 'h' : ''}`;
  }
  return `${sign}${Math.round(a)}h`;
}

export const fmtNum = (n: number, d = 0) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtArea = (km2: number) =>
  km2 >= 1000 ? `${fmtNum(km2 / 1000, 1)}k km²` : `${fmtNum(km2)} km²`;

/* ------------------------------------------------------------------ *
 * severity / category metadata (single source of truth for colours)   *
 * ------------------------------------------------------------------ */
export const SEV_META: Record<Severity, { label: string; color: string; bg: string; border: string; dot: string; rank: number }> = {
  NORMAL: { label: 'NORMAL', color: '#38bdf8', bg: 'rgba(56,189,248,0.13)', border: 'rgba(56,189,248,0.38)', dot: '●', rank: 0 },
  MODERATE: { label: 'MODERATE', color: '#eab308', bg: 'rgba(234,179,8,0.13)', border: 'rgba(234,179,8,0.38)', dot: '●', rank: 1 },
  HIGH: { label: 'HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.13)', border: 'rgba(249,115,22,0.4)', dot: '●', rank: 2 },
  EXTREME: { label: 'EXTREME', color: '#ef4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.45)', dot: '●', rank: 3 },
};

export const CAT_META: Record<Category, { label: string; short: string; icon: string; color: string; unit: string }> = {
  rainfall: { label: 'Extreme Rainfall', short: 'Rainfall', icon: 'Rain', color: '#38bdf8', unit: 'mm/day' },
  cyclone: { label: 'Cyclone / Tropical Storm', short: 'Cyclone', icon: 'Cyclone', color: '#a78bfa', unit: 'kt' },
  wind: { label: 'Severe Wind', short: 'Wind', icon: 'Wind', color: '#818cf8', unit: 'km/h' },
  heat: { label: 'Heat Anomaly', short: 'Heat', icon: 'Heat', color: '#fb7185', unit: '°C' },
  cold: { label: 'Cold Anomaly', short: 'Cold', icon: 'Cold', color: '#60a5fa', unit: '°C' },
  pressure: { label: 'Low-Pressure System', short: 'Pressure', icon: 'Pressure', color: '#c084fc', unit: 'hPa' },
  drought: { label: 'Drought Anomaly', short: 'Drought', icon: 'Drought', color: '#d9a15b', unit: 'mm deficit' },
  flood: { label: 'Flood-Related Weather', short: 'Flood', icon: 'Flood', color: '#0ea5e9', unit: 'mm/day' },
  thunderstorm: { label: 'Thunderstorm / Severe Convection', short: 'Convection', icon: 'Convection', color: '#facc15', unit: 'CAPE' },
  compound: { label: 'Compound Extreme Event', short: 'Compound', icon: 'Compound', color: '#f43f5e', unit: 'index' },
};

export const TREND_META: Record<Trend, { label: string; color: string; icon: string }> = {
  INTENSIFYING: { label: 'INTENSIFYING', color: '#ef4444', icon: '▲' },
  STEADY: { label: 'STEADY', color: '#eab308', icon: '■' },
  WEAKENING: { label: 'WEAKENING', color: '#38bdf8', icon: '▼' },
  DISSIPATING: { label: 'DISSIPATING', color: '#64748b', icon: '◦' },
};

export const bandFor = (conf: number): ConfBand => (conf >= 85 ? 'HIGH' : conf >= 65 ? 'MEDIUM' : 'LOW');

/** Composite severity score → class. Consistent across map, cards, charts, alerts, filters. */
export function severityOf(score: number): Severity {
  if (score >= 82) return 'EXTREME';
  if (score >= 68) return 'HIGH';
  if (score >= 55) return 'MODERATE';
  return 'NORMAL';
}

/** Diverging + sequential scientific colour ramps, returned as [r,g,b] stops (no green). */
export type Stop = [number, number, number, number];

export const RAMPS: Record<string, Stop[]> = {
  temp: [
    [-6, 49, 54, 149], [-3, 69, 117, 180], [-1, 116, 173, 209], [0, 171, 217, 233],
    [1, 224, 243, 248], [2.2, 255, 237, 180], [4, 254, 210, 130], [6, 253, 174, 97],
    [8, 244, 109, 67], [10, 215, 48, 39], [13, 165, 0, 38],
  ],
  rain: [
    [0, 120, 160, 190], [3, 70, 140, 200], [10, 30, 110, 210], [22, 30, 64, 175],
    [36, 79, 30, 160], [55, 140, 30, 140], [75, 190, 40, 130], [100, 230, 60, 120],
  ],
  wind: [
    [0, 30, 58, 138], [15, 14, 165, 233], [30, 56, 189, 248], [45, 129, 140, 248],
    [60, 245, 158, 11], [80, 239, 68, 68],
  ],
  pressure: [
    [-18, 30, 60, 150], [-10, 60, 130, 200], [-3, 150, 200, 230], [0, 220, 235, 240],
    [3, 250, 220, 180], [10, 240, 150, 90], [18, 200, 60, 60],
  ],
  humidity: [
    [-30, 160, 110, 40], [-15, 220, 180, 100], [0, 200, 210, 230], [12, 100, 180, 240],
    [25, 30, 130, 220], [40, 30, 70, 180],
  ],
  anomaly: [
    [0.05, 30, 58, 138], [0.25, 14, 165, 233], [0.48, 245, 158, 11], [0.72, 239, 68, 68],
    [0.92, 190, 24, 93],
  ],
  risk: [
    [0.05, 30, 41, 59], [0.22, 2, 132, 199], [0.45, 234, 88, 12], [0.75, 220, 38, 38],
    [1.0, 147, 51, 234],
  ],
};

/** Build a lookup table (256 RGBA entries) from a ramp. */
export function makeLut(ramp: Stop[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  const stops = [...ramp].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < 256; i++) {
    const v = (i / 255) * stops[stops.length - 1][0];
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (v >= stops[s][0] && v <= stops[s + 1][0]) {
        a = stops[s];
        b = stops[s + 1];
        break;
      }
    }
    const f = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
    lut[i * 4] = lerp(a[1], b[1], f);
    lut[i * 4 + 1] = lerp(a[2], b[2], f);
    lut[i * 4 + 2] = lerp(a[3], b[3], f);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

export function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
