/**
 * Loads the Google Maps JavaScript API exactly once, and reports the failure
 * modes that actually happen in practice instead of hanging on a spinner.
 *
 * The usual causes of failure are all distinct and all need a different answer:
 *   - no key configured                  -> the build is misconfigured
 *   - billing not enabled on the project -> the map renders a grey "development only" box
 *   - key not restricted / wrong referrer -> the API returns REQUEST_DENIED
 *   - the script is blocked by an ad blocker or offline -> no network
 */

const CALLBACK = '__sihtrack_gmaps_ready__';
const TIMEOUT_MS = 15000;

/**
 * The Maps JavaScript API is loaded from a script tag and is therefore untyped
 * here. `MapsApi` is the narrow, hand-written shape the engine actually uses;
 * anything outside it is a deliberate cast rather than an accident.
 */
export interface MapsApi {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => any;
  Marker: new (opts?: Record<string, unknown>) => any;
  Polyline: new (opts?: Record<string, unknown>) => any;
  Polygon: new (opts?: Record<string, unknown>) => any;
  LatLng: new (lat: number, lng: number) => any;
  LatLngBounds: new (sw?: any, ne?: any) => any;
  Size: new (w: number, h: number) => any;
  Point: new (x: number, y: number) => any;
  ImageMapType: new (opts: Record<string, unknown>) => any;
  SymbolPath: { CIRCLE: any; FORWARD_CLOSED_ARROW: any };
  event: { trigger: (o: object, e: string, ...a: unknown[]) => void; clearInstanceListeners: (o: object) => void };
}

let inflight: Promise<MapsApi> | null = null;

export class GoogleMapsError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'GoogleMapsError';
    this.hint = hint;
  }
}

export function mapsKey(): string {
  const key = (import.meta.env?.VITE_GOOGLE_MAPS_KEY as string | undefined)?.trim();
  return key || '';
}

export function loadGoogleMaps(): Promise<MapsApi> {
  if (inflight) return inflight;

  inflight = new Promise<MapsApi>((resolve, reject) => {
    const key = mapsKey();
    if (!key) {
      reject(
        new GoogleMapsError(
          'No Google Maps API key is configured',
          'Set VITE_GOOGLE_MAPS_KEY in .env.local and restart the dev server.'
        )
      );
      return;
    }

    const g = window as unknown as { google?: { maps?: MapsApi }; [k: string]: unknown };
    if (g.google?.maps?.Map) {
      resolve(g.google.maps);
      return;
    }

    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[CALLBACK];
      if (err) reject(err);
      else if (g.google?.maps) resolve(g.google.maps);
      else
        reject(
          new GoogleMapsError(
            'The Google Maps API loaded but did not initialise',
            'This usually means the key is invalid, or billing is not enabled on the Google Cloud project.'
          )
        );
    };

    const timer = window.setTimeout(() => {
      finish(
        new GoogleMapsError(
          'The Google Maps API did not respond',
          'The Maps script is blocked or unreachable. Check your connection, an ad blocker, or the network access to maps.googleapis.com.'
        )
      );
    }, TIMEOUT_MS);

    g[CALLBACK] = () => finish();

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      finish(
        new GoogleMapsError(
          'The Google Maps script could not be loaded',
          'maps.googleapis.com is unreachable, or the key was rejected. Verify billing is enabled and the key allows this origin.'
        )
      );
    document.head.appendChild(script);
  });

  return inflight;
}

/** Resolved once the script is present, for a synchronous `await` after the first load. */
export function mapsReady(): boolean {
  return !!(window as unknown as { google?: { maps?: MapsApi } }).google?.maps?.Map;
}
