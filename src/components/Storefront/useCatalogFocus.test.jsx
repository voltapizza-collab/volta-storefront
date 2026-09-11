import { useRef, useState } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import useCatalogFocus from "./useCatalogFocus";

let rootRef, stageRef, navigate;
beforeEach(() => {
  window.innerWidth = 393;
  document.body.innerHTML = '<main><button class="sf-catalogExit">Volver</button><div class="stage"></div><footer class="sf-stickyFooterShell"></footer></main>';
  rootRef = { current: document.querySelector("main") };
  stageRef = { current: document.querySelector(".stage") };
  navigate = jest.fn();
  window.scrollTo = jest.fn();
});
afterEach(() => { document.body.removeAttribute("style"); window.innerWidth = 1024; });
const location = { pathname: "/pizza/store", search: "?coupon=VOLTA", hash: "", state: null };
const options = (changes = {}) => ({ location, navigate, rootRef, stageRef, ready: true, suspended: false, ...changes });

test("desktop deep links are replaced without locking the page or losing the coupon", () => {
  window.innerWidth = 1440;
  const { result } = renderHook(props => useCatalogFocus(props), { initialProps: options({
    location: { ...location, hash: "#vitrina", state: { catalogFocusEntry: true, fromCoupon: "VOLTA" } },
  }) });
  expect(result.current[0]).toBe(false);
  expect(result.current[2]).toBe(false);
  expect(document.body.style.position).not.toBe("fixed");
  expect(navigate).toHaveBeenCalledWith({ pathname: location.pathname, search: "?coupon=VOLTA", hash: "" }, {
    replace: true, preventScrollReset: true, state: { fromCoupon: "VOLTA" },
  });
});

test("crossing into desktop unlocks focus and never navigates Back or reopens it on mobile", () => {
  const focused = options({ location: { ...location, hash: "#vitrina", state: { catalogFocusEntry: true } } });
  const { result, rerender } = renderHook(props => useCatalogFocus(props), { initialProps: focused });
  expect(document.body.style.position).toBe("fixed");
  act(() => { window.innerWidth = 761; window.dispatchEvent(new Event("resize")); });
  expect(result.current[0]).toBe(false);
  expect(document.body.style.position).toBe("");
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ hash: "", search: "?coupon=VOLTA" }), expect.objectContaining({ replace: true }));
  expect(navigate).not.toHaveBeenCalledWith(-1);
  navigate.mockClear();
  act(() => result.current[1](true));
  expect(navigate).not.toHaveBeenCalled();
  rerender(options());
  act(() => { window.innerWidth = 760; window.dispatchEvent(new Event("resize")); });
  expect(result.current[0]).toBe(false);
  expect(result.current[2]).toBe(true);
});

test("open preserves coupon URL; close uses browser history exactly once", () => {
  const { result, rerender } = renderHook(props => useCatalogFocus(props), { initialProps: options() });
  act(() => result.current[1](true));
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ search: "?coupon=VOLTA", hash: "#vitrina" }), expect.objectContaining({ state: expect.objectContaining({ catalogFocusEntry: true }) }));
  rerender(options({ location: { ...location, hash: "#vitrina", state: { catalogFocusEntry: true } } }));
  navigate.mockClear();
  act(() => { result.current[1](false); result.current[1](false); });
  expect(navigate.mock.calls).toEqual([[-1]]);
});

test("body unlocks and product scroll restores on Back or unmount", () => {
  document.body.style.overflow = "auto";
  stageRef.current.scrollTop = 175;
  const { result, rerender, unmount } = renderHook(props => useCatalogFocus(props), { initialProps: options() });
  act(() => result.current[1](true));
  rerender(options({ location: { ...location, hash: "#vitrina" } }));
  expect(document.body.style.position).toBe("fixed");
  stageRef.current.scrollTop = 800;
  rerender(options());
  expect(document.body.style.position).toBe("");
  expect(document.body.style.overflow).toBe("auto");
  expect(stageRef.current.scrollTop).toBe(175);
  rerender(options({ location: { ...location, hash: "#vitrina" } }));
  unmount();
  expect(document.body.style.position).toBe("");
});

test("Escape respects child dialogs; deep links close without leaving the store", () => {
  const focused = options({ location: { ...location, hash: "#vitrina" }, suspended: true });
  const { rerender } = renderHook(props => useCatalogFocus(props), { initialProps: focused });
  fireEvent.keyDown(window, { key: "Escape" });
  expect(navigate).not.toHaveBeenCalled();
  rerender({ ...focused, suspended: false });
  fireEvent.keyDown(window, { key: "Escape" });
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ hash: "", search: "?coupon=VOLTA" }), expect.objectContaining({ replace: true }));
});

test("a directly opened vitrina initializes after asynchronous store loading", () => {
  const focused = options({ location: { ...location, hash: "#vitrina" }, ready: false });
  const { rerender } = renderHook(props => useCatalogFocus(props), { initialProps: focused });
  expect(document.body.style.position).not.toBe("fixed");
  rerender({ ...focused, ready: true });
  expect(document.body.style.position).toBe("fixed");
  expect(rootRef.current.style.getPropertyValue("--catalog-viewport-height")).not.toBe("");
});

test("keyboard viewport uses visible height and removes footer clearance", () => {
  const viewport = new EventTarget();
  Object.assign(viewport, { height: window.innerHeight - 300, offsetTop: 24 });
  const previous = window.visualViewport;
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  const input = document.createElement("input");
  rootRef.current.appendChild(input);
  const focused = options({ location: { ...location, hash: "#vitrina" } });
  jest.useFakeTimers();
  const { unmount } = renderHook(props => useCatalogFocus(props), { initialProps: focused });
  act(() => { input.focus(); viewport.dispatchEvent(new Event("resize")); jest.advanceTimersByTime(32); });
  expect(rootRef.current.dataset.catalogKeyboard).toBe("true");
  expect(rootRef.current.style.getPropertyValue("--catalog-footer-height")).toBe("0px");
  expect(rootRef.current.style.getPropertyValue("--catalog-viewport-top")).toBe("24px");
  unmount();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: previous });
  jest.useRealTimers();
});

test("closing returns keyboard focus to the recreated expand button", () => {
  jest.useFakeTimers();
  document.body.innerHTML = "";
  function Harness() {
    const [route, setRoute] = useState(location);
    const root = useRef(null), stage = useRef(null);
    const [open, setOpen] = useCatalogFocus({ location: route, navigate: (next, opts) => setRoute(next === -1 ? location : { ...next, state: opts?.state }), rootRef: root, stageRef: stage, ready: true });
    return <main ref={root} className={open ? "is-grid-focused" : ""}><div ref={stage} />{open
      ? <button className="sf-catalogExit" onClick={() => setOpen(false)}>Volver</button>
      : <button className="sf-catalogExpand" onClick={() => setOpen(true)}>Ampliar</button>}</main>;
  }
  render(<Harness />);
  const expand = screen.getByText("Ampliar");
  expand.focus(); fireEvent.click(expand);
  fireEvent.click(screen.getByText("Volver"));
  act(() => jest.advanceTimersByTime(32));
  expect(document.activeElement).toBe(screen.getByText("Ampliar"));
  jest.useRealTimers();
});
