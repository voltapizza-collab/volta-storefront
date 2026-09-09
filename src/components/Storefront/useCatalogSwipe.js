import { useEffect, useRef } from "react";

const INTERACTIVE = "button, a, input, select, textarea, summary, [contenteditable='true']";
const ignoresGesture = target => Boolean(
  target.closest("input, select, textarea, [contenteditable='true']") ||
  (target.closest(INTERACTIVE) && !target.closest(".lsf-card"))
);

// Pointer events keep mouse/touch/pen gestures on one path. Native vertical scrolling
// cancels the pointer; cancellation must never select a category.
export default function useCatalogSwipe({ items, activeId, onSelect, enabled = true, surfaceRef, ready = true }) {
  const gesture = useRef(null);
  const suppressClickUntil = useRef(0);
  const wheelGesture = useRef({ lastAt: 0, distance: 0, committed: false });
  const resetDrag = () => {
    surfaceRef?.current?.style.removeProperty("--catalog-drag-x");
    surfaceRef?.current?.removeAttribute("data-dragging");
  };

  useEffect(() => {
    const surface = surfaceRef?.current;
    if (!surface || !ready || !enabled) return undefined;
    const onWheel = event => {
      if (event.ctrlKey || ignoresGesture(event.target)) return;
      const horizontal = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      const vertical = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
      if (Math.abs(horizontal) < 1 || Math.abs(horizontal) <= Math.abs(vertical) * 1.5) return;
      // Trackpad swipes emit wheel events, not pointer drags. Consume horizontal
      // movement only, preserving native vertical scrolling and pinch-to-zoom.
      event.preventDefault();
      const current = wheelGesture.current, now = Date.now();
      if (now - current.lastAt > 240) { current.distance = 0; current.committed = false; }
      current.lastAt = now;
      if (current.committed) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientWidth : 1;
      current.distance += horizontal * unit;
      if (Math.abs(current.distance) < 60) return;
      current.committed = true;
      const index = items.findIndex(item => item.id === activeId);
      const next = index < 0 ? null : items[index + (current.distance > 0 ? 1 : -1)];
      if (next) onSelect(next.id);
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [activeId, enabled, items, onSelect, ready, surfaceRef]);

  return {
    onPointerDownCapture(event) {
      resetDrag();
      if (event.isPrimary === false) { gesture.current = null; return; }
      suppressClickUntil.current = 0;
      gesture.current = null;
      if (!enabled || !["mouse", "touch", "pen"].includes(event.pointerType) || ignoresGesture(event.target)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, activeId, horizontal: false };
    },
    onPointerMoveCapture(event) {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = Math.abs(event.clientX - current.x), dy = Math.abs(event.clientY - current.y);
      if (!current.horizontal && dy > 16 && dy >= dx) { gesture.current = null; return; }
      if (dx > 24 && dx > dy * 1.5) {
        current.horizontal = true;
        suppressClickUntil.current = Date.now() + 500;
        if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        const offset = Math.max(-120, Math.min(120, (event.clientX - current.x) * 0.55));
        surfaceRef?.current?.setAttribute("data-dragging", "true");
        surfaceRef?.current?.style.setProperty("--catalog-drag-x", `${offset}px`);
      }
    },
    onPointerUpCapture(event) {
      const current = gesture.current;
      gesture.current = null;
      resetDrag();
      if (current?.horizontal) suppressClickUntil.current = Date.now() + 500;
      if (!current || current.id !== event.pointerId || !enabled || activeId !== current.activeId) return;
      const dx = event.clientX - current.x, dy = Math.abs(event.clientY - current.y);
      if (Math.abs(dx) < 50 || Math.abs(dx) < dy * 1.5) return;
      suppressClickUntil.current = Date.now() + 500;
      const index = items.findIndex(item => item.id === activeId);
      if (index < 0) return;
      const next = items[index + (dx < 0 ? 1 : -1)];
      if (next) onSelect(next.id);
    },
    onPointerCancel() { gesture.current = null; resetDrag(); },
    onLostPointerCapture(event) {
      // Touch starts with implicit capture on the pizza/image. Taking capture
      // on the stage makes that CHILD emit a bubbling lostpointercapture event.
      // Only losing the stage's own capture cancels our active gesture.
      if (event.target !== event.currentTarget) return;
      gesture.current = null;
      resetDrag();
    },
    onDragStart(event) {
      // Native image dragging would cancel the pointer before the swipe threshold.
      if (gesture.current) event.preventDefault();
    },
    onClickCapture(event) {
      if (Date.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
