import { memo, useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtOffset } from '../../lib/utils';
import type { TrackKey } from '../../types';

const AXIS = { stroke: 'rgba(126,166,224,0.25)', tick: { fill: '#6d80a0', fontSize: 9.5 } };

function tipStyle() {
  return {
    contentStyle: {
      background: 'rgba(11,18,32,0.96)', border: '1px solid rgba(126,166,224,0.22)',
      borderRadius: 10, fontSize: 11, padding: '7px 9px', color: '#e8eefa',
    },
    labelStyle: { color: '#9fb2cd', fontSize: 10, marginBottom: 3 },
    itemStyle: { padding: 0 },
  } as const;
}

export interface MetricSpec {
  key: keyof TrackKey;
  label: string;
  color: string;
  unit: string;
  kind?: 'line' | 'area';
}

/** Evolution chart with a "NOW" cursor — the core event-evolution visual. */
export const EvolutionChart = memo(function EvolutionChart({
  series, currentT, spec, height = 108,
}: { series: TrackKey[]; currentT: number; spec: MetricSpec; height?: number }) {
  const data = useMemo(
    () => series.filter((_, i) => i % 2 === 0).map((k) => ({ t: k.t, label: fmtOffset(k.t), v: +k[spec.key] as number, now: k.t })),
    [series, spec.key]
  );
  const Comp: any = spec.kind === 'area' ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Comp data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${spec.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={spec.color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={spec.color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="t" tick={AXIS.tick} axisLine={{ stroke: AXIS.stroke }} tickLine={false} type="number" domain={['dataMin', 'dataMax']} ticks={[-48, 0, 48, 96, 144]} tickFormatter={(v) => fmtOffset(v as number)} />
        <YAxis tick={AXIS.tick} axisLine={false} tickLine={false} width={40} />
        <Tooltip {...tipStyle()} formatter={(v: any) => [`${(+v).toFixed(1)} ${spec.unit}`, spec.label]} labelFormatter={(l) => `T ${fmtOffset(l as number)}`} />
        <ReferenceLine x={currentT} stroke="#4dc4ff" strokeWidth={1.2} strokeDasharray="4 3" />
        <ReferenceLine x={0} stroke="rgba(126,166,224,0.35)" strokeDasharray="2 4" label={{ value: 'NOW', position: 'insideTopLeft', fill: '#6d80a0', fontSize: 8 }} />
        {spec.kind === 'area' ? (
          <Area type="monotone" dataKey="v" stroke={spec.color} strokeWidth={1.8} fill={`url(#g-${spec.key})`} dot={false} isAnimationActive={false} />
        ) : (
          <Line type="monotone" dataKey="v" stroke={spec.color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        )}
      </Comp>
    </ResponsiveContainer>
  );
});

/** Multi-metric comparison used on the analytics page. */
export const MultiLine = memo(function MultiLine({
  data, series, height = 220, xKey = 't',
}: { data: any[]; series: { key: string; label: string; color: string }[]; height?: number; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey={xKey} tick={AXIS.tick} axisLine={{ stroke: AXIS.stroke }} tickLine={false} tickFormatter={(v) => fmtOffset(v as number)} />
        <YAxis tick={AXIS.tick} axisLine={false} tickLine={false} width={40} />
        <Tooltip {...tipStyle()} labelFormatter={(l) => `T ${fmtOffset(l as number)}`} />
        <ReferenceLine x={0} stroke="rgba(126,166,224,0.3)" strokeDasharray="2 4" />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
});

/** Horizontal category bars. */
export const HBar = memo(function HBar({
  data, height = 240, unit = '',
}: { data: { label: string; value: number; color: string }[]; height?: number; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 26, left: 4, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="2 4" />
        <XAxis type="number" tick={AXIS.tick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ ...AXIS.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={104} />
        <Tooltip {...tipStyle()} formatter={(v: any) => [`${v}${unit}`, 'Value']} cursor={{ fill: 'rgba(126,166,224,0.06)' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={11}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

/** Stacked risk-bar chart for regional risk. */
export const RiskBars = memo(function RiskBars({ data, height = 200 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="label" tick={{ ...AXIS.tick, fontSize: 9 }} axisLine={{ stroke: AXIS.stroke }} tickLine={false} interval={0} angle={-24} textAnchor="end" height={44} />
        <YAxis tick={AXIS.tick} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
        <Tooltip {...tipStyle()} formatter={(v: any) => [`${v}/100`, 'Risk score']} cursor={{ fill: 'rgba(126,166,224,0.06)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={18}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

/** Confidence decay curve with the usable-forecast threshold. */
export const ConfidenceChart = memo(function ConfidenceChart({
  series, currentT, height = 110, threshold = 60,
}: { series: TrackKey[]; currentT: number; height?: number; threshold?: number }) {
  const data = series.map((k) => ({ t: k.t, v: k.conf }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="g-conf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="t" tick={AXIS.tick} axisLine={{ stroke: AXIS.stroke }} tickLine={false} type="number" domain={['dataMin', 'dataMax']} ticks={[-48, 0, 48, 96, 144]} tickFormatter={(v) => fmtOffset(v as number)} />
        <YAxis tick={AXIS.tick} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
        <Tooltip {...tipStyle()} formatter={(v: any) => [`${(+v).toFixed(0)}%`, 'Model confidence']} labelFormatter={(l) => `T ${fmtOffset(l as number)}`} />
        <ReferenceLine y={threshold} stroke="#f97316" strokeDasharray="4 3" label={{ value: 'usable', position: 'insideBottomRight', fill: '#f97316', fontSize: 8 }} />
        <ReferenceLine x={currentT} stroke="#4dc4ff" strokeWidth={1.2} strokeDasharray="4 3" />
        <Area type="monotone" dataKey="v" stroke="#7dd3a0" strokeWidth={1.8} fill="url(#g-conf)" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
});
