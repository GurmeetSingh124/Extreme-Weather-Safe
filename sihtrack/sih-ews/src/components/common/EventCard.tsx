import { WeatherIcon } from './WeatherIcon';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/design';
import type { EventView } from '../map/adapter';

/**
 * Events page card. `onOpen` must call the store's selectEvent and navigate to
 * the map — there is no separate detail page.
 */
export function EventCard({ e, onOpen }: { e: EventView; onOpen: (id: string) => void }) {
  const c = SEVERITY_COLOR[e.severity];
  return (
    <button className="sih-ecard" onClick={() => onOpen(e.id)}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14 }}>
        <span style={{ color: c, flexShrink: 0 }}>
          <WeatherIcon type={e.source.category} />
        </span>
        {e.title}
      </span>
      <span className="sih-muted" style={{ fontSize: 12 }}>
        {e.region} · {e.id}
      </span>
      <span className="sih-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <b style={{ color: c }}>{SEVERITY_LABEL[e.severity]}</b>
        <span>{e.intensity}% intensity</span>
      </span>
      <span className="sih-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>{e.direction}</span>
        <span>{e.confidence}% confidence</span>
      </span>
      <span style={{ fontSize: 12, color: 'var(--sih-primary)' }}>View on Map →</span>
    </button>
  );
}
