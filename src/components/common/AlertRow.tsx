import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/design';
import type { EventView } from '../map/adapter';

/** Alerts page row. Shows ONLY who/where/when/severity — details live in the drawer. */
export function AlertRow({ e, ageLabel, onView }: { e: EventView; ageLabel: string; onView: (id: string) => void }) {
  const c = SEVERITY_COLOR[e.alert?.severity ?? e.severity];
  return (
    <div className="sih-ecard" style={{ flexDirection: 'row', alignItems: 'center', gap: 16, cursor: 'default' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{e.title}</div>
        <div className="sih-muted" style={{ fontSize: 12 }}>
          {e.region} · {ageLabel}
        </div>
      </div>
      <b style={{ color: c, fontSize: 12, whiteSpace: 'nowrap' }}>{SEVERITY_LABEL[e.alert?.severity ?? e.severity]}</b>
      <button className="sih-btn sih-btn-primary" onClick={() => onView(e.id)}>
        View Event
      </button>
    </div>
  );
}
