import { useMemo, useState } from 'react';
import { AlertTriangle, Filter, Search, X } from 'lucide-react';
import { useStore, useVisibleEvents } from '../store/useStore';
import { CAT_META, cn } from '../lib/utils';
import { CAT_PLAIN, SEV_ORDER_UI, SEV_UI } from '../lib/design';
import { EventRow } from '../components/common/EventRow';
import { EmptyState, PageHeader } from '../components/common/ui';
import { WeatherIcon } from '../components/common/WeatherIcons';
import type { Category, Severity } from '../types';

const CATS: Category[] = [
  'rainfall',
  'cyclone',
  'wind',
  'heat',
  'cold',
  'pressure',
  'drought',
  'flood',
  'thunderstorm',
  'compound',
];

export function EventsPage() {
  const { visible } = useVisibleEvents();
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);
  const filters = useStore((s) => s.filters);
  const toggleCategory = useStore((s) => s.toggleCategory);
  const toggleSeverity = useStore((s) => s.toggleSeverity);
  const resetFilters = useStore((s) => s.resetFilters);

  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const RANK: Record<Severity, number> = { EXTREME: 0, HIGH: 1, MODERATE: 2, NORMAL: 3 };
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = [...visible].sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.intensity - a.intensity);
    return s
      ? base.filter(
          (e) =>
            e.id.toLowerCase().includes(s) ||
            CAT_PLAIN[e.category].toLowerCase().includes(s) ||
            e.anchor.toLowerCase().includes(s) ||
            e.corridor.some((c) => c.toLowerCase().includes(s))
        )
      : base;
  }, [visible, q]);

  const handleOpen = (id: string) => {
    select(id, { fly: true });
    setView('map');
  };

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
      <PageHeader
        title="Detected Weather Events"
        sub="Extreme meteorological events detected by the spatial tracking engine. Select an event to track its trajectory on the map."
        right={
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-edge bg-ink-900/80 px-2.5">
              <Search size={14} className="text-txt-lo" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events or regions…"
                aria-label="Search events"
                className="w-[180px] bg-transparent text-[12.5px] text-txt-hi outline-none placeholder:text-txt-lo"
              />
              {q && (
                <button
                  className="btn !h-5 !min-h-0 !w-5 !border-0 !bg-transparent !p-0 text-txt-lo hover:text-txt-hi"
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              className={cn('btn !h-9 text-[12px]', showFilters && 'border-brand-500/50 bg-brand-500/15 text-brand-300')}
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <Filter size={13} /> Filter
            </button>
          </div>
        }
      />

      {/* Severity Filter Chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SEV_ORDER_UI.map((sv) => {
          const u = SEV_UI[sv];
          const n = visible.filter((e) => e.severity === sv).length;
          const on = filters.severities.includes(sv);
          return (
            <button
              key={sv}
              onClick={() => toggleSeverity(sv)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-all',
                on
                  ? 'border-brand-500/60 bg-brand-500/15 text-brand-300'
                  : 'border-edge bg-ink-900/60 text-txt-mid hover:border-edge2 hover:text-txt-hi'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: u.color }} aria-hidden />
              <span className="text-[12px] font-medium">{u.label}</span>
              <span className="mono rounded bg-ink-800 px-1.5 py-0.5 text-[11px] font-bold text-txt-hi">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Expandable Hazard Category Filters */}
      {showFilters && (
        <div className="mb-5 rounded-xl border border-edge bg-ink-900/80 p-3.5 animate-fade-in">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-txt-lo">
              Hazard Category
            </span>
            <button className="text-[11px] text-txt-lo hover:text-brand-300" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((c) => {
              const on = filters.categories.includes(c);
              const color = CAT_META[c].color;
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  aria-pressed={on}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
                    on
                      ? 'border-brand-500/60 bg-brand-500/20 text-brand-300'
                      : 'border-edge bg-ink-950/60 text-txt-mid hover:border-edge2 hover:text-txt-hi'
                  )}
                >
                  <WeatherIcon category={c} size={14} color={color} />
                  <span>{CAT_PLAIN[c]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Events Grid */}
      {list.length ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((e) => (
            <EventRow key={e.id} e={e} onOpen={() => handleOpen(e.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Extreme Events Detected"
          body="No events match your current filter selection. Clear filters or scrub the timeline to explore different forecasts."
          icon={<AlertTriangle size={24} className="text-txt-lo" />}
          action={
            <button className="btn mt-2 !py-1.5 text-[12px]" onClick={resetFilters}>
              Clear Filters
            </button>
          }
        />
      )}
    </div>
  );
}
