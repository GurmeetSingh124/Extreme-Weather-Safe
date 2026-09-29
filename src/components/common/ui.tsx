import { memo, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, Info, X } from 'lucide-react';
import { CAT_META, SEV_META, TREND_META, cn, fmtNum } from '../../lib/utils';
import { SEV_UI, TIPS, TREND_UI } from '../../lib/design';
import type { Category, ConfBand, Severity, Trend } from '../../types';
import { useStore } from '../../store/useStore';
import { WeatherIcon } from './WeatherIcons';

/* ------------------------------------------------------------------ *
 * Tooltip — every unfamiliar control gets one                          *
 * ------------------------------------------------------------------ */
export function Tip({ text, side = 'top', children }: { text: string; side?: 'top' | 'bottom' | 'left' | 'right'; children: ReactNode }) {
  const [on, setOn] = useState(false);
  const pos =
    side === 'bottom'
      ? 'top-full left-1/2 mt-2 -translate-x-1/2'
      : side === 'left'
        ? 'right-full top-1/2 mr-2 -translate-y-1/2'
        : side === 'right'
          ? 'left-full top-1/2 ml-2 -translate-y-1/2'
          : 'bottom-full left-1/2 mb-2 -translate-x-1/2';
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onFocus={() => setOn(true)} onBlur={() => setOn(false)}>
      {children}
      {on && (
        <span role="tooltip" className={cn('pointer-events-none absolute z-[80] w-max max-w-[220px] rounded-lg border border-edge bg-ink-950/97 px-2 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-txt-mid shadow-pop', pos)}>
          {text}
        </span>
      )}
    </span>
  );
}

/** Wraps an icon-only control: renders the tooltip and the accessible name. */
export function TipButton({
  tip, label, children, className, ...rest
}: { tip: string; label: string; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tip text={tip}>
      <button aria-label={label} title={tip} className={className} {...rest}>
        {children}
      </button>
    </Tip>
  );
}

/* ------------------------------------------------------------------ *
 * Severity — colour is always paired with an icon + word              *
 * ------------------------------------------------------------------ */
export const SevChip = memo(function SevChip({ severity, size = 'sm' }: { severity: Severity; size?: 'sm' | 'xs' }) {
  const m = SEV_META[severity];
  const u = SEV_UI[severity];
  return (
    <span
      className={cn('chip', size === 'xs' && 'px-1 py-0 text-[9px]')}
      style={{ color: m.color, background: m.bg, borderColor: m.border }}
      title={`Severity: ${u.label} — ${u.plain}`}
    >
      <span aria-hidden>{u.icon}</span>
      {u.label}
    </span>
  );
});

export const TrendChip = memo(function TrendChip({ trend }: { trend: Trend }) {
  const m = TREND_META[trend];
  const u = TREND_UI[trend];
  return (
    <span className="chip" style={{ color: m.color, background: `${m.color}1f`, borderColor: `${m.color}55` }} title={u.plain}>
      <span aria-hidden>{u.icon}</span>
      {u.label}
    </span>
  );
});

export const CatChip = memo(function CatChip({ category, short }: { category: Category; short?: boolean }) {
  const m = CAT_META[category];
  return (
    <span className="chip inline-flex items-center gap-1.5" style={{ color: m.color, background: `${m.color}1a`, borderColor: `${m.color}4d` }}>
      <WeatherIcon category={category} size={12} />
      <span>{short ? m.short : m.label}</span>
    </span>
  );
});

export const ConfChip = memo(function ConfChip({ band, value }: { band: ConfBand; value?: number }) {
  const map: Record<ConfBand, string> = { HIGH: '#22c55e', MEDIUM: '#eab308', LOW: '#ef4444' };
  return (
    <span className="chip" style={{ color: map[band], background: `${map[band]}1a`, borderColor: `${map[band]}4d` }} title={TIPS.confidence}>
      {band}
      {value !== undefined && <span className="mono font-normal opacity-80">{value.toFixed(0)}%</span>}
    </span>
  );
});

/* ------------------------------------------------------------------ *
 * Cards & metrics                                                     *
 * ------------------------------------------------------------------ */
