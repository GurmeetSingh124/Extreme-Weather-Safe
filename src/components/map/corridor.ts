/**
 * Blurred uncertainty corridor, drawn on a canvas overlay.
 *
 * Only THIS canvas is blurred (CSS filter) — never the map itself.
 *
 * Adapted from the redesign: it used `getProjection().fromLatLngToDivPixel`,
 * which is not reliably populated on the current Maps JS API, so the caller
 * injects the engine's own Web-Mercator `projectPoint` instead. The canvas is
 * laid over the map div at inset 0, so div pixels are also container pixels and
 * no origin correction is needed.
 */
import type { LatLng } from './adapter';

export interface CorridorPoint extends LatLng {
  halfWidthKm: number;
}

export type ProjectFn = (lat: number, lng: number) => { x: number; y: number } | null;

export function createCorridor(map: google.maps.Map, project: ProjectFn, color = '#7c8cff') {
  let pts: CorridorPoint[] = [];
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  class Overlay extends google.maps.OverlayView {
    override onAdd() {
      canvas = document.createElement('canvas');
      canvas.className = 'sih-corridor';
      const pane = this.getPanes()?.overlayLayer;
      (pane ?? map.getDiv()).appendChild(canvas);
    }

    override onRemove() {
      canvas?.remove();
      canvas = null;
      ctx = null;
    }

    override draw() {
      if (!canvas) return;
      const div = map.getDiv();
      const w = div.clientWidth;
      const h = div.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.style.left = '0px';
      canvas.style.top = '0px';
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (!ctx) ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (pts.length < 2) return;

      const zoom = map.getZoom() ?? 5;
      const px: { x: number; y: number; r: number }[] = [];
      for (const p of pts) {
        const s = project(p.lat, p.lng);
        if (!s) continue;
        /* metres per pixel at this latitude and zoom, then the half-width */
        const mpp = (156543.03392 * Math.cos((p.lat * Math.PI) / 180)) / Math.pow(2, zoom);
        px.push({ x: s.x, y: s.y, r: (p.halfWidthKm * 1000) / Math.max(1e-6, mpp) });
      }
      if (px.length < 2) return;

      const L: [number, number][] = [];
      const R: [number, number][] = [];
      px.forEach((p, i) => {
        const a = px[Math.max(0, i - 1)];
        const b = px[Math.min(px.length - 1, i + 1)];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        L.push([p.x - (dy / len) * p.r, p.y + (dx / len) * p.r]);
        R.push([p.x + (dy / len) * p.r, p.y - (dx / len) * p.r]);
      });

      ctx.beginPath();
      L.forEach(([x, y], i) => (i ? ctx!.lineTo(x, y) : ctx!.moveTo(x, y)));
      R.reverse().forEach(([x, y]) => ctx!.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.fill();
    }
  }

  const overlay = new Overlay();
  overlay.setMap(map);

  return {
    /** Corridor half-width should grow with lead time, e.g. 25km at NOW -> 140km at +72h. */
    setPath(next: CorridorPoint[]) {
      pts = next;
      overlay.draw();
    },
    clear() {
      pts = [];
      overlay.draw();
    },
    redraw() {
      overlay.draw();
    },
    destroy() {
      overlay.setMap(null);
      pts = [];
    },
  };
}
