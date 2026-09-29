/**
 * DEMO EVENT ENGINE
 * -------------------------------------------------------------------
 * Every event is a deterministic function of a single timeline value `t`
 * (hours relative to NOW). Position, intensity, anomaly score, spatial
 * extent, translation speed, confidence, ETA and derived statistics are
 * all produced by this module, so the map, charts, panels, alerts and
 * analytics can never disagree with each other.
 *
 * !!! ALL OUTPUT IS SIMULATED DEMO DATA — NOT AN OFFICIAL FORECAST !!!
 */
import type {
  AlertItem, Category, CompoundGroup, RegionRisk, Severity, TrackKey, Trend, WeatherEvent,
} from '../types';
import {
  bearingDeg, clamp, haversineKm, headingLabel, lerp, NOW, noise2, smoothstep, spline,
  bandFor, severityOf, fmtTime, fmtDate,
} from '../lib/utils';

/* ------------------------------------------------------------------ */
/* time domain                                                         */
/* ------------------------------------------------------------------ */
export const T_MIN = -48;
export const T_MAX = 168;
export const T_STEP = 2; // keyframe cadence (hours)

export interface EventSeed {
  id: string;
  name: string;
  category: Category;
  subtype: string;
  headline: string;
  evolution: string;
  drivers: string[];
  compound?: boolean;
  /** [region, lat, lon] waypoints in chronological order */
  path: [string, number, number][];
  tStart: number;
  tEnd: number;
  tPeak: number;
  i0: number;
  iPeak: number;
  iEnd: number;
  a0: number;
  aPeak: number;
  aEnd: number;
  e0: number;
  ePeak: number;
  eEnd: number;
  speed: number;
  conf0: number;
  wobble: number;
}

const S = (s: EventSeed) => s;

