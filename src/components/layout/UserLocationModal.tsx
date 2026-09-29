import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Crosshair,
  AlertTriangle,
  Compass,
  ArrowRight,
  ShieldCheck,
  X,
  LocateFixed,
  Route,
  Activity,
} from 'lucide-react';
import { useSnapshot, useStore } from '../../store/useStore';
import { haversineKm, bearingDeg, headingLabel, SEV_META } from '../../lib/utils';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/design';
import { WeatherIcon } from '../common/WeatherIcon';
import type { WeatherEvent } from '../../types';

interface NearbyEventRecord {
  event: WeatherEvent;
  distanceKm: number;
  direction: string;
  bearing: number;
  etaHours?: number;
}

export function UserLocationModal() {
  const open = useStore((s) => s.locationModalOpen);
  const setOpen = useStore((s) => s.setLocationModalOpen);
  const userLoc = useStore((s) => s.userLocation);
  const setUserLoc = useStore((s) => s.setUserLocation);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectEvent = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);
  const snap = useSnapshot();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Request user location only upon explicit user click
  const handleRequestLocation = () => {
    if (!('geolocation' in navigator)) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setUserLoc(loc);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg('Location access was not granted.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMsg('Location information is unavailable.');
        } else if (err.code === err.TIMEOUT) {
          setErrorMsg('Location request timed out.');
        } else {
          setErrorMsg('Location access was not granted.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Center map on user coordinates
  const handleCenterOnMe = () => {
    if (!userLoc) return;
    requestFlyTo({
      name: 'Your Location',
      kind: 'Region',
      lat: userLoc.lat,
      lon: userLoc.lon,
      zoom: 8.5,
    });
    setView('map');
    setOpen(false);
  };

  // Sort events by geographic distance from user location
  const nearbyList: NearbyEventRecord[] = useMemo(() => {
    if (!userLoc || !snap.events.length) return [];
    return snap.events
      .map((ev) => {
        const d = haversineKm(userLoc.lat, userLoc.lon, ev.lat, ev.lon);
        const b = bearingDeg(userLoc.lat, userLoc.lon, ev.lat, ev.lon);
        const heading = headingLabel(b);
        const eta = ev.etas?.[0]?.etaH;
        return {
          event: ev,
          distanceKm: Math.round(d),
          direction: heading,
          bearing: Math.round(b),
          etaHours: eta,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [userLoc, snap.events]);

  const nearest = nearbyList[0];

  // Nearby composite risk calculation
  const nearbyRisk = useMemo(() => {
    if (!nearest) return { level: 'LOW', color: '#22c55e', text: 'No imminent threat' };
    if (nearest.distanceKm < 120 && (nearest.event.severity === 'EXTREME' || nearest.event.severity === 'HIGH')) {
      return { level: 'SEVERE', color: '#ef4444', text: `High risk within ${nearest.distanceKm} km` };
    }
    if (nearest.distanceKm < 250) {
      return { level: 'MODERATE', color: '#eab308', text: `Advisory monitoring (${nearest.distanceKm} km away)` };
    }
    return { level: 'NORMAL', color: '#22c55e', text: `Nearest event ${nearest.distanceKm} km away` };
  }, [nearest]);

  const handleOpenEvent = (eventId: string) => {
    selectEvent(eventId, { fly: true });
    setView('map');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-location-title"
    >
      <div
        className="w-full max-w-[460px] rounded-2xl border border-edge bg-ink-950/98 shadow-2xl p-5 text-txt-hi space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand-500/40 bg-brand-500/10 text-brand-300">
              <LocateFixed size={16} />
            </span>
            <div>
              <h2 id="user-location-title" className="text-[14px] font-bold tracking-tight text-txt-hi">
                Local Meteorological Intelligence
              </h2>
              <span className="text-[11px] text-txt-lo">Browser Geolocation & Proximity Analysis</span>
            </div>
          </div>
          <button
            className="btn-icon !h-7 !w-7"
            onClick={() => setOpen(false)}
            aria-label="Close user location dialog"
          >
            <X size={14} />
          </button>
        </div>

        {/* Location status / Request action */}
        {!userLoc ? (
          <div className="rounded-xl border border-dashed border-edge/80 bg-ink-900/40 p-4 text-center space-y-3">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-brand-500/10 text-brand-400">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-txt-hi">Detect Weather Threats Near You</div>
              <p className="text-[11.5px] text-txt-lo max-w-[340px] mx-auto mt-0.5 leading-relaxed">
                Click below to request your device position and calculate distance to active cyclones, heavy rainfall and convective storm corridors.
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-rose-500/12 border border-rose-500/30 px-3 py-2 text-[12px] text-rose-300 flex items-center justify-center gap-2">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              className="sih-btn sih-btn-primary w-full !h-10 text-[13px]"
              onClick={handleRequestLocation}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Requesting Location…</span>
                </>
              ) : (
                <>
                  <Crosshair size={15} />
                  <span>Use My Location</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* User Location Coordinates Card */}
            <div className="rounded-xl border border-edge bg-ink-900/60 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-txt-hi">
                    YOUR LOCATION
                  </span>
                </div>
                <button
                  className="sih-btn !h-6 !px-2 text-[11px] text-txt-lo hover:text-txt-hi"
                  onClick={handleRequestLocation}
                  title="Refresh location"
                >
                  Refresh
                </button>
              </div>

              <div className="flex items-baseline justify-between text-[13px]">
                <span className="mono text-txt-hi font-bold">
                  {userLoc.lat.toFixed(4)}°N, {userLoc.lon.toFixed(4)}°E
                </span>
                <span className="text-[11px] text-txt-lo">
                  GPS Accuracy: ±{Math.round(userLoc.accuracy || 25)}m
                </span>
              </div>

              {/* Nearby Risk Summary */}
              <div
                className="flex items-center justify-between p-2 rounded-lg text-[12px]"
                style={{
                  background: `color-mix(in srgb, ${nearbyRisk.color} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${nearbyRisk.color} 30%, transparent)`,
                }}
              >
                <div className="flex items-center gap-2">
                  <Activity size={14} style={{ color: nearbyRisk.color }} />
                  <span className="font-semibold" style={{ color: nearbyRisk.color }}>
                    {nearbyRisk.level} RISK
                  </span>
                </div>
                <span className="text-[11.5px] text-txt-lo">{nearbyRisk.text}</span>
              </div>

              {/* Center Map Action */}
              <button
                className="sih-btn sih-btn-primary w-full !h-8 text-[12px]"
                onClick={handleCenterOnMe}
              >
                <Crosshair size={13} /> Center Map on Me
              </button>
            </div>

            {/* Nearest Event Highlight */}
            {nearest && (
              <div className="rounded-xl border border-edge bg-ink-900/40 p-3 space-y-2">
                <div className="text-[11px] font-semibold text-txt-lo uppercase tracking-wider flex items-center justify-between">
                  <span>Nearest Extreme Hazard</span>
                  <span
                    className="font-bold text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      color: SEVERITY_COLOR[nearest.event.severity],
                      background: `color-mix(in srgb, ${SEVERITY_COLOR[nearest.event.severity]} 15%, transparent)`,
                    }}
                  >
                    {SEVERITY_LABEL[nearest.event.severity]}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 grid h-7 w-7 place-items-center rounded-full border shrink-0"
                      style={{
                        borderColor: SEVERITY_COLOR[nearest.event.severity],
                        color: SEVERITY_COLOR[nearest.event.severity],
                      }}
                    >
                      <WeatherIcon type={nearest.event.category} size={14} />
                    </span>
                    <div>
                      <div className="text-[13px] font-bold text-txt-hi">{nearest.event.name}</div>
                      <div className="text-[11px] text-txt-lo">
                        {nearest.event.id} · {nearest.event.anchor}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 py-1.5 px-2 rounded bg-ink-950/70 border border-edge/60 text-center text-[11px]">
                  <div>
                    <span className="block text-txt-lo text-[10px]">Distance</span>
                    <b className="text-txt-hi">{nearest.distanceKm} km</b>
                  </div>
                  <div>
                    <span className="block text-txt-lo text-[10px]">Direction</span>
                    <b className="text-txt-hi">{nearest.direction} ({nearest.bearing}°)</b>
                  </div>
                  <div>
                    <span className="block text-txt-lo text-[10px]">Severity</span>
                    <b style={{ color: SEVERITY_COLOR[nearest.event.severity] }}>
                      {SEVERITY_LABEL[nearest.event.severity]}
                    </b>
                  </div>
                </div>

                <button
                  className="sih-btn w-full !h-8 text-[12px] flex items-center justify-center gap-1.5"
                  onClick={() => handleOpenEvent(nearest.event.id)}
                >
                  <span>Inspect Event Details</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* Other Nearby Events List */}
            {nearbyList.length > 1 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-txt-lo uppercase tracking-wider px-1">
                  Other Active Hazards Sorted by Distance
                </div>
                <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                  {nearbyList.slice(1, 5).map((item) => (
                    <div
                      key={item.event.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-ink-900/60 border border-edge/60 text-[11.5px] hover:border-edge2 cursor-pointer transition-colors"
                      onClick={() => handleOpenEvent(item.event.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span style={{ color: SEVERITY_COLOR[item.event.severity] }}>
                          <WeatherIcon type={item.event.category} size={13} />
                        </span>
                        <div className="truncate">
                          <span className="text-txt-hi font-medium truncate block">{item.event.name}</span>
                          <span className="text-txt-lo text-[10px]">{item.event.anchor}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="mono font-bold text-txt-hi">{item.distanceKm} km</span>
                        <span className="block text-[10px] text-txt-lo">{item.direction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
