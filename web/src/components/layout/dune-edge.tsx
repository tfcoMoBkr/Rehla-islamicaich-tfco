import { cn } from "@/lib/utils";

/** A soft dune line that lets a night band end without a hard rule. */
export function DuneEdge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("pointer-events-none block w-full text-night", className)}
    >
      <path
        fill="currentColor"
        d="M0 40V25C140 8 262 5 402 17s250 24 380 11S1022 1 1162 10s218 17 278 11v19z"
      />
    </svg>
  );
}
