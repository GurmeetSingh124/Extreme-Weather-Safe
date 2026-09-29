import { useState } from "react";
import {
  ArrowRight,
  Check,
  MousePointerClick,
  MousePointerSquareDashed,
  Timer,
  X,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { cn } from "../../lib/utils";

const STEPS = [
  {
    id: "map",
    icon: MousePointerClick,
    title: "Explore the Map",
    body: "See active extreme weather events across India. Each marker is one event — the colour tells you how serious it is.",
    view: "map" as const,
  },
  {
    id: "select",
    icon: MousePointerSquareDashed,
    title: "Select an Event",
    body: "Click any marker to see its movement and intensity, then press “Track This Event” to follow its full path.",
    view: "map" as const,
  },
  {
    id: "time",
    icon: Timer,
    title: "Use the Timeline",
    body: "Drag the bar under the map to move through past and forecast time. Everything on screen updates together.",
    view: "map" as const,
  },
];

/**
 * Three hints, shown once, dismissible, never in the way.
 */
export function Onboarding() {
  const onboarded = useStore((s) => s.onboarded);
  const skip = useStore((s) => s.skipOnboarding);
  const setView = useStore((s) => s.setView);
  const [i, setI] = useState(0);
  if (onboarded) return null;

  const step = STEPS[i];
  const I = step.icon;
  const last = i === STEPS.length - 1;

  return (
    <div data-onboarding>
      <div
        className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[3px]"
        role="dialog"
        aria-modal="true"
        aria-label="Quick guide"
      >
        <div className="relative w-full max-w-[420px] rounded-2xl border border-edge bg-ink-900/98 p-5 shadow-pop animate-fade-up">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-500/45 bg-brand-500/12 text-brand-300">
              <I size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-semibold tracking-tight text-txt-hi">
                {step.title}
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-txt-mid">
                {step.body}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((s, n) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  n <= i ? "bg-brand-400" : "bg-ink-700",
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button className="btn !py-2 text-[12.5px]" onClick={skip}>
              Skip guide
            </button>
            <div className="ml-auto flex items-center gap-2">
              {i > 0 && (
                <button
                  className="btn !py-2 text-[12.5px]"
                  onClick={() => setI((v) => v - 1)}
                >
                  Back
                </button>
              )}
              <button
                className="btn-primary !py-2 text-[12.5px]"
                onClick={() => {
                  setView(step.view);
                  if (last) skip();
                  else setI((v) => v + 1);
                }}
              >
                {last ? (
                  <>
                    <Check size={14} /> Start exploring
                  </>
                ) : (
                  <>
                    Next <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          <button
            className="absolute right-3 top-3 btn !h-7 !min-h-0 !w-7 !border-0 !bg-transparent !p-0"
            onClick={skip}
            aria-label="Close the guide"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
