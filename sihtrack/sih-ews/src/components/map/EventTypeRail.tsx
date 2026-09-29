import { useMemo, type KeyboardEvent } from 'react';
import { Layers, X } from 'lucide-react';
import { CAT_META, cn } from '../../lib/utils';
import { WeatherIcon } from '../common/WeatherIcons';
import { FOCUS_ORDER, categoryCounts, useStore, useVisibleEvents } from '../../store/useStore';
import type { Category } from '../../types';

/**
 * The hazard-type selector, docked inside the map.
 *
 * Every weather type gets its own dedicated map: pick one and the map shows
 * only that hazard, in that hazard's colour, with a count. That answers one
 * question at a time instead of asking the reader to decode ten different
 * marker colours at once. "All types" stays available as the overview.
 */
export function EventTypeRail() {
  const focus = useStore((s) => s.focusCategory);
  const setFocusCategory = useStore((s) => s.setFocusCategory);
  const filters = useStore((s) => s.filters);
  const t = useStore((s) => s.currentTime);
  const { visible } = useVisibleEvents();

  const counts = useMemo(() => categoryCounts(filters, t), [filters, t]);
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const active = focus ? CAT_META[focus] : null;

  return (
    <div
      className="pointer-events-auto w-[178px] overflow-hidden rounded-xl border border-edge2/80 bg-ink-900/92 shadow-lg backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
      role="radiogroup"
      aria-label="Weather type — pick one to see its dedicated map"
    >
      <div className="flex items-center gap-1.5 border-b border-edge2/70 px-2.5 py-2">
        <Layers size={12} className="shrink-0 text-brand-300" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-txt-mid">Event type</span>
      </div>

      <div
        className="max-h-[min(58vh,430px)] overflow-y-auto py-1"
        onKeyDown={(e) => onRovingKey(e, e.currentTarget)}
      >
        <RailRow
          on={focus === null}
          icon="all"
          label="All types"
          sublabel="Overview"
          count={total}
          color="#94a3b8"
          onClick={() => setFocusCategory(null)}
        />
        <div className="my-1 border-t border-edge2/60" />
        {FOCUS_ORDER.map((c) => {
          const meta = CAT_META[c];
          const n = counts[c] ?? 0;
          return (
            <RailRow
              key={c}
              on={focus === c}
              icon={c}
              label={meta.short}
              sublabel={n === 1 ? '1 event' : `${n} events`}
              count={n}
              color={meta.color}
              dim={n === 0}
              onClick={() => setFocusCategory(focus === c ? null : c)}
            />
          );
        })}
      </div>

      {/* the dedicated-map banner: what this map is now dedicated to */}
      {active && (
        <div
          className="flex items-center gap-1.5 border-t px-2.5 py-2"
          style={{ borderColor: `${active.color}55`, background: `${active.color}14` }}
        >
          <span className="shrink-0" style={{ color: active.color }} aria-hidden>
            <WeatherIcon category={focus as Category} size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold leading-tight" style={{ color: active.color }}>
              {active.label}
            </span>
            <span className="block text-[9.5px] text-txt-lo">only this type is shown</span>
          </span>
          <button
            onClick={() => setFocusCategory(null)}
            aria-label="Leave the dedicated map and show all types"
            className="shrink-0 rounded p-0.5 text-txt-lo transition-colors hover:text-txt-hi"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Arrow-key navigation for the type selector.
 *
 * A `radiogroup` promises the arrow keys work, so they move focus AND select,
 * with Home/End jumping to the ends. Without this the role is a lie and a
 * keyboard user has to tab through eleven rows to reach the hazard they want.
 */
function onRovingKey(e: KeyboardEvent<HTMLDivElement>, container: HTMLElement) {
  const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const rows = [...container.querySelectorAll<HTMLButtonElement>('[role=radio]')];
  if (!rows.length) return;
  const i = rows.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const next =
    e.key === 'Home' ? 0
    : e.key === 'End' ? rows.length - 1
    : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (i - 1 + rows.length) % rows.length
    : (i + 1) % rows.length;
  rows[next].focus();
  rows[next].click();
}

function RailRow({
  on,
  icon,
  label,
  sublabel,
  count,
  color,
  dim,
  onClick,
}: {
  on: boolean;
  icon: Category | 'all';
  label: string;
  sublabel: string;
  count: number;
  color: string;
  dim?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 border-l-2 px-2.5 py-1.5 text-left transition-colors',
        on ? 'bg-ink-750/80' : 'border-l-transparent hover:bg-ink-800/70',
        dim && !on && 'opacity-45'
      )}
      style={on ? { borderLeftColor: color, background: `${color}1f` } : undefined}
    >
      <span className="shrink-0" style={{ color }} aria-hidden>
        {icon === 'all' ? <Layers size={15} /> : <WeatherIcon category={icon} size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[11.5px] font-semibold leading-tight', on ? 'text-txt-hi' : 'text-txt-mid')}>
          {label}
        </span>
        <span className="block truncate text-[9.5px] leading-tight text-txt-lo">{sublabel}</span>
      </span>
      <span
        className={cn('mono shrink-0 rounded px-1 text-[10px] font-bold leading-[15px]', on ? 'text-ink-950' : 'bg-ink-750/80 text-txt-lo')}
        style={on ? { background: color } : undefined}
      >
        {count}
      </span>
    </button>
  );
}

/** Compact horizontal version for narrow screens, where a vertical rail would
 *  cover most of the map. */
export function EventTypeStrip() {
  const focus = useStore((s) => s.focusCategory);
  const setFocusCategory = useStore((s) => s.setFocusCategory);
  const filters = useStore((s) => s.filters);
  const t = useStore((s) => s.currentTime);
  const counts = useMemo(() => categoryCounts(filters, t), [filters, t]);
  const { visible } = useVisibleEvents();

  return (
    <div
      className="pointer-events-auto flex gap-1.5 overflow-x-auto rounded-xl border border-edge2/80 bg-ink-900/92 px-2 py-1.5 shadow-lg backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => onRovingKey(e, e.currentTarget)}
      role="radiogroup"
      aria-label="Weather type"
    >
      <StripChip on={focus === null} icon="all" label="All" count={visible.length} color="#94a3b8" onClick={() => setFocusCategory(null)} />
      {FOCUS_ORDER.map((c) => {
        const meta = CAT_META[c];
        return (
          <StripChip
            key={c}
            on={focus === c}
            icon={c}
            label={meta.short}
            count={counts[c] ?? 0}
            color={meta.color}
            dim={(counts[c] ?? 0) === 0}
            onClick={() => setFocusCategory(focus === c ? null : c)}
          />
        );
      })}
    </div>
  );
}

function StripChip({
  on,
  icon,
  label,
  count,
  color,
  dim,
  onClick,
}: {
  on: boolean;
  icon: Category | 'all';
  label: string;
  count: number;
  color: string;
  dim?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
        on ? 'text-txt-hi' : 'border-edge2/70 text-txt-mid',
        dim && !on && 'opacity-45'
      )}
      style={on ? { background: `${color}24`, borderColor: `${color}88` } : undefined}
    >
      <span className="shrink-0" style={{ color: on ? color : undefined }} aria-hidden>
        {icon === 'all' ? <Layers size={13} /> : <WeatherIcon category={icon} size={13} />}
      </span>
      {label}
      <span className="mono text-[10px] text-txt-lo">{count}</span>
    </button>
  );
}

export type { Category };