export const SEEDS: EventSeed[] = [
  S({
    id: 'EX-1042', name: 'Eastern India Rainfall Cluster', category: 'rainfall',
    subtype: 'Persistent extreme rainfall band',
    headline: 'Extreme rainfall anomaly over eastern India with a coherent north-westward propagation.',
    evolution: 'Increasing rainfall intensity through the next 18–24 h followed by gradual weakening as the system advances inland and moisture flux drops.',
    drivers: ['Deep monsoon trough', 'Anomalous moisture flux convergence', 'Low-level cyclonic circulation', 'Above-normal SST anomaly in Bay of Bengal'],
    path: [['Odisha', 19.9, 85.4], ['West Bengal', 22.4, 87.0], ['Jharkhand', 23.7, 85.6], ['Bihar', 25.7, 85.0]],
    tStart: -42, tEnd: 130, tPeak: 16, i0: 52, iPeak: 90, iEnd: 36,
    a0: 58, aPeak: 92, aEnd: 41, e0: 18000, ePeak: 52500, eEnd: 21000,
    speed: 18, conf0: 94, wobble: 0.55,
  }),
  S({
    id: 'EX-1043', name: 'Bay of Bengal Cyclonic Storm', category: 'cyclone',
    subtype: 'Cyclonic storm — coastal landfall track',
    headline: 'Cyclonic circulation over the north Bay of Bengal tracking north-west toward the Odisha–West Bengal coast.',
    evolution: 'Intensity peaks near landfall, then rapid weakening as the system loses ocean moisture source and surface friction increases.',
    drivers: ['Warm core vortex', 'Low vertical wind shear', 'High ocean heat content', 'Upper-level divergence'],
    path: [['Bay of Bengal', 16.4, 87.9], ['Odisha Coast', 19.6, 86.1], ['Odisha', 20.9, 85.4], ['West Bengal', 22.6, 86.9]],
    tStart: -30, tEnd: 120, tPeak: 26, i0: 61, iPeak: 92, iEnd: 30,
    a0: 66, aPeak: 93, aEnd: 34, e0: 26000, ePeak: 68000, eEnd: 15000,
    speed: 22, conf0: 91, wobble: 0.7,
  }),
  S({
    id: 'EX-1044', name: 'Rajasthan Heat Anomaly', category: 'heat',
    subtype: 'Above-normal surface temperature anomaly',
    headline: 'Strong positive temperature anomaly over the Thar region, propagating east toward the national capital region.',
    evolution: 'Heat anomaly slowly relaxes as the core drifts east into a moister air mass with increased cloud cover.',
    drivers: ['Subsidence inversion', 'Clear-sky radiative forcing', 'Advected continental air mass', 'Reduced soil moisture'],
    path: [['Rajasthan', 26.6, 70.9], ['Rajasthan', 27.7, 73.2], ['Haryana', 28.9, 75.6], ['Delhi', 28.6, 77.1]],
    tStart: -34, tEnd: 110, tPeak: 30, i0: 55, iPeak: 84, iEnd: 30,
    a0: 63, aPeak: 89, aEnd: 33, e0: 52000, ePeak: 118000, eEnd: 42000,
    speed: 11, conf0: 88, wobble: 0.35,
  }),
  S({
    id: 'EX-1045', name: 'Kutch Severe Wind Event', category: 'wind',
    subtype: 'Severe wind — gust corridor',
    headline: 'Severe wind conditions developing over coastal Kutch and the Gulf of Kachchh, moving inland to the north-east.',
    evolution: 'Gust intensity steady for 12 h, then a gradual weakening as the pressure gradient slackens over land.',
    drivers: ['Tight pressure gradient', 'Coastal convergence zone', 'Monsoon low-level jet', 'Katabatic acceleration'],
    path: [['Gujarat', 23.1, 69.8], ['Gujarat', 24.3, 71.4], ['Rajasthan', 25.4, 73.1], ['Madhya Pradesh', 24.6, 75.4]],
    tStart: -28, tEnd: 96, tPeak: 22, i0: 60, iPeak: 82, iEnd: 34,
    a0: 64, aPeak: 84, aEnd: 36, e0: 28000, ePeak: 61000, eEnd: 22000,
    speed: 26, conf0: 86, wobble: 0.6,
  }),
  S({
    id: 'EX-1046', name: 'Western Ghats Rainfall Event', category: 'rainfall',
    subtype: 'Orographic extreme rainfall',
    headline: 'Orographically enhanced rainfall anomaly along the Western Ghats, propagating north along the crest.',
    evolution: 'Intensity remains high for 24 h as the offshore trough is anchored, then weakens with a northward shift of the axis.',
    drivers: ['Offshore trough', 'Strong orographic lift', 'Cross-equatorial flow', 'Deep moisture depth'],
    path: [['Kerala', 9.6, 76.6], ['Karnataka', 12.4, 75.4], ['Karnataka', 14.6, 74.7], ['Goa', 15.6, 73.8]],
    tStart: -38, tEnd: 118, tPeak: 10, i0: 57, iPeak: 88, iEnd: 34,
    a0: 61, aPeak: 90, aEnd: 38, e0: 14000, ePeak: 39000, eEnd: 15000,
    speed: 14, conf0: 89, wobble: 0.5,
  }),
  S({
    id: 'EX-1047', name: 'Central India Low-Pressure System', category: 'pressure',
    subtype: 'Well-marked low pressure area',
    headline: 'Well-marked low pressure area over central India with a north-eastward steering flow.',
    evolution: 'Minimum central pressure deepens slightly before the system merges with the monsoon trough and fills.',
    drivers: ['Monsoon trough interaction', 'Vorticity maximum at 850 hPa', 'Moisture convergence'],
    path: [['Madhya Pradesh', 23.2, 77.5], ['Uttar Pradesh', 25.4, 79.6], ['Uttar Pradesh', 26.8, 81.4], ['Bihar', 25.9, 84.2]],
    tStart: -24, tEnd: 104, tPeak: 20, i0: 46, iPeak: 68, iEnd: 26,
    a0: 51, aPeak: 71, aEnd: 28, e0: 64000, ePeak: 132000, eEnd: 48000,
    speed: 16, conf0: 83, wobble: 0.45,
  }),
  S({
    id: 'EX-1048', name: 'Uttarakhand Cold Anomaly', category: 'cold',
    subtype: 'Negative temperature anomaly — high elevation',
    headline: 'Marked negative temperature anomaly over the Uttarakhand–Himachal highlands associated with a western disturbance.',
    evolution: 'Cold anomaly deepens for 12 h with fresh snow above 3,500 m, then relaxes as the disturbance moves away east.',
    drivers: ['Western disturbance', 'Cold air advection at 700 hPa', 'Orographic snowfall', 'Subsidence behind the trough'],
    path: [['Uttarakhand', 30.2, 78.6], ['Uttarakhand', 30.9, 79.2], ['Himachal Pradesh', 31.4, 77.9], ['Himachal Pradesh', 31.9, 77.0]],
    tStart: -26, tEnd: 92, tPeak: 14, i0: 44, iPeak: 66, iEnd: 24,
    a0: 49, aPeak: 68, aEnd: 27, e0: 22000, ePeak: 44000, eEnd: 17000,
    speed: 12, conf0: 87, wobble: 0.4,
  }),
  S({
    id: 'EX-1049', name: 'Deccan Convective Cluster', category: 'thunderstorm',
    subtype: 'Severe convective storms — squall line',
    headline: 'Severe convective cluster with squall-line structure over the Deccan plateau, moving north-west.',
    evolution: 'Convective intensity oscillates with diurnal heating, and decays after local sunset over the interior.',
    drivers: ['High CAPE', 'Low-level moisture incursion', 'Upper-air trough', 'Diurnal heating cycle'],
    path: [['Telangana', 17.6, 78.9], ['Maharashtra', 18.9, 77.4], ['Maharashtra', 20.1, 76.4], ['Chhattisgarh', 21.1, 81.3]],
    tStart: -20, tEnd: 84, tPeak: 8, i0: 50, iPeak: 81, iEnd: 28,
    a0: 54, aPeak: 82, aEnd: 30, e0: 19000, ePeak: 47000, eEnd: 16000,
    speed: 29, conf0: 82, wobble: 0.8,
  }),
  S({
    id: 'EX-1050', name: 'Marathwada Drought Anomaly', category: 'drought',
    subtype: 'Multi-week rainfall deficit anomaly',
    headline: 'Persistent rainfall-deficit anomaly over Marathwada with a slow southward expansion of the dry footprint.',
    evolution: 'Deficit deepens steadily with no significant relief signal inside the 120 h horizon; slow, low-amplitude movement.',
    drivers: ['Suppressed convection', 'Rain-shadow effect', 'Weak monsoon trough position', 'Soil-moisture memory'],
    path: [['Marathwada', 19.2, 75.9], ['Maharashtra', 18.4, 75.4], ['Karnataka', 17.2, 75.9], ['Karnataka', 16.1, 76.3]],
    tStart: -44, tEnd: 140, tPeak: 40, i0: 47, iPeak: 58, iEnd: 44,
    a0: 64, aPeak: 76, aEnd: 58, e0: 48000, ePeak: 96000, eEnd: 88000,
    speed: 6, conf0: 79, wobble: 0.25,
  }),
  S({
    id: 'EX-1051', name: 'Brahmaputra Valley Flood Event', category: 'flood',
    subtype: 'Flood-generating rainfall anomaly',
    headline: 'Flood-generating rainfall anomaly over the Brahmaputra valley with upstream catchment accumulation.',
    evolution: 'Rainfall stays intense for 30 h and only slowly eases, keeping catchment run-off elevated well beyond the forecast horizon.',
    drivers: ['Bay moisture channel', 'Himalayan orographic blocking', 'Saturated catchment soils', 'Upstream contribution'],
    path: [['Assam', 25.6, 90.4], ['Assam', 26.3, 92.1], ['Assam', 27.0, 93.4], ['Arunachal Pradesh', 27.8, 94.6]],
    tStart: -36, tEnd: 126, tPeak: 24, i0: 66, iPeak: 94, iEnd: 44,
    a0: 70, aPeak: 95, aEnd: 47, e0: 32000, ePeak: 74000, eEnd: 30000,
    speed: 13, conf0: 92, wobble: 0.5,
  }),
  S({
    id: 'EX-1052', name: 'Gangetic West Bengal Compound Extreme', category: 'compound',
    subtype: 'Rainfall + severe wind + low pressure overlap',
    headline: 'Compound extreme: extreme rainfall, severe wind and a deep low-pressure anomaly co-located over Gangetic West Bengal.',
    evolution: 'All three drivers remain phase-locked over the next 24 h — the compound risk score stays critical before the wind field decouples.',
    drivers: ['Co-located low-pressure anomaly', 'Extreme rainfall anomaly', 'Severe wind anomaly', 'Tidal coincidence on the Hooghly'],
    compound: true,
    path: [['West Bengal', 21.9, 87.6], ['West Bengal', 22.9, 88.1], ['Jharkhand', 23.8, 86.6], ['Bihar', 25.1, 86.1]],
    tStart: -22, tEnd: 108, tPeak: 18, i0: 72, iPeak: 96, iEnd: 40,
    a0: 76, aPeak: 97, aEnd: 43, e0: 34000, ePeak: 79000, eEnd: 26000,
    speed: 21, conf0: 90, wobble: 0.55,
  }),
  S({
    id: 'EX-1053', name: 'Tamil Nadu Coastal Rainfall', category: 'rainfall',
    subtype: 'Coastal convergence rainfall',
    headline: 'Coastal convergence rainfall anomaly along the Tamil Nadu coast spreading north along the Andhra coast.',
    evolution: 'Moderate, steady rainfall anomaly with a gradual northward shift and slowly decreasing intensity.',
    drivers: ['Coastal convergence', 'Easterly wave', 'Warm coastal SSTs'],
    path: [['Tamil Nadu', 12.4, 80.1], ['Tamil Nadu', 13.5, 80.3], ['Andhra Pradesh', 15.1, 80.2], ['Andhra Pradesh', 16.4, 81.0]],
    tStart: -22, tEnd: 96, tPeak: 12, i0: 48, iPeak: 68, iEnd: 30,
    a0: 52, aPeak: 71, aEnd: 33, e0: 16000, ePeak: 38000, eEnd: 15000,
    speed: 17, conf0: 81, wobble: 0.5,
  }),
  S({
    id: 'EX-1054', name: 'Konkan Wind Corridor', category: 'wind',
    subtype: 'Coastal wind corridor',
    headline: 'Strengthening coastal wind corridor along the Konkan coast with a north-westward drift.',
    evolution: 'Wind anomaly peaks within 10 h then decays as the coastal pressure gradient relaxes.',
    drivers: ['Coastal pressure gradient', 'Low-level jet core', 'Gap-wind acceleration'],
    path: [['Konkan', 17.3, 73.6], ['Maharashtra', 18.6, 73.1], ['Gujarat', 20.4, 72.9], ['Gujarat', 21.7, 72.6]],
    tStart: -18, tEnd: 88, tPeak: 10, i0: 54, iPeak: 74, iEnd: 30,
    a0: 58, aPeak: 76, aEnd: 33, e0: 17000, ePeak: 36000, eEnd: 16000,
    speed: 24, conf0: 80, wobble: 0.55,
  }),
  S({
    id: 'EX-1055', name: 'Punjab Heat Anomaly', category: 'heat',
    subtype: 'Above-normal temperature anomaly',
    headline: 'Above-normal temperature anomaly over Punjab drifting south-east toward Haryana.',
    evolution: 'Slowly intensifying under clear skies, then easing after 48 h as moisture returns to the region.',
    drivers: ['Clear-sky subsidence', 'Advected continental air', 'Low soil moisture'],
    path: [['Punjab', 31.2, 74.9], ['Punjab', 30.4, 76.0], ['Haryana', 29.5, 76.6]],
    tStart: -20, tEnd: 84, tPeak: 34, i0: 46, iPeak: 66, iEnd: 32,
    a0: 62, aPeak: 82, aEnd: 40, e0: 38000, ePeak: 82000, eEnd: 44000,
    speed: 9, conf0: 85, wobble: 0.3,
  }),
];

