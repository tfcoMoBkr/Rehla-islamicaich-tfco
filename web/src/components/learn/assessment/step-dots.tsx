import { cn } from "@/lib/utils";

/** A short stretch of road with one stop per step; stops already passed are lit. */
export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <ol aria-hidden className="flex items-center">
      {Array.from({ length: total }, (_, index) => (
        <li key={index} className="flex items-center">
          {index > 0 && <span className={cn("h-0.5 w-3 sm:w-5", index <= current ? "bg-dawn" : "bg-border")} />}
          <span
            className={cn(
              "size-2.5 rounded-full border-2",
              index < current && "border-dawn bg-dawn",
              index === current && "size-3.5 border-primary bg-card",
              index > current && "border-border bg-card",
            )}
          />
        </li>
      ))}
    </ol>
  );
}
