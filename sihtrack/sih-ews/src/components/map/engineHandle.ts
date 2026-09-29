import type { MapEngineLike } from './types';

/**
 * The engine lives inside <WeatherMap /> but the event drawer is rendered by
 * the app shell (so the drawer can push the map instead of covering it).
 * This single mutable handle is the bridge between the two.
 */
let current: MapEngineLike | null = null;

export const setEngineHandle = (e: MapEngineLike | null) => {
  current = e;
};

export const getEngineHandle = (): MapEngineLike | null => current;