export const CATEGORY_LABEL: Record<Category, string> = {
  rainfall: 'Extreme Rainfall', cyclone: 'Cyclone / Tropical Storm', wind: 'Severe Wind',
  heat: 'Heat Anomaly', cold: 'Cold Anomaly', pressure: 'Low-Pressure System',
  drought: 'Drought Anomaly', flood: 'Flood-Related Weather', thunderstorm: 'Thunderstorm / Severe Convection',
  compound: 'Compound Extreme Event',
};

/* ------------------------------------------------------------------ */
/* track construction                                                  */
/* ------------------------------------------------------------------ */
function curve(t: number, tA: number, vA: number, tB: number, vB: number, tC: number, vC: number) {
  if (t <= tB) {
    const f = smoothstep(clamp((t - tA) / (tB - tA), 0, 1));
    return lerp(vA, vB, f);
  }
  const f = smoothstep(clamp((t - tB) / (tC - tB), 0, 1));
  return lerp(vB, vC, f);
}

const pathLen = (path: [string, number, number][]) => {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineKm(path[i - 1][1], path[i - 1][2], path[i][1], path[i][2]);
  return d;
};

function positionAt(seed: EventSeed, pts: number[][], t: number) {
  const tl = seed.tEnd - seed.tStart;
  const u = clamp((t - seed.tStart) / tl, 0, 1);
  const x = u * (pts.length - 1);
  const i = clamp(Math.floor(x), 0, pts.length - 2);
  const f = x - i;
  const a = pts[i];
  const b = pts[i + 1];
  const sm = smoothstep(f);
  return [lerp(a[0], b[0], sm), lerp(a[1], b[1], sm)] as [number, number];
}

