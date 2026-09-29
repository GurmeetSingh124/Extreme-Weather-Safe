import {
  BrainCircuit,
  CloudRain,
  Compass,
  Gauge,
  MapPin,
  Route,
  ShieldCheck,
  ThermometerSun,
  TriangleAlert,
  Wind,
  Droplets,
  Clock,
  ChevronRight,
  BarChart3,
  X,
} from 'lucide-react';
import { WeatherIcon } from '../common/WeatherIcon';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/design';
import type { EventView } from './adapter';
import { useStore } from '../../store/useStore';

interface Props {
  event: EventView;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onTrack: () => void;
  onClose: () => void;
  nowHour?: number;
}

export function EventDrawer({
  event: e,
  index,
  total,
  onPrev,
  onNext,
  onTrack,
  onClose,
}: Props) {
  const setView = useStore((s) => s.setView);
  const c = SEVERITY_COLOR[e.severity];
  const hours = (h: number) => `+${Math.abs(Math.round(h))}h`;

  // Meteorological condition values
  const cat = e.source.category;
  const tempAnomaly = cat === 'heat' ? '+6.8°C' : cat === 'cold' ? '-5.4°C' : '+1.2°C';
  const rainAnomaly = cat === 'rainfall' || cat === 'flood' ? '+168 mm/day' : cat === 'cyclone' ? '+142 mm/day' : cat === 'drought' ? '-45 mm/day' : '+4.2 mm/day';
  const windVal = cat === 'wind' || cat === 'cyclone' ? `${Math.round(e.speedKmh * 3.2)} km/h` : `${Math.round(e.speedKmh * 1.6)} km/h`;
  const presVal = cat === 'cyclone' ? '968 hPa' : cat === 'pressure' ? '988 hPa' : '1006 hPa';
  const humVal = cat === 'rainfall' || cat === 'flood' ? '94%' : cat === 'heat' || cat === 'drought' ? '38%' : '72%';

  return (
    <aside
      className="sih-drawer sih-glass"
      aria-label={`${e.title} complete event intelligence`}
      style={{
        width: '380px',
        maxHeight: 'calc(100vh - 140px)',
        zIndex: 35,
      }}
    >
      {/* Header */}
      <header className="flex items-start justify-between border-b border-white/10 pb-3">
        <div className="flex items-start gap-3">
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              flexShrink: 0,
              border: `2px solid ${c}`,
              color: c,
              display: 'grid',
              placeItems: 'center',
              background: '#0d1322',
            }}
          >
            <WeatherIcon type={e.source.category} size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-white">{e.source.categoryLabel}</span>
              <span className="mono rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {e.id}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-0.5 text-[12px] text-slate-400">
              <MapPin size={12} className="text-sky-400" />
              <span className="font-medium text-slate-200">{e.region}</span>
              <span>·</span>
              <span>
                {e.position.lat.toFixed(2)}°N, {e.position.lng.toFixed(2)}°E
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                color: c,
                background: `color-mix(in srgb, ${c} 16%, transparent)`,
                border: `1px solid color-mix(in srgb, ${c} 35%, transparent)`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
              {SEVERITY_LABEL[e.severity]}
            </span>
            <button
              onClick={onClose}
              className="btn !h-6 !w-6 !min-h-0 !p-0 text-slate-400 hover:text-white"
              aria-label="Close drawer"
            >
              <X size={14} />
            </button>
          </div>
          {total > 1 && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-1">
              <button onClick={onPrev} className="px-1 hover:text-white" aria-label="Previous event">
                ‹
              </button>
              <span className="mono text-[10px]">
                {index + 1}/{total}
              </span>
              <button onClick={onNext} className="px-1 hover:text-white" aria-label="Next event">
                ›
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CURRENT STATUS */}
      <section className="space-y-1.5">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
          Current Status
        </h3>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
            <span className="block text-[10px] text-slate-400">Intensity</span>
            <b className="text-[16px] font-bold" style={{ color: c }}>
              {e.intensity}%
            </b>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
            <span className="block text-[10px] text-slate-400">Movement</span>
            <b className="text-[14px] font-semibold text-slate-100">{e.direction}</b>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
            <span className="block text-[10px] text-slate-400">Speed</span>
            <b className="text-[14px] font-semibold text-slate-100">{e.speedKmh} km/h</b>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
            <span className="block text-[10px] text-slate-400">Confidence</span>
            <b className="text-[14px] font-semibold text-emerald-400">{e.confidence}%</b>
          </div>
          <div className="col-span-2 rounded-lg border border-white/10 bg-slate-900/60 p-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Spatial Coverage</span>
            <b className="text-[12.5px] font-semibold text-slate-200">
              {Math.round(e.source.extentKm2).toLocaleString()} km²
            </b>
          </div>
        </div>
      </section>

      {/* FORECAST */}
      <section className="space-y-1.5 border-t border-white/10 pt-2.5">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
          Forecast
        </h3>
        <div className="space-y-1.5">
          {e.forecast.length === 0 ? (
            <div className="text-[11.5px] italic text-slate-500">
              Terminal stage; system dissipating inside current horizon.
            </div>
          ) : (
            e.forecast.map((f) => (
              <div
                key={`${f.region}-${f.hours}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-[12px]"
              >
                <div className="flex items-center gap-2">
                  <span className="mono rounded bg-sky-500/15 px-1.5 py-0.5 text-[10.5px] font-bold text-sky-300">
                    {hours(f.hours)}
                  </span>
                  <span className="font-medium text-slate-200">{f.region}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                  <span>
                    Int: <b className="text-slate-200">{f.intensity}%</b>
                  </span>
                  <span>
                    Conf: <b className="text-emerald-400">{f.confidence}%</b>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* TRACK */}
      <section className="space-y-1.5 border-t border-white/10 pt-2.5">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
          Track
        </h3>
        <div className="grid grid-cols-2 gap-2 text-[11.5px] text-slate-300">
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span className="text-slate-400">Historical:</span>
            <b>{Math.round(e.source.durationH)}h observed</b>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span className="text-slate-400">Current:</span>
            <b>{e.region}</b>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span className="text-slate-400">Forecast:</span>
            <b>+{Math.round(e.source.skilledUntilH)}h horizon</b>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span className="text-slate-400">Uncertainty:</span>
            <b>± {Math.round(e.source.uncertaintyKm)} km</b>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-slate-400">Movement:</span>
            <b>
              {e.speedKmh} km/h toward {e.direction}
            </b>
          </div>
        </div>
      </section>

      {/* WEATHER CONDITIONS */}
      <section className="space-y-1.5 border-t border-white/10 pt-2.5">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
          Weather Conditions
        </h3>
        <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
          <div className="flex items-center gap-2 rounded bg-slate-900/60 border border-white/10 p-1.5">
            <ThermometerSun size={13} className="text-amber-400 shrink-0" />
            <div>
              <span className="block text-[9.5px] text-slate-400">Temp Anomaly</span>
              <b className="text-slate-100">{tempAnomaly}</b>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-slate-900/60 border border-white/10 p-1.5">
            <CloudRain size={13} className="text-sky-400 shrink-0" />
            <div>
              <span className="block text-[9.5px] text-slate-400">Rain Anomaly</span>
              <b className="text-slate-100">{rainAnomaly}</b>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-slate-900/60 border border-white/10 p-1.5">
            <Wind size={13} className="text-teal-400 shrink-0" />
            <div>
              <span className="block text-[9.5px] text-slate-400">Wind</span>
              <b className="text-slate-100">{windVal}</b>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-slate-900/60 border border-white/10 p-1.5">
            <Gauge size={13} className="text-blue-400 shrink-0" />
            <div>
              <span className="block text-[9.5px] text-slate-400">Pressure</span>
              <b className="text-slate-100">{presVal}</b>
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded bg-slate-900/60 border border-white/10 p-1.5">
            <div className="flex items-center gap-2">
              <Droplets size={13} className="text-cyan-400 shrink-0" />
              <span className="text-[10px] text-slate-400">Relative Humidity</span>
            </div>
            <b className="text-slate-100">{humVal}</b>
          </div>
        </div>
      </section>

      {/* AI INSIGHT */}
      <section className="space-y-1 rounded-lg border border-indigo-500/20 bg-indigo-950/40 p-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
          <BrainCircuit size={13} />
          <span>AI INSIGHT</span>
        </div>
        <p className="text-[11.5px] leading-relaxed text-slate-200">
          {e.insight ||
            `${e.source.categoryLabel} anomaly driven by synoptic moisture flux convergence and low-level cyclonic vorticity, exhibiting coherent medium-range steering flow.`}
        </p>
      </section>

      {/* ACTIONS */}
      <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2.5">
        <button
          className="sih-btn sih-btn-primary flex-1 !h-8 text-[12px]"
          onClick={onTrack}
        >
          <Route size={13} /> Track Event
        </button>
        <button
          className="sih-btn flex-1 !h-8 text-[12px]"
          onClick={() => setView('analytics')}
        >
          <BarChart3 size={13} /> View Analytics
        </button>
        <button className="sih-btn !h-8 !px-3 text-[12px]" onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );
}
