import { useMemo } from 'react';
import { Activity, AlertTriangle, ArrowRight, BarChart3, Flame, Gauge, Radar, Route, Sparkles, Target, TrendingUp } from 'lucide-react';
import { getSnapshot, useSnapshot, useStore } from '../store/useStore';
import { CAT_META, SEV_META, TREND_META, cn, fmtArea, fmtNum, fmtOffset, hexToRgba } from '../lib/utils';
import { AnomalyAnalysis, CompoundPanel, RegionRiskPanel } from '../components/panels/Panels';
import { Bar, DemoTag, ForecastTag, Metric, Panel, SectionTitle, SevChip, Skeleton, Sparkline } from '../components/common/ui';
import { HBar, MultiLine, RiskBars } from '../components/common/charts';
import { PIPELINE } from '../data/engine';

export function Overview() {
  const snap = useSnapshot();
  const setView = useStore((s) => s.setView);
  const select = useStore((s) => s.selectEvent);
  const history = useMemo(() => {
    const out: any[] = [];
    for (let h = snap.t - 72; h <= snap.t; h += 3) {
      const s = getSnapshot(h);
      out.push({ t: Math.round(h), active: s.stats.activeCount, extreme: s.stats.extremeCount, intensity: +s.stats.avgIntensity.toFixed(1), confidence: +s.stats.avgConfidence.toFixed(1) });
    }
    return out;
  }, [snap.t]);

  return (
    <div className="space-y-3 p-3">
      <PageHead
        icon={<Activity size={16} />}
        title="National Extreme Weather Overview"
        sub="Aggregate picture across all detected anomaly events at the current timeline position"
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Active events" value={String(snap.stats.activeCount)} tone="#4dc4ff" spark={history.map((h) => h.active)} />
        <Kpi label="Extreme events" value={String(snap.stats.extremeCount)} tone={SEV_META.EXTREME.color} spark={history.map((h) => h.extreme)} />
        <Kpi label="High-risk regions" value={String(snap.stats.highRiskRegions)} tone={SEV_META.HIGH.color} />
        <Kpi label="Avg intensity" value={`${snap.stats.avgIntensity.toFixed(0)}%`} tone={SEV_META.HIGH.color} spark={history.map((h) => h.intensity)} />
        <Kpi label="Avg confidence" value={`${snap.stats.avgConfidence.toFixed(0)}%`} tone="#7dd3a0" spark={history.map((h) => h.confidence)} />
        <Kpi label="Affected extent" value={`${fmtNum(snap.stats.totalAreaKm2 / 1000, 0)}k`} unit="km²" tone="#c084fc" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Active event register" icon={<AlertTriangle size={13} className="text-rose-400" />} sub={`${snap.active.length} events above the detection threshold`} dense>
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[720px] text-left">
              <thead>
                <tr className="text-[9.5px] uppercase tracking-wider text-txt-lo">
                  {['ID', 'Type', 'Location', 'Sev', 'Intensity', 'Anomaly', 'Movement', 'Conf', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2.5 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...snap.active]
                  .sort((a, b) => SEV_META[b.severity].rank - SEV_META[a.severity].rank || b.anomalyScore - a.anomalyScore)
                  .map((e) => (
                    <tr key={e.id} className="border-t hairline transition hover:bg-brand-500/6">
                      <td className="mono px-2.5 py-2 text-[10.5px] font-semibold text-txt-hi">{e.id}</td>
                      <td className="px-2.5 py-2">
                        <span className="flex items-center gap-1.5 text-[11px] text-txt-mid">
                          <span aria-hidden>{CAT_META[e.category].icon}</span>
                          {CAT_META[e.category].short}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-txt-mid">{e.anchor}</td>
                      <td className="px-2.5 py-2"><SevChip severity={e.severity} size="xs" /></td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="mono w-7 text-[10.5px] text-txt-hi">{e.intensity.toFixed(0)}</span>
                          <span className="w-12"><Bar value={e.intensity} color={SEV_META[e.severity].color} height={4} /></span>
                        </div>
                      </td>
                      <td className="mono px-2.5 py-2 text-[10.5px]" style={{ color: SEV_META[e.severity].color }}>{e.anomalyScore.toFixed(0)}</td>
                      <td className="mono px-2.5 py-2 text-[10.5px] text-txt-mid">{e.headingLabel} {e.speedKmph.toFixed(0)} km/h</td>
                      <td className="mono px-2.5 py-2 text-[10.5px]" style={{ color: e.confidence >= 85 ? '#7dd3a0' : e.confidence >= 65 ? '#eab308' : '#ef4444' }}>{e.confidence.toFixed(0)}%</td>
                      <td className="px-2.5 py-2 text-[10px]" style={{ color: TREND_META[e.trend].color }}>{TREND_META[e.trend].icon} {e.trend}</td>
                      <td className="px-2.5 py-2">
                        <button className="btn !px-2 !py-0.5 text-[10px]" onClick={() => { select(e.id, { fly: true }); setView('map'); }}>
                          <Target size={10} /> Map
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="National anomaly trend (T−72h → cursor)" icon={<TrendingUp size={13} className="text-brand-400" />} dense>
            <div className="p-2.5">
              <MultiLine
                data={history}
                height={170}
                series={[
                  { key: 'active', label: 'Active events', color: '#4dc4ff' },
                  { key: 'extreme', label: 'Extreme events', color: '#ef4444' },
                  { key: 'confidence', label: 'Avg confidence %', color: '#7dd3a0' },
                ]}
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-txt-lo">Aggregate statistics recomputed from the event engine every 3 h.</span>
                <DemoTag />
              </div>
            </div>
          </Panel>
          <AnomalyAnalysis />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <RegionRiskPanel limit={8} />
        <CompoundPanel limit={2} />
        <Panel title="Pipeline status" icon={<Route size={13} className="text-emerald-400" />} sub="current 00Z cycle execution" dense>
          <div className="space-y-1 p-2.5">
            {PIPELINE.slice(0, 7).map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/12 text-[8px] font-bold text-emerald-300">
                  {i + 1}
                </span>
                <span className="truncate text-[10.5px] text-txt-mid">{p.label}</span>
                <span className="mono ml-auto text-[9.5px] text-emerald-300/90">{p.ms} ms</span>
              </div>
            ))}
            <button className="btn mt-1.5 w-full !py-1 text-[10.5px]" onClick={() => setView('architecture')}>
              View full architecture <ArrowRight size={11} />
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {snap.extreme.slice(0, 4).map((e) => (
          <button
            key={e.id}
            onClick={() => { select(e.id, { fly: true }); setView('map'); }}
            className="glass group rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow"
            style={{ borderColor: hexToRgba(SEV_META[e.severity].color, 0.35) }}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border text-[13px]" style={{ borderColor: `${CAT_META[e.category].color}55`, background: `${CAT_META[e.category].color}1a` }}>
                {CAT_META[e.category].icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mono text-[11px] font-semibold text-txt-hi">{e.id}</div>
                <div className="truncate text-[10px] text-txt-lo">{e.categoryLabel}</div>
              </div>
              <SevChip severity={e.severity} size="xs" />
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <div className="text-[10px] text-txt-lo">Location</div>
                <div className="text-[12px] font-medium text-txt-hi">{e.anchor}</div>
              </div>
              <Sparkline data={e.series.filter((k) => k.t >= -24 && k.t <= 48).map((k) => k.intensity)} color={SEV_META[e.severity].color} width={78} height={26} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9.5px]">
              <Mini label="Intensity" value={`${e.intensity.toFixed(0)}%`} />
              <Mini label="ETA" value={e.etas[0] ? fmtOffset(e.etas[0].etaH) : '—'} />
              <Mini label="Conf" value={`${e.confidence.toFixed(0)}%`} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Events by category" icon={<BarChart3 size={13} className="text-brand-400" />} dense>
          <div className="p-2.5">
            <HBar
              data={(Object.keys(CAT_META) as (keyof typeof CAT_META)[])
                .map((c) => ({ label: CAT_META[c].short, value: snap.events.filter((e) => e.category === c).length, color: CAT_META[c].color }))
                .filter((d) => d.value > 0)
                .sort((a, b) => b.value - a.value)}
              height={230}
            />
          </div>
        </Panel>
        <Panel title="Regional risk profile" icon={<Gauge size={13} className="text-orange-400" />} dense>
          <div className="p-2.5">
            <RiskBars
              height={230}
              data={snap.regions.slice(0, 12).map((r) => ({
                label: r.name,
                value: r.riskScore,
                color: r.riskScore >= 82 ? SEV_META.EXTREME.color : r.riskScore >= 68 ? SEV_META.HIGH.color : r.riskScore >= 55 ? SEV_META.MODERATE.color : '#3b82f6',
              }))}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border hairline bg-ink-850/60 px-1.5 py-1">
      <div className="text-[8.5px] uppercase tracking-wider text-txt-lo">{label}</div>
      <div className="mono text-[10.5px] font-semibold text-txt-hi">{value}</div>
    </div>
  );
}

function Kpi({ label, value, unit, tone, spark }: { label: string; value: string; unit?: string; tone: string; spark?: number[] }) {
  return (
    <div className="glass rounded-xl px-3 py-2.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-txt-lo">{label}</div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="mono text-[20px] font-bold leading-none" style={{ color: tone }}>{value}</span>
          {unit && <span className="text-[10px] text-txt-lo">{unit}</span>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} color={tone} width={54} height={20} />}
      </div>
    </div>
  );
}

export function PageHead({ icon, title, sub, right }: { icon: any; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand-500/35 bg-brand-500/12 text-brand-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[16px] font-semibold tracking-tight text-txt-hi">{title}</h1>
        {sub && <p className="truncate text-[11px] text-txt-lo">{sub}</p>}
      </div>
      {right}
      <DemoTag />
    </div>
  );
}