function regionAt(seed: EventSeed, t: number) {
  const tl = seed.tEnd - seed.tStart;
  const u = clamp((t - seed.tStart) / tl, 0, 1);
  const x = u * (seed.path.length - 1);
  const i = clamp(Math.round(x), 0, seed.path.length - 1);
  return seed.path[i][0];
}

function buildSeries(seed: EventSeed): TrackKey[] {
  const ctrl = seed.path.map((p) => [p[1], p[2]]);
  const pts = spline(ctrl, 10);
  const out: TrackKey[] = [];
  const baseSpeed = (pathLen(seed.path) / Math.max(1, seed.tEnd - seed.tStart)) || seed.speed;
  for (let t = T_MIN; t <= T_MAX + 0.001; t += T_STEP) {
    const [lat, lon] = positionAt(seed, pts, t);
    const j = seed.wobble;
    const w1 = noise2(t * 0.21, 3.1, seed.id.charCodeAt(3)) * j;
    const w2 = noise2(t * 0.17, 8.4, seed.id.charCodeAt(5)) * j * 0.08;
    const intensity = clamp(curve(t, seed.tStart, seed.i0, seed.tPeak, seed.iPeak, seed.tEnd, seed.iEnd) + w1 * 2.2, 6, 100);
    const anomaly = clamp(curve(t, seed.tStart, seed.a0, seed.tPeak, seed.aPeak, seed.tEnd, seed.aEnd) + w1 * 1.6, 5, 100);
    const extent = clamp(curve(t, seed.tStart, seed.e0, seed.tPeak, seed.ePeak, seed.tEnd, seed.eEnd) * (1 + w1 * 0.03), 2000, 200000);
    const speed = clamp(baseSpeed * (1 + w2) * 1.0, 3, 58);
    // confidence: high for the analysis (past) window, decaying with lead time
    const lead = Math.max(0, t);
    const conf = clamp(
      seed.conf0 + (t < 0 ? Math.min(6, -t * 0.16) : 0) - (t > 0 ? Math.pow(lead / 120, 1.15) * 46 : 0),
      18, 99
    );
    out.push({
      t, lat: +lat.toFixed(3), lon: +lon.toFixed(3),
      intensity: +intensity.toFixed(1), anomaly: +anomaly.toFixed(1),
      extent: Math.round(extent), speed: +speed.toFixed(1), conf: +conf.toFixed(0),
    });
  }
  return out;
}

