import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Bell, BookOpen, Brain, Clock, Compass, Crosshair,
  Filter, MapPin, Navigation, Play, Radar, Route, Search, ShieldAlert, Sparkles, Target,
  TrendingDown, TrendingUp, Zap,
} from 'lucide-react';
import { getSnapshot, useSnapshot, useStore, useVisibleEvents } from '../store/useStore';
import {
  CAT_META, SEV_META, TREND_META, cn, fmtArea, fmtNum, fmtOffset, fmtTime, hexToRgba,
} from '../lib/utils';
import { NOW } from '../lib/utils';
import { Bar, ConfChip, DemoTag, ForecastTag, Gauge, Metric, Panel, Row, SevChip, Sparkline, TrendChip } from '../components/common/ui';
import { ConfidenceChart, EvolutionChart, HBar, MultiLine } from '../components/common/charts';
import { PageHead } from './Overview';
import { CatChip } from '../components/common/ui';
import type { Category, WeatherEvent } from '../types';
import { CAT_META as CM } from '../lib/utils';

/** jump the timeline to an event's most intense moment and focus the map on it */
function useReplay() {
  return (e: WeatherEvent) => {
    const st = useStore.getState();
    const peak = e.series.reduce((best, k) => (k.intensity > best.intensity ? k : best), e.series[0]);
    st.setPlaying(false);
    st.setTime(peak.t);
    st.selectEvent(e.id, { fly: true });
    st.setView('map');
    st.pushToast({ kind: 'info', title: 'Replaying', msg: `${CAT_META[e.category].label} at ${fmtOffset(peak.t - NOW)}` });
  };
}

