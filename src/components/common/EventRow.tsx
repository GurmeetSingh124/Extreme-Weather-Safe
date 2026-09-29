import { memo } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { CAT_META, SEV_META, cn } from '../../lib/utils';
import { CAT_PLAIN, SEV_UI } from '../../lib/design';
import { WeatherIcon } from './WeatherIcons';
import type { WeatherEvent } from '../../types';

/**
 * Clean, minimal event card according to Section 21:
 *
 * ┌─────────────────────────────┐
 * │ CloudRain  Extreme Rainfall │
 * │ Odisha                      │
 * │                             │
 * │ EXTREME     87% intensity   │
 * │ NW          94% confidence  │
 * │                             │
 * │ View on Map →               │
 * └─────────────────────────────┘
 */
export const EventRow = memo(function EventRow({
  e,
  onOpen,
  compact,
}: {
  e: WeatherEvent;
  onOpen: () => void;
  onReplay?: () => void;
  compact?: boolean;
}) {
  const cat = CAT_META[e.category];
  const sev = SEV_META[e.severity];
  const sevUI = SEV_UI[e.severity];

  return (
    <article
      onClick={onOpen}
      className={cn(
        'group relative flex cursor-pointer flex-col justify-between rounded-xl border border-edge/80 bg-ink-900/60 p-4 transition-all hover:border-brand-500/50 hover:bg-ink-850/70 hover:shadow-card',
        compact && 'p-3'
      )}
      style={{ borderLeft: `3px solid ${sev.color}` }}
    >
      <div>
        {/* Header: Weather Icon + Title */}
        <div className="flex items-center gap-2.5">
          <WeatherIcon category={e.category} size={18} color={cat.color} />
          <h3 className="truncate text-[14px] font-bold tracking-tight text-txt-hi">
            {CAT_PLAIN[e.category]}
          </h3>
        </div>

        {/* Location */}
        <p className="mt-1 flex items-center gap-1 text-[12px] text-txt-mid">
          <MapPin size={11} className="text-txt-lo shrink-0" />
          <span>{e.anchor}</span>
        </p>

        {/* 2x2 Clean Stats Grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: sev.color, background: sev.bg, border: `1px solid ${sev.border}` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sev.color }} />
              {sevUI.label}
            </span>
          </div>

          <div className="text-right">
            <span className="mono font-bold text-txt-hi">{Math.round(e.intensity)}%</span>
            <span className="text-[11px] text-txt-lo ml-1">intensity</span>
          </div>

          <div className="text-[11.5px] font-medium text-txt-mid">
            {e.headingLabel} ({Math.round(e.speedKmph)} km/h)
          </div>

          <div className="text-right">
            <span className="mono font-bold text-txt-hi">{Math.round(e.confidence)}%</span>
            <span className="text-[11px] text-txt-lo ml-1">confidence</span>
          </div>
        </div>
      </div>

      {/* Action link */}
      <div className="mt-4 flex items-center justify-between border-t border-edge/60 pt-2.5 text-[12px] font-semibold text-brand-300 group-hover:text-brand-200">
        <span>View on Map</span>
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </div>
    </article>
  );
});

export { ArrowRight };