const SERIES_CACHE = new Map<string, TrackKey[]>();
export function series(seed: EventSeed): TrackKey[] {
  let s = SERIES_CACHE.get(seed.id);
  if (!s) {
    s = buildSeries(seed);
    SERIES_CACHE.set(seed.id, s);
  }
  return s;
}

export const scoreOf = (k: { intensity: number; anomaly: number }) => 0.6 * k.intensity + 0.4 * k.anomaly;

function sampleAt(s: TrackKey[], t: number): TrackKey {
  if (t <= s[0].t) return s[0];
  if (t >= s[s.length - 1].t) return s[s.length - 1];
  const x = (t - s[0].t) / T_STEP;
  const i = clamp(Math.floor(x), 0, s.length - 2);
  const f = smoothstep(x - i);
  const a = s[i];
  const b = s[i + 1];
  return {
    t, lat: lerp(a.lat, b.lat, f), lon: lerp(a.lon, b.lon, f),
    intensity: lerp(a.intensity, b.intensity, f), anomaly: lerp(a.anomaly, b.anomaly, f),
    extent: lerp(a.extent, b.extent, f), speed: lerp(a.speed, b.speed, f), conf: lerp(a.conf, b.conf, f),
  };
}

const statusOf = (k: TrackKey, next: TrackKey): Trend => {
  const d = next.intensity - k.intensity;
  if (k.intensity < 30 && d < 0) return 'DISSIPATING';
  if (d > 1.4) return 'INTENSIFYING';
  if (d < -1.4) return 'WEAKENING';
  return 'STEADY';
};

const UNCERTAINTY_BASE = 95; // km, grows with lead time

function aiSummary(e: Omit<WeatherEvent, 'aiSummary'>, seed: EventSeed) {
  const dir = e.headingLabel;
  const pct = e.anomalyScore.toFixed(0);
  const horizon = Math.round(e.skilledUntilH);
  return [
    `${CATEGORY_LABEL[seed.category]} anomaly detected over ${e.anchor}.`,
    `The system identifies a ${e.severity === 'EXTREME' ? 'high-intensity' : 'significant'} event moving ${dir} at ${e.speedKmph.toFixed(0)} km/h with a footprint of ${(e.extentKm2 / 1000).toFixed(1)}k km².`,
    `Composite anomaly score is ${pct}/100 against the reanalysis climatology (of which the event sits near the ${Math.min(99.6, 62 + e.anomalyScore * 0.38).toFixed(1)}th percentile).`,
    `Forecast confidence decreases after ${horizon} h and falls to ${e.confidence > 0 ? Math.round(sampleAt(series(seed), T_MAX).conf) : 0}% at the far end of the 120 h horizon, so downstream corridor positions are indicative only.`,
  ].join(' ');
}

