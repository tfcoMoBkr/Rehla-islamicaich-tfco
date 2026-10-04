import { GripVertical } from "lucide-react";

/** Where a finger starts a drag. Decorative for assistive technology: the item itself is tapped. */
export function DragHandle() {
  return (
    <span
      data-drag-handle
      aria-hidden
      className="-my-2 -ms-2 grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-5" />
    </span>
  );
}
