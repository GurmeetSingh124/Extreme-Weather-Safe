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
    id: 'temp',
    label: 'Temperature',
    hint: 'Surface temperature anomaly relative to climatology',
    icon: (s) => <ThermometerSun size={s} className="text-amber-400" />,
  },
  {
    id: 'rain',
    label: 'Rainfall',
    hint: 'Precipitation rate and moisture anomaly',
    icon: (s) => <CloudRain size={s} className="text-sky-400" />,
  },
  {
    id: 'wind',
    label: 'Wind',
    hint: 'Wind speed vector field at 850 hPa',
    icon: (s) => <Wind size={s} className="text-teal-400" />,
  },
  {
    id: 'storm',
    label: 'Storm',
    hint: 'Cyclonic vorticity and severe convective footprint',
    icon: (s) => <CycloneSvg size={s} className="text-violet-400" />,
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
  const snap = useSnapshot();
  const focus = useStore((s) => s.focusCategory);
  const dataSourceMode = useStore((s) => s.dataSourceMode);
  const dataSourceMeta = useStore((s) => s.dataSourceMeta);
  const { active, index, list } = useMapFocus();
  const cat = focus ? CAT_META[focus] : null;
  /* With one event on the map, a "14 active anomalies" line would describe a
     view nobody is looking at, so the header names what is actually shown and
     keeps the totals only as a position in the set. */
  const subline = active
    ? focus
      ? `${cat?.short} · event ${index + 1} of ${list.length} · ${active.id}`
      : `All types · event ${index + 1} of ${list.length} · ${active.id}`
    : `${snap.stats.activeCount} active anomalies`;

  return (
    <div
      className="pointer-events-none flex flex-col gap-0.5 rounded-lg border border-edge/60 bg-ink-950/75 px-3 py-2 backdrop-blur-md"
      data-map-header
    >
      <div className="flex items-center gap-2">
        <h1 className="text-[12px] font-bold tracking-wider text-txt-hi">SIHTRACK</h1>
        <span className="text-[10px] text-txt-lo">/</span>
        <span className="text-[11px] font-medium text-txt-mid">Extreme Weather Intelligence</span>
        <span
          className={cn(
            'ml-2 mono inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
            dataSourceMode === 'REAL'
              ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              dataSourceMode === 'REAL' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            )}
            aria-hidden
          />
          {dataSourceMode === 'REAL' ? (dataSourceMeta.model || 'ECMWF IFS 0.25°') : 'DEMO DATA'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-txt-lo">
        <span>India Subcontinent</span>
        <span>•</span>
        <span className="text-brand-300 font-medium">{subline}</span>
        {active?.severity === 'EXTREME' && (
          <>
            <span>•</span>
            <span className="font-semibold text-rose-400">EXTREME</span>
          </>
        )}
        {!active && snap.stats.extremeCount > 0 && (
          <>
            <span>•</span>
            <span className="font-semibold text-rose-400">{snap.stats.extremeCount} extreme</span>
          </>
        )}
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
/* Map Controls — Zoom, Reset, Basemap, Fullscreen                    */
/* ================================================================== */
export const MapControls = memo(function MapControls({
  engine,
}: {
  engine: () => MapEngineLike | null;
}) {
  const basemap = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const userLocation = useStore((s) => s.userLocation);
  const setLocationModalOpen = useStore((s) => s.setLocationModalOpen);
  const [openBase, setOpenBase] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openBase) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenBase(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenBase(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openBase]);

  return (
    <div ref={ref} className="relative flex flex-col items-end gap-1.5">
      <div className="flex flex-col overflow-hidden rounded-lg border border-edge bg-ink-950/90 shadow-card backdrop-blur-md">
        <TipButton tip={TIPS.zoomIn} label="Zoom in" className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0" onClick={() => engine()?.zoomBy(1)}>
          <Plus size={15} />
        </TipButton>
        <div className="h-px bg-edge" />
        <TipButton tip={TIPS.zoomOut} label="Zoom out" className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0" onClick={() => engine()?.zoomBy(-1)}>
          <Minus size={15} />
        </TipButton>
        <div className="h-px bg-edge" />
        <TipButton tip={TIPS.resetView} label="Reset to India view" className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0" onClick={() => engine()?.reset()}>
          <RotateCcw size={14} />
        </TipButton>
        <div className="h-px bg-edge" />
        <TipButton tip={TIPS.fitEvents} label="Fit all visible events" className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0" onClick={() => engine()?.fitTo([])}>
          <Locate size={14} />
        </TipButton>
        <div className="h-px bg-edge" />
        <TipButton
          tip={userLocation ? 'Center on My Location' : 'Use My Location'}
          label="My Location"
          className={cn('btn !h-8 !w-8 !min-h-0 !rounded-none !border-0', userLocation && 'text-sky-400 bg-sky-500/10')}
          onClick={() => {
            if (userLocation) {
              engine()?.flyTo(userLocation.lon, userLocation.lat, 8.5);
            }
            setLocationModalOpen(true);
          }}
        >
          <MapPin size={14} className={userLocation ? 'text-sky-400' : 'text-txt-lo'} />
        </TipButton>
        <div className="h-px bg-edge" />
        <TipButton tip={TIPS.fullscreen} label="Toggle fullscreen" className="btn !h-8 !w-8 !min-h-0 !rounded-none !border-0" onClick={() => engine()?.toggleFullscreen()}>
          <Expand size={14} />
        </TipButton>
        <div className="h-px bg-edge" />
        <Tip text="Change map base style">
          <button
            aria-label="Map style"
            className={cn('btn !h-8 !w-8 !min-h-0 !rounded-none !border-0', openBase && 'bg-brand-500/20 text-brand-300')}
            onClick={() => setOpenBase((o) => !o)}
          >
            <Compass size={14} />
          </button>
        </Tip>
      </div>

      {openBase && (
        <div className="absolute right-10 top-24 w-[190px] rounded-xl border border-edge bg-ink-950/98 p-1.5 shadow-pop animate-fade-in backdrop-blur-md">
          <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wider text-txt-lo">Map Style</div>
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setBasemap(b.id);
                setOpenBase(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                basemap === b.id ? 'bg-brand-500/15 text-brand-300' : 'text-txt-mid hover:bg-ink-850'
              )}
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full border',
                  basemap === b.id ? 'border-brand-400 bg-brand-400' : 'border-edge bg-ink-800'
                )}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-[12px] font-medium leading-tight">{b.label}</span>
                <span className="block truncate text-[10px] text-txt-lo">{b.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

/* ================================================================== */
/* Single "Layers" Button + Clean Popover Panel                       */
/* ================================================================== */
export function LayersPanel({ engine }: { engine: () => MapEngineLike | null }) {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const setAllLayers = useStore((s) => s.setAllLayers);
  const open = useStore((s) => s.layersOpen);
  const setOpen = useStore((s) => s.setLayersOpen);
  const showTracks = useStore((s) => s.showTracks);
  const showCorridors = useStore((s) => s.showCorridors);
  const showEta = useStore((s) => s.showEta);
  const showStateLabels = useStore((s) => s.showStateLabels);
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
          className="absolute right-0 top-10 w-[270px] overflow-hidden rounded-xl border border-edge bg-ink-950/98 shadow-pop backdrop-blur-md animate-fade-in z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-edge px-3 py-2.5">
            <div className="flex items-center gap-2">
              <LayersIcon size={14} className="text-brand-400" />
              <h3 className="text-[11.5px] font-semibold uppercase tracking-wider text-txt-hi">
                Weather Layers
              </h3>
            </div>
            <button
              className="btn !h-6 !min-h-0 !w-6 !border-0 !bg-transparent !p-0 text-txt-lo hover:text-txt-hi"
              onClick={() => setOpen(false)}
              aria-label="Close layers"
            >
              <X size={13} />
            </button>
          </div>

          <div className="p-2 space-y-2">
            {/* Extreme Events (Always On) */}
            <div className="flex items-center justify-between rounded-lg bg-ink-900/70 px-2.5 py-1.5 border border-edge/60">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <div>
                  <span className="block text-[12px] font-semibold text-txt-hi">Extreme Events</span>
                  <span className="block text-[9.5px] text-txt-lo">All active hazard tracks</span>
                </div>
              </div>
              <span className="rounded bg-brand-500/15 border border-brand-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-brand-300 uppercase">
                Active
              </span>
            </div>

            {/* Clear All button */}
            {activeLayersCount > 0 && (
              <div className="flex justify-end px-1">
                <button
                  className="text-[10px] text-txt-lo hover:text-brand-300 transition-colors"
                  onClick={() => setAllLayers(false)}
                >
                  Clear weather overlays
                </button>
              </div>
            )}

            {/* Weather Overlay Options */}
            <ul className="space-y-0.5">
              {SCIENTIFIC_WEATHER_LAYERS.map((l) => {
                const on = !!layers[l.id];
                const meta = LAYERS[l.id];
                return (
                  <li key={l.id}>
                    <button
                      data-layer-id={l.id}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                        on ? 'bg-brand-500/12 border border-brand-500/30' : 'hover:bg-ink-850/80 border border-transparent'
                      )}
                      onClick={() => toggleLayer(l.id)}
                      aria-pressed={on}
                    >
                      <span className="shrink-0">{l.icon(14)}</span>
                      <div className="min-w-0 flex-1">
                        <span className={cn('block text-[12px] font-medium leading-tight', on ? 'text-txt-hi' : 'text-txt-mid')}>
                          {l.label}
                        </span>
                        {on && meta && (
                          <span
                            className="mt-1 block h-[2.5px] w-full rounded-full"
                            style={{ background: legendGradient(l.id as any) }}
                          />
                        )}
                      </div>
                      {on ? (
                        <Eye size={13} className="shrink-0 text-brand-400" />
                      ) : (
                        <EyeOff size={13} className="shrink-0 text-txt-lo/60" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Map Options */}
            <div className="border-t border-edge/60 pt-2">
              <span className="block px-1 text-[9.5px] font-semibold uppercase tracking-wider text-txt-lo mb-1">
                GIS Elements
              </span>
              <div className="flex flex-wrap gap-1">
                <ToggleBtn on={showStateLabels} label="State Names" onClick={() => toggle('showStateLabels')} />
                <ToggleBtn on={showTracks} label="Forecast Track" onClick={() => toggle('showTracks')} />
                <ToggleBtn on={showCorridors} label="Uncertainty Zone" onClick={() => toggle('showCorridors')} />
                <ToggleBtn on={showEta} label="Arrival Times" onClick={() => toggle('showEta')} />
              </div>
            </div>
          </div>
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