export function resolveEvent(seed: EventSeed, t: number): WeatherEvent {
  const s = series(seed);
  const cur = sampleAt(s, t);
  const ahead = sampleAt(s, Math.min(T_MAX, t + 3));
  const behind = sampleAt(s, Math.max(T_MIN, t - 3));

  const score = scoreOf(cur);
  const severity: Severity = severityOf(score);
  const trend = statusOf(cur, ahead);

  const headingDeg = bearingDeg(behind.lat, behind.lon, ahead.lat, ahead.lon);
  const anchor = regionAt(seed, t);

  const history = s.filter((k) => k.t <= t);
  const predicted = s.filter((k) => k.t > t);

  // detection time = most recent upward crossing of the MODERATE (55) threshold
  let detectedAt: number | null = null;
  for (let i = 1; i < s.length; i++) {
    if (scoreOf(s[i]) >= 55 && scoreOf(s[i - 1]) < 55) detectedAt = s[i].t;
  }
  const ageH = detectedAt === null ? Math.max(0, t - s[0].t) : t - detectedAt;

  // ETA per downstream corridor region
  const tl = seed.tEnd - seed.tStart;
  const etas: WeatherEvent['etas'] = [];
  seed.path.forEach(([region], i) => {
    const wpT = seed.tStart + (i / Math.max(1, seed.path.length - 1)) * tl;
    if (wpT > t + 0.5 && !etas.some((x) => x.region === region)) {
      const k = sampleAt(s, wpT);
      etas.push({
        region,
        etaH: wpT - t,
        intensity: Math.round(k.intensity),
        confidence: Math.round(k.conf),
      });
    }
  });

  const skilled = s.find((k) => k.t > 0 && k.conf < 60);

  const lat = cur.lat;
  const lon = cur.lon;
  const base: Omit<WeatherEvent, 'aiSummary'> = {
    id: seed.id, name: seed.name, category: seed.category, categoryLabel: CATEGORY_LABEL[seed.category],
    subtype: seed.subtype, anchor, corridor: seed.path.map((p) => p[0]),
    lat, lon,
    intensity: cur.intensity, anomalyScore: cur.anomaly, confidence: cur.conf, confBand: bandFor(cur.conf),
    severity, trend, extentKm2: cur.extent, speedKmph: cur.speed,
    headingDeg: Math.round(headingDeg), headingLabel: headingLabel(headingDeg),
    durationH: Math.max(0, ageH),
    detectedAt: detectedAt === null ? T_MIN : detectedAt,
    firstSeenLabel: `${fmtDate(NOW + (detectedAt === null ? T_MIN : detectedAt) * 3600e3)}, ${fmtTime(NOW + (detectedAt === null ? T_MIN : detectedAt) * 3600e3)}`,
    lastSeenLabel: `${fmtTime(NOW + t * 3600e3)}`,
    status: trend,
    forecastStatus:
      t < seed.tPeak
        ? `Expected to ${trend === 'INTENSIFYING' ? 'intensify' : 'hold'} for the next ${Math.max(3, Math.round(seed.tPeak - t))} h`
        : `Expected to weaken over the next ${Math.max(6, Math.round((seed.tEnd - t) * 0.35))} h`,
    uncertaintyKm: Math.round(UNCERTAINTY_BASE + Math.max(0, t) * (seed.category === 'cyclone' ? 21 : 15) + Math.max(0, cur.extent / 900)),
    skilledUntilH: skilled ? skilled.t : T_MAX,
    etas,
    history, predicted, series: s, current: cur,
    headline: seed.headline, evolution: seed.evolution, drivers: seed.drivers,
    compound: !!seed.compound,
  };
  return { ...base, aiSummary: aiSummary(base, seed) };
}

/* ------------------------------------------------------------------ */
/* region risk                                                         */
/* ------------------------------------------------------------------ */
export const REGION_CENTROIDS: Record<string, [number, number]> = {
  Odisha: [20.3, 84.9], 'West Bengal': [23.0, 87.6], Jharkhand: [23.6, 85.3], Bihar: [25.6, 85.5],
  'Andhra Pradesh': [15.9, 80.4], Assam: [26.2, 92.5], Gujarat: [22.3, 71.6], Rajasthan: [26.6, 73.4],
  Maharashtra: [19.4, 75.5], 'Madhya Pradesh': [23.5, 78.4], Kerala: [10.5, 76.4], Karnataka: [14.5, 75.9],
  'Tamil Nadu': [11.4, 78.7], Telangana: [17.9, 79.2], 'Uttar Pradesh': [26.9, 80.8], Chhattisgarh: [21.4, 81.8],
  Punjab: [31.0, 75.4], Haryana: [29.3, 76.3], Delhi: [28.6, 77.2], 'Himachal Pradesh': [31.7, 77.5],
  Uttarakhand: [30.2, 78.9], Goa: [15.4, 74.0], Marathwada: [19.2, 75.7], Konkan: [17.6, 73.5],
  'Arunachal Pradesh': [27.9, 94.2], 'Bay of Bengal': [16.0, 87.8], 'Odisha Coast': [19.6, 86.1],
  Jammu: [32.9, 74.9], Ladakh: [34.2, 77.6], Meghalaya: [25.5, 91.4], Tripura: [23.8, 91.6],
};

export function resolveRegions(events: WeatherEvent[]): RegionRisk[] {
  const byRegion = new Map<string, RegionRisk>();
  for (const [name, [lat, lon]] of Object.entries(REGION_CENTROIDS)) {
    byRegion.set(name, { name, lat, lon, riskScore: 0, hazard: 'No active hazard', trend: 'STEADY', eventIds: [] });
  }
  for (const e of events) {
    for (const region of e.corridor) {
      const r = byRegion.get(region);
      if (!r) continue;
      const wpIndex = e.corridor.indexOf(region);
      const decay = 1 - wpIndex * 0.13;
      const contribution = scoreOf(e.current) * decay * (e.confidence / 100);
      if (contribution > r.riskScore) {
        r.riskScore = contribution;
        r.hazard = e.categoryLabel;
        r.trend = e.trend;
      } else if (!r.eventIds.includes(e.id)) {
        r.riskScore = Math.max(r.riskScore, contribution * 0.92);
      }
      if (!r.eventIds.includes(e.id)) r.eventIds.push(e.id);
    }
  }
  // baseline climatological exposure so every region carries a non-zero score
  for (const r of byRegion.values()) {
    const base = 8 + Math.abs(noise2(r.lat * 0.4, r.lon * 0.4, 7)) * 12;
    r.riskScore = Math.round(clamp(r.riskScore * 0.94 + base, 4, 99));
  }
  return [...byRegion.values()].sort((a, b) => b.riskScore - a.riskScore);
}

