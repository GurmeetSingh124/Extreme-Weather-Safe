import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Play, Sparkles } from 'lucide-react';
import { GoogleMapEngine } from './GoogleMapEngine';
import { LayersPanel, Legend, MapControls, MapHeaderCard } from './MapOverlays';
import { EventDrawer } from './EventDrawer';
import { toEventView } from './adapter';
import { TimelineBar } from './TimelineBar';
import { MapError } from './MapError';
import { setEngineHandle } from './engineHandle';
import { useSnapshot, useStore, useMapFocus } from '../../store/useStore';
import { api } from '../../services/api';
import { T_MAX, T_MIN } from '../../data/engine';
import type { LayerId } from '../../types';
import type { MapEngineLike } from './types';
import { EmptyState } from '../common/ui';

const RASTER_LAYERS: LayerId[] = ['anomaly', 'risk', 'temp', 'rain', 'storm', 'wind', 'pressure', 'humidity'];

/**
 * The Map is the Hero:
 * Immediate India view, clean dark basemap, professional SVG markers,
 * smooth 60fps trajectory animation, and right-side Event Details Drawer.
 */
export const WeatherMap = memo(function WeatherMap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GoogleMapEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [basemap, setBasemapState] = useState({ provider: 'loading', offline: false, loading: true });
  const [fatal, setFatal] = useState<{ message: string; hint: string } | null>(null);

  const basemapId = useStore((s) => s.basemap);
  const layers = useStore((s) => s.layers);
  const currentTime = useStore((s) => s.currentTime);
  const trackedEventId = useStore((s) => s.trackedEventId);
  const selectEvent = useStore((s) => s.selectEvent);
  const selectDemoEvent = useStore((s) => s.selectDemoEvent);
  const resetViewNonce = useStore((s) => s.resetViewNonce);
  const flyTo = useStore((s) => s.flyTo);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const showTracks = useStore((s) => s.showTracks);
  const showCorridors = useStore((s) => s.showCorridors);
  const showEta = useStore((s) => s.showEta);
  const showLabels = useStore((s) => s.showLabels);
  const showStateLabels = useStore((s) => s.showStateLabels);
  const clusterEvents = useStore((s) => s.clusterEvents);
  const setView = useStore((s) => s.setView);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const playSpeed = useStore((s) => s.playSpeed);
  const setPlaySpeed = useStore((s) => s.setPlaySpeed);
  const setTime = useStore((s) => s.setTime);
  const trackEvent = useStore((s) => s.trackEvent);
  const drawerOpen = useStore((s) => s.drawerOpen);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);
  const userLocation = useStore((s) => s.userLocation);

  const snap = useSnapshot();
  const { active: focused, hiddenIds, list, index, step, goTo } = useMapFocus();

  const getEngine = useCallback((): MapEngineLike | null => engineRef.current, []);

  /* ---------------- Engine lifecycle ---------------- */
  useEffect(() => {
    if (!mapEl.current) return;
    let engine: GoogleMapEngine;
    try {
      engine = new GoogleMapEngine(mapEl.current, {
        onSelect: (id) => {
          if (id) {
            selectEvent(id, { fly: true });
          } else {
            selectEvent(null);
          }
        },
        onReady: () => setReady(true),
        onBaseStatus: (s) => setBasemapState({ provider: s.provider, offline: s.offline, loading: s.loading }),
        onFatal: (message, hint) => setFatal({ message, hint }),
      });
    } catch (err) {
      console.error('[Map] failed to initialise', err);
      setReady(true);
      return;
    }
    engineRef.current = engine;
    setEngineHandle(engine);

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(mapEl.current);
    const onWin = () => engine.resize();
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
      setEngineHandle(null);
      engine.destroy();
      engineRef.current = null;
    };
  }, [selectEvent]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => engineRef.current?.resize(), 60);
    return () => window.clearTimeout(id);
  }, [ready, trackedEventId, resetViewNonce, drawerOpen]);

  useEffect(() => {
    if (ready) engineRef.current?.setBasemap(basemapId);
  }, [basemapId, ready]);

  useEffect(() => {
    if (ready) engineRef.current?.setLayerVisibility(layers as Record<string, boolean>);
  }, [layers, ready]);

  useEffect(() => {
    if (ready) engineRef.current?.setStateLabelsVisible(showStateLabels);
  }, [showStateLabels, ready]);

  useEffect(() => {
    if (ready && resetViewNonce) engineRef.current?.reset();
  }, [resetViewNonce, ready]);

  useEffect(() => {
    if (!ready || !flyTo) return;
    engineRef.current?.flyTo(flyTo.lon, flyTo.lat, flyTo.zoom);
    requestFlyTo(null);
  }, [flyTo, ready, requestFlyTo]);

  useEffect(() => {
    if (ready) engineRef.current?.setUserLocation(userLocation);
  }, [userLocation, ready]);

  /* ---------------- Weather raster overlays ---------------- */
  useEffect(() => {
    if (!ready) return;
    const active = RASTER_LAYERS.filter((l) => layers[l]);
    if (!active.length) return;
    const rounded = Math.round(currentTime * 2) / 2;
    const events = snap.events;
    let cancelled = false;
    const gen = (genRefSeq.current += 1);

    (async () => {
      for (const layer of active) {
        await new Promise((r) => setTimeout(r, 0));
        if (cancelled || gen !== genRefSeq.current) return;
        const grid = await api.field(layer, rounded, events);
        if (cancelled || gen !== genRefSeq.current) return;
        engineRef.current?.setField(layer, grid);
        if (layer === 'wind') engineRef.current?.setWindField(await api.wind(rounded, events));
      }
      if (cancelled || gen !== genRefSeq.current) return;
      if (layers.wind && !active.includes('wind')) engineRef.current?.setWindField(await api.wind(rounded, events));
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, currentTime, layers, snap.events]);

  /* ---------------- Events, markers, tracks ---------------- */
  useEffect(() => {
    if (!ready) return;
    let raf = requestAnimationFrame(() =>
      engineRef.current?.updateEvents(snap.events, {
        showTracks,
        showCorridors,
        showEta,
        showLabels,
        showStateLabels,
        showDistricts: false,
        selectedId: focused?.id ?? null,
        hiddenIds,
        t: currentTime,
        cluster: clusterEvents,
      })
    );
    return () => cancelAnimationFrame(raf);
  }, [
    ready,
    snap.events,
    focused?.id,
    hiddenIds,
    showTracks,
    showCorridors,
    showEta,
    showLabels,
    showStateLabels,
    clusterEvents,
    currentTime,
  ]);

  /* Animated track layer */
  useEffect(() => {
    if (!ready) return;
    engineRef.current?.setTrackedEvent(focused ?? null, currentTime, playing);
  }, [ready, focused, currentTime, playing]);

  /* Loading progress simulation */
  useEffect(() => {
    if (ready) return;
    const id = window.setInterval(() => setProgress((p) => Math.min(94, p + 8)), 160);
    return () => window.clearInterval(id);
  }, [ready]);

  const handleStartDemo = () => {
    selectDemoEvent();
    setPlaying(true);
  };

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#070c18]">
      {/* Map Canvas */}
      <div
        ref={mapEl}
        className="absolute inset-0"
        role="application"
        aria-label="Extreme weather intelligence map of India"
      />

      {/* Top-Left: Minimal Map Header (Section 11) & Demo Showcase Button */}
      <div
        className="pointer-events-auto absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <MapHeaderCard status={basemap} />
        <button
          onClick={handleStartDemo}
          className="btn !h-7 gap-1.5 !px-2.5 text-[11px] font-semibold border-brand-500/40 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20"
          title="Play interactive demonstration track (Requirement 48)"
        >
          <Sparkles size={12} className="text-brand-400" />
          <span>Interactive Demo Track</span>
        </button>
      </div>

      {/* Top-Right: Layers & Map Controls (Section 10 & 12) */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <LayersPanel engine={getEngine} />
        <MapControls engine={getEngine} />
      </div>

      {/* Bottom-Left: Minimal Legend */}
      <div className="absolute bottom-[88px] left-3 z-20 hidden sm:block" onClick={(e) => e.stopPropagation()}>
        <Legend />
      </div>

      {/* The ONE Event Details Drawer (Section 19, 20, 21) */}
      {focused && drawerOpen && (
        <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
          <EventDrawer
            event={toEventView(focused)}
            index={index >= 0 ? index : 0}
            total={list.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onTrack={() => {
              trackEvent(focused.id);
              getEngine()?.focusEvent(focused);
            }}
            onClose={() => setDrawerOpen(false)}
            nowHour={0}
          />
        </div>
      )}

      {/* Minimal Error State (Section 40) */}
      {fatal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <MapError
            cause={fatal.message}
            onRetry={() => window.location.reload()}
            onViewData={() => setView('events')}
          />
        </div>
      )}

      {/* Empty State */}
      {ready && !snap.events.length && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4">
          <div className="pointer-events-auto w-full max-w-[380px]">
            <EmptyState
              title="No Extreme Events Detected"
              body="No extreme weather anomalies meet current filters at this timeline step. Move the timeline or clear filters."
              icon={<AlertCircle size={24} className="text-txt-lo" />}
              action={
                <button className="btn mt-2 !py-1.5 text-[12px]" onClick={() => useStore.getState().resetFilters()}>
                  Reset Filters
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* Loading state */}
      {!ready && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#070c18]" data-loading="true">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-400" />
          <p className="text-[12px] font-medium text-txt-mid">Initializing India Map…</p>
          <div className="h-1 w-36 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-brand-400 transition-[width] duration-180" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Bottom: PAST / NOW / FORECAST timeline (Section 22 & 23) */}
      <div onClick={(e) => e.stopPropagation()}>
        <TimelineBar
          value={currentTime}
          onChange={setTime}
          min={T_MIN}
          max={T_MAX}
          now={0}
          playing={playing}
          onPlayingChange={setPlaying}
          speed={playSpeed}
          onSpeedChange={setPlaySpeed}
          jumps={[-24, -12, 0, 12, 24, 48, 72]}
        />
      </div>
    </div>
  );
});

const genRefSeq = { current: 0 };
