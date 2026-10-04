import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type RoadSide = "start" | "end";

type RoadStopProps = {
  /** Which side of the road the content sits on from `md` up. On phones it is always beside the road. */
  side?: RoadSide;
  marker?: ReactNode;
  as?: "div" | "li";
  className?: string;
  children: ReactNode;
};

/**
 * One stop along a RoadJourney. On phones the road runs down the inline-start edge with
 * content beside it; from `md` up it runs down the centre and stops alternate sides,
 * the marker leaning toward its content so the road weaves between them.
 */
export function RoadStop({ side = "start", marker, as: Tag = "div", className, children }: RoadStopProps) {
  const isStart = side === "start";

  return (
    <Tag
      className={cn(
        "relative z-10 grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)] md:gap-x-0",
        className,
      )}
    >
      <div
        className={cn(
          "col-start-1 row-start-1 flex justify-center pt-1 md:col-start-2",
          isStart
            ? "md:-translate-x-10 md:rtl:translate-x-10"
            : "md:translate-x-10 md:rtl:-translate-x-10",
        )}
      >
        {marker}
      </div>
      <div
        className={cn(
          "col-start-2 row-start-1",
          isStart ? "md:col-start-1 md:pe-4" : "md:col-start-3 md:ps-4",
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