/* ------------------------------------------------------------------ */
/* compound events                                                     */
/* ------------------------------------------------------------------ */
const COMPOUND_GROUPS: { id: string; members: string[]; label: string }[] = [
  { id: 'CMP-01', members: ['EX-1052', 'EX-1042', 'EX-1043'], label: 'Gangetic West Bengal — rainfall + wind + low pressure' },
  { id: 'CMP-02', members: ['EX-1051'], label: 'Brahmaputra valley — flood-generating rainfall + saturated catchment' },
  { id: 'CMP-03', members: ['EX-1045', 'EX-1054'], label: 'West coast — wind corridor overlap' },
];

export function resolveCompounds(events: WeatherEvent[]): CompoundGroup[] {
  const map = new Map(events.map((e) => [e.id, e]));
  const out: CompoundGroup[] = [];
  for (const g of COMPOUND_GROUPS) {
    const members = g.members.map((id) => map.get(id)).filter(Boolean) as WeatherEvent[];
    if (members.length < 2 && g.id !== 'CMP-02') continue;
    const overlap = members.every((m) => m.confidence > 40);
    const score = clamp(
      members.reduce((s, m) => s + scoreOf(m.current), 0) / members.length + (members.length - 1) * 4 + 3,
      0, 100
    );
    out.push({
      id: g.id, eventIds: members.map((m) => m.id), score: Math.round(score), label: g.label,
      drivers: [...new Set(members.flatMap((m) => m.drivers.slice(0, 2)))].slice(0, 5),
      regions: [...new Set(members.flatMap((m) => m.corridor))].slice(0, 6),
    });
  }
  return out.filter((g) => g.score > 30).sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* alerts                                                              */
/* ------------------------------------------------------------------ */
export function resolveAlerts(events: WeatherEvent[]): AlertItem[] {
  const items: AlertItem[] = [];
  for (const e of events) {
    if (e.severity === 'MODERATE' && e.confidence < 70) continue;
    items.push({
      id: `AL-${e.id}`,
      severity: e.severity,
      title:
        e.severity === 'EXTREME'
          ? `Extreme ${e.categoryLabel.toLowerCase()} event detected over ${e.anchor}`
          : e.severity === 'HIGH'
          ? `${e.categoryLabel} conditions developing over ${e.anchor}`
          : `${e.categoryLabel} detected in ${e.anchor}`,
      body: `${e.id} · anomaly score ${e.anomalyScore.toFixed(0)}/100 · moving ${e.headingLabel} at ${e.speedKmph.toFixed(0)} km/h · confidence ${e.confidence.toFixed(0)}%. ${e.forecastStatus}.`,
      eventId: e.id,
      issuedAt: NOW + Math.min(0, e.detectedAt) * 3600e3,
      region: e.anchor,
      read: e.severity === 'MODERATE',
    });
  }
  const rank: Record<Severity, number> = { EXTREME: 3, HIGH: 2, MODERATE: 1, NORMAL: 0 };
  return items.sort((a, b) => rank[b.severity] - rank[a.severity] || b.issuedAt - a.issuedAt);
}

/* ------------------------------------------------------------------ */
/* universe snapshot                                                   */
/* ------------------------------------------------------------------ */
const UNIVERSE_CACHE = new Map<number, WeatherEvent[]>();
export function eventsAt(t: number): WeatherEvent[] {
  const key = Math.round(t / 0.5) * 0.5;
  let u = UNIVERSE_CACHE.get(key);
  if (!u) {
    if (UNIVERSE_CACHE.size > 400) UNIVERSE_CACHE.clear();
    u = SEEDS.map((s) => resolveEvent(s, key));
    UNIVERSE_CACHE.set(key, u);
  }
  return u;
}

export const isActive = (e: WeatherEvent) => e.severity !== 'NORMAL' || e.confidence > 55;

export interface Snapshot {
  t: number;
  events: WeatherEvent[];
  active: WeatherEvent[];
  extreme: WeatherEvent[];
  high: WeatherEvent[];
  regions: RegionRisk[];
  compounds: CompoundGroup[];
  alerts: AlertItem[];
  stats: {
    activeCount: number; extremeCount: number; highRiskRegions: number;
    avgIntensity: number; avgConfidence: number; avgDurationH: number; avgSpeed: number;
    maxAnomaly: number; totalAreaKm2: number;
  };
}

export function snapshot(t: number): Snapshot {
  const events = eventsAt(t);
  const active = events.filter((e) => e.severity !== 'NORMAL');
  const extreme = events.filter((e) => e.severity === 'EXTREME');
  const high = events.filter((e) => e.severity === 'HIGH');
  const regions = resolveRegions(events);
  const alerts = resolveAlerts(events);
  const n = Math.max(1, active.length);
  return {
    t, events, active, extreme, high, regions,
    compounds: resolveCompounds(events), alerts,
    stats: {
      activeCount: active.length,
      extremeCount: extreme.length,
      highRiskRegions: regions.filter((r) => r.riskScore >= 55).length,
      avgIntensity: active.reduce((s, e) => s + e.intensity, 0) / n,
      avgConfidence: active.reduce((s, e) => s + e.confidence, 0) / n,
      avgDurationH: active.reduce((s, e) => s + e.durationH, 0) / n,
      avgSpeed: active.reduce((s, e) => s + e.speedKmph, 0) / n,
      maxAnomaly: Math.max(...active.map((e) => e.anomalyScore), 0),
      totalAreaKm2: active.reduce((s, e) => s + e.extentKm2, 0),
    },
  };
}

/** Domain-wide anomaly / driver table used by the Anomaly Analysis panel. */
export function anomalyTable(s: Snapshot) {
  const hot = s.events.filter((e) => e.category === 'heat');
  const cold = s.events.filter((e) => e.category === 'cold');
  const rain = s.events.filter((e) => e.category === 'rainfall' || e.category === 'flood' || e.category === 'cyclone');
  const wind = s.events.filter((e) => e.category === 'wind' || e.category === 'cyclone' || e.category === 'thunderstorm');
  const pres = s.events.filter((e) => e.category === 'pressure' || e.category === 'cyclone');
  const tmax = (l: WeatherEvent[]) => (l.length ? Math.max(...l.map((e) => e.anomalyScore)) : 0);
  return [
    { key: 'Temperature', value: +((tmax(hot) || 60) / 100 * 5.4 - (tmax(cold) || 40) / 100 * 2.1).toFixed(1), unit: '°C', ramp: 'temp' },
    { key: 'Rainfall', value: +(tmax(rain) * 2.1).toFixed(0), unit: '%', ramp: 'rain' },
    { key: 'Wind', value: +(tmax(wind) / 100 * 48).toFixed(0), unit: 'km/h', ramp: 'wind' },
    { key: 'Pressure', value: -+((tmax(pres) || 60) / 100 * 15).toFixed(0), unit: 'hPa', ramp: 'pressure' },
    { key: 'Humidity', value: +(tmax(rain) / 100 * 19 - 4).toFixed(0), unit: '%', ramp: 'humidity' },
  ];
}

/** Model pipeline stages — used by the architecture view and data panel. */
export const PIPELINE = [
  { id: 'ingest', label: 'Weather Forecast Data', tech: 'NWP GRIB2 · IMD / NCMRWF / ECMWF open feeds', detail: 'Medium-range deterministic + ensemble forecast fields ingested on a 6-hourly cycle out to 120 h.', io: 'GRIB2 / NetCDF', ms: 420 },
  { id: 'ingestion', label: 'Data Ingestion', tech: 'Python · xarray · Dask · Airflow', detail: 'Chunked, parallelised reads with checksum validation and gap detection before anything enters the pipeline.', io: 'Zarr store', ms: 610 },
  { id: 'preprocess', label: 'Preprocessing', tech: 'Regridding · debiasing · unit harmonisation', detail: 'Bilinear regrid to a common 0.25° grid, forecast-error debiasing against ERA5, quality masking.', io: '0.25° grids', ms: 380 },
  { id: 'anomaly', label: 'Anomaly Detection', tech: 'Climatological z-scores + autoencoder residual', detail: 'Each grid cell is scored against a 30-year daily climatology; a convolutional autoencoder flags residual spatial patterns the z-score misses.', io: 'Anomaly field', ms: 940 },
  { id: 'identify', label: 'Extreme Event Identification', tech: 'Connected-component labelling + watershed', detail: 'Thresholded anomaly fields are clustered into discrete objects with area, centroid, peak value and a detection timestamp.', io: 'Event objects', ms: 520 },
  { id: 'track', label: 'Spatio-Temporal Tracking', tech: 'Hungarian assignment + Kalman smoothing', detail: 'Event objects are linked frame-to-frame into tracks by minimising a cost of centroid distance, area change and type similarity.', io: 'Track table', ms: 470 },
  { id: 'forecast', label: 'AI Forecasting', tech: 'PyTorch ConvLSTM + gradient-boosted ETA regression', detail: 'ConvLSTM predicts intensity and footprint evolution; a regressor predicts translation and region-wise arrival times.', io: 'Track + ETA', ms: 1120 },
  { id: 'risk', label: 'Risk Analysis', tech: 'Weighted multi-hazard composite index', detail: 'Exposure, hazard intensity and confidence are combined into a 0–100 risk score per administrative region, incl. compound overlap.', io: 'Risk field', ms: 300 },
  { id: 'gis', label: 'GIS Visualization', tech: 'Google Maps JS API - ImageMapType field overlays - WebGL', detail: 'Anomaly fields are rasterised to imagery layers; tracks, corridors, ETAs and markers render as vector layers.', io: 'Interactive map', ms: 180 },
  { id: 'alert', label: 'Alert Generation', tech: 'Rule engine + severity classifier', detail: 'Events crossing severity and confidence thresholds generate deduplicated, ranked alerts routed to operational dashboards.', io: 'Alert stream', ms: 160 },
];
