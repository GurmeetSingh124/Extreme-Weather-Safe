import { memo, useMemo, useState } from 'react';
import {
  AlertTriangle, Bell, BellOff, Building2, ChevronDown, Droplets, Flame, Gauge as GaugeIcon,
  Layers, Sparkles, Target, Thermometer, TrendingDown, TrendingUp, Wind, X,
} from 'lucide-react';
import { useSnapshot, useStore } from '../../store/useStore';
import { CAT_META, SEV_META, cn, fmtArea, fmtNum, hexToRgba } from '../../lib/utils';
import { api } from '../../services/api';
import { Bar, DemoTag, Metric, Panel, SectionTitle, SevChip, Sparkline } from '../common/ui';
import type { Severity } from '../../types';

/* ------------------------------------------------------------------ */
/* Region risk panel                                                   */
/* ------------------------------------------------------------------ */
export function RegionRiskPanel({ limit = 9, className }: { limit?: number; className?: string }) {
  const snap = useSnapshot();
  const select = useStore((s) => s.selectEvent);
  const setSelectedRegion = useStore((s) => s.setSelectedRegion);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const setView = useStore((s) => s.setView);
  const [open, setOpen] = useState(true);

  return (
    <Panel
      className={className}
      title="High-Risk Regions"
      icon={<AlertTriangle size={13} className="text-orange-400" />}
      sub="composite risk = hazard × exposure × confidence"
      right={<span className="mono text-[10px] text-txt-lo top{snap.regions.length}">{snap.regions.length}</span>}
      dense
    >
      {open && (
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {snap.regions.slice(0, limit).map((r, i) => {
            const color = r.riskScore >= 82 ? SEV_META.EXTREME.color : r.riskScore >= 68 ? SEV_META.HIGH.color : r.riskScore >= 55 ? SEV_META.MODERATE.color : '#3b82f6';
            const first = snap.events.find((e) => r.eventIds.includes(e.id));
            return (
              <button
                key={r.name}
                onClick={() => {
                  setSelectedRegion(r.name);
                  requestFlyTo({ name: r.name, kind: 'Region risk', lat: r.lat, lon: r.lon, zoom: 6.6 });
                  setView('map');
                }}
                className="group mb-1 w-full rounded-lg border border-transparent bg-ink-850/55 px-2.5 py-1.5 text-left transition hover:border-edge2 hover:bg-ink-800/80"
              >
                <div className="flex items-center gap-2">
                  <span className="mono text-[9.5px] text-txt-lo">{String(i + 1).padStart(2, '0')}</span>
                  <span className="truncate text-[11.5px] font-medium text-txt-hi">{r.name}</span>
                  <span className="ml-auto mono text-[11.5px] font-semibold" style={{ color }}>{r.riskScore}</span>
                </div>
                <div className="mt-1"><Bar value={r.riskScore} color={color} height={4} /></div>
                <div className="mt-1 flex items-center gap-2 text-[9.5px] text-txt-lo">
                  <span className="truncate">{r.hazard}</span>
                  <span className="ml-auto flex items-center gap-1">
                    {r.trend === 'INTENSIFYING' ? <TrendingUp size={9} className="text-rose-400" /> : r.trend === 'WEAKENING' ? <TrendingDown size={9} className="text-sky-400" /> : <Target size={9} />}
                    {r.trend}
                  </span>
                </div>
                {first && (
                  <div className="mono mt-0.5 truncate text-[9px] text-brand-400/80">{first.id} · {first.categoryLabel}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Anomaly analysis                                                    */
/* ------------------------------------------------------------------ */
export function AnomalyAnalysis({ className }: { className?: string }) {
  const snap = useSnapshot();
  const rows = useMemo(() => anomalyRows(snap), [snap]);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.norm)), 0.001);
  return (
    <Panel className={className} title="Anomaly Analysis" icon={<GaugeIcon size={13} className="text-brand-400" />} sub="departure from 30-year reanalysis climatology" dense>
      <div className="space-y-1.5 p-2.5">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-center gap-2">
              <span className="text-[12px]" aria-hidden>{r.icon}</span>
              <span className="text-[11px] text-txt-mid">{r.key}</span>
              <span className="mono ml-auto text-[11.5px] font-semibold" style={{ color: r.color }}>
                {r.value > 0 ? '+' : ''}{typeof r.value === 'number' ? r.value.toFixed(r.decimals) : r.value} {r.unit}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700/70">
                <div
                  className="absolute top-0 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(Math.abs(r.norm) / maxAbs) * 50}%`,
                    left: r.norm >= 0 ? '50%' : `${50 - (Math.abs(r.norm) / maxAbs) * 50}%`,
                    background: r.color,
                    boxShadow: `0 0 8px ${r.color}88`,
                  }}
                />
                <div className="absolute left-1/2 top-0 h-full w-px bg-edge2" />
              </div>
              <span className="mono w-9 shrink-0 text-right text-[9px] text-txt-lo">{r.pct}%ile</span>
            </div>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t hairline pt-1.5">
          <span className="text-[10px] text-txt-lo">Domain maximum percentile</span>
          <span className="mono text-[11px] font-semibold text-rose-300">{Math.max(...rows.map((r) => r.pct))}th</span>
        </div>
        <DemoTag />
      </div>
    </Panel>
  );
}

function anomalyRows(snap: ReturnType<typeof useSnapshot>) {
  const pick = (cats: string[]) => snap.events.filter((e) => cats.includes(e.category));
  const maxA = (l: typeof snap.events) => (l.length ? Math.max(...l.map((e) => e.anomalyScore)) : 55);
  const heat = pick(['heat']), cold = pick(['cold']);
  const rain = pick(['rainfall', 'flood', 'cyclone']);
  const wind = pick(['wind', 'cyclone', 'thunderstorm']);
  const pres = pick(['pressure', 'cyclone']);
  const hum = pick(['rainfall', 'flood', 'drought', 'cyclone']);
  const tHot = maxA(heat), tCold = maxA(cold);
  const temp = +(tHot * 0.062 - tCold * 0.026).toFixed(1);
  const rainPct = Math.round(maxA(rain) * 2.1);
  const windK = Math.round(maxA(wind) * 0.48);
  const presH = -Math.round(maxA(pres) * 0.16);
  const humP = Math.round(maxA(hum) * 0.2 - 4);
  const rows = [
    { key: 'Temperature', value: temp, unit: '°C', decimals: 1, norm: temp / 6, pct: Math.round(60 + tHot * 0.39), color: temp >= 0 ? '#fb7185' : '#60a5fa', icon: <Thermometer size={12} /> },
    { key: 'Rainfall', value: rainPct, unit: '%', decimals: 0, norm: rainPct / 200, pct: Math.round(60 + maxA(rain) * 0.39), color: '#38bdf8', icon: <Droplets size={12} /> },
    { key: 'Wind', value: windK, unit: 'km/h', decimals: 0, norm: windK / 50, pct: Math.round(60 + maxA(wind) * 0.39), color: '#5eead4', icon: <Wind size={12} /> },
    { key: 'Pressure', value: presH, unit: 'hPa', decimals: 0, norm: presH / 16, pct: Math.round(60 + maxA(pres) * 0.38), color: '#c084fc', icon: <GaugeIcon size={12} /> },
    { key: 'Humidity', value: humP, unit: '%', decimals: 0, norm: humP / 20, pct: Math.round(60 + maxA(hum) * 0.37), color: '#7dd3fc', icon: <Droplets size={12} /> },
    { key: 'Composite anomaly', value: +maxA(snap.events).toFixed(0), unit: '/100', decimals: 0, norm: maxA(snap.events) / 100, pct: Math.round(62 + maxA(snap.events) * 0.38), color: '#f97316', icon: <Flame size={12} /> },
  ];
  return rows.map((r) => ({ ...r, pct: Math.min(99, r.pct) }));
}

/* ------------------------------------------------------------------ */
/* Compound analysis                                                   */
/* ------------------------------------------------------------------ */
export function CompoundPanel({ className, limit = 3 }: { className?: string; limit?: number }) {
  const snap = useSnapshot();
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);
  return (
    <Panel
      className={className}
      title="Compound Weather Analysis"
      icon={<Layers size={13} className="text-rose-400" />}
      sub="co-located multi-hazard overlap detection"
      dense
      right={<span className="chip border-rose-400/40 bg-rose-500/12 text-rose-300">{snap.compounds.length}</span>}
    >
      <div className="space-y-2 p-2.5">
        {snap.compounds.slice(0, limit).map((c) => {
          const color = c.score >= 82 ? SEV_META.EXTREME.color : c.score >= 68 ? SEV_META.HIGH.color : SEV_META.MODERATE.color;
          return (
            <div key={c.id} className="rounded-lg border px-2.5 py-2" style={{ borderColor: hexToRgba(color, 0.4), background: hexToRgba(color, 0.07) }}>
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] font-semibold" style={{ color }}>{c.id}</span>
                <span className="chip inline-flex items-center gap-1" style={{ color, background: hexToRgba(color, 0.14), borderColor: hexToRgba(color, 0.45) }}>
                  <AlertTriangle size={11} /> COMPOUND EXTREME
                </span>
                <span className="mono ml-auto text-[13px] font-bold" style={{ color }}>{c.score}<span className="text-[9px] text-txt-lo">/100</span></span>
              </div>
              <div className="mt-1 text-[10.5px] leading-snug text-txt-mid">{c.label}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.eventIds.map((id) => (
                  <button
                    key={id}
                    className="chip border-edge bg-ink-800/70 text-txt-mid hover:text-txt-hi"
                    onClick={() => { select(id, { fly: true }); setView('map'); }}
                  >
                    {id}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Bar value={c.score} color={color} height={4} />
              </div>
              <div className="mt-1 text-[9.5px] leading-snug text-txt-lo">Drivers: {c.drivers.join(' · ')}</div>
            </div>
          );
        })}
        <div className="text-[10px] leading-snug text-txt-lo">
          Overlap is evaluated where two or more extreme anomalies share š‰¥ 30% of their footprint inside the same
          6-hourly window.
        </div>
      </div>
    </Panel>
  );
}


