/**
 * Track sampling + smooth marker movement. Imperative on purpose: no React
 * re-render per frame, so scrubbing the timeline stays cheap.
 */
import type { LatLng, TimedPoint } from './adapter';

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function cr(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

/** Position on the track at time t (hours rel. NOW). Catmull-Rom between timed points. */
export function positionAt(track: TimedPoint[], t: number): LatLng {
  const n = track.length;
  if (n === 0) return { lat: 0, lng: 0 };
  if (t <= track[0].t) return { lat: track[0].lat, lng: track[0].lng };
  if (t >= track[n - 1].t) return { lat: track[n - 1].lat, lng: track[n - 1].lng };
  let i = 0;
  while (i < n - 2 && t > track[i + 1].t) i++;
  const a = track[i];
  const b = track[i + 1];
  const u = (t - a.t) / (b.t - a.t || 1);
  const p0 = track[Math.max(0, i - 1)];
  const p3 = track[Math.min(n - 1, i + 2)];
  return { lat: cr(p0.lat, a.lat, b.lat, p3.lat, u), lng: cr(p0.lng, a.lng, b.lng, p3.lng, u) };
}

/** Densified path for polylines: sampled every `stepH` hours from t0..t1. */
export function samplePath(track: TimedPoint[], t0: number, t1: number, stepH = 1): LatLng[] {
  const out: LatLng[] = [];
  if (!track.length) return out;
  for (let t = t0; t < t1; t += stepH) out.push(positionAt(track, t));
  out.push(positionAt(track, t1));
  return out;
}

/** Fading trail: `count` points behind `now`, oldest first, with opacity 0..1. */
export function trailPoints(track: TimedPoint[], now: number, count = 10, stepH = 1.5) {
  const pts: (LatLng & { opacity: number })[] = [];
  for (let i = count; i >= 1; i--) {
    pts.push({ ...positionAt(track, now - i * stepH), opacity: (1 - i / (count + 1)) * 0.55 });
  }
  return pts;
}

/** Eases a position toward a target with requestAnimationFrame. ~350ms for jumps, ~120ms during playback. */
export class MarkerMover {
  private cur: LatLng;
  private from: LatLng;
  private to: LatLng;
  private t0 = 0;
  private dur = 350;
  private raf = 0;

  constructor(start: LatLng, private onFrame: (p: LatLng) => void) {
    this.cur = this.from = this.to = start;
  }

  moveTo(p: LatLng, dur = 350) {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) dur = 0;
    this.from = this.cur;
    this.to = p;
    this.dur = dur;
    this.t0 = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const k = this.dur === 0 ? 1 : Math.min(1, (now - this.t0) / this.dur);
    const e = ease(k);
    this.cur = { lat: lerp(this.from.lat, this.to.lat, e), lng: lerp(this.from.lng, this.to.lng, e) };
    this.onFrame(this.cur);
    this.raf = k < 1 ? requestAnimationFrame(this.tick) : 0;
  };

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
