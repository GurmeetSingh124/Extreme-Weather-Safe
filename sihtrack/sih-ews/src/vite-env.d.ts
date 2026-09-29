/// <reference types="vite/client" />

/**
 * The Google Maps key is build-time configuration, not a secret that should be
 * inlined into source. `.env.local` holds it and is gitignored.
 */
interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
