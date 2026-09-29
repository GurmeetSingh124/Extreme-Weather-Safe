import { useEffect, useRef } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

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

export function TimelineBar({
  value,
  onChange,
  min,
  max,
  now,
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  jumps,
}: Props) {
  const latest = useRef(value);
  latest.current = value;

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
  const isPast = value < now;

  return (
    <div className="sih-tl sih-glass" role="group" aria-label="Timeline">
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          className="sih-chip !p-1.5 text-slate-400 hover:text-white"
          onClick={() => {
            onPlayingChange(false);
            onChange(Math.max(min, value - 6));
          }}
          aria-label="Previous step (−6h)"
          title="Previous step (−6h)"
        >
          <SkipBack size={14} />
        </button>

        <button
          className="sih-btn sih-btn-primary"
          style={{ width: 34, height: 34, borderRadius: '50%', padding: 0, flexShrink: 0 }}
          onClick={() => onPlayingChange(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          className="sih-chip !p-1.5 text-slate-400 hover:text-white"
          onClick={() => {
            onPlayingChange(false);
            onChange(Math.min(max, value + 6));
          }}
          aria-label="Next step (+6h)"
          title="Next step (+6h)"
        >
          <SkipForward size={14} />
        </button>
      </div>

      <button
        className="sih-chip shrink-0 !px-2 !py-1 text-[11px]"
        onClick={() => onSpeedChange(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        aria-label="Playback speed"
        title="Playback speed"
      >
        {speed}×
      </button>

      <div className="sih-tl-track">
        <div
          className="sih-muted"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9.5,
            letterSpacing: '.12em',
            fontWeight: 700,
          }}
        >
          <span className={isPast ? 'text-sky-300 font-bold' : 'text-slate-400'}>PAST</span>
          <span className={!isPast ? 'text-indigo-300 font-bold' : 'text-slate-400'}>FORECAST</span>
        </div>
        <div className="sih-tl-now" style={{ left: `${nowPct}%` }}>
          <span className="text-white font-bold">NOW</span>
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

      <div className="sih-jumps hidden sm:flex" style={{ display: 'flex', gap: 2 }}>
        {jumps.map((j) => (
          <button
            key={j}
            className={`sih-chip${Math.abs(value - j) < 0.25 ? ' on' : ''}`}
            onClick={() => {
              onPlayingChange(false);
              onChange(j);
            }}
            aria-label={j === now ? 'Jump to now' : `Jump to ${j > now ? '+' : ''}${j - now} hours`}
          >
            {j === now ? 'NOW' : `${j > now ? '+' : '−'}${Math.abs(Math.round(j - now))}h`}
          </button>
        ))}
      </div>
    </div>
  );
}
