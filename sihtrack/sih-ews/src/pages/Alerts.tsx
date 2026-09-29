import { useState } from 'react';
import { Bell, Check, Crosshair, MapPin } from 'lucide-react';
import { useSnapshot, useStore } from '../store/useStore';
import { SEV_META, cn, NOW } from '../lib/utils';
import { CAT_PLAIN, SEV_ORDER_UI, SEV_UI } from '../lib/design';
import { EmptyState, PageHeader } from '../components/common/ui';
import { WeatherIcon } from '../components/common/WeatherIcons';

export function AlertsPage() {
  const snap = useSnapshot();
  const read = useStore((s) => s.readAlerts);
  const markRead = useStore((s) => s.markAlertRead);
  const markAll = useStore((s) => s.markAllRead);
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);
  const [f, setF] = useState<'ALL' | (typeof SEV_ORDER_UI)[number]>('ALL');

  const list = f === 'ALL' ? snap.alerts : snap.alerts.filter((a) => a.severity === f);
  const unread = snap.alerts.filter((a) => !read.includes(a.id) && !a.read).length;

  const ago = (ts: number) => {
    const mins = Math.max(1, Math.round((NOW - ts) / 60000));
    if (mins < 60) return `${mins} min ago`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };

  const handleViewEvent = (eventId: string, alertId: string) => {
    markRead(alertId);
    select(eventId, { fly: true });
    setView('map');
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
      <PageHeader
        title="Hazard Alerts"
        sub="Priority advisories generated for extreme and high-severity weather events. Select an alert to track its development."
        right={
          unread > 0 ? (
            <button className="btn !h-8 text-[12px]" onClick={markAll}>
              <Check size={13} /> Mark all read
            </button>
          ) : undefined
        }
      />

      {/* Severity filter chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(['ALL', ...SEV_ORDER_UI] as const).map((k) => {
          const u = k === 'ALL' ? null : SEV_UI[k];
          const n = k === 'ALL' ? snap.alerts.length : snap.alerts.filter((a) => a.severity === k).length;
          return (
            <button
              key={k}
              onClick={() => setF(k as any)}
              aria-pressed={f === k}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors',
                f === k
                  ? 'border-brand-500/60 bg-brand-500/15 text-brand-300'
                  : 'border-edge bg-ink-900/60 text-txt-mid hover:border-edge2 hover:text-txt-hi'
              )}
            >
              {u && <span className="h-2 w-2 rounded-full" style={{ background: u.color }} aria-hidden />}
              <span className="text-[12px] font-medium">{u ? u.label : 'All Alerts'}</span>
              <span className="mono rounded bg-ink-800 px-1.5 py-0.5 text-[11px] font-bold text-txt-hi">{n}</span>
            </button>
          );
        })}
      </div>

      {list.length ? (
        <ul className="space-y-3">
          {list.map((a) => {
            const m = SEV_META[a.severity];
            const isRead = read.includes(a.id) || a.read;
            const ev = snap.events.find((e) => e.id === a.eventId);

            return (
              <li
                key={a.id}
                className={cn(
                  'rounded-xl border border-edge/80 bg-ink-900/60 p-4 transition-all hover:border-edge2',
                  isRead && 'opacity-80'
                )}
                style={{ borderLeft: `3px solid ${m.color}` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {ev && (
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge bg-ink-950">
                        <WeatherIcon category={ev.category} size={18} />
                      </span>
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-bold tracking-tight text-txt-hi">
                          {ev ? CAT_PLAIN[ev.category].toUpperCase() : a.title}
                        </h2>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}
                        >
                          {a.severity}
                        </span>
                        <span className="mono text-[10.5px] text-txt-lo">ID: {a.eventId}</span>
                        {!isRead && (
                          <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" title="Unread" />
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-[12px] text-txt-mid">
                        <span className="flex items-center gap-1 font-medium text-txt-hi">
                          <MapPin size={12} className="text-brand-400" />
                          {a.region}
                        </span>
                        <span>•</span>
                        <span className="text-txt-lo">Detected {ago(a.issuedAt)}</span>
                      </div>

                      <p className="mt-2 text-[12.5px] leading-relaxed text-txt-mid max-w-[700px]">
                        {a.body}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-edge/60">
                    {ev && (
                      <button
                        className="btn-primary !h-8 text-[12px] w-full sm:w-auto"
                        onClick={() => handleViewEvent(ev.id, a.id)}
                        title="View event in the details drawer on the map"
                      >
                        <Crosshair size={13} /> View Event
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No Active Alerts"
          body="No warnings or alerts are currently active for this severity level."
          icon={<Bell size={24} className="text-txt-lo" />}
        />
      )}
    </div>
  );
}

export { Bell };
