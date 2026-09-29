import { loadGoogleMaps, GoogleMapsError, type MapsApi } from '../../lib/googleMaps';
import { TrackLayer } from './TrackLayer';
import { toEventView } from './adapter';
import { weatherIconMarkup } from '../common/WeatherIcon';
import { BOUNDS, rasterize, NX, NY, type Grid, type VecField } from '../../data/fields';
import { CAT_META, SEV_META, clamp } from '../../lib/utils';
import { INDIA_CENTER, INDIA_ZOOM } from '../../lib/design';
import { getWeatherIconSvgString } from '../common/WeatherIcons';
import { corridorRing } from '../../lib/geo';
import { STATE_RENAME } from './stateNames';
import type { LayerId, WeatherEvent } from '../../types';
import type { Basemap, BasemapStatus, EngineCallbacks, EventRenderOpts } from './types';

const TILE = 256;
/** the raster overlays are only meaningful over India, and only to a degree or two */
const FIELD_TILE_MIN = 3;
const FIELD_TILE_MAX = 8;

const RASTER_LAYERS: LayerId[] = ['anomaly', 'risk', 'temp', 'rain', 'storm', 'wind', 'pressure', 'humidity'];

/** a 1x1 fully transparent PNG — used as a hit-area-free icon for DOM overlays */
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * A dark style for Google Maps that matches the application shell. Without this
 * the default `roadmap` is a bright white map in the middle of a dark UI, which
 * is the single most jarring thing you can do to a command-centre layout.
 */
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f1726' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ea3c2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1120' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3a4a68' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#132339' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#111c2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1b2b45' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#24365a' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070d18' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1f3350' }] },
];

