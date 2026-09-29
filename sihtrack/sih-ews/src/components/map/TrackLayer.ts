/**
 * Draws ONE tracked event: past line, fading trail, dashed forecast, blurred
 * corridor, glowing marker.
 *
 * Adapted from the redesign: the marker overlay was positioned with
 * `getProjection().fromLatLngToDivPixel`, which the current Maps JS API does
 * not reliably provide, so it takes the engine's `projectPoint` instead.
 */
import { FORECAST_COLOR, SEVERITY_COLOR } from '../../lib/design';
import type { LatLng, EventView } from './adapter';
import { MarkerMover, positionAt, samplePath, trailPoints } from './motion';
import { createCorridor, type ProjectFn } from './corridor';

/** Corridor half-width in km as a function of forecast lead time in hours.
 *  ~25 km at NOW, fanning out to ~140 km at the +72h horizon. */
const CORRIDOR_MAX_LEAD_H = 72;
function corridorHalfWidthKm(leadHours: number): number {
  const h = Math.max(0, leadHours);
  return 25 + 115 * Math.min(1, h / CORRIDOR_MAX_LEAD_H);
}

/**
 * The marker overlay is created by a factory rather than at module scope.
 *
 * `extends google.maps.OverlayView` is evaluated the moment this module is
 * imported, which happens long before the Maps loader resolves — declaring the
 * class up top would throw `google is not defined` on a cold start.
 */
function makeHtmlMarker(project: ProjectFn) {
  return class HtmlMarker extends google.maps.OverlayView {
    private el = document.createElement('div');
    private pos: LatLng;

    constructor(map: google.maps.Map, pos: LatLng, color: string, iconSvg: string) {
      super();
      this.pos = pos;
      this.el.className = 'sih-marker sel';
      this.el.style.setProperty('--c', color);
      this.el.style.position = 'absolute';
      this.el.innerHTML = iconSvg;
      this.setMap(map);
    }

    override onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.el);
    }

    override onRemove() {
      this.el.remove();
    }

    /** named `setPosition` rather than `set`, which MVCObject already defines */
    setPosition(p: LatLng) {
      this.pos = p;
      this.draw();
    }

    override draw() {
      const p = project(this.pos.lat, this.pos.lng);
      if (p) {
        this.el.style.left = `${p.x}px`;
        this.el.style.top = `${p.y}px`;
      }
    }
  };
}

const TRAIL_SEGMENTS = 8;

export class TrackLayer {
  private ev?: EventView;
  private past: google.maps.Polyline;
  private future: google.maps.Polyline;
  private trail: google.maps.Polyline[] = [];
  private corridor: ReturnType<typeof createCorridor>;
  private marker?: InstanceType<ReturnType<typeof makeHtmlMarker>>;
  private mover?: MarkerMover;
  /** resolved once the Maps API exists; `setEvent` runs long after construction */
  private MarkerCtor: ReturnType<typeof makeHtmlMarker>;

  constructor(
    private map: google.maps.Map,
    private project: ProjectFn,
    private iconFor: (ev: EventView) => string,
  ) {
    const HtmlMarker = makeHtmlMarker(project);
    this.MarkerCtor = HtmlMarker;
    this.past = new google.maps.Polyline({
      strokeColor: '#ef4444',
      strokeOpacity: 0.55,
      strokeWeight: 1.6,
      clickable: false,
      map,
    });
    this.future = new google.maps.Polyline({
      strokeOpacity: 0,
      clickable: false,
      map,
      icons: [
        {
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: FORECAST_COLOR, scale: 2 },
          offset: '0',
          repeat: '12px',
        },
      ],
    });
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      this.trail.push(new google.maps.Polyline({ map, clickable: false, strokeWeight: 3, strokeOpacity: 0 }));
    }
    this.corridor = createCorridor(map, project);
  }

  setEvent(ev: EventView | undefined) {
    this.mover?.destroy();
    this.marker?.setMap(null);
    this.marker = undefined;
    this.ev = ev;
    if (!ev || ev.track.length < 2) {
      this.clear();
      return;
    }
    const color = SEVERITY_COLOR[ev.severity];
    this.trail.forEach((p) => p.setOptions({ strokeColor: color }));
    this.marker = new this.MarkerCtor(this.map, ev.position, color, this.iconFor(ev));
    this.mover = new MarkerMover(ev.position, (p) => this.marker?.setPosition(p));

    /* The corridor is the forecast-uncertainty envelope: it is anchored to real
       lead time from NOW (t=0), NOT to the animation cursor, so it does not move
       as you scrub. Nearest edge is ~25 km wide and it fans out to ~140 km at the
       +72h horizon. Drawn once per event. */
    const tMax = ev.track[ev.track.length - 1].t;
    const stepH = 2;
    const band = samplePath(ev.track, 0, tMax, stepH);
    this.corridor.setPath(band.map((p, i) => ({ ...p, halfWidthKm: corridorHalfWidthKm(i * stepH) })));

    this.update(0, false);
  }

  /** Call whenever currentTime changes. Cheap: no React, no allocation beyond small arrays. */
  update(t: number, playing: boolean) {
    const ev = this.ev;
    if (!ev || !ev.track.length) return;
    const tMin = ev.track[0].t;
    const tMax = ev.track[ev.track.length - 1].t;
    const now = Math.min(Math.max(t, tMin), tMax);

    this.past.setPath(samplePath(ev.track, tMin, now, 2));
    this.future.setPath(samplePath(ev.track, now, tMax, 2));

    const pts = trailPoints(ev.track, now, TRAIL_SEGMENTS + 1);
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      this.trail[i].setPath([pts[i], pts[i + 1]]);
      this.trail[i].setOptions({ strokeOpacity: pts[i + 1].opacity });
    }
    this.mover?.moveTo(positionAt(ev.track, now), playing ? 120 : 350);
  }

  private clear() {
    this.past.setPath([]);
    this.future.setPath([]);
    this.trail.forEach((p) => p.setPath([]));
    this.corridor.clear();
  }

  destroy() {
    this.clear();
    this.mover?.destroy();
    this.marker?.setMap(null);
    this.marker = undefined;
    this.ev = undefined;
    this.past.setMap(null);
    this.future.setMap(null);
    this.trail.forEach((p) => p.setMap(null));
    this.corridor.destroy();
  }
}