/* ================================================================== */
/* SPATIO-TEMPORAL TRACKING                                            */
/* ================================================================== */
export function Tracking() {
  const snap = useSnapshot();
  const selected = useStore((s) => s.selectedEventId);
  const select = useStore((s) => s.selectEvent);
  const t = useStore((s) => s.currentTime);
  const setTime = useStore((s) => s.setTime);
  const setPlaying = useStore((s) => s.setPlaying);
  const setSpeed = useStore((s) => s.setPlaySpeed);
  const replay = useReplay();

  const e = useMemo(() => snap.events.find((x) => x.id === selected) ?? snap.extreme[0] ?? snap.active[0], [snap, selected]);
  if (!e) return <div className="p-6 text-[12px] text-txt-lo">No tracked events available.</div>;

  const wpOf = (i: number) => e.corridor[i];
  const wpT = (i: number) => -48 + (i / Math.max(1, e.corridor.length - 1)) * (e.series[e.series.length - 1].t + 48);

  return (
    <div className="space-y-3 p-3">
      <PageHead
        icon={<Route size={16} />}
        title="Spatio-Temporal Event Tracking"
        sub="Frame-to-frame event linkage — observed positions, current fix and AI-projected corridor"
        right={
          <div className="flex items-center gap-1.5">
            <button className="btn !py-1.5" onClick={() => replay(e)}><Zap size={12} /> Replay event</button>
            <button
              className="btn !py-1.5"
              onClick={() => {
                setTime(Math.min(168, t + 6));
                setSpeed(12);
                setPlaying(true);
              }}
            >
              <Play size={12} /> Animate forward
            </button>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <Panel title="Tracked events" icon={<Activity size={13} className="text-brand-400" />} sub="select to inspect track" dense>
          <div className="max-h-[70vh] overflow-y-auto p-1.5">
            {snap.active.map((x) => (
              <button
                key={x.id}
                onClick={() => select(x.id)}
                className={cn('mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left transition', x.id === e.id ? 'border-brand-500/50 bg-brand-500/12' : 'border-transparent bg-ink-850/55 hover:bg-ink-800/75')}
              >
                <div className="flex items-center gap-1.5">
                  <span aria-hidden>{CAT_META[x.category].icon}</span>
                  <span className="mono text-[10.5px] font-semibold text-txt-hi">{x.id}</span>
                  <span className="ml-auto mono text-[10px]" style={{ color: SEV_META[x.severity].color }}>{x.anomalyScore.toFixed(0)}</span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-txt-lo">{x.anchor} · {x.corridor.slice(x.corridor.indexOf(x.anchor) + 1, x.corridor.indexOf(x.anchor) + 3).join(' â†’ ') || 'terminal'}</div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel
            title={`${e.id} · ${e.categoryLabel}`}
            icon={<Navigation size={13} style={{ color: CAT_META[e.category].color }} />}
            sub={`${e.subtype} · current fix ${e.lat.toFixed(2)}°N ${e.lon.toFixed(2)}°E`}
            right={<SevChip severity={e.severity} />}
            dense
          >
            <div className="space-y-3 p-3">
              {/* corridor chain */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="panel-title">Propagation chain</span>
                  <span className="mono text-[10px] text-txt-lo">heading {e.headingLabel} · {e.speedKmph.toFixed(0)} km/h</span>
                </div>
                <div className="flex flex-wrap items-stretch gap-1.5">
                  {e.corridor.map((region, i) => {
                    const wp = wpT(i);
                    const past = wp <= t;
                    const here = region === e.anchor;
                    return (
                      <div key={region + i} className="flex items-center gap-1.5">
                        <div
                          className={cn('rounded-lg border px-2.5 py-2 transition-all', here ? 'border-brand-500/55 bg-brand-500/14' : past ? 'border-edge bg-ink-850/60' : 'border-violet-400/40 bg-violet-500/10')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={cn('grid h-4 w-4 place-items-center rounded-full text-[8.5px] font-bold', here ? 'bg-brand-500 text-ink-950' : past ? 'bg-ink-700 text-txt-lo' : 'bg-violet-500/30 text-violet-200')}>{i + 1}</span>
                            <span className={cn('text-[11px] font-medium', here ? 'text-brand-400' : past ? 'text-txt-lo' : 'text-violet-200')}>{region}</span>
                          </div>
                          <div className="mono mt-0.5 text-[9px] text-txt-lo">
                            {past ? `passed ${fmtOffset(wp)}` : `ETA ${fmtOffset(wp - t)}`}
                          </div>
                        </div>
                        {i < e.corridor.length - 1 && (
                          <svg width="26" height="10" className="shrink-0">
                            <defs>
                              <marker id={`ah${i}`} markerWidth="6" markerHeight="6" refX="4" refY="2.6" orient="auto">
                                <path d="M0,0 L5,2.6 L0,5.2 Z" fill={past ? 'rgba(109,128,160,0.9)' : 'rgba(167,139,250,0.95)'} />
                              </marker>
                            </defs>
                            <line x1="0" y1="5" x2="20" y2="5" stroke={past ? 'rgba(109,128,160,0.55)' : 'rgba(167,139,250,0.7)'} strokeWidth="1.4" strokeDasharray={past ? undefined : '3 2'} markerEnd={`url(#ah${i})`} />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Anomaly score" value={e.anomalyScore.toFixed(0)} unit="/100" tone={SEV_META[e.severity].color} />
                <Metric label="Intensity now" value={e.intensity.toFixed(0)} unit="%" />
                <Metric label="Spatial extent" value={fmtArea(e.extentKm2)} />
                <Metric label="Duration" value={`${e.durationH.toFixed(0)} h`} />
                <Metric label="Detection time" value={<span className="text-[11px]">{e.firstSeenLabel}</span>} mono={false} />
                <Metric label="Current fix time" value={<span className="text-[11px]">{fmtTime(NOW + t * 3600e3)}</span>} mono={false} />
                <Metric label="Confidence" value={`${e.confidence.toFixed(0)}%`} hint={`band ${e.confBand}`} />
                <Metric label="Skill horizon" value={`+${e.skilledUntilH.toFixed(0)} h`} hint="confidence < 60%" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border hairline bg-ink-850/45 px-2 py-1.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: SEV_META[e.severity].color }} />
                    <span className="text-[11px] text-txt-mid">Intensity — analysed &amp; projected</span>
                    <span className="mono ml-auto text-[11px] font-semibold text-txt-hi">{e.intensity.toFixed(0)}%</span>
                  </div>
                  <EvolutionChart series={e.series} currentT={t} spec={{ key: 'intensity', label: 'Intensity', color: SEV_META[e.severity].color, unit: '%', kind: 'area' }} height={112} />
                </div>
                <div className="rounded-lg border hairline bg-ink-850/45 px-2 py-1.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-[11px] text-txt-mid">Forecast confidence &amp; usable horizon</span>
                  </div>
                  <ConfidenceChart series={e.series} currentT={t} height={112} />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="panel-title">Track keyframes (every 6 h)</span>
                  <ForecastTag />
                </div>
                <div className="max-h-[280px] overflow-auto rounded-lg border hairline">
                  <table className="data-table w-full min-w-[560px] text-left">
                    <thead>
                      <tr className="bg-ink-800/85 text-[9.5px] uppercase tracking-wider text-txt-lo">
                        {['Offset', 'Lat', 'Lon', 'Intensity', 'Extent km²²', 'Speed', 'Anomaly', 'Conf', 'Phase'].map((h) => (
                          <th key={h} className="whitespace-nowrap px-2.5 py-1.5 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="mono text-[10px]">
                      {e.series.filter((k) => k.t % 6 === 0).map((k) => (
                        <tr key={k.t} className={cn('border-t hairline transition hover:bg-brand-500/8', Math.abs(k.t - t) < 3 && 'bg-brand-500/12')}>
                          <td className={cn('px-2.5 py-[5px] font-semibold', k.t > 0 ? 'text-violet-300' : k.t < 0 ? 'text-txt-lo' : 'text-brand-400')}>{fmtOffset(k.t)}</td>
                          <td className="px-2.5 py-[5px] text-txt-mid">{k.lat.toFixed(3)}</td>
                          <td className="px-2.5 py-[5px] text-txt-mid">{k.lon.toFixed(3)}</td>
                          <td className="px-2.5 py-[5px] text-txt-hi">{k.intensity.toFixed(0)}</td>
                          <td className="px-2.5 py-[5px] text-txt-mid">{fmtNum(k.extent)}</td>
                          <td className="px-2.5 py-[5px] text-txt-mid">{k.speed.toFixed(1)}</td>
                          <td className="px-2.5 py-[5px]" style={{ color: SEV_META[sevOf(k.anomaly)].color }}>{k.anomaly.toFixed(0)}</td>
                          <td className="px-2.5 py-[5px]" style={{ color: k.conf >= 80 ? '#7dd3a0' : k.conf >= 60 ? '#eab308' : '#ef4444' }}>{k.conf.toFixed(0)}</td>
                          <td className="px-2.5 py-[5px] text-[9.5px] text-txt-lo">{k.t <= 0 ? 'ANALYSED' : 'FORECAST'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[0, 6, 12, 24, 48, 72, 120].map((h) => (
                  <button key={h} className="btn !py-1 text-[10px]" onClick={() => { setPlaying(false); setTime(h); }}>
                    T {fmtOffset(h)}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const sevOf = (a: number) => (a >= 82 ? 'EXTREME' : a >= 68 ? 'HIGH' : a >= 55 ? 'MODERATE' : 'NORMAL') as keyof typeof SEV_META;

/* ================================================================== */
/* FORECAST                                                            */
/* ================================================================== */
export function Forecast() {
  const snap = useSnapshot();
  const t = useStore((s) => s.currentTime);
  const setTime = useStore((s) => s.setTime);
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);

  const outlook = useMemo(() => {
    const out: any[] = [];
    for (let h = t; h <= 120; h += 6) {
      const s = getSnapshot(h);
      out.push({ t: Math.round(h), extreme: s.extreme.length, high: s.high.length, regions: s.regions.filter((r) => r.riskScore >= 55).length, confidence: +s.stats.avgConfidence.toFixed(1), events: s.stats.activeCount });
    }
    return out;
  }, [t]);

  return (
    <div className="space-y-3 p-3">
      <PageHead
        icon={<Radar size={16} />}
        title="Medium-Range Forecast Outlook"
        sub="Aggregate evolution of the extreme-event field out to +120 h from the current cursor"
        right={<ForecastTag label="AI FORECAST / ESTIMATED — DEMO" />}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Forecast horizon" value="120" unit="h" hint="+168 h chart horizon" />
        <Metric label="Extreme events at cursor" value={String(snap.stats.extremeCount)} tone={SEV_META.EXTREME.color} />
        <Metric label="Events forecast at +72 h" value={String(getSnapshot(72).stats.activeCount)} />
        <Metric label="Confidence at +24 h" value={`${getSnapshot(t + 24).stats.avgConfidence.toFixed(0)}%`} tone="#7dd3a0" />
      </div>

      <Panel title="Aggregate event-field evolution" icon={<TrendingUp size={13} className="text-brand-400" />} sub="recomputed at 6-hourly steps — the timeline drives every point" dense>
        <div className="p-2.5">
          <MultiLine
            data={outlook}
            height={250}
            series={[
              { key: 'events', label: 'Active events', color: '#4dc4ff' },
              { key: 'extreme', label: 'Extreme events', color: '#ef4444' },
              { key: 'high', label: 'High-severity events', color: '#f97316' },
              { key: 'regions', label: 'High-risk regions', color: '#eab308' },
              { key: 'confidence', label: 'Avg confidence %', color: '#7dd3a0' },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0, 12, 24, 48, 72, 120].map((h) => (
              <button key={h} className={cn('btn !py-1 text-[10px]', Math.abs(t - h) < 1 && 'btn-active')} onClick={() => setTime(h)}>Jump to T {fmtOffset(h)}</button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Region-wise arrival outlook" icon={<MapPin size={13} className="text-violet-300" />} sub="earliest estimated arrival per region" dense>
          <div className="p-2.5">
            <HBar
              height={280}
              unit="h"
              data={(() => {
                const m = new Map<string, number>();
                for (const e of snap.active) for (const et of e.etas) {
                  const prev = m.get(et.region);
                  if (prev === undefined || et.etaH < prev) m.set(et.region, et.etaH);
                }
                return [...m.entries()].sort((a, b) => a[1] - b[1]).slice(0, 12).map(([label, value]) => ({
                  label, value: Math.round(value),
                  color: value <= 12 ? '#ef4444' : value <= 36 ? '#f97316' : '#4dc4ff',
                }));
              })()}
            />
          </div>
        </Panel>

        <Panel title="Per-event forecast summary" icon={<Navigation size={13} className="text-brand-400" />} dense>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {[...snap.active].sort((a, b) => a.etas[0]?.etaH! - b.etas[0]?.etaH! || 0).map((e) => (
              <button
                key={e.id}
                onClick={() => { select(e.id, { fly: true }); setView('map'); }}
                className="mb-1.5 w-full rounded-lg border hairline bg-ink-850/55 px-2.5 py-2 text-left transition hover:bg-ink-800/80"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden>{CAT_META[e.category].icon}</span>
                  <span className="mono text-[10.5px] font-semibold text-txt-hi">{e.id}</span>
                  <SevChip severity={e.severity} size="xs" />
                  <span className="ml-auto mono text-[10px]" style={{ color: e.confidence >= 85 ? '#7dd3a0' : '#eab308' }}>{e.confidence.toFixed(0)}% conf</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-txt-lo">
                  <span className="text-txt-mid">{e.anchor}</span>
                  {e.etas.slice(0, 2).map((et) => (
                    <span key={et.region} className="flex items-center gap-0.5">
                      <ArrowRight size={9} /> {et.region} <span className="mono text-violet-300">{fmtOffset(et.etaH)}</span>
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}


/* ================================================================== */
/* AI INSIGHTS                                                         */
/* ================================================================== */
export function AIInsights() {
  const snap = useSnapshot();
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);
  const e = snap.extreme[0] ?? snap.active[0];
  const ordered = [...snap.active].sort((a, b) => b.anomalyScore - a.anomalyScore);

  const nationalNarrative = useMemo(() => {
    const ext = snap.extreme;
    const top = ordered[0];
    const compound = snap.compounds[0];
    const regions = snap.regions.filter((r) => r.riskScore >= 68).slice(0, 4).map((r) => r.name);
    return [
      `${snap.stats.activeCount} extreme-weather anomaly events are currently tracked, of which ${snap.stats.extremeCount} are classified EXTREME.`,
      top ? `The dominant feature is ${top.id} (${top.categoryLabel}) over ${top.anchor}, with a composite anomaly score of ${top.anomalyScore.toFixed(0)}/100 and an intensity of ${top.intensity.toFixed(0)}%. It is moving ${top.headingLabel} at ${top.speedKmph.toFixed(0)} km/h.` : '',
      ext.length > 1 ? `A further ${ext.length - 1} extreme-class events are active in the same window, so the national picture is a multi-hazard rather than a single-system situation.` : '',
      compound ? `Compound analysis flags ${compound.id} at ${compound.score}/100 where multiple hazards overlap${compound.regions.length ? ` across ${compound.regions.slice(0, 3).join(', ')}` : ''}.` : '',
      regions.length ? `Highest composite risk is concentrated over ${regions.join(', ')}.` : '',
      `Average model confidence across active events is ${snap.stats.avgConfidence.toFixed(0)}%; confidence decays materially beyond +72 h, so corridor positions at longer lead times should be read as indicative ranges rather than fixes.`,
      'All statements above are generated from DEMO / SIMULATED data by a deterministic prototype engine and are not official meteorological guidance.',
    ].filter(Boolean).join(' ');
  }, [snap, ordered]);

  return (
    <div className="space-y-3 p-3">
      <PageHead icon={<Brain size={16} />} title="AI Insights" sub="Narrative summaries generated from the anomaly field, event tracks and risk composition" />

      <Panel title="National AI situation summary" icon={<Sparkles size={13} className="text-brand-400" />} sub={`generated at T ${fmtOffset(snap.t)} · ${fmtTime(NOW + snap.t * 3600e3)}`} dense>
        <div className="space-y-2 p-3">
          <p className="text-[12.5px] leading-relaxed text-txt-mid">{nationalNarrative}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip border-edge bg-ink-750/60 text-txt-lo"><Sparkles size={9} /> AI-generated narrative</span>
            <DemoTag />
            <span className="chip border-violet-400/40 bg-violet-500/12 text-violet-300">Not operational guidance</span>
          </div>
        </div>
      </Panel>

      <Panel title="Highest composite anomaly" icon={<Compass size={13} className="text-rose-400" />} sub={e ? `${e.id} · ${e.categoryLabel}` : ''} dense>
        {e && (
          <div className="space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-4">
              <Gauge value={e.anomalyScore} color={SEV_META[e.severity].color} label="Anomaly score" unit="/100" />
              <Gauge value={e.intensity} color={CAT_META[e.category].color} label="Intensity" unit="%" />
              <Gauge value={e.confidence} color="#7dd3a0" label="Model confidence" unit="%" />
              <div className="min-w-[220px] flex-1">
                <p className="text-[12px] leading-relaxed text-txt-mid">{e.aiSummary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {e.drivers.map((d) => <span key={d} className="chip border-edge bg-ink-800/60 text-txt-mid">{d}</span>)}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button className="btn !py-1.5 text-[10.5px]" onClick={() => { select(e.id, { fly: true }); setView('map'); }}><Crosshair size={11} /> Open event on map</button>
              <button className="btn !py-1.5 text-[10.5px]" onClick={() => setView('tracking')}><Route size={11} /> Inspect full track</button>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((x) => (
          <div key={x.id} className="glass rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span aria-hidden>{CAT_META[x.category].icon}</span>
              <span className="mono text-[11.5px] font-semibold text-txt-hi">{x.id}</span>
              <SevChip severity={x.severity} size="xs" />
              <span className="ml-auto mono text-[10px]" style={{ color: SEV_META[x.severity].color }}>{x.anomalyScore.toFixed(0)}/100</span>
            </div>
            <div className="mt-1 text-[10.5px] text-txt-lo">{x.categoryLabel} · {x.anchor} · {TREND_META[x.trend].label}</div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-txt-mid">{x.aiSummary}</p>
            <div className="mt-2 flex items-center gap-2">
              <Bar value={x.confidence} color="#7dd3a0" height={4} />
              <span className="mono text-[9.5px] text-txt-lo">{x.confidence.toFixed(0)}%</span>
            </div>
            <button className="btn mt-2 w-full !py-1 text-[10px]" onClick={() => { select(x.id, { fly: true }); setView('map'); }}>
              <Target size={10} /> Locate on map
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* HISTORICAL EVENTS                                                   */
/* ================================================================== */
const HIST_CATALOG: Record<Category, { n: number; durH: number; spd: number; pct: number; label: string }> = {
  rainfall: { n: 12, durH: 38, spd: 16, pct: 98, label: 'Monsoon low-pressure rainfall clusters (2005—2025)' },
  cyclone: { n: 8, durH: 52, spd: 24, pct: 96, label: 'Bay of Bengal cyclonic storms making landfall (1999—2025)' },
  wind: { n: 14, durH: 26, spd: 29, pct: 95, label: 'Coastal gust corridors and gap winds (2008—2025)' },
  heat: { n: 17, durH: 84, spd: 9, pct: 94, label: 'Prolonged heat anomaly episodes (2003—2025)' },
  cold: { n: 9, durH: 40, spd: 13, pct: 92, label: 'Western-disturbance cold anomalies (2006—2025)' },
  pressure: { n: 11, durH: 62, spd: 15, pct: 93, label: 'Well-marked monsoon low-pressure systems (2005—2025)' },
  drought: { n: 6, durH: 520, spd: 5, pct: 88, label: 'Multi-week rainfall-deficit episodes (2002—2025)' },
  flood: { n: 10, durH: 56, spd: 12, pct: 97, label: 'Flood-generating rainfall episodes (2004—2025)' },
  thunderstorm: { n: 19, durH: 14, spd: 32, pct: 90, label: 'Severe convective / squall-line episodes (2010—2025)' },
  compound: { n: 5, durH: 48, spd: 19, pct: 99, label: 'Compound multi-hazard overlaps (2007—2025)' },
};

export function Historical() {
  const snap = useSnapshot();
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);
  const ranked = [...snap.active].sort((a, b) => b.anomalyScore - a.anomalyScore);

  return (
    <div className="space-y-3 p-3">
      <PageHead
        icon={<BookOpen size={16} />}
        title="Historical Event Comparison"
        sub="Current anomalies placed against a demonstration analogue catalogue of past extreme events"
      />

      <div className="glass rounded-xl border border-amber-500/25 px-3 py-2">
        <p className="text-[11px] leading-relaxed text-amber-100/80">
          <strong>Analytical context only.</strong> The analogue catalogue below is illustrative demo content built to show
          how current events would be benchmarked against historical climatology. It is not a verified historical record
          and must not be cited as one.
        </p>
      </div>

      {ranked.slice(0, 8).map((e) => {
        const h = HIST_CATALOG[e.category];
        const devPct = e.anomalyScore * 0.38 + 62;
        const durDev = ((e.durationH - h.durH) / h.durH) * 100;
        const spdDev = ((e.speedKmph - h.spd) / h.spd) * 100;
        return (
          <Panel
            key={e.id}
            title={`${e.id} · current vs historical analogues`}
            icon={<BookOpen size={13} className="text-brand-400" />}
            sub={`${e.categoryLabel} · current event over ${e.anchor}`}
            right={<SevChip severity={e.severity} />}
            dense
          >
            <div className="grid gap-3 p-3 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Current percentile" value={`${Math.min(99.6, devPct).toFixed(1)}`} unit="th" tone={SEV_META.EXTREME.color} hint="vs 30-yr climatology" />
                  <Metric label="Historical similar events" value={String(h.n)} hint="in demo catalogue" />
                  <Metric label="Avg historical duration" value={`${h.durH}`} unit="h" hint={`current ${e.durationH.toFixed(0)} h`} />
                  <Metric label="Avg historical speed" value={`${h.spd}`} unit="km/h" hint={`current ${e.speedKmph.toFixed(0)}`} />
                </div>
                <div className="mt-2.5 space-y-1 rounded-lg border hairline bg-ink-850/50 px-2.5 py-1">
                  <Row k="Analogue catalogue" v={h.label} mono={false} />
                  <Row k="Historical peak percentile band" v={`${h.pct - 6}th — ${h.pct}th`} />
                  <Row k="Duration deviation" v={`${durDev >= 0 ? '+' : ''}${durDev.toFixed(0)} %`} tone={durDev >= 0 ? '#f97316' : '#38bdf8'} />
                  <Row k="Movement-speed deviation" v={`${spdDev >= 0 ? '+' : ''}${spdDev.toFixed(0)} %`} tone={spdDev >= 0 ? '#f97316' : '#38bdf8'} />
                  <Row k="Anomaly-severity vs analogues" v={devPct > h.pct ? 'ABOVE historical band' : 'WITHIN historical band'} tone={devPct > h.pct ? SEV_META.EXTREME.color : '#7dd3a0'} mono={false} />
                  <Row k="Interpretation" v={devPct > h.pct ? 'Rarer than most analogues in the catalogue' : 'Comparable to the catalogue typical case'} mono={false} />
                </div>
                <button className="btn mt-2 !py-1 text-[10px]" onClick={() => { select(e.id, { fly: true }); setView('map'); }}>
                  <Target size={10} /> Locate current event
                </button>
              </div>
              <div className="rounded-lg border hairline bg-ink-850/45 px-2 py-1.5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] text-txt-mid">Current track vs historical mean evolution</span>
                </div>
                <MultiLine
                  height={170}
                  data={e.series.filter((_, i) => i % 2 === 0).map((k) => ({
                    t: k.t,
                    current: +k.intensity.toFixed(1),
                    historical: +Math.max(8, h.durH ? 100 * Math.exp(-Math.pow((k.t - 0) / (h.durH * 0.9), 2)) * (h.pct / 100) + 24 : 40).toFixed(1),
                  }))}
                  series={[
                    { key: 'current', label: 'Current event intensity', color: CAT_META[e.category].color },
                    { key: 'historical', label: 'Historical mean envelope', color: '#6d80a0' },
                  ]}
                />
                <div className="mt-1 text-[9.5px] leading-snug text-txt-lo">
                  The historical envelope is a stylised mean curve for the analogue set, shown for comparison only.
                </div>
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}