export function Panel({
  title, icon, right, children, className, dense, sub,
}: {
  title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode;
  className?: string; dense?: boolean; sub?: ReactNode;
}) {
  return (
    <section className={cn('card overflow-hidden', className)}>
      {title && (
        <header className={cn('flex items-center gap-2 border-b hairline px-3.5', dense ? 'py-2.5' : 'py-3')}>
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[12.5px] font-semibold tracking-tight text-txt-hi">{title}</h2>
            {sub && <p className="truncate text-[11px] text-txt-lo">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Metric({
  label, value, unit, hint, tone, className, mono = true,
}: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; tone?: string; className?: string; mono?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-edge bg-ink-900/70 px-3 py-2.5', className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-txt-lo">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={cn('text-[16px] font-semibold leading-tight', mono && 'mono')} style={tone ? { color: tone } : undefined}>
          {value}
        </span>
        {unit && <span className="text-[11px] text-txt-lo">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[10.5px] leading-tight text-txt-lo">{hint}</div>}
    </div>
  );
}

export function Row({ k, v, tone, mono = true }: { k: ReactNode; v: ReactNode; tone?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b hairline py-[7px] last:border-0">
      <span className="text-[11.5px] text-txt-lo">{k}</span>
      <span className={cn('text-right text-[12px] font-medium text-txt-hi', mono && 'mono')} style={tone ? { color: tone } : undefined}>
        {v}
      </span>
    </div>
  );
}

/** The four headline numbers. Deliberately only four. */
export function Stat({
  label, value, unit, tone, icon, tip, onClick,
}: { label: string; value: ReactNode; unit?: string; tone?: string; icon?: ReactNode; tip?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-txt-lo">{label}</span>
        {tip && <Info size={11} className="text-txt-lo/60" aria-hidden />}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="mono text-[24px] font-bold leading-none" style={tone ? { color: tone } : { color: '#eef3fb' }}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-txt-lo">{unit}</span>}
      </div>
    </>
  );
  const cls = 'card px-3.5 py-2.5 text-left transition-colors';
  if (onClick)
    return (
      <button className={cn(cls, 'hover:border-edge2 hover:bg-ink-800')} onClick={onClick}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

/* ------------------------------------------------------------------ *
 * Charts & bars                                                       *
 * ------------------------------------------------------------------ */
export function Gauge({
  value, max = 100, label, color, size = 108, unit,
}: { value: number; max?: number; label?: string; color: string; size?: number; unit?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = size / 2 - 9;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const a0 = Math.PI;
  const a1 = Math.PI * (1 - pct);
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size * 0.66} viewBox={`0 0 ${size} ${size * 0.72}`}>
        <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`} fill="none" stroke="rgba(148,176,224,0.18)" strokeWidth={7} strokeLinecap="round" />
        <path
          d={`M ${x0} ${y0} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 0 ${x1} ${y1}`}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          style={{ transition: 'all .25s ease-out' }}
        />
      </svg>
      <div className="absolute top-[42%] flex flex-col items-center">
        <span className="mono text-lg font-semibold leading-none" style={{ color }}>{fmtNum(value)}</span>
        {unit && <span className="text-[10px] text-txt-lo">{unit}</span>}
      </div>
      {label && <div className="mt-1 text-center text-[10px] uppercase tracking-[0.08em] text-txt-lo">{label}</div>}
    </div>
  );
}

export function Sparkline({
  data, color, width = 84, height = 22, fill = true,
}: { data: number[]; color: string; width?: number; height?: number; fill?: boolean }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d - min) / span) * (height - 3) - 1.5}`);
  const id = `sp${color.replace(/[^a-z0-9]/gi, '')}${data.length}`;
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.38" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={`url(#${id})`} />
        </>
      )}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Bar({ value, max = 100, color, height = 5 }: { value: number; max?: number; color: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-ink-700/70" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%`, background: color }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skel', className)} />;
}

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-2.5 flex items-center justify-between gap-3', className)}>
      <h3 className="panel-title">{children}</h3>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Accordion — progressive disclosure, keeps panels quiet               *
 * ------------------------------------------------------------------ */
export function Accordion({
  title, subtitle, icon, children, defaultOpen = false, badge,
}: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('overflow-hidden rounded-lg border border-edge bg-ink-900/60', open && 'bg-ink-850/70')}>
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-ink-800/60"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-txt-hi">{title}</span>
          {subtitle && <span className="block truncate text-[11px] text-txt-lo">{subtitle}</span>}
        </span>
        {badge}
        <ChevronDown size={15} className={cn('shrink-0 text-txt-lo transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <div className="animate-fade-in border-t border-edge px-3 py-3">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Empty state                                                         *
 * ------------------------------------------------------------------ */
export function EmptyState({ title, body, icon, action }: { title: string; body?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-edge bg-ink-900/50 px-6 py-12 text-center">
      <div className="flex items-center justify-center p-2 rounded-lg bg-ink-800/60 border border-edge text-txt-lo" aria-hidden>
        {icon ?? <AlertTriangle size={22} className="text-txt-lo" />}
      </div>
      <h3 className="text-[14px] font-semibold text-txt-hi">{title}</h3>
      {body && <p className="max-w-[420px] text-[12px] leading-relaxed text-txt-lo">{body}</p>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page header                                                         *
 * ------------------------------------------------------------------ */
export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-tight text-txt-hi">{title}</h1>
        {sub && <p className="mt-0.5 max-w-[70ch] text-[12.5px] leading-relaxed text-txt-lo">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Data-honesty tags                                                   *
 * ------------------------------------------------------------------ */
export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn('chip border-amber-500/40 bg-amber-500/12 text-amber-300', className)} title={TIPS.demo}>
      DEMO DATA
    </span>
  );
}

export function ForecastTag({ className, label = 'AI ESTIMATE' }: { className?: string; label?: string }) {
  return (
    <span className={cn('chip border-sky-400/40 bg-sky-500/12 text-sky-200', className)} title="Estimated by the demo model, not an official forecast">
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Toasts                                                              *
 * ------------------------------------------------------------------ */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const icon = { info: Info, warn: AlertTriangle, alert: AlertTriangle, ok: Check };
  const tone = { info: '#4dc4ff', warn: '#f97316', alert: '#ef4444', ok: '#22c55e' };
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex w-[min(92vw,400px)] -translate-x-1/2 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const I = icon[t.kind];
        return (
          <div key={t.id} className="glass pointer-events-auto flex animate-fade-up items-start gap-2.5 px-3 py-2.5">
            <I size={15} style={{ color: tone[t.kind] }} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-txt-hi">{t.title}</div>
              {t.msg && <div className="mt-0.5 text-[11.5px] leading-snug text-txt-mid">{t.msg}</div>}
            </div>
            <button className="btn !h-6 !min-h-0 !w-6 !border-0 !bg-transparent !p-0 text-txt-lo hover:text-txt-hi" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
