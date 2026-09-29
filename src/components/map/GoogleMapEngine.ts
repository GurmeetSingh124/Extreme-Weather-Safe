import { loadGoogleMaps, GoogleMapsError, type MapsApi } from '../../lib/googleMaps';
import { BOUNDS, rasterize, sampleVec, NX, NY, type Grid, type VecField } from '../../data/fields';
import { CAT_META, SEV_META, clamp } from '../../lib/utils';
import { INDIA_CENTER, INDIA_ZOOM } from '../../lib/design';
import { getWeatherIconSvgString } from '../common/WeatherIcons';
import { corridorRing } from '../../lib/geo';
import { STATE_RENAME } from './stateNames';
import type { LayerId, WeatherEvent } from '../../types';
import type { Basemap, BasemapStatus, EngineCallbacks, EventRenderOpts } from './types';

const TILE = 256;
const FIELD_TILE_MIN = 3;
const FIELD_TILE_MAX = 8;
const RASTER_LAYERS: LayerId[] = ['anomaly', 'risk', 'temp', 'rain', 'storm', 'wind', 'pressure', 'humidity'];
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

interface OverlayRec {
  type: any;
  canvas: HTMLCanvasElement;
  grid: Grid | null;
}

interface SingleMarkerRecord {
  el: HTMLElement;
  lat: number;
  lon: number;
}

interface ClusterRecord {
  el: HTMLElement;
  lat: number;
  lon: number;
  count: number;
  color: string;
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

  /* Map-native DOM Overlay View */
  private overlayView: any = null;
  private overlayPaneContainer: HTMLDivElement | null = null;

  /* Single markers and clusters attached to the overlay pane */
  private singles = new Map<string, SingleMarkerRecord>();
  private clusters = new Map<string, ClusterRecord>();

  /* Interpolated animation coordinates for smooth timeline scrub */
  private animCoords = new Map<string, { curLat: number; curLon: number; tgtLat: number; tgtLon: number }>();
  private animRafId = 0;

  /* State labels */
  private stateLabelMarkers: any[] = [];
  private stateNames: { name: string; lat: number; lon: number }[] = [];

  /* Track vector layers */
  private histLines: any[] = [];
  private foreLines: any[] = [];
  private corridors: any[] = [];
  private etaDots: any[] = [];
  private trailMarkers: any[] = [];
  private trackLabels: any[] = [];

  /* User location */
  private userLocationMarkerEl: HTMLElement | null = null;
  private userLocationCoords: { lat: number; lon: number } | null = null;
  private userLocationCircle: any = null;

  /* Raster overlays */
  private overlays = new Map<LayerId, OverlayRec>();
  private wind: { canvas: HTMLCanvasElement; field: VecField | null } | null = null;
  private pendingWind: VecField | null = null;
  private windParticles: { lon: number; lat: number; age: number; maxAge: number; speed: number; trail: { x: number; y: number }[] }[] = [];
  private windRafId = 0;
  private tileSliceCanvas: HTMLCanvasElement = document.createElement('canvas');
  private tileCache = new Map<string, string>();
  private corridorCanvas: HTMLCanvasElement | null = null;

  constructor(container: HTMLElement, cb: EngineCallbacks) {
    this.container = container;
    this.cb = cb;
    this.cb.onBaseStatus?.({ provider: 'loading', offline: false, loading: true });
    void this.boot();
  }

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

    this.initNativeOverlay();
    const cCanvas = document.createElement('canvas');
    cCanvas.className = 'sih-corridor-canvas';
    this.container.appendChild(cCanvas);
    this.corridorCanvas = cCanvas;

    this.attachListeners();
    this.buildOverlays();
    void this.loadStates();

    const onTiles = this.map.addListener('tilesloaded', () => {
      onTiles.remove();
      this.markLoaded();
    });
    this.loadTimers.push(window.setTimeout(() => this.markLoaded(), 5000));

