import { useMemo } from 'react';
import { BarChart3, TrendingUp, Activity, Flame, Wind, Clock, ShieldCheck, Gauge } from 'lucide-react';
import { getSnapshot, useSnapshot, useStore } from '../store/useStore';
import { CAT_META, SEV_META, fmtNum, fmtOffset } from '../lib/utils';
import { CAT_PLAIN, SEV_ORDER_UI } from '../lib/design';
import { PageHeader, Panel } from '../components/common/ui';
import { HBar, MultiLine } from '../components/common/charts';
import type { Category, Severity } from '../types';

export function AnalyticsPage() {
  const snap = useSnapshot();
  const currentTime = useStore((s) => s.currentTime);
  const setTime = useStore((s) => s.setTime);
  const setPlaying = useStore((s) => s.setPlaying);

  /* Statistics requested in Section 26 */
  const totalEvents = snap.events.length;
  const extremeEvents = snap.stats.extremeCount;
  const avgIntensity = Math.round(snap.stats.avgIntensity);
  const avgConfidence = Math.round(snap.stats.avgConfidence);
  const avgDuration = Math.round(
    snap.events.reduce((acc, ev) => acc + ev.durationH, 0) / Math.max(1, totalEvents)
  );
  const avgSpeed = Math.round(
    snap.events.reduce((acc, ev) => acc + ev.speedKmph, 0) / Math.max(1, totalEvents)
  );

  /* History trend data */
  const historyTrend = useMemo(() => {
    const out: any[] = [];
    for (let h = snap.t - 48; h <= snap.t + 48; h += 6) {
      const s = getSnapshot(h);
      out.push({
        t: Math.round(h),
        active: s.stats.activeCount,
        extreme: s.stats.extremeCount,
        intensity: +s.stats.avgIntensity.toFixed(1),
        confidence: +s.stats.avgConfidence.toFixed(1),
      });
    }
    return out;
  }, [snap.t]);

  /* Events by type */
  const eventsByType = useMemo(
    () =>
      (Object.keys(CAT_META) as Category[])
        .map((c) => ({
          label: CAT_PLAIN[c],
          value: snap.events.filter((e) => e.category === c).length,
          color: CAT_META[c].color,
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [snap.events]
  );

  /* Events by region */
  const eventsByRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of snap.events) {
      for (const r of e.corridor) {
        m.set(r, (m.get(r) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({
        label,
        value,
        color: value >= 3 ? '#ef4444' : value >= 2 ? '#f97316' : '#38bdf8',
      }));
  }, [snap.events]);

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
      <PageHeader
        title="Event Analytics & Statistics"
        sub={`Spatio-temporal meteorological analytics computed across all active and projected events at ${fmtOffset(snap.t)}.`}
        right={
          <div className="flex flex-wrap gap-1">
            {[-24, 0, 24, 48, 72].map((h) => (
              <button
                key={h}
                className={`btn !h-7 !py-0.5 text-[11px] ${Math.abs(currentTime - h) < 0.6 ? 'btn-active' : ''}`}
                onClick={() => {
                  setPlaying(false);
                  setTime(h);
                }}
              >
                {h === 0 ? 'NOW' : fmtOffset(h)}
              </button>
            ))}
          </div>
        }
      />

      {/* 26. Key Statistics Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={<Activity size={16} className="text-brand-400" />}
          label="Total Events"
          value={String(totalEvents)}
          sub="Detected anomalies"
        />
        <StatCard
          icon={<Flame size={16} className="text-rose-400" />}
          label="Extreme Events"
          value={String(extremeEvents)}
          tone="#ef4444"
          sub="High risk category"
        />
        <StatCard
          icon={<Gauge size={16} className="text-amber-400" />}
          label="Avg Intensity"
          value={`${avgIntensity}%`}
          tone="#facc15"
          sub="Severity composite"
        />
        <StatCard
          icon={<Wind size={16} className="text-teal-400" />}
          label="Avg Movement Speed"
          value={`${avgSpeed} km/h`}
          sub="Propagation rate"
        />
        <StatCard
          icon={<Clock size={16} className="text-sky-400" />}
          label="Avg Duration"
          value={`${avgDuration}h`}
          sub="From first detection"
        />
        <StatCard
          icon={<ShieldCheck size={16} className="text-emerald-400" />}
          label="Forecast Confidence"
          value={`${avgConfidence}%`}
          tone="#4ade80"
          sub="Model certainty"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Events by Type */}
        <Panel title="Events by Type" sub="Distribution of extreme weather anomalies by category">
          <div className="p-4">
            <HBar height={240} data={eventsByType} />
          </div>
        </Panel>

        {/* Events by Region */}
        <Panel title="Events by Region" sub="Number of event corridors crossing Indian states & coastal zones">
          <div className="p-4">
            <HBar height={240} data={eventsByRegion} />
          </div>
        </Panel>
      </div>

      {/* Situation Progression Chart */}
      <div className="mt-4">
        <Panel
          title="Multi-Day Trend"
          sub="Timeline progression: active anomalies, extreme cases and forecast confidence"
        >
          <div className="p-4">
            <MultiLine
              height={250}
              data={historyTrend}
              series={[
                { key: 'active', label: 'Active events', color: '#38bdf8' },
                { key: 'extreme', label: 'Extreme events', color: '#ef4444' },
                { key: 'confidence', label: 'Confidence %', color: '#4ade80' },
                { key: 'intensity', label: 'Average intensity %', color: '#facc15' },
              ]}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-edge/80 bg-ink-900/60 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-txt-lo">{label}</span>
        {icon}
      </div>
      <div className="mono mt-2 text-[20px] font-bold" style={tone ? { color: tone } : { color: '#f8fafc' }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-txt-lo truncate">{sub}</div>
    </div>
  );
}
