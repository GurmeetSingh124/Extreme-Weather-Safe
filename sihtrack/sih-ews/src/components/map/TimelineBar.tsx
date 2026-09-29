import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface Props {
  /** absolute hours, matching the store's single clock */
  value: number;
  onChange: (t: number) => void;
  min: number;
  max: number;
  /** the hour that counts as NOW, marked on the track */
  now: number;
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  jumps: number[];
}

const SPEEDS = [1, 2, 4, 6];

/**
 * PAST / NOW / FORECAST slider, play, speed and jump chips.
 *
 * Adapted from the redesign: the store clock is absolute hours, so the redesign's
 * `min`/`max` are now passed in and the NOW marker is an explicit prop rather
 * than being hard-coded to 0.
 */
export function TimelineBar({
  value, onChange, min, max, now, playing, onPlayingChange, speed, onSpeedChange, jumps,
}: Props) {
  const latest = useRef(value);
  latest.current = value;

  /* Playback clock: one simulated hour per real second, times speed. The store
     is written at ~10 Hz and the map marker eases between writes, so motion
     still looks continuous without re-rendering React on every frame. */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastWrite = 0;
    let t = latest.current;
    const tick = (nowMs: number) => {
      t += ((nowMs - last) / 1000) * speed;
      last = nowMs;
      if (t >= max) {
        onChange(max);
        onPlayingChange(false);
        return;
      }
      if (t < min) t = min;
      if (nowMs - lastWrite > 100) {
        onChange(t);
        lastWrite = nowMs;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, min, max, onChange, onPlayingChange]);

  const nowPct = ((now - min) / (max - min)) * 100;

  return (
    <div className="sih-tl sih-glass" role="group" aria-label="Timeline">
      <button
        className="sih-btn sih-btn-primary"
        style={{ width: 38, height: 38, borderRadius: '50%', padding: 0, flexShrink: 0 }}
        onClick={() => onPlayingChange(!playing)}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <button
        className="sih-chip"
        onClick={() => onSpeedChange(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        aria-label="Playback speed"
      >
        {speed}×
      </button>

      <div className="sih-tl-track">
        <div
          className="sih-muted"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.12em' }}
        >
          <span>PAST</span>
          <span style={{ color: 'var(--sih-forecast)' }}>FORECAST</span>
        </div>
        <div className="sih-tl-now" style={{ left: `${nowPct}%` }}>
          <span>NOW</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Time offset in hours"
          aria-valuetext={value === now ? 'Now' : `${value > now ? '+' : ''}${(value - now).toFixed(1)} hours from now`}
        />
      </div>

      <div className="sih-jumps" style={{ display: 'flex', gap: 2 }}>
        {jumps.map((j) => (
          <button
            key={j}
            className={`sih-chip${Math.abs(value - j) < 0.25 ? ' on' : ''}`}
            onClick={() => onChange(j)}
            aria-label={j === now ? 'Jump to now' : `Jump to ${j > now ? '+' : ''}${j - now} hours`}
          >
            {j === now ? 'NOW' : `${j > now ? '+' : '−'}${Math.abs(Math.round(j - now))}h`}
          </button>
        ))}
      </div>
    </div>
  );
}
