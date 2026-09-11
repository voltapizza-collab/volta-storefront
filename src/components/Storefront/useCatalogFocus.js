import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const FOCUS_HASH = "#vitrina";
const COMPACT_QUERY = "(max-width: 760px)";
const isCompactViewport = () => window.matchMedia?.(COMPACT_QUERY).matches ?? window.innerWidth <= 760;

export default function useCatalogFocus({ location, navigate, suspended, rootRef, stageRef, ready }) {
  const [available, setAvailable] = useState(isCompactViewport);
  const open = available && location.hash === FOCUS_HASH;
  const closing = useRef(false);
  const stagePosition = useRef(0);
  const openerRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia?.(COMPACT_QUERY);
    const update = () => setAvailable(isCompactViewport());
    update();
    if (media) media.addEventListener("change", update);
    else window.addEventListener("resize", update);
    return () => {
      if (media) media.removeEventListener("change", update);
      else window.removeEventListener("resize", update);
    };
  }, []);

  // Replace the focus entry on wide screens; Back must never leave the store on resize.
  useEffect(() => {
    if (available || location.hash !== FOCUS_HASH) return;
    const { catalogFocusEntry, ...state } = location.state || {};
    navigate({ pathname: location.pathname, search: location.search, hash: "" }, {
      replace: true, preventScrollReset: true, state,
    });
  }, [available, location, navigate]);

  const setOpen = useCallback(value => {
    if (value && available && !open) {
      openerRef.current = document.activeElement;
      stagePosition.current = stageRef.current?.scrollTop || 0;
      navigate({ pathname: location.pathname, search: location.search, hash: FOCUS_HASH }, {
        preventScrollReset: true,
        state: { ...location.state, catalogFocusEntry: true },
      });
    } else if (!value && open && !closing.current) {
      closing.current = true;
      if (location.state?.catalogFocusEntry) navigate(-1);
      else navigate({ pathname: location.pathname, search: location.search, hash: "" }, { replace: true, preventScrollReset: true });
    }
  }, [available, location, navigate, open, stageRef]);

  useLayoutEffect(() => {
    closing.current = false;
    if (!open || !ready || !rootRef.current) return undefined;
    const opener = openerRef.current || document.activeElement, scrollY = window.scrollY;
    const body = document.body;
    const old = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    Object.assign(body.style, { position: "fixed", top: `-${scrollY}px`, width: "100%", overflow: "hidden" });
    rootRef.current?.querySelector(".sf-catalogExit")?.focus({ preventScroll: true });
    return () => {
      Object.assign(body.style, old);
      window.scrollTo(0, scrollY);
      if (stageRef.current) stageRef.current.scrollTop = stagePosition.current;
      // The expand button is recreated when the normal view returns.
      window.requestAnimationFrame(() => {
        if (!rootRef.current || rootRef.current.classList.contains("is-grid-focused")) return;
        const target = opener?.isConnected && opener !== body ? opener : rootRef.current.querySelector(".sf-catalogExpand");
        target?.focus?.({ preventScroll: true });
      });
    };
  }, [open, ready, rootRef, stageRef]);

  useEffect(() => {
    if (!open || suspended) return undefined;
    const onKeyDown = event => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); } };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, suspended, setOpen]);

  // Read the visible viewport and actual footer height; no guessed keyboard delays.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame;
    const viewport = window.visualViewport;
    const footer = root.querySelector(".sf-stickyFooterShell");
    const update = () => {
      frame = null;
      const height = viewport?.height || window.innerHeight;
      const keyboard = open && document.activeElement?.matches("input, textarea") && window.innerHeight - height > 120;
      root.dataset.catalogKeyboard = keyboard ? "true" : "false";
      root.style.setProperty("--catalog-viewport-height", `${height}px`);
      root.style.setProperty("--catalog-viewport-top", `${viewport?.offsetTop || 0}px`);
      root.style.setProperty("--catalog-footer-height", `${keyboard ? 0 : footer?.getBoundingClientRect().height || 0}px`);
    };
    const schedule = () => { if (frame == null) frame = window.requestAnimationFrame(update); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (footer) observer?.observe(footer);
    update();
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, [open, ready, rootRef]);
  return [open, setOpen, available];
}
