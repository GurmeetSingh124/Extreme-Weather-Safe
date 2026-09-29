import { useMemo } from 'react';
import { CalendarDays, Crosshair, MapPin, ArrowRight } from 'lucide-react';
import { getSnapshot, useStore } from '../store/useStore';
import { CAT_META, SEV_META, cn, NOW, fmtDate } from '../lib/utils';
import { CAT_PLAIN, SEV_UI } from '../lib/design';
import { PageHeader } from '../components/common/ui';
import { WeatherIcon } from '../components/common/WeatherIcons';
import { T_MAX } from '../data/engine';
import type { Severity } from '../types';

const DAYS = [0, 1, 2, 3, 4, 5];

export function ForecastPage() {
  const currentTime = useStore((s) => s.currentTime);
  const setTime = useStore((s) => s.setTime);
  const setPlaying = useStore((s) => s.setPlaying);
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);

  const forecastDays = useMemo(
    () =>
      DAYS.map((d) => {
        const tOffset = Math.min(T_MAX, d * 24);
        const s = getSnapshot(tOffset);
        const regions = [...new Set(s.active.flatMap((e) => e.corridor))];
        const eventCategories = [...new Set(s.active.map((e) => e.category))];
        const maxSeverity: Severity = s.extreme.length > 0 ? 'EXTREME' : s.high.length > 0 ? 'HIGH' : 'MODERATE';

        return {
          d,
          t: tOffset,
          label: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `+${d} days`,
          date: fmtDate(NOW + tOffset * 3600e3),
          activeCount: s.active.length,
          extremeCount: s.extreme.length,
          regions: regions.slice(0, 5),
          categories: eventCategories,
          maxSeverity,
          avgConfidence: Math.round(s.stats.avgConfidence),
          events: s.active,
        };
      }),
    []
  );

  const handleFocusEvent = (eventId: string, tOffset: number) => {
    setPlaying(false);
    setTime(tOffset);
    select(eventId, { fly: true });
    setView('map');
  };

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
      <PageHeader
        title="Extreme Weather Outlook"
        sub="5-day medium-range AI projection of anomalous meteorological patterns across the subcontinent. Select an event to track its progression on the map."
      />

      <div className="space-y-4">
        {forecastDays.map((day) => {
          const isCurrentSelectedDay = Math.abs(currentTime - day.t) < 12;
          const sevMeta = SEV_META[day.maxSeverity];

          return (
            <div
              key={day.d}
              className={cn(
                'rounded-xl border border-edge/80 bg-ink-900/50 p-4 transition-all hover:border-edge2',
                isCurrentSelectedDay && 'border-brand-500/50 bg-ink-900/80 shadow-card'
              )}
            >
              {/* Day Header Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-edge bg-ink-950 font-bold text-brand-300">
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[16px] font-bold text-txt-hi">{day.label}</h2>
                      <span className="text-[12px] text-txt-lo">({day.date})</span>
                      {day.d === 0 && (
                        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-sky-300">
                          Present
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-txt-lo">
                      {day.activeCount} active anomalies · {day.extremeCount} severe
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-txt-lo block">Confidence</span>
                    <span className="mono text-[13px] font-bold text-emerald-400">{day.avgConfidence}%</span>
                  </div>
                  <span
                    className="rounded px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider"
                    style={{ color: sevMeta.color, background: sevMeta.bg, border: `1px solid ${sevMeta.border}` }}
                  >
                    {day.maxSeverity}
                  </span>
                </div>
              </div>

              {/* Day Details: Affected Regions & Categories */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-txt-mid">Affected Regions:</span>
                  {day.regions.map((r) => (
                    <span key={r} className="rounded bg-ink-800 px-2 py-0.5 text-txt-hi text-[11.5px]">
                      {r}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-txt-mid">Major Hazard Types:</span>
                  {day.categories.map((c) => (
                    <span key={c} className="flex items-center gap-1 text-[11.5px] text-txt-hi">
                      <WeatherIcon category={c} size={14} color={CAT_META[c].color} />
                      <span>{CAT_PLAIN[c]}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick Events List for this Day */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {day.events.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => handleFocusEvent(ev.id, day.t)}
                    className="flex items-center justify-between rounded-lg border border-edge/60 bg-ink-950/60 p-2.5 text-left transition-colors hover:border-brand-500/50 hover:bg-ink-850"
                  >
                    <div className="flex items-center gap-2">
                      <WeatherIcon category={ev.category} size={15} color={CAT_META[ev.category].color} />
                      <div>
                        <div className="text-[12px] font-medium text-txt-hi leading-tight">
                          {CAT_PLAIN[ev.category]}
                        </div>
                        <div className="text-[10px] text-txt-lo flex items-center gap-1 mt-0.5">
                          <MapPin size={9} /> {ev.anchor}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-300">
                      <span>Track</span>
                      <Crosshair size={12} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
