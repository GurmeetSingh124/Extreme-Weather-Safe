import React from 'react';
import {
  CloudRain,
  Wind,
  ThermometerSun,
  Snowflake,
  Gauge,
  Sun,
  Waves,
  CloudLightning,
  AlertTriangle,
  Droplets,
  Layers,
  BrainCircuit,
  Route,
  MapPin,
  CloudSun,
  ShieldCheck,
  Clock,
  TrendingUp,
  Minus,
  TrendingDown,
  CircleDot,
  type LucideProps,
} from 'lucide-react';
import type { Category, Severity, Trend } from '../../types';

export interface WeatherIconProps extends LucideProps {
  category: Category;
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Unified Meteorological Icon System (SIHTRACK Part 2)
 * Replaces all cartoon/emoji icons with clean, accessible SVG symbols.
 */
export function WeatherIcon({
  category,
  size = 18,
  className = '',
  color,
  strokeWidth = 1.8,
  ...rest
}: WeatherIconProps) {
  const props: LucideProps = {
    size,
    className,
    style: color ? { color } : undefined,
    strokeWidth,
    'aria-hidden': true,
    ...rest,
  };

  switch (category) {
    case 'rainfall':
      return <CloudRain {...props} />;
    case 'cyclone':
      return <CycloneSvg size={size} className={className} color={color} strokeWidth={Number(strokeWidth) || 1.8} />;
    case 'wind':
      return <Wind {...props} />;
    case 'heat':
      return <ThermometerSun {...props} />;
    case 'cold':
      return <Snowflake {...props} />;
    case 'pressure':
      return <Gauge {...props} />;
    case 'drought':
      return <Sun {...props} />;
    case 'flood':
      return <Waves {...props} />;
    case 'thunderstorm':
      return <CloudLightning {...props} />;
    case 'compound':
      return <CompoundIcon size={size} className={className} color={color} strokeWidth={Number(strokeWidth) || 1.8} />;
    default:
      return <AlertTriangle {...props} />;
  }
}

/** Professional Meteorological Cyclone / Vortex SVG */
export function CycloneSvg({
  size = 18,
  className = '',
  color = 'currentColor',
  strokeWidth = 1.8,
}: {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9C9.5 9 6.5 11 6 13.5C5.5 16 7 18 9 19.5" />
      <path d="M12 15C14.5 15 17.5 13 18 10.5C18.5 8 17 6 15 4.5" />
      <path d="M15 12C15 9.5 13 6.5 10.5 6C8 5.5 6 7 4.5 9" />
      <path d="M9 12C9 14.5 11 17.5 13.5 18C16 18.5 18 17 19.5 15" />
    </svg>
  );
}

/** Compound Hazard Icon: Layers with Alert indicator */
export function CompoundIcon({
  size = 18,
  className = '',
  color = 'currentColor',
  strokeWidth = 1.8,
}: {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <span className={`inline-flex items-center justify-center relative ${className}`} style={{ width: size, height: size }}>
      <Layers size={size} color={color} strokeWidth={strokeWidth} />
      <AlertTriangle
        size={Math.max(8, Math.round(size * 0.55))}
        color="#f43f5e"
        strokeWidth={2}
        className="absolute -top-1 -right-1"
      />
    </span>
  );
}

/** Trend Icon component (replaces ▲ ■ ▼ ◦) */
export function TrendIcon({
  trend,
  size = 13,
  className = '',
}: {
  trend: Trend;
  size?: number;
  className?: string;
}) {
  switch (trend) {
    case 'INTENSIFYING':
      return <TrendingUp size={size} className={`text-rose-400 ${className}`} strokeWidth={2.2} aria-hidden />;
    case 'STEADY':
      return <Minus size={size} className={`text-amber-400 ${className}`} strokeWidth={2.5} aria-hidden />;
    case 'WEAKENING':
      return <TrendingDown size={size} className={`text-sky-400 ${className}`} strokeWidth={2.2} aria-hidden />;
    case 'DISSIPATING':
      return <CircleDot size={size} className={`text-slate-400 ${className}`} strokeWidth={2} aria-hidden />;
  }
}

/** Standard System Icons (Part 2) */
export {
  CloudRain,
  Wind,
  ThermometerSun,
  Snowflake,
  Gauge,
  Droplets,
  CloudLightning,
  Waves,
  BrainCircuit,
  Route,
  MapPin,
  CloudSun,
  ShieldCheck,
  Clock,
  AlertTriangle,
};

/** Inline SVG string for Google Maps / Leaflet DOM markers */
export function getWeatherIconSvgString(category: Category, size = 15, color = '#ffffff'): string {
  switch (category) {
    case 'rainfall':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`;
    case 'cyclone':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 9C9.5 9 6.5 11 6 13.5C5.5 16 7 18 9 19.5"/><path d="M12 15C14.5 15 17.5 13 18 10.5C18.5 8 17 6 15 4.5"/></svg>`;
    case 'wind':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7A2.5 2.5 0 1 1 20 10H2"/><path d="M19.7 13.7A2.5 2.5 0 1 1 22 16H2"/><path d="M14.7 19.7A2.5 2.5 0 1 1 17 22H2"/></svg>`;
    case 'heat':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9a4 4 0 0 0-2 7.5"/><path d="M12 3v2"/><path d="M6.6 6.6l1.4 1.4"/><path d="M20 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><circle cx="18" cy="18" r="2"/></svg>`;
    case 'cold':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>`;
    case 'pressure':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`;
    case 'drought':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>`;
    case 'flood':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`;
    case 'thunderstorm':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m13 13-3 5h4l-3 5"/></svg>`;
    case 'compound':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`;
    default:
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
}
