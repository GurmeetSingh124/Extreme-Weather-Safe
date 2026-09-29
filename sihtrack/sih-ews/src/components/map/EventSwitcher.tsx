import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CAT_META, SEV_META, cn } from '../../lib/utils';
import { WeatherIcon } from '../common/WeatherIcons';
import { useMapFocus } from '../../store/useStore';
import type { WeatherEvent } from '../../types';

/**
 * The map shows one event at a time, so it has to carry the way to reach the
 * others. This is that switcher: the current event by name, its position in the
 * set, a list of every event currently available, and step-through controls.
 */
export function EventSwitcher() {
  const { list, active, index, step, goTo } = useMapFocus();

  if (!list.length) {
    return (
      <div className="pointer-events-auto rounded-xl border border-edge2/80 bg-ink-900/92 px-2.5 py-2 shadow-lg backdrop-blur-sm">
        <p className="text-[11px] text-txt-lo">No events to step through.</p>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto overflow-hidden rounded-xl border border-edge2/80 bg-ink-900/92 shadow-lg backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ---- step-through header ---- */}
      <div className="flex items-center gap-1 border-b border-edge2/70 px-2 py-1.5">
        <StepBtn label="Previous event" onClick={() => step(-1)}>
          <ChevronLeft size={14} />
        </StepBtn>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9.5px] uppercase tracking-[0.09em] text-txt-lo">
            Event {index + 1} of {list.length}
          </p>
          <p className="truncate text-[10px] font-semibold text-txt-mid" title={active?.name}>
            {active ? CAT_META[active.category].short : '—'}
          </p>
        </div>
        <StepBtn label="Next event" onClick={() => step(1)}>
          <ChevronRight size={14} />
        </StepBtn>
      </div>

      {/* ---- the active event, named ---- */}
      {active && <ActiveCard event={active} />}

      {/* ---- every other event, one click away ---- */}
      <div className="max-h-[min(34vh,236px)] overflow-y-auto border-t border-edge2/70 py-1">
        {list.map((e, i) => (
          <EventRow key={e.id} event={e} on={e.id === active?.id} position={i} onClick={() => goTo(e.id)} />
        ))}
      </div>
    </div>
  );
}

function StepBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="btn-icon !h-6 !min-h-0 !w-6 shrink-0"
    >
      {children}
    </button>
  );
}

function ActiveCard({ event }: { event: WeatherEvent }) {
  const meta = CAT_META[event.category];
  const sev = SEV_META[event.severity];
  return (
    <div className="px-2.5 py-2" style={{ background: `${meta.color}14` }}>
      <div className="flex items-start gap-1.5">
        <span className="mt-px shrink-0" style={{ color: meta.color }} aria-hidden>
          <WeatherIcon category={event.category} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold leading-tight text-txt-hi">{event.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-txt-lo">
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: sev.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sev.color }} aria-hidden />
              {sev.label}
            </span>
            <span aria-hidden>·</span>
            <span>{event.id}</span>
          </p>
        </div>
      </div>
      <dl className="mt-1.5 grid grid-cols-3 gap-1 text-center">
        <Stat label="Intensity" value={`${event.intensity}%`} />
        <Stat label="Confidence" value={`${event.confidence}%`} />
        <Stat label="Moving" value={`${event.speedKmph} km/h`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-800/70 px-1 py-1">
      <dd className="mono text-[11px] font-bold leading-tight text-txt-hi">{value}</dd>
      <dt className="text-[8.5px] uppercase tracking-wide text-txt-lo">{label}</dt>
    </div>
  );
}

function EventRow({
  event,
  on,
  position,
  onClick,
}: {
  event: WeatherEvent;
  on: boolean;
  position: number;
  onClick: () => void;
}) {
  const meta = CAT_META[event.category];
  const sev = SEV_META[event.severity];
  return (
    <button
      onClick={onClick}
      aria-current={on ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-1.5 border-l-2 px-2.5 py-1 text-left transition-colors',
        on ? 'bg-ink-750/70' : 'border-l-transparent hover:bg-ink-800/70'
      )}
      style={on ? { borderLeftColor: meta.color } : undefined}
      title={`${event.name} — ${event.id}`}
    >
      <span className="mono w-3 shrink-0 text-[9px] text-txt-lo">{position + 1}</span>
      <span className="shrink-0" style={{ color: meta.color }} aria-hidden>
        <WeatherIcon category={event.category} size={13} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[10.5px] text-txt-mid">{event.name}</span>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sev.color }} aria-label={sev.label} />
    </button>
  );
}

/** Horizontal step-through for narrow screens, where the rail stack would eat
 *  the whole map. */
export function EventSwitcherStrip() {
  const { list, active, index, step } = useMapFocus();
  if (!active) return null;
  const meta = CAT_META[active.category];
  return (
    <div
      className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-edge2/80 bg-ink-900/92 px-2 py-1.5 shadow-lg backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Event ${index + 1} of ${list.length}`}
    >
      <button onClick={() => step(-1)} aria-label="Previous event" className="btn-icon !h-6 !min-h-0 !w-6 shrink-0">
        <ChevronLeft size={14} />
      </button>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span style={{ color: meta.color }} aria-hidden>
            <WeatherIcon category={active.category} size={13} />
          </span>
          <span className="mono text-[9.5px] text-txt-lo">
            {index + 1}/{list.length}
          </span>
        </span>
        <span className="block truncate text-[11px] font-semibold text-txt-hi">{active.name}</span>
      </span>
      <button onClick={() => step(1)} aria-label="Next event" className="btn-icon !h-6 !min-h-0 !w-6 shrink-0">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
