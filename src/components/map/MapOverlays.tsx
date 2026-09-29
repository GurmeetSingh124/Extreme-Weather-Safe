import { memo, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Droplets,
  Expand,
  Eye,
  EyeOff,
  Gauge,
  Layers as LayersIcon,
  Locate,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  ThermometerSun,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { LAYERS, legendGradient } from '../../data/fields';
import { CAT_META, SEV_META, cn } from '../../lib/utils';
import { SEV_ORDER_UI, SEV_UI, TIPS } from '../../lib/design';
import { useSnapshot, useStore, useMapFocus } from '../../store/useStore';
import { Tip, TipButton } from '../common/ui';
import { CycloneSvg } from '../common/WeatherIcons';
import type { Basemap, MapEngineLike } from './types';
import type { LayerId } from '../../types';

const BASEMAPS: { id: Basemap; label: string; hint: string }[] = [
  { id: 'dark', label: 'Dark Navy', hint: 'Default high-contrast meteorological style' },
  { id: 'light', label: 'Neutral Light', hint: 'Daylight clean boundaries' },
  { id: 'satellite', label: 'Satellite', hint: 'Satellite imagery' },
];

interface WeatherLayerDef {
  id: LayerId;
  label: string;
  hint: string;
  icon: (size: number) => JSX.Element;
}

const SCIENTIFIC_WEATHER_LAYERS: WeatherLayerDef[] = [
  {
    id: 'rain',
    label: 'Rainfall',
    hint: 'Precipitation rate and moisture anomaly',
    icon: (s) => <CloudRain size={s} className="text-sky-400" />,
  },
  {
    id: 'temp',
    label: 'Temperature',
    hint: 'Surface temperature anomaly relative to climatology',
    icon: (s) => <ThermometerSun size={s} className="text-amber-400" />,
  },
  {
    id: 'wind',
    label: 'Wind',
    hint: 'Wind speed vector field at 850 hPa',
    icon: (s) => <Wind size={s} className="text-teal-400" />,
  },
  {
    id: 'pressure',
    label: 'Pressure',
    hint: 'Mean sea level pressure anomalies',
    icon: (s) => <Gauge size={s} className="text-blue-400" />,
  },
  {
    id: 'humidity',
    label: 'Humidity',
    hint: 'Relative humidity and precipitable water',
    icon: (s) => <Droplets size={s} className="text-cyan-400" />,
  },
  {
    id: 'storm',
    label: 'Storms',
    hint: 'Cyclonic vorticity and severe convective footprint',
    icon: (s) => <CycloneSvg size={s} className="text-violet-400" />,
  },
  {
    id: 'risk',
    label: 'Composite Risk',
    hint: 'Severity × area × confidence multi-hazard index',
    icon: (s) => <Activity size={s} className="text-rose-400" />,
  },
];

/* ================================================================== */
/* Map Watermark Badge — top-left                                     */
/* ================================================================== */
export const MapHeaderCard = memo(function MapHeaderCard({
  status,
}: {
  status: { provider: string; offline: boolean; loading: boolean };
}) {
  const dataSourceMode = useStore((s) => s.dataSourceMode);

  return (
    <div
      className="pointer-events-none flex flex-col gap-1 rounded-lg border border-edge/70 bg-ink-950/85 px-3 py-2 backdrop-blur-md shadow-card"
      data-map-header
    >
      <div className="flex flex-col">
        <h1 className="text-[14px] font-bold tracking-tight text-white leading-none">SIHTRACK</h1>
        <span className="text-[10.5px] font-medium text-slate-400 mt-0.5">Extreme Weather Intelligence</span>
      </div>
      <div>
        <span
          className={cn(
            'mono inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider',
            dataSourceMode === 'REAL'
              ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              dataSourceMode === 'REAL' ? 'bg-emerald-400' : 'bg-amber-400'
            )}
            aria-hidden
          />
          {dataSourceMode === 'REAL' ? 'REAL DATA' : 'DEMO MODE'}
        </span>
      </div>
    </div>
  );
});

/* ================================================================== */
/* Legend — bottom-left                                               */
/* ================================================================== */
export const Legend = memo(function Legend() {
  const layers = useStore((s) => s.layers);
  const snap = useSnapshot();
  const [collapsed, setCollapsed] = useState(false);
  const activeLayer = SCIENTIFIC_WEATHER_LAYERS.find((l) => layers[l.id]);
  const counts = (s: string) => snap.events.filter((e) => e.severity === s).length;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-edge bg-ink-950/85 px-2.5 py-1.5 text-[11px] font-medium text-txt-mid shadow-card backdrop-blur-md transition-colors hover:text-txt-hi"
        aria-label="Expand legend"
      >
        <span>Legend</span>
        <ChevronUp size={13} />
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto w-[184px] rounded-xl border border-edge bg-ink-950/90 p-2.5 shadow-card backdrop-blur-md"
      data-legend
    >
      <div className="flex items-center justify-between pb-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-txt-lo">Map Legend</h3>
        <button
          onClick={() => setCollapsed(true)}
          className="text-txt-lo hover:text-txt-hi"
          aria-label="Collapse legend"
        >
          <ChevronDown size={13} />
        </button>
      </div>

      {/* Severity */}
      <ul className="space-y-1">
        {SEV_ORDER_UI.map((s) => {
          const u = SEV_UI[s];
          return (
            <li key={s} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: u.color }} aria-hidden />
              <span className="text-[11px] text-txt-hi">{u.label}</span>
              <span className="mono ml-auto text-[10px] text-txt-lo">{counts(s)}</span>
            </li>
          );
        })}
      </ul>

      {/* Track & Movement Symbology */}
      <div className="mt-2 border-t border-edge/60 pt-2">
        <h4 className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-txt-lo">Event Movement</h4>
        <ul className="space-y-1 text-[10.5px] text-txt-mid">
          <li className="flex items-center gap-2">
            <svg width="22" height="4" aria-hidden>
              <line x1="0" y1="2" x2="22" y2="2" stroke="#38bdf8" strokeWidth="2" strokeOpacity="0.75" />
            </svg>
            <span>Past path</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full border border-sky-400 bg-sky-400/30" aria-hidden />
            <span>Current position</span>
          </li>
          <li className="flex items-center gap-2">
            <svg width="22" height="4" aria-hidden>
              <line x1="0" y1="2" x2="22" y2="2" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            <span>Forecast path</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-5.5 shrink-0 rounded border border-indigo-400/40 bg-indigo-500/15" aria-hidden />
            <span>Uncertainty zone</span>
          </li>
        </ul>
      </div>

      {/* Active Raster Gradient */}
      {activeLayer && (
        <div className="mt-2 border-t border-edge/60 pt-2">
          <h4 className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-txt-lo">
            {LAYERS[activeLayer.id]?.label ?? activeLayer.label}
          </h4>
          <div
            className="h-1.5 w-full rounded-full border border-edge/60"
            style={{ background: legendGradient(activeLayer.id as any) }}
          />
          <div className="mt-1 flex justify-between text-[8.5px] text-txt-lo mono">
            {(LAYERS[activeLayer.id]?.ticks ?? []).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/* ================================================================== */
/* Map Controls — Zoom In (+), Zoom Out (−), Locate, Fullscreen       */
/* ================================================================== */
export const MapControls = memo(function MapControls({
  engine,
}: {
  engine: () => MapEngineLike | null;
}) {
  const userLocation = useStore((s) => s.userLocation);
  const setLocationModalOpen = useStore((s) => s.setLocationModalOpen);

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-edge bg-ink-950/90 shadow-card backdrop-blur-md">
      <TipButton
        tip={TIPS.zoomIn}
        label="Zoom in"
        className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0"
        onClick={() => engine()?.zoomBy(1)}
      >
        <Plus size={15} />
      </TipButton>
      <div className="w-px h-5 bg-edge" />
      <TipButton
        tip={TIPS.zoomOut}
        label="Zoom out"
        className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0"
        onClick={() => engine()?.zoomBy(-1)}
      >
        <Minus size={15} />
      </TipButton>
      <div className="w-px h-5 bg-edge" />
      <TipButton
        tip={userLocation ? 'Center on My Location' : 'Locate (My Location)'}
        label="Locate"
        className={cn('btn !h-8 !w-8 !min-h-0 !rounded-none !border-0', userLocation && 'text-sky-400 bg-sky-500/10')}
        onClick={() => {
          if (userLocation) {
            engine()?.flyTo(userLocation.lon, userLocation.lat, 8.5);
          } else {
            setLocationModalOpen(true);
          }
        }}
      >
        <Locate size={14} className={userLocation ? 'text-sky-400' : 'text-txt-mid'} />
      </TipButton>
      <div className="w-px h-5 bg-edge" />
      <TipButton
        tip={TIPS.fullscreen}
        label="Fullscreen"
        className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0"
        onClick={() => engine()?.toggleFullscreen()}
      >
        <Expand size={14} />
      </TipButton>
    </div>
  );
});

/* ================================================================== */
/* Single "Layers" Button + Clean Popover Panel (Section 12)          */
/* ================================================================== */
export function LayersPanel({ engine }: { engine: () => MapEngineLike | null }) {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const setAllLayers = useStore((s) => s.setAllLayers);
  const open = useStore((s) => s.layersOpen);
  const setOpen = useStore((s) => s.setLayersOpen);
  const showTracks = useStore((s) => s.showTracks);
  const toggle = useStore((s) => s.toggle);

  const activeLayersCount = SCIENTIFIC_WEATHER_LAYERS.filter((l) => layers[l.id]).length;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <Tip text="Weather Layers and GIS Overlays">
        <button
          data-layers-toggle
          className={cn(
            'btn flex items-center gap-1.5 !h-8 !px-2.5 text-[12px]',
            open && 'border-brand-500/60 bg-brand-500/20 text-brand-300'
          )}
          onClick={() => setOpen(!open)}
          aria-label="Weather layers"
          aria-expanded={open}
        >
          <LayersIcon size={14} className={open ? 'text-brand-300' : 'text-txt-mid'} />
          <span className="font-medium">Layers</span>
          {activeLayersCount > 0 && (
            <span className="mono rounded bg-brand-500 px-1 text-[9.5px] font-bold text-ink-950">
              {activeLayersCount}
            </span>
          )}
        </button>
      </Tip>

      {open && (
        <div
          data-layers-panel
          className="absolute right-0 top-10 w-[260px] overflow-hidden rounded-xl border border-edge bg-ink-950/98 shadow-pop backdrop-blur-md animate-fade-in z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-edge px-3 py-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-txt-hi">
              WEATHER LAYERS
            </h3>
            <button
              className="btn !h-6 !min-h-0 !w-6 !border-0 !bg-transparent !p-0 text-txt-lo hover:text-txt-hi"
              onClick={() => setOpen(false)}
              aria-label="Close layers"
            >
              <X size={13} />
            </button>
          </div>

          <div className="p-2 space-y-1">
            {/* Extreme Events */}
            <button
              onClick={() => toggle('showTracks')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                showTracks ? 'bg-brand-500/12 text-txt-hi' : 'text-txt-lo hover:bg-ink-850'
              )}
            >
              <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px]', showTracks ? 'border-brand-400 bg-brand-500 text-ink-950 font-bold' : 'border-edge bg-ink-900')}>
                {showTracks && '✓'}
              </span>
              <span className="text-[12px] font-medium flex-1">Extreme Events</span>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
            </button>

            {/* Weather Overlay Checkboxes (Section 12) */}
            {SCIENTIFIC_WEATHER_LAYERS.map((l) => {
              const on = !!layers[l.id];
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLayer(l.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                    on ? 'bg-brand-500/12 text-txt-hi' : 'text-txt-lo hover:bg-ink-850'
                  )}
                >
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px]', on ? 'border-brand-400 bg-brand-500 text-ink-950 font-bold' : 'border-edge bg-ink-900')}>
                    {on && '✓'}
                  </span>
                  <span className="shrink-0">{l.icon(13)}</span>
                  <span className="text-[12px] font-medium flex-1">{l.label}</span>
                </button>
              );
            })}
          </div>

          {activeLayersCount > 0 && (
            <div className="border-t border-edge/60 p-2 flex justify-end">
              <button
                className="text-[10.5px] text-txt-lo hover:text-brand-300 transition-colors"
                onClick={() => setAllLayers(false)}
              >
                Clear all overlays
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleBtn({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
        on
          ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
          : 'border-edge bg-ink-900 text-txt-lo hover:text-txt-mid'
      )}
    >
      {on && <Check size={10} className="inline mr-1 text-brand-300" />}
      {label}
    </button>
  );
}
