import { X } from 'lucide-react';
import { useStore, useVisibleEvents } from '../../store/useStore';
import { LayersPanel, Legend } from '../map/MapOverlays';
import { getEngineHandle } from '../map/engineHandle';
import { EventRow } from '../common/EventRow';

/**
 * On small screens the same components move into a bottom sheet, and event
 * details become a bottom sheet rather than a side drawer.
 */
export function MobileSheets() {
  const sheet = useStore((s) => s.mobileSheet);
  const setSheet = useStore((s) => s.setMobileSheet);
  if (!sheet) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setSheet(null)} />
      <div
        data-sheet
      className="sheet-up fixed inset-x-0 bottom-0 z-[60] flex max-h-[78vh] flex-col overflow-hidden rounded-t-2xl border-t border-edge bg-ink-900/98 backdrop-blur-md lg:hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-edge px-3 py-2.5">
          <span className="mx-auto h-1 w-10 rounded-full bg-edge2" />
          <button className="btn !h-7 !min-h-0 !w-7 !border-0 !bg-transparent !p-0" onClick={() => setSheet(null)} aria-label="Close panel">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sheet === 'layers' && (
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-txt-hi">Weather Layers</h3>
                <div className="flex gap-2">
                  <LayersPanel engine={getEngineHandle} />
                </div>
              </div>
              <Legend />
            </div>
          )}
          {(sheet === 'events' || sheet === 'alerts') && <MobileEventList onDone={() => setSheet(null)} />}
        </div>
      </div>
    </>
  );
}

function MobileEventList({ onDone }: { onDone: () => void }) {
  const { visible } = useVisibleEvents();
  const select = useStore((s) => s.selectEvent);
  const setView = useStore((s) => s.setView);
  const RANK = ['EXTREME', 'HIGH', 'MODERATE', 'NORMAL'];
  const ranked = [...visible].sort((a, b) => RANK.indexOf(a.severity) - RANK.indexOf(b.severity) || b.intensity - a.intensity);
  return (
    <div className="p-3">
      <h3 className="mb-2 text-[13px] font-semibold text-txt-hi">Active Events ({visible.length})</h3>
      <div className="space-y-2">
        {ranked.map((e) => (
          <EventRow
            key={e.id}
            e={e}
            onOpen={() => {
              select(e.id, { fly: true });
              setView('map');
              onDone();
            }}
          />
        ))}
        {!ranked.length && <p className="py-8 text-center text-[12px] text-txt-lo">No events match the current filters.</p>}
      </div>
    </div>
  );
}

