import {
  CloudLightning,
  CloudRain,
  Gauge,
  Layers,
  Snowflake,
  Sun,
  ThermometerSun,
  Tornado,
  Waves,
  Wind,
  type LucideProps,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Category } from '../../types';

/**
 * Professional Lucide hazard outlines, no emoji, consistent stroke width (1.8).
 */
const ICONS: Record<Category, React.ComponentType<LucideProps>> = {
  rainfall: CloudRain,
  thunderstorm: CloudLightning,
  cyclone: Tornado,
  flood: Waves,
  heat: ThermometerSun,
  cold: Snowflake,
  wind: Wind,
  pressure: Gauge,
  drought: Sun,
  compound: Layers,
};

export interface WeatherIconProps extends LucideProps {
  type?: Category;
  category?: Category;
  size?: number;
}

export function WeatherIcon({ type, category, size = 16, strokeWidth = 1.8, ...rest }: WeatherIconProps) {
  const cat = type ?? category ?? 'compound';
  const Icon = ICONS[cat] ?? Layers;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />;
}

/**
 * Markup for map marker.
 */
export function weatherIconMarkup(type: Category, size = 16): string {
  return renderToStaticMarkup(<WeatherIcon type={type} size={size} />);
}
