import { memo } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  Cpu,
  Database,
  Info,
  Map as MapIcon,
  MoreHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSnapshot, useStore } from '../../store/useStore';
import type { ViewId } from '../../types';
import { Tip } from '../common/ui';

interface NavItem {
  id: ViewId;
  label: string;
  short: string;
  icon: LucideIcon;
  hint: string;
}

export const MAIN_NAV: NavItem[] = [
  { id: 'map', label: 'Map', short: 'Map', icon: MapIcon, hint: 'Extreme weather intelligence map of India' },
  { id: 'events', label: 'Events', short: 'Events', icon: Activity, hint: 'All detected extreme weather events' },
  { id: 'analytics', label: 'Analytics', short: 'Analytics', icon: BarChart3, hint: 'Statistics and historical analysis' },
  { id: 'forecast', label: 'Forecast', short: 'Forecast', icon: CalendarDays, hint: '5-day medium-range weather outlook' },
  { id: 'alerts', label: 'Alerts', short: 'Alerts', icon: Bell, hint: 'Warnings and critical hazard advisories' },
];

export const MORE_NAV: NavItem[] = [
  { id: 'architecture', label: 'Model Architecture', short: 'Model', icon: Cpu, hint: 'AI pipeline, spatio-temporal tracking network' },
  { id: 'ai', label: 'AI Intelligence', short: 'AI', icon: Brain, hint: 'Generative situation narratives and driver analysis' },
  { id: 'system', label: 'System & Data', short: 'Data', icon: Database, hint: 'Datasets, ERA5/IMD baseline, API specifications' },
  { id: 'about', label: 'About SIHTRACK', short: 'About', icon: Info, hint: 'Project information, problem statement SIH26078' },
  { id: 'historical', label: 'Historical Analogue', short: 'History', icon: BookOpen, hint: 'Compare against historical extreme weather analogues' },
];

/* ------------------------------------------------------------------ */
/* Desktop rail — 5 core sections + More                              */
/* ------------------------------------------------------------------ */
export const NavRail = memo(function NavRail() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setMoreOpen = useStore((s) => s.setMoreOpen);
  const moreOpen = useStore((s) => s.moreOpen);
  const snap = useSnapshot();
  const read = useStore((s) => s.readAlerts);
  const unread = snap.alerts.filter((a) => !read.includes(a.id) && !a.read).length;

  return (
    <nav
      className="z-30 hidden w-[64px] shrink-0 flex-col items-center gap-1.5 border-r border-edge bg-ink-950/90 py-3 lg:flex"
      aria-label="Main navigation"
    >
      {MAIN_NAV.map((n) => {
        const I = n.icon;
        const active = view === n.id;
        return (
          <Tip key={n.id} text={n.hint} side="right">
            <button
              onClick={() => setView(n.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex w-[50px] flex-col items-center gap-1 rounded-xl p-2 transition-all',
                active
                  ? 'bg-brand-500/15 text-brand-300 shadow-sm'
                  : 'text-txt-lo hover:bg-ink-850 hover:text-txt-hi'
              )}
            >
              <span className="relative">
                <I size={18} className="transition-transform group-hover:scale-105" />
                {n.id === 'events' && snap.stats.activeCount > 0 && (
                  <span className="mono absolute -right-2.5 -top-1 rounded bg-ink-800 px-1 text-[8.5px] font-bold text-brand-400">
                    {snap.stats.activeCount}
                  </span>
                )}
                {n.id === 'alerts' && unread > 0 && (
                  <span className="absolute -right-2 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-rose-500 px-0.5 text-[8.5px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none tracking-tight">{n.short}</span>
              {active && (
                <span className="absolute -left-px top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-brand-400" />
              )}
            </button>
          </Tip>
        );
      })}

      <div className="my-1 h-px w-6 bg-edge" />

      <Tip text="Technical, AI architecture and system details" side="right">
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          aria-expanded={moreOpen}
          className={cn(
            'flex w-[50px] flex-col items-center gap-1 rounded-xl p-2 transition-all',
            moreOpen ? 'bg-ink-800 text-txt-hi' : 'text-txt-lo hover:bg-ink-850 hover:text-txt-hi'
          )}
        >
          <MoreHorizontal size={18} />
          <span className="text-[10px] font-medium leading-none tracking-tight">More</span>
        </button>
      </Tip>
    </nav>
  );
});

/* ------------------------------------------------------------------ */
/* "More / System" drawer                                               */
/* ------------------------------------------------------------------ */
export const MoreDrawer = memo(function MoreDrawer() {
  const open = useStore((s) => s.moreOpen);
  const setOpen = useStore((s) => s.setMoreOpen);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <aside
        className="drawer-in fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col border-r border-edge bg-ink-950/98 shadow-2xl backdrop-blur-md"
        aria-label="Technical and System Pages"
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3.5">
          <div className="flex items-center gap-2">
            <MoreHorizontal size={16} className="text-brand-400" />
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-txt-hi">More & Technical</h2>
          </div>
          <button
            className="btn !h-7 !min-h-0 !w-7 !border-0 !bg-transparent !p-0 text-txt-lo hover:text-txt-hi"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <p className="px-4 py-3 text-[11.5px] leading-relaxed text-txt-lo">
          Technical architecture, AI models, and benchmark references supporting the meteorological engine.
        </p>

        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {MORE_NAV.map((n) => {
            const I = n.icon;
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => {
                  setView(n.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border border-brand-500/30 bg-brand-500/12 text-brand-300'
                    : 'text-txt-mid hover:bg-ink-850 hover:text-txt-hi'
                )}
              >
                <I size={16} className="mt-0.5 shrink-0 text-brand-400" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium leading-tight">{n.label}</span>
                  <span className="mt-0.5 block text-[10.5px] leading-snug text-txt-lo">{n.hint}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
});

/* ------------------------------------------------------------------ */
/* Mobile bottom navigation                                             */
/* ------------------------------------------------------------------ */
export const MobileNav = memo(function MobileNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const snap = useSnapshot();
  const read = useStore((s) => s.readAlerts);
  const unread = snap.alerts.filter((a) => !read.includes(a.id) && !a.read).length;

  return (
    <nav
      data-mobile-nav
      className="z-40 flex h-14 shrink-0 items-stretch gap-1 border-t border-edge bg-ink-950/95 px-1 backdrop-blur-md lg:hidden"
      aria-label="Mobile navigation"
    >
      {MAIN_NAV.map((n) => {
        const I = n.icon;
        const active = view === n.id;
        return (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors',
              active ? 'text-brand-300' : 'text-txt-lo'
            )}
          >
            <I size={17} />
            <span className="text-[9.5px] font-medium">{n.short}</span>
            {n.id === 'alerts' && unread > 0 && (
              <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
            )}
          </button>
        );
      })}
      <button
        onClick={() => setSidebarOpen(true)}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-txt-lo transition-colors hover:text-txt-hi"
      >
        <MoreHorizontal size={17} />
        <span className="text-[9.5px] font-medium">More</span>
      </button>
    </nav>
  );
});
