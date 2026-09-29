import { memo, useEffect, useRef, useState } from 'react';
import { Activity, Bell, ChevronRight, Database, MapPin, Menu, Radio, Search, ShieldCheck, X } from 'lucide-react';
import { getSnapshot, useSnapshot, useStore } from '../../store/useStore';
import { ALL_PLACES } from '../../data/places';
import { cn } from '../../lib/utils';
import { CAT_PLAIN, TIPS } from '../../lib/design';
import { Tip, TipButton } from '../common/ui';
import { api } from '../../services/api';

export const TopNav = memo(function TopNav() {
  const snap = useSnapshot();
  const setView = useStore((s) => s.setView);
  const view = useStore((s) => s.view);
  const readAlerts = useStore((s) => s.readAlerts);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const startOnboarding = useStore((s) => s.startOnboarding);

  const userLocation = useStore((s) => s.userLocation);
  const setLocationModalOpen = useStore((s) => s.setLocationModalOpen);
  const dataSourceMode = useStore((s) => s.dataSourceMode);
  const setDataSourceMode = useStore((s) => s.setDataSourceMode);
  const dataSourceMeta = useStore((s) => s.dataSourceMeta);
  const pushToast = useStore((s) => s.pushToast);

  const unread = snap.alerts.filter((a) => !readAlerts.includes(a.id) && !a.read).length;

  const handleToggleDataSource = async () => {
    if (dataSourceMode === 'DEMO') {
      try {
        const health = await api.health();
        if (health.mode === 'REAL') {
          setDataSourceMode('REAL');
          pushToast({
            kind: 'ok',
            title: 'CONNECTED TO REAL DATA PIPELINE',
            msg: `Ingesting live meteorological fields: ${dataSourceMeta.model || 'ECMWF IFS 0.25°'}`,
          });
        } else {
          pushToast({
            kind: 'warn',
            title: 'REAL DATA UNAVAILABLE — DEMO MODE ACTIVE',
            msg: 'Python backend is offline. Start the backend with `python -m uvicorn backend.app:app` to stream real data.',
          });
        }
      } catch {
        pushToast({
          kind: 'warn',
          title: 'REAL DATA UNAVAILABLE — DEMO MODE ACTIVE',
          msg: 'Python backend is offline. Start the backend with `python -m uvicorn backend.app:app` to stream real data.',
        });
      }
    } else {
      setDataSourceMode('DEMO');
      pushToast({
        kind: 'info',
        title: 'SWITCHED TO DEMO MODE',
        msg: 'Now running deterministic client-side medium-range simulation.',
      });
    }
  };

  return (
    <header className="relative z-40 flex h-13 shrink-0 items-center justify-between gap-3 border-b border-edge bg-ink-950/90 px-3 py-2 backdrop-blur-md sm:px-4">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5">
        <TipButton
          tip="Show navigation menu"
          label="Open navigation menu"
          className="btn-icon lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
        </TipButton>

        <button
          className="group flex items-center gap-2.5 rounded-lg text-left outline-none transition-opacity hover:opacity-90"
          onClick={() => setView('map')}
          aria-label="Go to the map"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/10 text-brand-300 shadow-sm transition-colors group-hover:border-brand-400/60">
            <Radio size={16} className="text-brand-400" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold tracking-tight text-txt-hi">SIHTRACK</span>
              <span className="rounded border border-brand-500/30 bg-brand-500/10 px-1 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-brand-300">
                AI GIS
              </span>
            </div>
            <span className="block text-[10px] font-medium tracking-wide text-txt-lo">
              Extreme Weather Intelligence
            </span>
          </div>
        </button>
      </div>

      {/* Center: Search */}
      <div className="hidden max-w-[380px] flex-1 sm:block md:max-w-[420px]">
        <SearchBox />
      </div>

      {/* Right: Events, Alerts, My Location, Data Source, Help */}
      <div className="flex shrink-0 items-center gap-2">
        <Tip text="View all detected extreme weather events">
          <button
            className={cn(
              'btn !h-8 !py-1 text-[12px]',
              view === 'events' && 'border-brand-500/60 bg-brand-500/15 text-brand-300'
            )}
            onClick={() => setView('events')}
            aria-label={`Events: ${snap.stats.activeCount} active`}
          >
            <Activity size={13} className="text-brand-400" />
            <span className="hidden md:inline">Events</span>
            <span className="mono rounded bg-ink-800 px-1.5 py-0.5 text-[10.5px] font-bold text-txt-hi">
              {snap.stats.activeCount}
            </span>
          </button>
        </Tip>

        <Tip text="Important warnings requiring attention">
          <button
            className={cn(
              'btn relative !h-8 !py-1 text-[12px]',
              view === 'alerts' && 'border-rose-500/60 bg-rose-500/15 text-rose-300'
            )}
            onClick={() => setView('alerts')}
            aria-label={`Alerts: ${unread} unread`}
          >
            <Bell size={13} className={unread > 0 ? 'text-rose-400' : 'text-txt-mid'} />
            <span className="hidden md:inline">Alerts</span>
            {unread > 0 && (
              <span className="mono rounded bg-rose-500/90 px-1.5 py-0.5 text-[10.5px] font-bold text-white shadow-sm">
                {unread}
              </span>
            )}
          </button>
        </Tip>

        {/* Use My Location Trigger */}
        <Tip text={userLocation ? 'Your Location Active · Inspect nearby weather hazards' : 'Use My Location · Inspect nearest extreme weather anomalies'}>
          <button
            className={cn(
              'btn !h-8 !py-1 text-[12px] flex items-center gap-1.5',
              userLocation && 'border-sky-500/60 bg-sky-500/15 text-sky-300'
            )}
            onClick={() => setLocationModalOpen(true)}
            aria-label="Use My Location"
          >
            <MapPin size={13} className={userLocation ? 'text-sky-400' : 'text-txt-mid'} />
            <span className="hidden lg:inline">My Location</span>
          </button>
        </Tip>

        {/* Real Data / Demo Mode Toggle & Status */}
        <div className="hidden items-center gap-2 border-l border-edge pl-2 sm:flex">
          <Tip text={dataSourceMode === 'REAL' ? 'Live Data Mode · ECMWF IFS 0.25° NWP (Click to switch to Demo)' : 'Demo Simulation Mode (Click to connect Real Data backend)'}>
            <button
              onClick={handleToggleDataSource}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                dataSourceMode === 'REAL'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', dataSourceMode === 'REAL' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} aria-hidden />
              {dataSourceMode === 'REAL' ? (dataSourceMeta.model || 'ECMWF IFS') : 'Demo Mode'}
            </button>
          </Tip>

          <Tip text="System ready · 120h Medium-Range AI Engine">
            <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-edge bg-ink-900 px-2 py-0.5 text-[10px] font-medium text-txt-lo">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Ready
            </span>
          </Tip>
        </div>

        <Tip text="Keyboard shortcuts & quick guide">
          <button
            className="btn-icon !h-8 !w-8"
            onClick={startOnboarding}
            aria-label="Help and shortcuts"
          >
            ?
          </button>
        </Tip>
      </div>
    </header>
  );
});

