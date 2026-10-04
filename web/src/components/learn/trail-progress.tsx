import { Lantern } from "@/components/journey/lantern";
import { cn } from "@/lib/utils";

const TRAIL = "M4 15C40 4 72 24 112 13S184 3 224 14 282 21 296 11";

/**
 * An activity's progress as a short stretch of road that extends with each right step, with a
 * lantern at its end that lights when the activity is done. Purely visual: progress is also
 * stated in words by each activity.
 */
export function TrailProgress({ value, done }: { value: number; done: boolean }) {
  const reached = Math.min(Math.max(value, 0), 1);

  return (
    <div aria-hidden className="flex items-center gap-3">
      <svg viewBox="0 0 300 26" fill="none" className="h-auto w-full flex-1 rtl:-scale-x-100">
        <path d={TRAIL} stroke="var(--hairline)" strokeWidth="3" strokeDasharray="6 7" strokeLinecap="round" />
        <path
          d={TRAIL}
          pathLength={1}
          stroke="var(--dawn)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1 1"
          // A round cap would draw a dot even at zero length, so the trail appears with its first step.
          opacity={reached > 0 ? 1 : 0}
          style={{ strokeDashoffset: 1 - reached, transition: "stroke-dashoffset 0.7s cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        />
      </svg>
      <Lantern lit={done} className={cn("size-9 shrink-0 text-ink", done && "lantern-flare")} />
    </div>
  );
}
