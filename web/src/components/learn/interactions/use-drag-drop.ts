"use client";

import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";

const DRAG_THRESHOLD = 8;

type Drag = { id: string; dx: number; dy: number; over: string | null };

function dropTargetAt(x: number, y: number): string | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const target = element.closest<HTMLElement>("[data-drop-target]");
    if (target?.dataset.dropTarget) return target.dataset.dropTarget;
  }
  return null;
}

/**
 * Drag an item onto a drop target with a mouse, a finger or a pen. A touch drag starts from the
 * item's handle (`data-drag-handle`), so the page still scrolls under the finger elsewhere.
 * Dragging is a shortcut only: every component that uses it keeps a tap for the same move.
 */
export function useDragDrop(onDrop: (itemId: string, targetId: string) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const origin = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const endedDrag = useRef(false);

  function itemProps(id: string) {
    const active = drag?.id === id;
    const style: CSSProperties | undefined = active
      ? { translate: `${drag.dx}px ${drag.dy}px`, position: "relative", zIndex: 30 }
      : undefined;
    return {
      "data-dragging": active || undefined,
      style,
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        const fromHandle = event.target instanceof Element && event.target.closest("[data-drag-handle]");
        if (event.pointerType !== "mouse" && !fromHandle) return;
        origin.current = { id, x: event.clientX, y: event.clientY, moved: false };
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const start = origin.current;
        if (!start || start.id !== id) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.moved) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          start.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setDrag({ id, dx, dy, over: dropTargetAt(event.clientX, event.clientY) });
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const start = origin.current;
        origin.current = null;
        if (!start?.moved) return;
        endedDrag.current = true;
        window.setTimeout(() => {
          endedDrag.current = false;
        }, 0);
        const target = dropTargetAt(event.clientX, event.clientY);
        setDrag(null);
        if (target) onDrop(id, target);
      },
      onPointerCancel: () => {
        origin.current = null;
        setDrag(null);
      },
      // The click that ends a drag is not also a tap.
      onClickCapture: (event: MouseEvent<HTMLElement>) => {
        if (!endedDrag.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
    };
  }

  function targetProps(id: string) {
    return { "data-drop-target": id, "data-drop-over": drag?.over === id || undefined };
  }

  return { itemProps, targetProps };
}