const SATELLITE_DIM = [
  { elementType: 'geometry', stylers: [{ color: '#223146' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#c3d2e8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1120' }] },
];

interface SingleRec {
  marker: any;
  el: HTMLElement;
}

interface OverlayRec {
  type: any;
  canvas: HTMLCanvasElement;
  grid: Grid | null;
}

export class GoogleMapEngine {
  private api: MapsApi | null = null;
  private map: any = null;
  private container: HTMLElement;
  private cb: EngineCallbacks;
  private ready = false;
  private destroyed = false;
  private statusSettled = false;
  private loadTimers: number[] = [];

  private basemap: Basemap = 'dark';
  private layerVis: Record<string, boolean> = {};
  private showStateLabels = true;

  private evEvents: WeatherEvent[] = [];
  private evOpts: EventRenderOpts | null = null;

  private singles = new Map<string, SingleRec>();
  private clusters = new Map<string, any>();
  private stateLabelMarkers: any[] = [];
  private stateNames: { name: string; lat: number; lon: number }[] = [];

  private histLines: any[] = [];
  private foreLines: any[] = [];
  private corridors: any[] = [];
  private etaDots: any[] = [];
  private trailMarkers: any[] = [];
  private trackLabels: any[] = [];

  private animCoords = new Map<string, { curLat: number; curLon: number; tgtLat: number; tgtLon: number }>();
  private animLoopActive = false;

  private userLocationMarker: any = null;
  private userLocationCircle: any = null;
  private userLocationEl: HTMLElement | null = null;

  private overlays = new Map<LayerId, OverlayRec>();
  private wind: { canvas: HTMLCanvasElement; field: VecField | null } | null = null;
  private pendingWind: VecField | null = null;
  /** redesign animated track layer for the single on-map event */
  private track: TrackLayer | null = null;
  /** true while TrackLayer owns the focused event's track rendering */
  private trackOwned = false;

  constructor(container: HTMLElement, cb: EngineCallbacks) {
    this.container = container;
    this.cb = cb;
    this.cb.onBaseStatus?.({ provider: 'loading', offline: false, loading: true });
    void this.boot();
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                          */
  /* ------------------------------------------------------------------ */
  private async boot() {
    let api: MapsApi;
    try {
      api = await loadGoogleMaps();
    } catch (err) {
      if (this.destroyed) return;
      const e = err as GoogleMapsError;
      this.cb.onFatal?.(e.message, e.hint);
      this.cb.onBaseStatus?.({ provider: 'unavailable', offline: true, loading: false });
      return;
    }
    if (this.destroyed) return;
    this.api = api;

    const el = document.createElement('div');
    el.className = 'absolute inset-0';
    this.container.appendChild(el);

    const base = this.basemapOptions();
    this.map = new api.Map(el, {
      center: new api.LatLng(INDIA_CENTER[1], INDIA_CENTER[0]),
      zoom: INDIA_ZOOM,
      minZoom: 3,
      maxZoom: 12,
      mapTypeId: base.mapTypeId,
      styles: base.styles,
      disableDefaultUI: true,
      clickableIcons: false,
      keyboardShortcuts: false,
      backgroundColor: '#070b14',
    });

    this.attachListeners();
    this.buildOverlays();
    void this.loadStates();

    /* the redesign's animated track layer for the single on-map event; it uses
       the same local projection as the rest of the engine */
    try {
      this.track = new TrackLayer(this.map, (lat, lon) => this.projectPoint(lat, lon), (ev) =>
        weatherIconMarkup(ev.source.category, 16)
      );
    } catch (err) {
      console.warn('[Map] track layer unavailable', err);
      this.track = null;
    }

    /* addListenerOnce no longer exists on the current Maps JS API */
    const onTiles = this.map.addListener('tilesloaded', () => {
      onTiles.remove();
      this.markLoaded();
    });
    /* a slow or partially failing tile set must not leave the spinner forever */
    this.loadTimers.push(window.setTimeout(() => this.markLoaded(), 6000));

    this.ready = true;
    this.cb.onReady?.();
    if (this.pendingWind) {
      const p = this.pendingWind;
      this.pendingWind = null;
      this.setWindField(p);
    }
  }

  /**
   * Web-Mercator lat/lon -> container pixel, computed locally.
   *
   * `map.getProjection()` is not reliably populated on the current Maps JS API
   * (it is null until the map has fully settled and null again after certain
   * transitions), so clustering and label placement use this instead. The maths
   * is the standard Web-Mercator projection Google also uses; because bearing and tilt
   * are never enabled, the map centre is always the middle of the container.
   */
  private projectPoint(lat: number, lon: number): { x: number; y: number } | null {
    const m = this.map;
    if (!m) return null;
    const proj = m.getProjection?.();
    if (proj?.fromLatLngToDivPixel) {
      try {
        const p = proj.fromLatLngToDivPixel(new this.api!.LatLng(lat, lon));
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
      } catch {
        /* fall through to the local projection */
      }
    }
    const center = m.getCenter();
    const zoom = m.getZoom();
    if (!center || zoom == null) return null;
    const rect = m.getDiv().getBoundingClientRect();
    if (rect.width < 2) return null;
    const world = 256 * Math.pow(2, zoom);
    const px = worldPoint(lon, lat, world);
    const pc = worldPoint(center.lng(), center.lat(), world);
    return { x: px.x - pc.x + rect.width / 2, y: px.y - pc.y + rect.height / 2 };
  }

  private markLoaded() {
    if (this.statusSettled) return;
    this.statusSettled = true;
    this.setStatus({ provider: 'Google Maps', offline: false, loading: false });
  }

  private setStatus(s: BasemapStatus) {
    this.cb.onBaseStatus?.(s);
  }

  private attachListeners() {
    const m = this.map;
    m.addListener('click', () => this.cb.onSelect(null));
    m.addListener('idle', () => {
      this.renderMarkers();
      this.renderStateLabels();
      this.drawWind();
      const c = m.getCenter();
      if (c && this.cb.onMove) this.cb.onMove(c.lng(), c.lat(), m.getZoom() ?? 0, 0);
    });
    m.addListener('zoom_changed', () => {
      this.renderMarkers();
      this.renderStateLabels();
    });
  }

  /* ------------------------------------------------------------------ */
  /* basemap                                                            */
  /* ------------------------------------------------------------------ */
  private basemapOptions(): { mapTypeId: string; styles?: unknown[] } {
    if (this.basemap === 'satellite') return { mapTypeId: 'hybrid', styles: SATELLITE_DIM };
    if (this.basemap === 'dark') return { mapTypeId: 'roadmap', styles: DARK_STYLE };
    return { mapTypeId: 'roadmap' };
  }

  setBasemap(kind: Basemap) {
    this.basemap = kind;
    if (!this.map) return;
    const o = this.basemapOptions();
    this.map.setOptions({ mapTypeId: o.mapTypeId, styles: o.styles });
  }

  /* ------------------------------------------------------------------ */
  /* weather field overlays                                             */
  /* ------------------------------------------------------------------ */
  private buildOverlays() {
    const api = this.api!;
    const m = this.map;
    if (!api || !m) return;
    const bounds = new api.LatLngBounds(
      new api.LatLng(BOUNDS.lat0, BOUNDS.lon0),
      new api.LatLng(BOUNDS.lat1, BOUNDS.lon1)
    );

    for (const id of RASTER_LAYERS) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const type = new api.ImageMapType({
        name: id,
        tileSize: new api.Size(TILE, TILE),
        minZoom: FIELD_TILE_MIN,
        maxZoom: FIELD_TILE_MAX,
        bounds,
        opacity: 0,
        getTileUrl: (coord: any, zoom: number) => this.tileUrl(id, canvas, coord, zoom),
      });
      this.overlays.set(id, { type, canvas, grid: null });
      void m;
    }
  }

  /**
   * Crop the full-extent field canvas down to one geographic tile. Returning
   * the same image for every tile would paint all of India into every tile, so
   * the crop is what makes the overlay geographically correct at any zoom.
   */
  private tileUrl(id: LayerId, canvas: HTMLCanvasElement, coord: any, zoom: number): string {
    const rec = this.overlays.get(id);
    if (!rec || !rec.grid) return BLANK;
    if (zoom < FIELD_TILE_MIN || zoom > FIELD_TILE_MAX) return BLANK;

    const n = Math.pow(2, zoom);
    if (coord.x < 0 || coord.y < 0 || coord.x >= n || coord.y >= n) return BLANK;

    const lon0 = (coord.x / n) * 360 - 180;
    const lon1 = ((coord.x + 1) / n) * 360 - 180;
    const latTop = mercLat(coord.y / n);
    const latBot = mercLat((coord.y + 1) / n);

    if (lon1 < BOUNDS.lon0 || lon0 > BOUNDS.lon1 || latBot < BOUNDS.lat0 || latTop > BOUNDS.lat1) return BLANK;

    const sx = ((lon0 - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0)) * canvas.width;
    const sx1 = ((lon1 - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0)) * canvas.width;
    const sy = ((BOUNDS.lat1 - latTop) / (BOUNDS.lat1 - BOUNDS.lat0)) * canvas.height;
    const sy1 = ((BOUNDS.lat1 - latBot) / (BOUNDS.lat1 - BOUNDS.lat0)) * canvas.height;

    const w = Math.max(1, Math.round(sx1 - sx));
    const h = Math.max(1, Math.round(sy1 - sy));
    const out = document.createElement('canvas');
    out.width = TILE;
    out.height = TILE;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, sx, sy, w, h, 0, 0, TILE, TILE);
    return out.toDataURL('image/png');
  }

  setField(layer: LayerId, grid: Grid) {
    if (!this.ready || !this.overlays.has(layer)) return;
    const rec = this.overlays.get(layer)!;
    rec.grid = grid;
    const isRisk = layer === 'risk';
    const img = rasterize(layer, grid, {
      width: rec.canvas.width,
      height: rec.canvas.height,
      alpha: isRisk ? 0.85 : 0.78,
      cutoff: isRisk ? 0.16 : layer === 'anomaly' ? 0.12 : 0.05,
      solid: undefined,
    });
    rec.canvas.getContext('2d')!.putImageData(img, 0, 0);
    this.applyOverlayVisibility();
  }

  setLayerVisibility(vis: Record<string, boolean>) {
    this.layerVis = { ...vis };
    this.applyOverlayVisibility();
  }

  private applyOverlayVisibility() {
    const m = this.map;
    if (!m) return;
    /* rebuild the overlay list rather than mutating it in place — Google has no
       public way to reorder overlayMapTypes, and the order defines precedence */
    m.overlayMapTypes.clear();
    for (const id of RASTER_LAYERS) {
      const rec = this.overlays.get(id);
      if (!rec || !rec.grid || !this.layerVis[id]) continue;
      rec.type.setOpacity(id === 'risk' ? 0.6 : id === 'anomaly' ? 0.55 : id === 'storm' ? 0.42 : 0.5);
      m.overlayMapTypes.push(rec.type);
    }
    if (this.wind) {
      this.wind.canvas.style.opacity = this.layerVis.wind ? '1' : '0';
      if (this.layerVis.wind) this.drawWind();
    }
  }

  /* ------------------------------------------------------------------ */
  /* wind particles                                                     */
  /* ------------------------------------------------------------------ */
  setWindField(vec: VecField) {
    if (this.destroyed) return;
    if (!this.map) {
      /* the map is still booting; replay this field once it exists */
      this.pendingWind = vec;
      return;
    }
    if (!this.wind) {
      const canvas = document.createElement('canvas');
      canvas.className = 'wind-particles';
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
      this.container.appendChild(canvas);
      this.wind = { canvas, field: null };
    }
    this.wind.field = vec;
    this.drawWind();
  }

  private drawWind() {
    const w = this.wind;
    const m = this.map;
    const api = this.api;
    if (!w || !m || !api || !w.field || !this.layerVis.wind) return;
    const rect = m.getDiv().getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w.canvas.width = Math.round(rect.width * dpr);
    w.canvas.height = Math.round(rect.height * dpr);
    const ctx = w.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w.canvas.width, w.canvas.height);
    ctx.strokeStyle = 'rgba(226,240,255,0.5)';
    ctx.lineWidth = Math.max(0.7, 1.1 * dpr);

    const b = m.getBounds();
    if (!b) return;
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();

    const field = w.field;
    const fw = NX;
    const fh = NY;
    const step = 2;
    ctx.beginPath();
    for (let y = 0; y < fh; y += step) {
      for (let x = 0; x < fw; x += step) {
        const i = y * fw + x;
        const u = field.u[i];
        const vv = field.v[i];
        if (u === undefined || vv === undefined) continue;
        const sp = field.speed[i];
        if (sp < 1.2) continue;
        const lon = BOUNDS.lon0 + (x / (fw - 1)) * (BOUNDS.lon1 - BOUNDS.lon0);
        const lat = BOUNDS.lat1 - (y / (fh - 1)) * (BOUNDS.lat1 - BOUNDS.lat0);
        if (lon < sw.lng() || lon > ne.lng() || lat < sw.lat() || lat > ne.lat()) continue;
        const p = this.projectPoint(lat, lon);
        if (!p) continue;
        const len = clamp(sp * 1.5, 5, 30) * dpr;
        const ang = Math.atan2(vv, u);
        const ax = p.x * dpr;
        const ay = p.y * dpr;
        ctx.moveTo(ax - (Math.cos(ang) * len) / 2, ay - (Math.sin(ang) * len) / 2);
        ctx.lineTo(ax + (Math.cos(ang) * len) / 2, ay + (Math.sin(ang) * len) / 2);
      }
    }
    ctx.stroke();
  }

  /* ------------------------------------------------------------------ */
  /* events                                                             */
  /* ------------------------------------------------------------------ */
  updateEvents(events: WeatherEvent[], o: EventRenderOpts) {
    this.evEvents = events;
    this.evOpts = o;
    if (!this.ready || !this.map) return;
    this.drawVectors(events, o);
    this.renderMarkers();
    this.renderStateLabels();
  }

  /**
   * Hand the single on-map event to the redesign's animated track layer.
   *
   * That layer owns the past line, the fading trail, the dashed forecast, the
   * blurred corridor and the glowing marker, and animates the marker as the
   * timeline moves. Once it is attached the engine stops drawing its own track
   * for that event so the two do not overdraw each other.
   */
  setTrackedEvent(ev: WeatherEvent | null, cursorHour: number, playing: boolean) {
    if (!this.track) return;
    if (!ev) {
      this.track.setEvent(undefined);
      this.trackOwned = false;
      return;
    }
    const view = toEventView(ev);
    /* the redesign's track times are hours relative to NOW */
    this.track.setEvent(view);
    this.track.update(view.track.length ? cursorHour : 0, playing);
    this.trackOwned = true;
  }

  /** Keep the tracked marker eased along the track as the clock moves. */
  updateTrackedTime(cursorHour: number, playing: boolean) {
    this.track?.update(cursorHour, playing);
  }

  private drawVectors(events: WeatherEvent[], o: EventRenderOpts) {
    const m = this.map;
    const api = this.api;
    if (!m || !api) return;
    for (const p of this.histLines) p.setMap(null);
    for (const p of this.foreLines) p.setMap(null);
    for (const p of this.corridors) p.setMap(null);
    for (const p of this.etaDots) p.setMap(null);
    for (const p of this.trailMarkers) p.setMap(null);
    for (const p of this.trackLabels) p.setMap(null);
    this.histLines = [];
    this.foreLines = [];
    this.corridors = [];
    this.etaDots = [];
    this.trailMarkers = [];
    this.trackLabels = [];

    for (const e of events) {
      if (o.hiddenIds.has(e.id)) continue;
      const color = CAT_META[e.category].color;
      const isSel = e.id === o.selectedId;
      /* the redesign's TrackLayer already draws the focused event's path, trail,
         forecast, corridor and marker — do not overdraw them here */
      if (this.trackOwned && isSel) continue;
      const wantTrack = o.showTracks && (isSel || e.severity === 'EXTREME');

      /* 1. Historical path: Thin semi-transparent line */
      if (wantTrack && e.history.length > 1) {
        const line = new api.Polyline({
          path: e.history.map((k) => new api.LatLng(k.lat, k.lon)),
          geodesic: true,
          strokeColor: '#38bdf8',
          strokeOpacity: isSel ? 0.75 : 0.45,
          strokeWeight: isSel ? 2.5 : 1.8,
          clickable: false,
          zIndex: isSel ? 40 : 20,
        });
        line.setMap(m);
        this.histLines.push(line);

        /* Trail: fading dots behind current position */
        const recentPts = e.history.slice(-5, -1);
        recentPts.forEach((pt, idx) => {
          const ratio = (idx + 1) / Math.max(1, recentPts.length);
          const alpha = 0.12 + ratio * 0.48;
          const rad = 2 + ratio * 2.5;
          const dot = new api.Marker({
            position: new api.LatLng(pt.lat, pt.lon),
            map: m,
            clickable: false,
            zIndex: isSel ? 46 : 26,
            icon: {
              path: api.SymbolPath.CIRCLE,
              scale: rad,
              fillColor: color,
              fillOpacity: alpha,
              strokeColor: color,
              strokeOpacity: alpha * 0.7,
              strokeWeight: 1,
            },
          });
          this.trailMarkers.push(dot);
        });

        /* Label: PAST */
        if (isSel && e.history.length >= 3) {
          const pastPt = e.history[Math.max(0, Math.floor(e.history.length * 0.2))];
          const lbl = new api.Marker({
            position: new api.LatLng(pastPt.lat, pastPt.lon),
            map: m,
            clickable: false,
            zIndex: 42,
            icon: { url: BLANK, anchor: new api.Point(0, 0), scaledSize: new api.Size(1, 1) },
            label: { text: 'PAST', color: '#7dd3fc', fontSize: '9px', fontWeight: '700', className: 'gm-track-tag' },
          });
          this.trackLabels.push(lbl);
        }
      }

      /* 2. Future path: Smooth dashed line with arrows */
      if (wantTrack && e.predicted.length > 0) {
        const predPath = [new api.LatLng(e.lat, e.lon), ...e.predicted.map((k) => new api.LatLng(k.lat, k.lon))];
        const line = new api.Polyline({
          path: predPath,
          geodesic: true,
          strokeOpacity: 0,
          clickable: false,
          zIndex: isSel ? 39 : 19,
          icons: [
            {
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: isSel ? 0.9 : 0.65,
                strokeWeight: isSel ? 2.5 : 1.8,
                strokeColor: '#a78bfa',
                scale: 2.2,
              },
              offset: '0',
              repeat: '10px',
            },
            {
              icon: { path: api.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.4, fillColor: '#a78bfa', fillOpacity: 0.9 },
              offset: '100%',
            },
          ],
        });
        line.setMap(m);
        this.foreLines.push(line);

        /* Label: FORECAST */
        if (isSel && e.predicted.length >= 2) {
          const forePt = e.predicted[Math.min(e.predicted.length - 1, Math.floor(e.predicted.length * 0.45))];
          const lbl = new api.Marker({
            position: new api.LatLng(forePt.lat, forePt.lon),
            map: m,
            clickable: false,
            zIndex: 42,
            icon: { url: BLANK, anchor: new api.Point(0, 0), scaledSize: new api.Size(1, 1) },
            label: { text: 'FORECAST', color: '#c4b5fd', fontSize: '9px', fontWeight: '700', className: 'gm-track-tag' },
          });
          this.trackLabels.push(lbl);
        }
      }

      /* 3. Uncertainty: Soft blurred translucent corridor around predicted path */
      if (o.showCorridors && (isSel || e.severity === 'EXTREME') && e.predicted.length > 2) {
        const ring = corridorRing([
          { lat: e.lat, lon: e.lon, r: e.uncertaintyKm * 0.35 },
          ...e.predicted
            .filter((_, i) => i % 3 === 0)
            .map((k) => ({
              lat: k.lat,
              lon: k.lon,
              r: e.uncertaintyKm * (0.35 + 0.65 * clamp((k.t - o.t) / Math.max(1, e.skilledUntilH * 1.4), 0, 1.35)),
            })),
        ]);
        if (ring.length > 3) {
          const poly = new api.Polygon({
            paths: ring.map(([lon, lat]) => new api.LatLng(lat, lon)),
            strokeColor: '#818cf8',
            strokeOpacity: isSel ? 0.35 : 0.16,
            strokeWeight: 1,
            fillColor: '#818cf8',
            fillOpacity: isSel ? 0.12 : 0.05,
            clickable: false,
            zIndex: isSel ? 30 : 10,
          });
          poly.setMap(m);
          this.corridors.push(poly);
        }
      }

      /* Current marker position indicator tag */
      if (isSel) {
        const nowLbl = new api.Marker({
          position: new api.LatLng(e.lat, e.lon),
          map: m,
          clickable: false,
          zIndex: 48,
          icon: { url: BLANK, anchor: new api.Point(0, 0), scaledSize: new api.Size(1, 1) },
          label: { text: 'NOW', color: '#38bdf8', fontSize: '9px', fontWeight: '800', className: 'gm-track-now' },
        });
        this.trackLabels.push(nowLbl);
      }

      if (o.showEta && isSel) {
        for (const et of e.etas) {
          if (e.corridor.indexOf(et.region) === 0) continue;
          const seed = e.predicted.find((k) => k.t >= o.t + et.etaH - 4);
          if (!seed) continue;
          const mk = new api.Marker({
            position: new api.LatLng(seed.lat, seed.lon),
            map: m,
            clickable: false,
            zIndex: 45,
            icon: { path: api.SymbolPath.CIRCLE, scale: 5, fillColor: '#7dd3fc', fillOpacity: 0.95, strokeColor: '#0b1120', strokeWeight: 1.5 },
            label: {
              text: `${et.region} · ${et.etaH >= 24 ? `${Math.round(et.etaH / 24)}d ${Math.round(et.etaH % 24)}h` : `${Math.round(et.etaH)}h`}`,
              color: '#dbeafe',
              fontSize: '10px',
              fontWeight: '600',
              className: 'gm-eta-label',
            },
          });
          this.etaDots.push(mk);
        }
      }
    }
  }

  private startAnimLoop() {
    const tick = () => {
      if (this.destroyed) return;
      for (const [id, c] of this.animCoords) {
        const dLat = c.tgtLat - c.curLat;
        const dLon = c.tgtLon - c.curLon;
        if (Math.abs(dLat) > 0.0001 || Math.abs(dLon) > 0.0001) {
          c.curLat += dLat * 0.22;
          c.curLon += dLon * 0.22;
        } else {
          c.curLat = c.tgtLat;
          c.curLon = c.tgtLon;
        }
        const rec = this.singles.get(id);
        if (rec && this.api) {
          rec.marker.setPosition(new this.api.LatLng(c.curLat, c.curLon));
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private renderMarkers() {
    const m = this.map;
    const api = this.api;
    const o = this.evOpts;
    if (!m || !api || !o) return;

    if (!this.animLoopActive) {
      this.animLoopActive = true;
      this.startAnimLoop();
    }

    const shown = this.evEvents.filter((e) => !o.hiddenIds.has(e.id));
    const singles: WeatherEvent[] = [];
    const groups: { px: number; py: number; items: WeatherEvent[] }[] = [];
    const clustering = o.cluster && (m.getZoom() ?? 0) < 7.2;

    if (clustering) {
      const pad = 46;
      for (const e of shown) {
        const p = this.projectPoint(e.lat, e.lon);
        if (!p) {
          singles.push(e);
          continue;
        }
        const hit = groups.find((g) => Math.hypot(g.px - p.x, g.py - p.y) < pad);
        if (hit) {
          hit.items.push(e);
          hit.px = (hit.px * (hit.items.length - 1) + p.x) / hit.items.length;
          hit.py = (hit.py * (hit.items.length - 1) + p.y) / hit.items.length;
        } else {
          groups.push({ px: p.x, py: p.y, items: [e] });
        }
      }
    } else {
      singles.push(...shown);
    }

    /* clusters */
    const keep = new Set<string>();
    for (const g of groups) {
      if (g.items.length < 2) {
        singles.push(g.items[0]);
        continue;
      }
      const key = g.items.map((e) => e.id).sort().join('|');
      keep.add(key);
      const top = [...g.items].sort((a, b) => b.intensity - a.intensity)[0];
      let mk = this.clusters.get(key);
      if (!mk) {
        mk = new api.Marker({
          position: new api.LatLng(g.items[0].lat, g.items[0].lon),
          map: m,
          clickable: true,
          zIndex: 800,
          icon: { url: BLANK, anchor: new api.Point(0, 0), scaledSize: new api.Size(28, 28) },
          label: {
            text: String(g.items.length),
            color: CAT_META[top.category].color,
            fontSize: `${clamp(11, 9 + g.items.length * 0.4, 15)}px`,
            fontWeight: '700',
            className: 'cmarker-label',
          },
          title: `${g.items.length} events here — click to separate`,
        });
        mk.addListener('click', () => {
          const first = g.items[0];
          m.setCenter(new api.LatLng(first.lat, first.lon));
          m.setZoom(Math.min(9, (m.getZoom() ?? 4) + 2.4));
        });
        this.clusters.set(key, mk);
      }
      mk.setPosition(new api.LatLng(g.items[0].lat, g.items[0].lon));
    }
    for (const [key, mk] of this.clusters) {
      if (!keep.has(key)) {
        mk.setMap(null);
        this.clusters.delete(key);
      }
    }

    /* single markers: a real DOM button parked at the marker's screen position */
    const keepSingle = new Set(singles.map((e) => e.id));
    for (const [id, rec] of this.singles) {
      if (!keepSingle.has(id)) {
        rec.marker.setMap(null);
        rec.el.remove();
        this.singles.delete(id);
        this.animCoords.delete(id);
      }
    }

    for (const e of singles) {
      const cat = CAT_META[e.category];
      const sev = SEV_META[e.severity];
      const sel = e.id === o.selectedId;

      /* Update interpolation target coordinate */
      let coord = this.animCoords.get(e.id);
      if (!coord) {
        coord = { curLat: e.lat, curLon: e.lon, tgtLat: e.lat, tgtLon: e.lon };
        this.animCoords.set(e.id, coord);
      } else {
        coord.tgtLat = e.lat;
        coord.tgtLon = e.lon;
      }

      let rec = this.singles.get(e.id);
      if (!rec) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'ev-marker';
        el.dataset.eventId = e.id;
        el.innerHTML = `<span class="ev-pulse"></span><span class="ev-core"></span><span class="ev-tip hidden"></span>`;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.cb.onSelect(e.id);
        });
        el.addEventListener('mouseenter', () => {
          el.classList.add('ev-hover');
          el.querySelector('.ev-tip')?.classList.remove('hidden');
        });
        el.addEventListener('mouseleave', () => {
          el.classList.remove('ev-hover');
          el.querySelector('.ev-tip')?.classList.add('hidden');
        });
        const marker = new api.Marker({
          position: new api.LatLng(coord.curLat, coord.curLon),
          map: m,
          clickable: false,
          zIndex: 700,
          icon: { url: BLANK, anchor: new api.Point(0, 0), scaledSize: new api.Size(1, 1) },
        });
        rec = { marker, el };
        this.singles.set(e.id, rec);
        this.attachDomMarker(marker, el);
      }
      const r = rec;
      r.el.style.setProperty('--mc', cat.color);
      r.el.style.setProperty('--ms', sev.color);
      r.el.style.setProperty('--msz', `${clamp(26 + e.intensity * 0.08, 26, 36)}px`);
      r.el.classList.toggle('ev-sel', sel);
      r.el.classList.toggle('ev-hot', !sel && e.severity === 'EXTREME');

      /* Clean SVG icon instead of emoji */
      const core = r.el.querySelector('.ev-core') as HTMLElement;
      if (core && core.dataset.cat !== e.category) {
        core.dataset.cat = e.category;
        core.innerHTML = getWeatherIconSvgString(e.category, 14, cat.color);
      }

      r.el.setAttribute(
        'aria-label',
        `${e.categoryLabel} in ${e.anchor}, severity ${e.severity}, intensity ${Math.round(e.intensity)} percent`
      );

      const tip = r.el.querySelector('.ev-tip') as HTMLElement;
      if (tip) {
        tip.innerHTML = `
          <div class="ev-tip-name">${e.categoryLabel}</div>
          <div class="ev-tip-row"><span>${e.anchor}</span></div>
          <div class="ev-tip-row"><span style="color:${sev.color};font-weight:600">${sev.dot} ${e.severity}</span></div>
          <div class="ev-tip-row"><span>Intensity</span><span class="mono ml-auto">${Math.round(e.intensity)}%</span></div>
          <div class="ev-tip-row"><span>Confidence</span><span class="mono ml-auto">${Math.round(e.confidence)}%</span></div>`;
      }

      r.marker.setZIndex(sel ? 900 : e.severity === 'EXTREME' ? 850 : 750);
    }
  }

  /**
   * Google positions markers itself, but the marker art is a DOM element so the
   * CSS custom properties and hover tooltips keep working. The element is
   * translated each frame to follow its marker.
   */
  private attachDomMarker(marker: any, el: HTMLElement) {
    const m = this.map;
    if (!m) return;
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '3';
    el.style.willChange = 'transform';
    m.getDiv().appendChild(el);
    const place = () => {
      if (this.destroyed) return;
      const pos = marker.getPosition();
      const p = pos ? this.projectPoint(pos.lat(), pos.lng()) : null;
      if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      requestAnimationFrame(place);
    };
    place();
  }

  highlight(id: string | null) {
    for (const [eid, rec] of this.singles) rec.el.classList.toggle('ev-sel', eid === id);
  }

  /* ------------------------------------------------------------------ */
  /* state labels                                                       */
  /* ------------------------------------------------------------------ */
  setStateLabelsVisible(on: boolean) {
    this.showStateLabels = on;
    this.renderStateLabels();
  }

  private async loadStates() {
    try {
      let data: any = null;
      for (const u of ['./geo/india-states.geojson', '/geo/india-states.geojson']) {
        try {
          const res = await fetch(u);
          if (!res.ok) continue;
          data = await res.json();
          if (data) break;
        } catch {
          /* try the next candidate */
        }
      }
      if (!data || this.destroyed) return;
      for (const f of data.features ?? []) {
        const raw = f.properties?.name ?? f.properties?.NAME_1 ?? f.properties?.ST_NM ?? 'Unknown';
        const c = centroidOf(f.geometry);
        if (!c || c[1] < -90) continue;
        this.stateNames.push({ name: STATE_RENAME[raw] ?? raw, lat: c[1], lon: c[0] });
      }
      this.stateNames.sort(
        (a, b) => Math.abs(b.lon - 80.5) + Math.abs(b.lat - 22.4) - (Math.abs(a.lon - 80.5) + Math.abs(a.lat - 22.4))
      );
      this.renderStateLabels();
    } catch {
      /* labels are a nicety, never a blocker */
    }
  }

  private renderStateLabels() {
    const m = this.map;
    const api = this.api;
    if (!m || !api) return;
    for (const mk of this.stateLabelMarkers) mk.setMap(null);
    this.stateLabelMarkers = [];
    if (!this.showStateLabels) return;
    const zoom = m.getZoom() ?? 0;
    if (zoom < 3.6) return;

    const rect = m.getDiv().getBoundingClientRect();
    if (rect.width < 2) return;
    const boxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const BIG = new Set([
      'Maharashtra', 'Madhya Pradesh', 'Rajasthan', 'West Bengal', 'Karnataka', 'Tamil Nadu',
      'Gujarat', 'Bihar', 'Assam', 'Odisha', 'Uttar Pradesh', 'Telangana',
    ]);

    for (const s of this.stateNames) {
      if (zoom < 5.4 && !BIG.has(s.name)) continue;
      const p = this.projectPoint(s.lat, s.lon);
      if (!p) continue;
      if (p.x < 40 || p.y < 20 || p.x > rect.width - 40 || p.y > rect.height - 20) continue;
      const bw = 7 * s.name.length;
      const box = { x1: p.x - bw / 2, y1: p.y - 8, x2: p.x + bw / 2, y2: p.y + 8 };
      if (boxes.some((b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2))) continue;
      boxes.push(box);
      const mk = new api.Marker({
        position: new api.LatLng(s.lat, s.lon),
        map: m,
        clickable: false,
        zIndex: 500,
        icon: { url: BLANK, anchor: new api.Point(0, 0), scaledSize: new api.Size(1, 1) },
        label: { text: s.name, color: '#cfe0f7', fontSize: '10.5px', fontWeight: '600', className: 'statelabel' },
      });
      this.stateLabelMarkers.push(mk);
    }
  }

  /* ------------------------------------------------------------------ */
  /* camera + controls                                                  */
  /* ------------------------------------------------------------------ */
  flyTo(lon: number, lat: number, zoom?: number, duration = 850) {
    const m = this.map;
    const api = this.api;
    if (!m || !api) return;
    const target = new api.LatLng(lat, lon);
    if (duration <= 0) {
      m.setCenter(target);
      if (zoom != null) m.setZoom(zoom);
      return;
    }
    /* Google has no tweened centre+zoom, so interpolate manually for the same feel */
    const from = m.getCenter();
    const z0 = m.getZoom() ?? INDIA_ZOOM;
    const z1 = zoom ?? z0;
    const t0 = performance.now();
    const tick = () => {
      if (this.destroyed || !this.map) return;
      const k = clamp((performance.now() - t0) / duration, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      if (from) {
        this.map.setCenter(
          new api.LatLng(from.lat() + (target.lat() - from.lat()) * e, from.lng() + (target.lng() - from.lng()) * e)
        );
      }
      this.map.setZoom(z0 + (z1 - z0) * e);
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  focusEvent(e: WeatherEvent) {
    this.flyTo(e.lon, e.lat, Math.max(6, this.map?.getZoom() ?? 6));
  }

  fitTo(events: WeatherEvent[], pad = 72) {
    const m = this.map;
    const api = this.api;
    if (!m || !api) return;
    if (!events.length) {
      m.fitBounds(new api.LatLngBounds(new api.LatLng(6, 68), new api.LatLng(36, 97)), pad);
      return;
    }
    const b = new api.LatLngBounds();
    for (const e of events) b.extend(new api.LatLng(e.lat, e.lon));
    m.fitBounds(b, pad);
  }

  reset() {
    this.flyTo(INDIA_CENTER[0], INDIA_CENTER[1], INDIA_ZOOM, 800);
  }

  zoomBy(delta: number) {
    const m = this.map;
    if (!m) return;
    m.setZoom(clamp((m.getZoom() ?? INDIA_ZOOM) + delta, 3, 12));
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().then(() => setTimeout(() => this.resize(), 260)).catch(() => {});
    } else {
      this.container.requestFullscreen?.().then(() => setTimeout(() => this.resize(), 260)).catch(() => {});
    }
  }

  resize() {
    const m = this.map;
    if (!m || !this.api) return;
    const c = m.getCenter();
    const z = m.getZoom();
    /* the synthetic resize event is deprecated but still honoured; the centre
     * and zoom nudge is what actually makes Google re-measure the container */
    try {
      this.api.event.trigger(m, 'resize');
    } catch {
      /* ignore */
    }
    if (c) m.setCenter(c);
    if (z != null) m.setZoom(z);
    this.renderStateLabels();
    this.drawWind();
  }

  setUserLocation(loc: { lat: number; lon: number; accuracy?: number } | null) {
    if (!this.map || !this.api) return;
    if (!loc) {
      if (this.userLocationMarker) {
        this.userLocationMarker.setMap(null);
        this.userLocationMarker = null;
      }
      if (this.userLocationCircle) {
        this.userLocationCircle.setMap(null);
        this.userLocationCircle = null;
      }
      if (this.userLocationEl) {
        this.userLocationEl.remove();
        this.userLocationEl = null;
      }
      return;
    }

    const pos = new this.api.LatLng(loc.lat, loc.lon);
    if (!this.userLocationMarker) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <span class="user-loc-pulse"></span>
        <span class="user-loc-core"></span>
        <span class="user-loc-label">Your Location</span>
      `;
      this.userLocationEl = el;
      this.userLocationMarker = new this.api.Marker({
        position: pos,
        map: this.map,
        clickable: false,
        zIndex: 999,
        icon: { url: BLANK, anchor: new this.api.Point(0, 0), scaledSize: new this.api.Size(1, 1) },
      });
      this.attachDomMarker(this.userLocationMarker, el);
    } else {
      this.userLocationMarker.setPosition(pos);
    }

    if (loc.accuracy && loc.accuracy > 50) {
      if (!this.userLocationCircle) {
        this.userLocationCircle = new this.api.Circle({
          map: this.map,
          center: pos,
          radius: loc.accuracy,
          strokeColor: '#38bdf8',
          strokeOpacity: 0.4,
          strokeWeight: 1,
          fillColor: '#38bdf8',
          fillOpacity: 0.08,
          clickable: false,
          zIndex: 40,
        });
      } else {
        this.userLocationCircle.setCenter(pos);
        this.userLocationCircle.setRadius(loc.accuracy);
      }
    } else if (this.userLocationCircle) {
      this.userLocationCircle.setMap(null);
      this.userLocationCircle = null;
    }
  }

  getStatus() {
    return { provider: 'Google Maps', offline: false, loading: !this.statusSettled };
  }

  destroy() {
    this.destroyed = true;
    for (const t of this.loadTimers) window.clearTimeout(t);
    this.loadTimers = [];
    this.track?.destroy();
    this.track = null;
    if (this.userLocationMarker) {
      this.userLocationMarker.setMap(null);
      this.userLocationMarker = null;
    }
    if (this.userLocationCircle) {
      this.userLocationCircle.setMap(null);
      this.userLocationCircle = null;
    }
    if (this.userLocationEl) {
      this.userLocationEl.remove();
      this.userLocationEl = null;
    }
    for (const [, rec] of this.singles) {
      rec.marker.setMap(null);
      rec.el.remove();
    }
    for (const [, mk] of this.clusters) mk.setMap(null);
    for (const mk of this.stateLabelMarkers) mk.setMap(null);
    for (const p of this.histLines) p.setMap(null);
    for (const p of this.foreLines) p.setMap(null);
    for (const p of this.corridors) p.setMap(null);
    for (const p of this.etaDots) p.setMap(null);
    for (const p of this.trailMarkers) p.setMap(null);
    for (const p of this.trackLabels) p.setMap(null);
    this.singles.clear();
    this.clusters.clear();
    this.stateLabelMarkers = [];
    this.histLines = [];
    this.foreLines = [];
    this.corridors = [];
    this.etaDots = [];
    this.trailMarkers = [];
    this.trackLabels = [];
    this.animCoords.clear();
    if (this.map) {
      this.map.overlayMapTypes.clear();
      this.api?.event.clearInstanceListeners(this.map);
    }
    this.map = null;
    this.container.replaceChildren();
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function mercLat(ty: number): number {
  const t = Math.PI * (1 - 2 * ty);
  return (180 / Math.PI) * Math.atan(Math.sinh(t));
}

/** Web-Mercator world pixel coordinates at a given tile size. */
function worldPoint(lon: number, lat: number, world: number): { x: number; y: number } {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * world,
    y: (0.5 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / (4 * Math.PI)) * world,
  };
}

/** Area-weighted centroid of the largest ring of a Polygon/MultiPolygon. */
function ringCentroid(ring: number[][]): [number, number] | null {
  if (!ring.length) return null;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    return [xs.reduce((s, v) => s + v, 0) / xs.length, ys.reduce((s, v) => s + v, 0) / ys.length];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function centroidOf(geom: any): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    const polys: any[] = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    let best: [number, number] | null = null;
    let bestArea = -1;
    for (const poly of polys) {
      const outer = poly[0];
      if (!outer) continue;
      const c = ringCentroid(outer);
      if (!c) continue;
      let area = 0;
      for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
        area += outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1];
      }
      area = Math.abs(area * 0.5);
      if (area > bestArea) {
        bestArea = area;
        best = c;
      }
    }
    if (best) return best;
  }
  return null;
}
