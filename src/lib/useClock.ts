import { useEffect, useState } from 'react';

/** Ticking clock used by the live status bar and the map coordinate readout. */
export function useLiveClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    now,
    utc: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
    local: `${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    local12: `${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`,
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    /** most recent 6-hourly NWP cycle boundary */
    cycle: `${pad(Math.floor(d.getUTCHours() / 6) * 6)}Z`,
  };
}
