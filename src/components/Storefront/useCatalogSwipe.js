import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const INTERACTIVE = "button, a, input, select, textarea, summary, [contenteditable='true']";
const ignoresGesture = target => Boolean(
  target.closest?.("input, select, textarea, [contenteditable='true']") ||
  (target.closest?.(INTERACTIVE) && !target.closest?.(".lsf-card"))
);
const contentOf = surface => surface?.querySelector(".lsf-grid-wrap, .sf-engineEmptyState");
const adjacent = (items, activeId, direction) => {
  const index = items.findIndex(item => item.id === activeId);
  return index < 0 ? null : items[index + direction];
};

// React commits the category once. Pointer movement only updates the moving layer.
export default function useCatalogSwipe({ items, activeId, onSelect, enabled = true, surfaceRef, ready = true }) {
  const gesture = useRef(null);
  const frame = useRef(null);
  const animation = useRef(null);
  const pendingSelection = useRef(null);
  const reducedMotion = useRef(false);
  const suppressClickUntil = useRef(0);
  const wheelGesture = useRef({ lastAt: 0, distance: 0, committed: false });
  const selection = useRef({ items, activeId, onSelect });

  const clearVisual = useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    animation.current?.cancel();
    animation.current = null;
    const surface = surfaceRef?.current;
    contentOf(surface)?.style.removeProperty("transform");
    surface?.removeAttribute("data-dragging");
  }, [surfaceRef]);

  const animateToRest = useCallback((content, from) => {
    if (!content?.animate || reducedMotion.current) return;
    const next = content.animate([
      { transform: from }, { transform: "translateX(0px)" },
    ], { duration: 140, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
    animation.current = next;
    next.onfinish = () => { if (animation.current === next) animation.current = null; };
  }, []);

  const cancelGesture = useCallback(() => {
    const current = gesture.current;
    const content = contentOf(surfaceRef?.current);
    const from = content?.style.transform;
    gesture.current = null;
    pendingSelection.current = null;
    clearVisual();
    if (current?.horizontal && from) animateToRest(content, from);
  }, [animateToRest, clearVisual, surfaceRef]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = Boolean(media?.matches); };
    update();
    media?.addEventListener?.("change", update);
    return () => { media?.removeEventListener?.("change", update); clearVisual(); };
  }, [clearVisual]);

  useLayoutEffect(() => {
    selection.current = { items, activeId, onSelect };
  }, [items, activeId, onSelect]);

  useLayoutEffect(() => {
    // An external category change, search or modal cancels an unfinished gesture.
    gesture.current = null;
    clearVisual();
    const pending = pendingSelection.current;
    pendingSelection.current = null;
    if (enabled && ready && pending?.id === activeId) {
      // The new category enters from its own side, never from the old drag offset.
      animateToRest(contentOf(surfaceRef?.current), `translateX(${pending.direction * 24}px)`);
    }
  }, [activeId, enabled, ready, animateToRest, clearVisual, surfaceRef]);

  useEffect(() => {
    const surface = surfaceRef?.current;
    if (!surface || !ready || !enabled) return undefined;
    const onWheel = event => {
      if (event.ctrlKey || ignoresGesture(event.target)) return;
      const horizontal = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      const vertical = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
      if (Math.abs(horizontal) < 1 || Math.abs(horizontal) <= Math.abs(vertical) * 1.5) return;
      event.preventDefault();
      const current = wheelGesture.current, now = Date.now();
      if (now - current.lastAt > 240) { current.distance = 0; current.committed = false; }
      current.lastAt = now;
      if (current.committed) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientWidth : 1;
      current.distance += horizontal * unit;
      if (Math.abs(current.distance) < 60) return;
      current.committed = true;
      const latest = selection.current;
      const next = adjacent(latest.items, latest.activeId, current.distance > 0 ? 1 : -1);
      if (next) { cancelGesture(); latest.onSelect(next.id); }
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [cancelGesture, enabled, ready, surfaceRef]);

  return {
    onPointerDownCapture(event) {
      clearVisual();
      pendingSelection.current = null;
      gesture.current = null;
      if (event.isPrimary === false) return;
      suppressClickUntil.current = 0;
      if (!enabled || !ready || !["mouse", "touch", "pen"].includes(event.pointerType) || ignoresGesture(event.target)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      gesture.current = {
        id: event.pointerId, x: event.clientX, y: event.clientY, activeId,
        horizontal: false, offset: 0, samples: [{ x: event.clientX, t: performance.now() }],
      };
    },
    onPointerMoveCapture(event) {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x, dy = Math.abs(event.clientY - current.y);
      if (!current.horizontal) {
        if (dy > 10 && dy >= Math.abs(dx)) { cancelGesture(); return; }
        if (Math.abs(dx) <= 10 || Math.abs(dx) <= dy * 1.2) return;
        current.horizontal = true;
        surfaceRef?.current?.setAttribute("data-dragging", "true");
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      // Keep the chosen axis even if the finger curves after recognition.
      suppressClickUntil.current = Date.now() + 500;
      const now = performance.now();
      current.samples.push({ x: event.clientX, t: now });
      while (current.samples.length > 2 && current.samples[1].t < now - 80) current.samples.shift();
      current.offset = adjacent(items, activeId, dx < 0 ? 1 : -1) ? dx : dx * 0.25;
      if (frame.current === null) frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        if (gesture.current !== current || reducedMotion.current) return;
        const content = contentOf(surfaceRef?.current);
        if (content) content.style.transform = `translateX(${current.offset}px)`;
      });
    },
    onPointerUpCapture(event) {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      if (!current.horizontal || !enabled || !ready || activeId !== current.activeId) { cancelGesture(); return; }
      suppressClickUntil.current = Date.now() + 500;
      const dx = event.clientX - current.x;
      const sample = current.samples[0];
      const velocity = (event.clientX - sample.x) / Math.max(1, performance.now() - sample.t);
      const flick = Math.abs(dx) >= 24 && Math.abs(velocity) >= 0.45 && Math.sign(velocity) === Math.sign(dx);
      const direction = dx < 0 ? 1 : -1;
      const next = adjacent(items, activeId, direction);
      if ((!flick && Math.abs(dx) < 50) || !next) { cancelGesture(); return; }
      gesture.current = null;
      clearVisual();
      pendingSelection.current = { id: next.id, direction };
      onSelect(next.id);
    },
    onPointerCancel() { cancelGesture(); },
    onLostPointerCapture(event) {
      // Ignore implicit capture transferring from an image, and release after up.
      if (event.target === event.currentTarget && gesture.current) cancelGesture();
    },
    onDragStart(event) { if (gesture.current) event.preventDefault(); },
    onClickCapture(event) {
      if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    },
  };
}
