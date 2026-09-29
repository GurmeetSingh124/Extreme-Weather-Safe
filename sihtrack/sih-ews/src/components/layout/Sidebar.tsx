import { memo } from 'react';
import {
  Activity, AlertTriangle, BarChart3, BookOpen, ChevronLeft, Cpu, Database, Home, Layers,
  LayoutDashboard, Map as MapIcon, Menu, Radar, Route, Satellite, ShieldAlert, Sparkles, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSnapshot, useStore } from '../../store/useStore';
import type { ViewId } from '../../types';

export const NAV: { id: ViewId; label: string; icon: any; group: string; badge?: 'alerts' | 'events' }[] = [
  { id: 'map', label: 'Live Map', icon: MapIcon, group: 'Operations' },
  { id: 'overview', label: 'Overview', icon: Home, group: 'Operations' },
  { id: 'events', label: 'Active Events', icon: AlertTriangle, group: 'Operations', badge: 'events' },
  { id: 'tracking', label: 'Event Tracking', icon: Route, group: 'Tracking & Forecast' },
  { id: 'forecast', label: 'Forecast', icon: Radar, group: 'Tracking & Forecast' },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, group: 'Tracking & Forecast', badge: 'alerts' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Analysis' },
  { id: 'historical', label: 'Historical Events', icon: BookOpen, group: 'Analysis' },
  { id: 'ai', label: 'AI Insights', icon: Sparkles, group: 'Analysis' },
  { id: 'architecture', label: 'System Architecture', icon: Cpu, group: 'System' },
  { id: 'system', label: 'System / Data', icon: Database, group: 'System' },
  { id: 'about', label: 'About SIH26078', icon: LayoutDashboard, group: 'System' },
];

export const Sidebar = memo(function Sidebar() {
  const open = useStore((s) => s.sidebarOpen);
  const setOpen = useStore((s) => s.setSidebarOpen);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const snap = useSnapshot();
  const read = useStore((s) => s.readAlerts);
  const unread = snap.alerts.filter((a) => !read.includes(a.id)).length;

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <>
      {/* mobile top-left trigger */}
      <button
        className="glass fixed left-3 top-[52px] z-40 grid h-8 w-8 place-items-center rounded-lg lg:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={15} /> : <Menu size={15} />}
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          'z-50 flex shrink-0 flex-col border-r hairline bg-ink-900/96 backdrop-blur-xl transition-all duration-300 ease-out',
          'fixed inset-y-0 left-0 lg:static',
          open ? 'w-[228px] translate-x-0' : 'w-[58px] -translate-x-full lg:translate-x-0'
        )}
      >
        {/* brand */}
        <div className={cn('flex items-center gap-2.5 border-b hairline px-3 py-3', !open && 'lg:px-2 lg:justify-center')}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/12">
            <Satellite size={16} className="text-brand-400" />
          </span>
          {open && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold tracking-tight text-txt-hi">SIHTRACK</div>
              <div className="truncate text-[9px] uppercase tracking-[0.16em] text-txt-lo">Extreme Weather Intelligence</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-1.5 py-2">
          {groups.map((g) => (
            <div key={g} className="mb-2">
              {open && <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-txt-lo/80">{g}</div>}
              {NAV.filter((n) => n.group === g).map((n) => {
                const I = n.icon;
                const active = view === n.id;
                const badge = n.badge === 'alerts' ? unread : n.badge === 'events' ? snap.stats.activeCount : 0;
                return (
                  <button
                    key={n.id}
                    onClick={() => setView(n.id)}
                    title={n.label}
                    className={cn(
                      'group mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition-all duration-150',
                      active ? 'bg-brand-500/14 text-brand-400' : 'text-txt-mid hover:bg-ink-750/70 hover:text-txt-hi',
                      !open && 'lg:justify-center'
                    )}
                  >
                    <I size={15} className={cn('shrink-0', active && 'text-brand-400')} />
                    {open && <span className="flex-1 truncate text-[11.5px] font-medium">{n.label}</span>}
                    {open && badge > 0 && (
                      <span className={cn('grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white', n.badge === 'alerts' ? 'bg-rose-500' : 'bg-brand-600')}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t hairline p-2">
          {open && (
            <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <Activity size={10} className="text-amber-300" />
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-300">DEMO / SIMULATED DATA</span>
              </div>
              <p className="mt-1 text-[9.5px] leading-snug text-amber-100/70">
                Not an official forecast. Prototype for SIH26078.
              </p>
            </div>
          )}
          <button className="btn w-full !py-1.5" onClick={() => setOpen(!open)} title={open ? 'Collapse sidebar' : 'Expand sidebar'}>
            <ChevronLeft size={13} className={cn('transition-transform', !open && 'rotate-180')} />
            {open && <span className="text-[10.5px]">Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
});