    this.ready = true;
    this.cb.onReady?.();
    if (this.pendingWind) {
      const p = this.pendingWind;
      this.pendingWind = null;
      this.setWindField(p);
    }
  }

  /**
   * Initializes a true Google Maps OverlayView.
   * Elements inside this pane move with Google Maps' internal GPU transform
   * during pans, drags, and zooms. Markers stay 100% attached to lat/lng.
   */
  private initNativeOverlay() {
    const api = this.api as any;
    if (!api || !this.map) return;

    const engine = this;
    const container = document.createElement('div');
    container.className = 'sih-native-markers-overlay';
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '0';
    container.style.height = '0';
    container.style.overflow = 'visible';
    container.style.pointerEvents = 'none';

    this.overlayPaneContainer = container;

    class NativeOverlay extends api.OverlayView {
      onAdd() {
        const pane = this.getPanes()?.overlayMouseTarget;
        if (pane) {
          pane.appendChild(container);
        }
      }

      onRemove() {
        container.remove();
      }

      draw() {
        engine.repositionAllMarkers();
      }
    }

    const overlay = new NativeOverlay();
    overlay.setMap(this.map);
    this.overlayView = overlay;
  }

  /**
   * Translates geographic coordinates to pixel coordinates within the overlay pane.
   */
  private latLngToDivPixel(lat: number, lon: number): { x: number; y: number } | null {
    if (!this.overlayView) return null;
    const proj = this.overlayView.getProjection();
    if (!proj) return null;
    try {
      const pt = proj.fromLatLngToDivPixel(new this.api!.LatLng(lat, lon));
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        return { x: pt.x, y: pt.y };
      }
    } catch {
      return null;
    }
    return null;
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
    // Clicking anywhere on map clears event selection
    m.addListener('click', () => this.cb.onSelect(null));

    m.addListener('idle', () => {
      this.repositionAllMarkers();
      this.renderStateLabels();
      this.drawWind();
      const c = m.getCenter();
      if (c && this.cb.onMove) this.cb.onMove(c.lng(), c.lat(), m.getZoom() ?? 0, 0);
    });

    m.addListener('bounds_changed', () => {
      this.repositionAllMarkers();
    });

    m.addListener('zoom_changed', () => {
      this.renderMarkers();
      this.renderStateLabels();
    });
  }

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
  /* Weather field raster overlays                                      */
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
      canvas.width = 512;
      canvas.height = 512;
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

  private tileUrl(id: LayerId, canvas: HTMLCanvasElement, coord: any, zoom: number): string {
    const rec = this.overlays.get(id);
    if (!rec || !rec.grid) return BLANK;
    if (zoom < FIELD_TILE_MIN || zoom > FIELD_TILE_MAX) return BLANK;

    const n = Math.pow(2, zoom);
    if (coord.x < 0 || coord.y < 0 || coord.x >= n || coord.y >= n) return BLANK;

    const cacheKey = `${id}_${zoom}_${coord.x}_${coord.y}`;
    const hit = this.tileCache.get(cacheKey);
    if (hit) return hit;

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
    const out = this.tileSliceCanvas;
    out.width = TILE;
    out.height = TILE;
    const ctx = out.getContext('2d')!;
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(canvas, sx, sy, w, h, 0, 0, TILE, TILE);
    const url = out.toDataURL('image/png');
    this.tileCache.set(cacheKey, url);
    return url;
  }

  setField(layer: LayerId, grid: Grid) {
    if (!this.ready || !this.overlays.has(layer)) return;
    const rec = this.overlays.get(layer)!;
    rec.grid = grid;
    for (const k of this.tileCache.keys()) {
      if (k.startsWith(layer)) this.tileCache.delete(k);
    }
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
    m.overlayMapTypes.clear();
    for (const id of RASTER_LAYERS) {
      const rec = this.overlays.get(id);
      if (!rec || !rec.grid || !this.layerVis[id]) continue;
      rec.type.setOpacity(id === 'risk' ? 0.6 : id === 'anomaly' ? 0.55 : id === 'storm' ? 0.42 : 0.5);
      m.overlayMapTypes.push(rec.type);
    }
    if (this.wind) {
      this.wind.canvas.style.opacity = this.layerVis.wind ? '1' : '0';
      if (this.layerVis.wind) {
        this.startWindLoop();
      } else {
        this.stopWindLoop();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Air Flow Streamline Simulation Engine                              */
  /* ------------------------------------------------------------------ */
  setWindField(vec: VecField) {
    if (this.destroyed) return;
    if (!this.map) {
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
    if (this.layerVis.wind) this.startWindLoop();
  }

  private initWindParticles() {
    this.windParticles = [];
    const count = 360;
    for (let i = 0; i < count; i++) {
      this.windParticles.push(this.spawnWindParticle(true));
    }
  }

  private spawnWindParticle(randomAge = false) {
    const lon = BOUNDS.lon0 + Math.random() * (BOUNDS.lon1 - BOUNDS.lon0);
    const lat = BOUNDS.lat0 + Math.random() * (BOUNDS.lat1 - BOUNDS.lat0);
    const maxAge = 40 + Math.floor(Math.random() * 45);
    const age = randomAge ? Math.floor(Math.random() * maxAge) : 0;
    return { lon, lat, age, maxAge, speed: 0, trail: [] as { x: number; y: number }[] };
  }

  private startWindLoop() {
    if (this.windRafId) return;
    if (!this.windParticles.length) this.initWindParticles();

    const loop = () => {
      if (this.destroyed) return;
      if (!this.layerVis.wind || !this.wind?.field || !this.map) {
        this.windRafId = 0;
        return;
      }
      this.stepWindParticles();
      this.windRafId = requestAnimationFrame(loop);
    };
    this.windRafId = requestAnimationFrame(loop);
  }

  private stopWindLoop() {
    if (this.windRafId) {
      cancelAnimationFrame(this.windRafId);
      this.windRafId = 0;
    }
    if (this.wind?.canvas) {
      const ctx = this.wind.canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, this.wind.canvas.width, this.wind.canvas.height);
    }
  }

  private drawWind() {
    if (this.layerVis.wind && this.wind?.field) {
      this.startWindLoop();
    } else {
      this.stopWindLoop();
    }
  }

  private stepWindParticles() {
    const w = this.wind;
    const m = this.map;
    if (!w || !m || !w.field) return;

    const rect = m.getDiv().getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (w.canvas.width !== targetW || w.canvas.height !== targetH) {
      w.canvas.width = targetW;
      w.canvas.height = targetH;
    }

    const ctx = w.canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const b = m.getBounds();
    const sw = b?.getSouthWest();
    const ne = b?.getNorthEast();
    const minLon = sw ? sw.lng() - 1 : BOUNDS.lon0;
    const maxLon = ne ? ne.lng() + 1 : BOUNDS.lon1;
    const minLat = sw ? sw.lat() - 1 : BOUNDS.lat0;
    const maxLat = ne ? ne.lat() + 1 : BOUNDS.lat1;

    for (const p of this.windParticles) {
      p.age++;
      if (p.age > p.maxAge || p.lon < minLon || p.lon > maxLon || p.lat < minLat || p.lat > maxLat) {
        Object.assign(p, this.spawnWindParticle(false));
        continue;
      }

      const [u, v] = sampleVec(w.field, p.lon, p.lat);
      const sp = Math.hypot(u, v);
      p.speed = sp;

      if (sp < 0.8) {
        p.age += 2;
        continue;
      }

      const cosLat = Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      const stepFactor = 0.0034;
      p.lon += (u * stepFactor) / cosLat;
      p.lat += v * stepFactor;

      const pt = this.latLngToDivPixel(p.lat, p.lon);
      if (!pt) {
        p.trail = [];
        continue;
      }

      p.trail.push({ x: pt.x, y: pt.y });
      if (p.trail.length > 7) p.trail.shift();
      if (p.trail.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }

      const alpha = Math.sin((p.age / p.maxAge) * Math.PI) * 0.85;
      let strokeColor: string;
      if (sp > 45) {
        strokeColor = `rgba(244, 63, 94, ${alpha.toFixed(2)})`;
      } else if (sp > 25) {
        strokeColor = `rgba(129, 140, 248, ${alpha.toFixed(2)})`;
      } else {
        strokeColor = `rgba(56, 189, 248, ${(alpha * 0.82).toFixed(2)})`;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.min(2.4, 0.9 + (sp / 50) * 1.2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Events, Markers, Clusters & Tracks                                 */
  /* ------------------------------------------------------------------ */
  updateEvents(events: WeatherEvent[], o: EventRenderOpts) {
    this.evEvents = events;
    this.evOpts = o;
    if (!this.ready || !this.map) return;
    this.drawVectors(events, o);
    this.renderMarkers();
    this.renderStateLabels();
  }

  setTrackedEvent(ev: WeatherEvent | null, cursorHour: number, playing: boolean) {
    if (!this.ready || !this.map || !this.evOpts) return;
    this.drawVectors(this.evEvents, { ...this.evOpts, selectedId: ev?.id ?? null });
  }

  /**
   * Repositions all marker DOM elements inside the overlay pane.
   * Called automatically by Google Maps' OverlayView whenever the map draws.
   */
  private repositionAllMarkers() {
    if (!this.overlayPaneContainer) return;

    // Reposition single event markers
    for (const [id, rec] of this.singles) {
      const coord = this.animCoords.get(id);
      const lat = coord ? coord.curLat : rec.lat;
      const lon = coord ? coord.curLon : rec.lon;
      const p = this.latLngToDivPixel(lat, lon);
      if (p) {
        rec.el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      }
    }

    // Reposition clusters
    for (const [, rec] of this.clusters) {
      const p = this.latLngToDivPixel(rec.lat, rec.lon);
      if (p) {
        rec.el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      }
    }

    // Reposition user location marker
    if (this.userLocationMarkerEl && this.userLocationCoords) {
      const p = this.latLngToDivPixel(this.userLocationCoords.lat, this.userLocationCoords.lon);
      if (p) {
        this.userLocationMarkerEl.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      }
    }

    this.drawFlowingCorridors();
  }

  /**
   * Continuous smooth interpolation loop for markers when timeline changes.
   * Runs only while moving toward target coordinates.
   */
  private startAnimLoop() {
    if (this.animRafId) return;

    const tick = () => {
      if (this.destroyed) return;
      let anyMoving = false;

      for (const [id, c] of this.animCoords) {
        const dLat = c.tgtLat - c.curLat;
        const dLon = c.tgtLon - c.curLon;
        if (Math.abs(dLat) > 0.0001 || Math.abs(dLon) > 0.0001) {
          c.curLat += dLat * 0.22;
          c.curLon += dLon * 0.22;
          anyMoving = true;

          const rec = this.singles.get(id);
          if (rec) {
            const p = this.latLngToDivPixel(c.curLat, c.curLon);
            if (p) {
              rec.el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
            }
          }
        } else {
          c.curLat = c.tgtLat;
          c.curLon = c.tgtLon;
        }
      }

      if (anyMoving) {
        this.drawFlowingCorridors();
        this.animRafId = requestAnimationFrame(tick);
      } else {
        this.drawFlowingCorridors();
        this.animRafId = 0;
      }
    };

    this.animRafId = requestAnimationFrame(tick);
  }

  private renderMarkers() {
    const m = this.map;
    const o = this.evOpts;
    const container = this.overlayPaneContainer;
    if (!m || !o || !container) return;

    // Filter events
    const shown = this.evEvents.filter((e) => !o.hiddenIds.has(e.id));
    const zoom = m.getZoom() ?? INDIA_ZOOM;
    const clustering = (o.cluster ?? true) && zoom < 7.2;

    const singles: WeatherEvent[] = [];
    const groups: { px: number; py: number; lat: number; lon: number; items: WeatherEvent[] }[] = [];

    if (clustering) {
      const pad = 46;
      for (const e of shown) {
        const p = this.latLngToDivPixel(e.lat, e.lon);
        if (!p) {
          singles.push(e);
          continue;
        }
        const hit = groups.find((g) => Math.hypot(g.px - p.x, g.py - p.y) < pad);
        if (hit) {
          hit.items.push(e);
          hit.lat = (hit.lat * (hit.items.length - 1) + e.lat) / hit.items.length;
          hit.lon = (hit.lon * (hit.items.length - 1) + e.lon) / hit.items.length;
          hit.px = (hit.px * (hit.items.length - 1) + p.x) / hit.items.length;
          hit.py = (hit.py * (hit.items.length - 1) + p.y) / hit.items.length;
        } else {
          groups.push({ px: p.x, py: p.y, lat: e.lat, lon: e.lon, items: [e] });
        }
      }
    } else {
      singles.push(...shown);
    }

    // Process clusters
    const activeClusterKeys = new Set<string>();
    for (const g of groups) {
      if (g.items.length < 2) {
        singles.push(g.items[0]);
        continue;
      }
      const key = g.items.map((e) => e.id).sort().join('|');
      activeClusterKeys.add(key);

      const hasExtreme = g.items.some((e) => e.severity === 'EXTREME');
      const hasHigh = g.items.some((e) => e.severity === 'HIGH');
      const color = hasExtreme ? '#ef4444' : hasHigh ? '#f97316' : '#38bdf8';

      let rec = this.clusters.get(key);
      if (!rec) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'cmarker';
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = '0';
        el.style.pointerEvents = 'auto';
        el.style.width = '34px';
        el.style.height = '34px';
        el.style.borderRadius = '9999px';
        el.style.background = '#0a101d';
        el.style.border = `2.2px solid ${color}`;
        el.style.boxShadow = `0 0 12px ${color}55, 0 3px 8px rgba(0,0,0,0.6)`;
        el.style.color = '#ffffff';
        el.style.fontSize = '12px';
        el.style.fontWeight = '700';
        el.style.cursor = 'pointer';
        el.style.display = 'grid';
        el.style.placeItems = 'center';
        el.innerHTML = `<span>${g.items.length}</span>`;

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          m.setCenter(new this.api!.LatLng(g.lat, g.lon));
          m.setZoom(Math.min(10, (m.getZoom() ?? 5) + 2.2));
        });

        container.appendChild(el);
        rec = { el, lat: g.lat, lon: g.lon, count: g.items.length, color };
        this.clusters.set(key, rec);
      } else {
        rec.lat = g.lat;
        rec.lon = g.lon;
        rec.count = g.items.length;
        rec.el.querySelector('span')!.textContent = String(g.items.length);
      }

      const p = this.latLngToDivPixel(rec.lat, rec.lon);
      if (p) {
        rec.el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      }
    }

    // Clean stale clusters
    for (const [key, rec] of this.clusters) {
      if (!activeClusterKeys.has(key)) {
        rec.el.remove();
        this.clusters.delete(key);
      }
    }

    // Process single markers
    const activeSingleIds = new Set(singles.map((e) => e.id));
    for (const [id, rec] of this.singles) {
      if (!activeSingleIds.has(id)) {
        rec.el.remove();
        this.singles.delete(id);
        this.animCoords.delete(id);
      }
    }

    for (const e of singles) {
      const cat = CAT_META[e.category];
      const sev = SEV_META[e.severity];
      const sel = e.id === o.selectedId;

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
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = '0';
        el.style.pointerEvents = 'auto';
        el.innerHTML = `<span class="ev-blur"></span><span class="ev-pulse"></span><span class="ev-core"></span><span class="ev-tip hidden"></span>`;

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

        container.appendChild(el);
        rec = { el, lat: e.lat, lon: e.lon };
        this.singles.set(e.id, rec);
      } else {
        rec.lat = e.lat;
        rec.lon = e.lon;
      }

      rec.el.style.setProperty('--mc', cat.color);
      rec.el.style.setProperty('--ms', sev.color);
      rec.el.style.setProperty('--msz', `${clamp(26 + e.intensity * 0.08, 26, 36)}px`);
      rec.el.classList.toggle('ev-sel', sel);
      rec.el.classList.toggle('ev-hot', !sel && e.severity === 'EXTREME');

      const core = rec.el.querySelector('.ev-core') as HTMLElement;
      if (core && core.dataset.cat !== e.category) {
        core.dataset.cat = e.category;
        core.innerHTML = getWeatherIconSvgString(e.category, 14, cat.color);
      }

      rec.el.setAttribute(
        'aria-label',
        `${e.categoryLabel} in ${e.anchor}, severity ${e.severity}, intensity ${Math.round(e.intensity)} percent`
      );

      const tip = rec.el.querySelector('.ev-tip') as HTMLElement;
      if (tip) {
        tip.innerHTML = `
          <div class="ev-tip-name">${e.categoryLabel}</div>
          <div class="ev-tip-row"><span>${e.anchor}</span></div>
          <div class="ev-tip-row"><span style="color:${sev.color};font-weight:600">${sev.dot} ${e.severity}</span></div>
          <div class="ev-tip-row"><span>Intensity</span><span class="mono ml-auto">${Math.round(e.intensity)}%</span></div>
          <div class="ev-tip-row"><span>Confidence</span><span class="mono ml-auto">${Math.round(e.confidence)}%</span></div>`;
      }

      const p = this.latLngToDivPixel(coord.curLat, coord.curLon);
      if (p) {
        rec.el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      }
    }

    this.startAnimLoop();
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
      const wantTrack = o.showTracks && (isSel || e.severity === 'EXTREME');

      /* 1. Historical path: Thin solid line with low opacity */
      if (wantTrack && e.history.length > 1) {
        const line = new api.Polyline({
          path: e.history.map((k) => new api.LatLng(k.lat, k.lon)),
          geodesic: true,
          strokeColor: '#38bdf8',
          strokeOpacity: isSel ? 0.8 : 0.4,
          strokeWeight: isSel ? 2.6 : 1.8,
          clickable: false,
          zIndex: isSel ? 40 : 20,
        });
        line.setMap(m);
        this.histLines.push(line);

        /* Trail: subtle fading dots behind current position */
        const recentPts = e.history.slice(-6, -1);
        recentPts.forEach((pt, idx) => {
          const ratio = (idx + 1) / Math.max(1, recentPts.length);
          const alpha = 0.15 + ratio * 0.55;
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

        /* PAST label */
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

      /* 2. Forecast path: Smooth dashed line with arrows */
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
                strokeOpacity: isSel ? 0.95 : 0.65,
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

        /* FORECAST label */
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

      /* 3. Uncertainty: Soft translucent corridor polygon */
      if (o.showCorridors && (isSel || e.severity === 'EXTREME') && e.predicted.length > 2) {
        const ring = corridorRing([
          { lat: e.lat, lon: e.lon, r: e.uncertaintyKm * 0.35 },
          ...e.predicted
            .filter((_, i) => i % 2 === 0)
            .map((k) => ({
              lat: k.lat,
              lon: k.lon,
              r: e.uncertaintyKm * (0.35 + 0.65 * clamp((k.t - o.t) / Math.max(1, e.skilledUntilH * 1.3), 0, 1.4)),
            })),
        ]);
        if (ring.length > 3) {
          const poly = new api.Polygon({
            paths: ring.map(([lon, lat]) => new api.LatLng(lat, lon)),
            strokeColor: '#818cf8',
            strokeOpacity: 0,
            strokeWeight: 0,
            fillColor: '#818cf8',
            fillOpacity: isSel ? 0.07 : 0.03,
            clickable: false,
            zIndex: isSel ? 30 : 10,
          });
          poly.setMap(m);
          this.corridors.push(poly);
        }
      }

      /* NOW label tag */
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

      /* ETA badges */
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
    this.drawFlowingCorridors();
  }

  /**
   * Renders the flowing uncertainty corridor shape onto the blurred canvas layer.
   * Creates an organic, glowing, diffused meteorological plume extending along the forecast track.
   */
  private drawFlowingCorridors() {
    const canvas = this.corridorCanvas;
    const m = this.map;
    const o = this.evOpts;
    if (!canvas || !m || !this.api || !o) return;

    const rect = m.getDiv().getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!o.showCorridors) return;

    const zoom = m.getZoom() ?? 5;
    for (const e of this.evEvents) {
      if (o.hiddenIds.has(e.id)) continue;
      const isSel = e.id === o.selectedId;
      const want = isSel || e.severity === 'EXTREME';
      if (!want || e.predicted.length < 2) continue;

      const cat = CAT_META[e.category] || { color: '#818cf8' };
      const sev = SEV_META[e.severity] || { color: '#ef4444' };
      const baseColor = isSel ? cat.color : sev.color;

      const corridorPts = [
        { lat: e.lat, lon: e.lon, r: e.uncertaintyKm * 0.4 },
        ...e.predicted.map((k) => ({
          lat: k.lat,
          lon: k.lon,
          r: e.uncertaintyKm * (0.4 + 0.65 * clamp((k.t - o.t) / Math.max(1, e.skilledUntilH * 1.3), 0, 1.4)),
        })),
      ];

      const screenPts: { x: number; y: number; r: number }[] = [];
      for (const pt of corridorPts) {
        const p = this.latLngToDivPixel(pt.lat, pt.lon);
        if (!p) continue;
        const mpp = (156543.03392 * Math.cos((pt.lat * Math.PI) / 180)) / Math.pow(2, zoom);
        const rPx = Math.max(8, (pt.r * 1000) / Math.max(1e-6, mpp));
        screenPts.push({ x: p.x, y: p.y, r: rPx });
      }

      if (screenPts.length < 2) continue;

      const left: [number, number][] = [];
      const right: [number, number][] = [];
      for (let i = 0; i < screenPts.length; i++) {
        const a = screenPts[Math.max(0, i - 1)];
        const b = screenPts[Math.min(screenPts.length - 1, i + 1)];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const cur = screenPts[i];
        left.push([cur.x + nx * cur.r, cur.y + ny * cur.r]);
        right.push([cur.x - nx * cur.r, cur.y - ny * cur.r]);
      }

      // Outer flowing blurred envelope
      ctx.save();
      ctx.beginPath();
      left.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      right.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();

      const head = screenPts[0];
      const tail = screenPts[screenPts.length - 1];
      const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(0.35, isSel ? '#818cf8' : baseColor);
      grad.addColorStop(0.75, '#6366f1');
      grad.addColorStop(1, 'rgba(99, 102, 241, 0.05)');

      ctx.fillStyle = grad;
      ctx.globalAlpha = isSel ? 0.6 : 0.38;
      ctx.fill();

      // Flowing luminous spine stream
      ctx.beginPath();
      screenPts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isSel ? 10 : 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = isSel ? 0.5 : 0.28;
      ctx.stroke();

      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  /* State Labels                                                       */
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
          // continue
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
      // ignore
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
      const p = this.latLngToDivPixel(s.lat, s.lon);
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
  /* Camera & Controls                                                  */
  /* ------------------------------------------------------------------ */
  flyTo(lon: number, lat: number, zoom?: number, duration = 800) {
    const m = this.map;
    const api = this.api;
    if (!m || !api) return;
    const target = new api.LatLng(lat, lon);
    if (duration <= 0) {
      m.setCenter(target);
      if (zoom != null) m.setZoom(zoom);
      return;
    }

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
    this.flyTo(e.lon, e.lat, Math.max(6.5, this.map?.getZoom() ?? 6.5));
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
    this.flyTo(INDIA_CENTER[0], INDIA_CENTER[1], INDIA_ZOOM, 750);
  }

  zoomBy(delta: number) {
    const m = this.map;
    if (!m) return;
    m.setZoom(clamp((m.getZoom() ?? INDIA_ZOOM) + delta, 3, 12));
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().then(() => setTimeout(() => this.resize(), 200)).catch(() => {});
    } else {
      this.container.requestFullscreen?.().then(() => setTimeout(() => this.resize(), 200)).catch(() => {});
    }
  }

  resize() {
    const m = this.map;
    if (!m || !this.api) return;
    const c = m.getCenter();
    const z = m.getZoom();
    try {
      this.api.event.trigger(m, 'resize');
    } catch {
      // ignore
    }
    if (c) m.setCenter(c);
    if (z != null) m.setZoom(z);
    this.repositionAllMarkers();
    this.renderStateLabels();
    this.drawWind();

    // Secondary pass after CSS layout transition settles
    requestAnimationFrame(() => {
      this.repositionAllMarkers();
      this.renderStateLabels();
      this.drawWind();
    });
  }

  /* ------------------------------------------------------------------ */
  /* User Location                                                      */
  /* ------------------------------------------------------------------ */
  setUserLocation(loc: { lat: number; lon: number; accuracy?: number } | null) {
    if (!this.map || !this.api || !this.overlayPaneContainer) return;
    if (!loc) {
      if (this.userLocationMarkerEl) {
        this.userLocationMarkerEl.remove();
        this.userLocationMarkerEl = null;
      }
      this.userLocationCoords = null;
      if (this.userLocationCircle) {
        this.userLocationCircle.setMap(null);
        this.userLocationCircle = null;
      }
      return;
    }

    this.userLocationCoords = { lat: loc.lat, lon: loc.lon };
    const pos = new this.api.LatLng(loc.lat, loc.lon);

    if (!this.userLocationMarkerEl) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.pointerEvents = 'none';
      el.innerHTML = `
        <span class="user-loc-pulse"></span>
        <span class="user-loc-core"></span>
        <span class="user-loc-label">Your Location</span>
      `;
      this.overlayPaneContainer.appendChild(el);
      this.userLocationMarkerEl = el;
    }

    const p = this.latLngToDivPixel(loc.lat, loc.lon);
    if (p && this.userLocationMarkerEl) {
      this.userLocationMarkerEl.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -50%)`;
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
    if (this.animRafId) {
      cancelAnimationFrame(this.animRafId);
      this.animRafId = 0;
    }

    if (this.overlayView) {
      this.overlayView.setMap(null);
      this.overlayView = null;
    }
    if (this.overlayPaneContainer) {
      this.overlayPaneContainer.remove();
      this.overlayPaneContainer = null;
    }

    if (this.userLocationCircle) {
      this.userLocationCircle.setMap(null);
      this.userLocationCircle = null;
    }

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

function mercLat(ty: number): number {
  const t = Math.PI * (1 - 2 * ty);
  return (180 / Math.PI) * Math.atan(Math.sinh(t));
}

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
