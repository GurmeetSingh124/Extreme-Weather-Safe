/** Minimal, non-technical. Cause details go to the console, not the UI. */
export function MapError({ onRetry, onViewData, cause }: { onRetry: () => void; onViewData: () => void; cause?: string }) {
  if (cause) console.warn('[SIHTRACK map]', cause);
  return (
    <div
      className="sih-glass"
      role="alert"
      style={{
        position: 'absolute', inset: 0, margin: 'auto', width: 420, maxWidth: 'calc(100vw - 32px)',
        height: 190, padding: 28, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 30,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600 }}>Map unavailable</div>
      <div className="sih-muted" style={{ fontSize: 13 }}>
        Google Maps could not be loaded. Every other part of SIHTRACK still works.
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="sih-btn sih-btn-primary" onClick={onRetry}>
          Retry
        </button>
        <button className="sih-btn" onClick={onViewData}>
          View Demo Data
        </button>
      </div>
    </div>
  );
}
