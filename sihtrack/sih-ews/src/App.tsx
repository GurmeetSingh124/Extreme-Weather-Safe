import { Suspense, lazy, useEffect } from 'react';
import { Flame, MapPin, TriangleAlert, Timer } from 'lucide-react';
import { TopNav } from './components/layout/TopNav';
import { MoreDrawer, NavRail, MobileNav } from './components/layout/NavRail';
import { MobileSheets } from './components/layout/MobileSheets';
import { Onboarding } from './components/layout/Onboarding';
import { UserLocationModal } from './components/layout/UserLocationModal';
import { WeatherMap } from './components/map/WeatherMap';
import { Toasts, Stat } from './components/common/ui';
import { useSnapshot, useStore, useVisibleEvents } from './store/useStore';
import { CAT_META, SEV_META } from './lib/utils';

import { EventsPage } from './pages/Events';
import { AlertsPage } from './pages/Alerts';
import { ForecastPage } from './pages/Forecast';
import { AboutPage } from './pages/About';

/* pages outside the main six are loaded on demand */
const AnalyticsPage = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.AnalyticsPage })));
const Overview = lazy(() => import('./pages/Overview').then((m) => ({ default: m.Overview })));
const Tracking = lazy(() => import('./pages/EventViews').then((m) => ({ default: m.Tracking })));
const Historical = lazy(() => import('./pages/EventViews').then((m) => ({ default: m.Historical })));
const AIInsights = lazy(() => import('./pages/EventViews').then((m) => ({ default: m.AIInsights })));
const Architecture = lazy(() => import('./pages/Architecture').then((m) => ({ default: m.Architecture })));
const SystemData = lazy(() => import('./pages/Architecture').then((m) => ({ default: m.SystemData })));

export default function App() {
  const view = useStore((s) => s.view);
  const trackedEventId = useStore((s) => s.trackedEventId);

  /* ---------------- keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useStore.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        st.setPlaying(!st.playing);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        st.setPlaying(false);
        st.nudgeTime(6);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        st.setPlaying(false);
        st.nudgeTime(-6);
      } else if (e.key === 'Escape') {
        st.selectEvent(null);
        st.setMoreOpen(false);
        st.setLayersOpen(false);
      } else {
        const k = e.key.toLowerCase();
        if (k === 'r') st.resetView();
        else if (k === 'm') st.setView('map');
        else if (k === 'e') st.setView('events');
        else if (k === 'a') st.setView('analytics');
        else if (k === 'f') st.setView('forecast');
        else if (k === 'l') st.setView('alerts');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* playback stops when the map is not on screen */
  useEffect(() => {
    if (view !== 'map') useStore.getState().setPlaying(false);
  }, [view]);

  const isMap = view === 'map';

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-950">
      <TopNav />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <NavRail />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {isMap ? (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="relative min-w-0 flex-1 overflow-hidden">
                <WeatherMap />
              </div>
            </div>
          ) : (
            <main className="min-h-0 flex-1 overflow-y-auto bg-ink-950">
              <Suspense fallback={<PageLoading />}>
                {view === 'events' && <EventsPage />}
                {view === 'alerts' && <AlertsPage />}
                {view === 'forecast' && <ForecastPage />}
                {view === 'about' && <AboutPage />}
                {view === 'analytics' && <AnalyticsPage />}
                {view === 'overview' && <Overview />}
                {view === 'tracking' && <Tracking />}
                {view === 'historical' && <Historical />}
                {view === 'ai' && <AIInsights />}
                {view === 'architecture' && <Architecture />}
                {view === 'system' && <SystemData />}
              </Suspense>
            </main>
          )}
        </div>
      </div>

      <MobileNav />

      <MoreDrawer />
      <MobileSheets />
      <Onboarding />
      <UserLocationModal />
      <Toasts />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Four numbers. Nothing else.                                         */
/* ------------------------------------------------------------------ */
function TopSummary() {
  const snap = useSnapshot();
  const setView = useStore((s) => s.setView);
  const focus = useStore((s) => s.focusCategory);
  const goAlerts = () => setView('alerts');
  /* when the map is dedicated to one hazard, these numbers must describe that
     hazard — otherwise the header would contradict what the map is showing */
  const { visible } = useVisibleEvents();
  const scoped = focus !== null;
  const activeCount = scoped ? visible.length : snap.stats.activeCount;
  const extremeCount = scoped ? visible.filter((e) => e.severity === 'EXTREME').length : snap.stats.extremeCount;
  const regionCount = scoped ? new Set(visible.flatMap((e) => e.corridor)).size : snap.stats.highRiskRegions;
  return (
    <section className="shrink-0 border-b border-edge bg-ink-900/60 px-3 py-2.5 sm:px-4" aria-label="Current situation at a glance">
      {scoped && (
        <p className="mb-1.5 text-[10.5px] text-txt-lo">
          Showing <span className="font-semibold text-txt-mid">{CAT_META[focus].label}</span> only
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="Active Events"
          value={activeCount}
          icon={<TriangleAlert size={12} className="text-brand-300" />}
          tip="Events currently being tracked"
          onClick={() => setView('events')}
        />
        <Stat
          label="Extreme Events"
          value={extremeCount}
          tone={SEV_META.EXTREME.color}
          icon={<Flame size={12} className="text-rose-400" />}
          tip="The most serious class — act now"
          onClick={goAlerts}
        />
        <Stat
          label="High-Risk Regions"
          value={regionCount}
          tone={SEV_META.HIGH.color}
          icon={<MapPin size={12} className="text-orange-400" />}
          tip="Districts and states with a high combined risk score"
          onClick={() => setView('analytics')}
        />
        <Stat
          label="Forecast Horizon"
          value={120}
          unit="h"
          icon={<Timer size={12} className="text-sky-300" />}
          tip="How far ahead the model forecasts. The timeline runs to +168h"
        />
      </div>
    </section>
  );
}

function PageLoading() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center">
      <div className="flex flex-col items-center gap-2.5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/25 border-t-brand-400" />
        <p className="text-[12px] text-txt-lo">Loading…</p>
      </div>
    </div>
  );
}