/* ------------------------------------------------------------------ */
/* Debounced global search                                             */
/* ------------------------------------------------------------------ */
function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ label: string; sub: string; kind: 'event' | 'place'; run: () => void }[]>([]);
  const selectEvent = useStore((s) => s.selectEvent);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const setView = useStore((s) => s.setView);
  const pushToast = useStore((s) => s.pushToast);
  const currentTime = useStore((s) => s.currentTime);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-search]')) {
        setOpen(false);
        setQ('');
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  useEffect(() => {
    const s = q.trim().toLowerCase();
    if (!s) {
      setResults([]);
      return;
    }
    const h = window.setTimeout(() => {
      // 1. Direct coordinate pattern matching (e.g., "28.36, 79.41" or "28.36 79.41" or "28.36N 79.41E")
      const coordResults: { label: string; sub: string; kind: 'place'; run: () => void }[] = [];
      const numParts = s.replace(/[°NSEWnsew,]/g, ' ').trim().split(/\s+/).filter(Boolean);
      if (numParts.length === 2) {
        const lat = parseFloat(numParts[0]);
        const lon = parseFloat(numParts[1]);
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          coordResults.push({
            label: `Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
            sub: 'Geographic coordinate target · Inspect local anomalies',
            kind: 'place',
            run: () => {
              requestFlyTo({ name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, kind: 'Coordinates', lat, lon, zoom: 7.8 });
              setView('map');
              pushToast({ kind: 'info', title: 'Moved to Coordinates', msg: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E` });
            },
          });
        }
      }

      const events = getSnapshot(currentTime)
        .events.filter(
          (ev) =>
            ev.id.toLowerCase().includes(s) ||
            CAT_PLAIN[ev.category].toLowerCase().includes(s) ||
            ev.anchor.toLowerCase().includes(s) ||
            ev.corridor.some((c) => c.toLowerCase().includes(s))
        )
        .slice(0, 4)
        .map((ev) => ({
          label: CAT_PLAIN[ev.category],
          sub: `${ev.anchor} · ${ev.severity}`,
          kind: 'event' as const,
          run: () => {
            selectEvent(ev.id, { fly: true });
            setView('map');
          },
        }));

      const places = ALL_PLACES.filter((p) => p.name.toLowerCase().includes(s) || (p.state && p.state.toLowerCase().includes(s)))
        .slice(0, 5)
        .map((p) => ({
          label: p.name,
          sub: `${p.kind}${p.state ? ' · ' + p.state : ''}`,
          kind: 'place' as const,
          run: () => {
            requestFlyTo({ name: p.name, kind: p.kind, lat: p.lat, lon: p.lon, zoom: 6.8, state: p.state });
            setView('map');
            pushToast({ kind: 'info', title: `Moved to ${p.name}`, msg: 'Map centered on search result.' });
          },
        }));

      setResults([...coordResults, ...places, ...events]);
    }, 160);
    return () => window.clearTimeout(h);
  }, [q, currentTime, requestFlyTo, selectEvent, setView, pushToast]);

  return (
    <div data-search className="relative w-full">
      <div
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg border bg-ink-900/90 px-2.5 transition-colors',
          open ? 'border-brand-500/60 bg-ink-900 shadow-sm' : 'border-edge hover:border-edge2'
        )}
      >
        <Search size={14} className="shrink-0 text-txt-lo" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder="Search state, district, city or lat, lon…"
          aria-label="Search states, cities, districts and events"
          title={TIPS.search}
          className="h-full w-full bg-transparent text-[12px] text-txt-hi outline-none placeholder:text-txt-lo"
        />
        {q && (
          <button
            className="btn !h-5 !min-h-0 !w-5 !border-0 !bg-transparent !p-0 text-txt-lo hover:text-txt-hi"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-edge bg-ink-900/98 shadow-pop animate-fade-in">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                r.run();
                setQ('');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-800"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-txt-hi">{r.label}</span>
                <span className="block truncate text-[11px] text-txt-lo">{r.sub}</span>
              </span>
              <span className="shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-txt-lo">
                {r.kind}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && q.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-edge bg-ink-900/98 px-3 py-3 text-[12px] text-txt-lo shadow-pop">
          No location or event matches “{q.trim()}”.
        </div>
      )}
    </div>
  );
}
