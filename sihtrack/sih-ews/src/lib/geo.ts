import { bearingDeg, clamp } from './utils';

export interface CorridorPoint {
  lat: number;
  lon: number;
  r: number;
}

/**
 * Build the uncertainty corridor polygon around a projected track.
 * The half-width `r` (km) grows with lead time, so a widening wedge
 * visually communicates growing forecast uncertainty.
 */
export function corridorRing(pts: CorridorPoint[]): [number, number][] {
  if (pts.length < 2) return [];
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const br = (bearingDeg(a.lat, a.lon, b.lat, b.lon) * Math.PI) / 180;
    const nx = Math.cos(br);
    const ny = -Math.sin(br);
    const mLat = p.r / 110.574;
    const mLon = p.r / (111.32 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
    left.push([+(p.lon + nx * mLon).toFixed(3), +(p.lat + ny * mLat).toFixed(3)]);
    right.push([+(p.lon - nx * mLon).toFixed(3), +(p.lat - ny * mLat).toFixed(3)]);
  }
  return [...left, ...right.reverse(), left[0]];
}

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export function boundsOf(pts: { lat: number; lon: number }[], padDeg = 1.4): [number, number, number, number] {
  if (!pts.length) return [66, 6, 98, 38];
  let minLon = 999, minLat = 999, maxLon = -999, maxLat = -999;
  for (const p of pts) {
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  const padLon = Math.max(padDeg, (maxLon - minLon) * 0.25);
  const padLat = Math.max(padDeg, (maxLat - minLat) * 0.25);
  return [minLon - padLon, minLat - padLat, maxLon + padLon, maxLat + padLat];
}

/** Approximate area (km²) of a polygon ring — used for the spatial-extent readout. */
export function ringAreaKm2(ring: [number, number][]) {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    total += (x2 - x1) * (2 + Math.sin((y1 * Math.PI) / 180) + Math.sin((y2 * Math.PI) / 180));
  }
  return Math.abs((total * 6378137 * 6378137 * Math.PI) / 180 / 2) / 1e6;
}

export const INDIA_VIEW = { center: [80.6, 22.6] as [number, number], zoom: 4.1 };

export const INDIA_BOUNDS: [number, number, number, number] = [66.5, 6.5, 97.5, 37.5];

/** Nearest-neighbour snap of a coordinate to a region name (best effort, demo). */
export function snapToRegion(lat: number, lon: number, centroids: Record<string, [number, number]>) {
  let best = '';
  let bestD = Infinity;
  for (const [name, [rLat, rLon]] of Object.entries(centroids)) {
    const d = (rLat - lat) ** 2 + (rLon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

export const clampZoom = (z: number) => clamp(z, 3.2, 12);
