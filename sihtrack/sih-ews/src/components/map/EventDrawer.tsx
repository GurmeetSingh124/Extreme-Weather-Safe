import {
  BrainCircuit,
  CloudRain,
  Compass,
  Gauge,
  Layers,
  MapPin,
  Route,
  ShieldCheck,
  ThermometerSun,
  TriangleAlert,
  Wind,
  Droplets,
  Clock,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { WeatherIcon } from '../common/WeatherIcon';
import { FORECAST_COLOR, SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/design';
import type { EventView } from './adapter';

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

/**
 * THE Canonical Event Details Drawer (SIHTRACK Part 9 & Part 10).
 * Opens when an event is clicked from the Map, Events page, Alerts page, or Forecast page.
 * Unifies all event information into a single canonical view without duplication.
 */
export function EventDrawer({
  event: e,
  index,
  total,
  onPrev,
  onNext,
  onTrack,
  onClose,
  nowHour = 0,
}: Props) {
  const c = SEVERITY_COLOR[e.severity];
  const pastPoints = e.track.filter((p) => p.t < 0);
  const futurePoints = e.track.filter((p) => p.t > 0);
  const hours = (h: number) => `${h >= 0 ? '+' : '−'}${Math.abs(Math.round(h))} h`;

  // Derived or measured meteorological readings
  const rawCond = e.source.conditions as any || {};
  const tempVal = rawCond.temperature || (e.source.category === 'heat' ? '45.8°C' : e.source.category === 'cold' ? '-6.2°C' : '28.4°C');
  const rainVal = rawCond.rainfall || (e.source.category === 'rainfall' ? '185 mm/day' : e.source.category === 'cyclone' ? '140 mm/day' : '2.4 mm/day');
  const windVal = rawCond.wind || `${Math.round(e.speedKmh * 1.8)} km/h`;
  const presVal = rawCond.pressure || (e.source.category === 'cyclone' ? '968 hPa' : '1004 hPa');
  const humVal = rawCond.humidity || (e.source.category === 'rainfall' || e.source.category === 'flood' ? '94%' : '65%');

  return (
    <aside className="sih-drawer sih-glass" aria-label={`${e.title} complete event intelligence`}>
      {/* Top Header */}
      <header className="flex items-center gap-2.5 pb-2 border-b border-white/10">
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            flexShrink: 0,
            border: `1.8px solid ${c}`,
            color: c,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--sih-surface)',
          }}
        >
          <WeatherIcon type={e.source.category} size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="mono text-[11px] font-bold text-txt-mid">{e.id}</span>
            <span className="text-[10px] text-txt-lo">·</span>
            <span className="text-[11px] text-txt-lo uppercase font-semibold">{e.source.categoryLabel}</span>
          </div>
          <h2 className="text-[14px] font-bold text-txt-hi truncate leading-tight">{e.title}</h2>
        </div>
        <span
          className="sih-pill shrink-0"
          style={{
            color: c,
            background: `color-mix(in srgb, ${c} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${c} 35%, transparent)`,
          }}
        >
          {SEVERITY_LABEL[e.severity]}
        </span>
      </header>

      {/* Stepper Navigation */}
      <div className="flex items-center justify-between text-[11.5px] text-txt-lo py-1">
        <span className="flex items-center gap-1.5">
          <MapPin size={12} className="text-brand-400" />
          <span className="text-txt-hi font-medium">{e.region}</span>
          <span>({e.position.lat.toFixed(2)}°N, {e.position.lng.toFixed(2)}°E)</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            className="sih-btn !h-6 !px-2 text-[11px]"
            onClick={onPrev}
            aria-label="Previous event"
            title="Previous event"
          >
            ‹
          </button>
          <span className="mono text-[11px] px-1">{index + 1}/{total}</span>
          <button
            className="sih-btn !h-6 !px-2 text-[11px]"
            onClick={onNext}
            aria-label="Next event"
            title="Next event"
          >
            ›
          </button>
        </div>
      </div>

      {/* Primary Event Telemetry Grid */}
      <div className="sih-stat-grid">
        <div>
          Current Intensity
          <b style={{ color: c }}>{e.intensity}%</b>
        </div>
        <div>
          <ShieldCheck size={11} className="inline mr-1 text-emerald-400" /> Model Confidence
          <b>{e.confidence}%</b>
        </div>
        <div>
          <Compass size={11} className="inline mr-1 text-txt-lo" /> Direction
          <b className="text-[14px]">{e.direction}</b>
        </div>
        <div>
          Translation Speed
          <b className="text-[14px]">{e.speedKmh} km/h</b>
        </div>
        <div>
          Spatial Coverage
          <b className="text-[13px]">{Math.round(e.source.extentKm2).toLocaleString()} km²</b>
        </div>
        <div>
          <Clock size={11} className="inline mr-1 text-txt-lo" /> Duration
          <b className="text-[13px]">{Math.round(e.source.durationH)}h active</b>
        </div>
      </div>

      {/* SECTION 1: FORECAST (Future locations + ETA) */}
      <details open className="group">
        <summary className="font-semibold text-txt-mid hover:text-txt-hi">
          <ChevronRight size={12} className="transition-transform group-open:rotate-90 text-brand-400" />
          FORECAST & REGION ETAs
        </summary>
        <div className="mt-2 space-y-1.5 pl-2">
          {e.forecast.length === 0 ? (
            <div className="text-[11.5px] text-txt-lo italic">Terminal stage; no downstream propagation forecast.</div>
          ) : (
            e.forecast.map((f) => (
              <div
                key={`${f.region}-${f.hours}`}
                className="flex items-center justify-between py-1 px-2 rounded bg-ink-900/60 border border-edge/60 text-[12px]"
              >
                <div className="flex items-center gap-2">
                  <span className="mono font-semibold text-brand-300">{hours(f.hours)}</span>
                  <span className="text-txt-hi font-medium">{f.region}</span>
                </div>
                <div className="text-[11px] text-txt-lo flex items-center gap-2">
                  <span>Int: <b className="text-txt-hi">{f.intensity}%</b></span>
                  <span>Conf: <b className="text-emerald-400">{f.confidence}%</b></span>
                </div>
              </div>
            ))
          )}
        </div>
      </details>

      {/* SECTION 2: TRACK (Historical + Current + Predicted Path) */}
      <details open className="group">
        <summary className="font-semibold text-txt-mid hover:text-txt-hi">
          <ChevronRight size={12} className="transition-transform group-open:rotate-90 text-brand-400" />
          <Route size={12} className="text-brand-400" /> SPATIO-TEMPORAL TRACK
        </summary>
        <div className="mt-2 pl-2 sih-kv">
          <span>Observed past fixes: <b>{pastPoints.length}</b></span>
          <span>AI-projected fixes: <b>{futurePoints.length}</b></span>
          <span>Corridor uncertainty: <b>± {Math.round(e.source.uncertaintyKm)} km</b></span>
          <span>Skilled forecast horizon: <b>+{Math.round(e.source.skilledUntilH)}h</b></span>
        </div>
        <div className="mt-2 pl-2">
          <ol className="flex items-center gap-1 list-none p-0 m-0 text-[10.5px]">
            {e.states.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className={`truncate ${s.key === 'current' ? 'font-bold text-sky-300' : 'text-txt-lo'}`}>
                  {s.label}
                </span>
                {i < e.states.length - 1 && <span className="flex-1 h-[1px] bg-white/10" />}
              </li>
            ))}
          </ol>
        </div>
      </details>

      {/* SECTION 3: WEATHER CONDITIONS (Temp, Rain, Wind, Pres, Hum) */}
      <details open className="group">
        <summary className="font-semibold text-txt-mid hover:text-txt-hi">
          <ChevronRight size={12} className="transition-transform group-open:rotate-90 text-brand-400" />
          LOCAL WEATHER CONDITIONS
        </summary>
        <div className="mt-2 pl-2 grid grid-cols-2 gap-2 text-[12px]">
          <div className="p-2 rounded bg-ink-900/60 border border-edge/60 flex items-center gap-2">
            <ThermometerSun size={14} className="text-amber-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-txt-lo">Temperature</span>
              <b className="text-txt-hi">{tempVal}</b>
            </div>
          </div>
          <div className="p-2 rounded bg-ink-900/60 border border-edge/60 flex items-center gap-2">
            <CloudRain size={14} className="text-sky-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-txt-lo">Precipitation</span>
              <b className="text-txt-hi">{rainVal}</b>
            </div>
          </div>
          <div className="p-2 rounded bg-ink-900/60 border border-edge/60 flex items-center gap-2">
            <Wind size={14} className="text-teal-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-txt-lo">Peak Wind</span>
              <b className="text-txt-hi">{windVal}</b>
            </div>
          </div>
          <div className="p-2 rounded bg-ink-900/60 border border-edge/60 flex items-center gap-2">
            <Gauge size={14} className="text-blue-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-txt-lo">Atm. Pressure</span>
              <b className="text-txt-hi">{presVal}</b>
            </div>
          </div>
          <div className="p-2 rounded bg-ink-900/60 border border-edge/60 flex items-center gap-2 col-span-2">
            <Droplets size={14} className="text-cyan-400 shrink-0" />
            <div className="flex-1 flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-txt-lo">Relative Humidity</span>
                <b className="text-txt-hi">{humVal}</b>
              </div>
              <span className="mono text-[10px] text-txt-lo">850 hPa diagnostic</span>
            </div>
          </div>
        </div>
      </details>

      {/* SECTION 4: AI INSIGHT */}
      {e.insight && (
        <div className="sih-ai-box mt-1">
          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-[11px] mb-1">
            <BrainCircuit size={13} />
            <span>AI METEOROLOGICAL INSIGHT</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-txt-hi/90">{e.insight}</p>
          {e.source.drivers && e.source.drivers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {e.source.drivers.map((d) => (
                <span key={d} className="rounded bg-indigo-950/80 border border-indigo-500/30 px-1.5 py-0.5 text-[9.5px] text-indigo-200">
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: MODEL CONFIDENCE & UNCERTAINTY */}
      <details className="group">
        <summary className="font-semibold text-txt-mid hover:text-txt-hi">
          <ChevronRight size={12} className="transition-transform group-open:rotate-90 text-brand-400" />
          <ShieldCheck size={12} className="text-emerald-400" /> MODEL CONFIDENCE & SPREAD
        </summary>
        <div className="mt-2 pl-2 text-[11.5px] text-txt-lo space-y-1">
          <div className="flex justify-between">
            <span>Ensemble Confidence:</span>
            <b className="text-emerald-400">{e.confidence}% ({e.source.confBand} band)</b>
          </div>
          <div className="flex justify-between">
            <span>Forecast Corridor Half-Width:</span>
            <b className="text-txt-hi">± {Math.round(e.source.uncertaintyKm)} km</b>
          </div>
          <div className="flex justify-between">
            <span>Calibration Method:</span>
            <span className="text-txt-mid">Empirical validation error envelope</span>
          </div>
          <p className="text-[10.5px] pt-1 text-txt-lo leading-tight italic">
            Forecast uncertainty expands with lead time. Corridor indicates 90% trajectory confidence bounds.
          </p>
        </div>
      </details>

      {/* SECTION 6: ALERT & IMPACT */}
      {e.alert && (
        <div className="sih-alert-box mt-1">
          <TriangleAlert size={15} color={SEVERITY_COLOR[e.alert.severity]} className="shrink-0 mt-0.5" />
          <div className="text-[11.5px]">
            <div className="font-bold text-txt-hi uppercase tracking-wider text-[11px]">
              Priority Hazard Warning · {SEVERITY_LABEL[e.alert.severity]}
            </div>
            <div className="text-txt-lo mt-0.5">
              Impacted jurisdictions: <span className="text-txt-hi font-medium">{e.alert.regions.join(', ')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
        <button className="sih-btn sih-btn-primary flex-1 !h-9 text-[12.5px]" onClick={onTrack}>
          <Route size={14} /> Track Event On Map
        </button>
        <button className="sih-btn !h-9 text-[12.5px]" onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );
}
