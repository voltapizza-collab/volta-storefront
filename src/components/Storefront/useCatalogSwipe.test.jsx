import { useRef, useState } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import useCatalogSwipe from "./useCatalogSwipe";

const items = [{ id: "offers" }, { id: 10 }, { id: 20 }];

function GestureSurface({ onGift = () => {}, ready = true }) {
  const [activeId, setActiveId] = useState(10);
  const surfaceRef = useRef(null);
  const handlers = useCatalogSwipe({ items, activeId, onSelect: setActiveId, surfaceRef, ready });
  if (!ready) return <span>Cargando</span>;
  return <div ref={surfaceRef} {...handlers} data-testid="products">
    <output data-testid="category">{activeId}</output>
    <article className="lsf-card"><button onClick={onGift}>Haz un regalo</button></article>
  </div>;
}

const dispatchPointer = (target, type, x, y) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, { pointerType: { value: "mouse" }, pointerId: { value: 1 }, isPrimary: { value: true } });
  fireEvent(target, event);
};
function setup(overrides = {}) {
  const onSelect = jest.fn();
  const props = { items, activeId: 10, onSelect, ...overrides };
  const hook = renderHook(value => useCatalogSwipe(value), { initialProps: props });
  const surface = document.createElement("div");
  const image = document.createElement("img"); surface.appendChild(image);
  surface.setPointerCapture = jest.fn();
  const event = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true, target: image, currentTarget: surface, ...extra });
  const swipe = (from, to) => act(() => {
    hook.result.current.onPointerDownCapture(event(...from));
    hook.result.current.onPointerMoveCapture(event(...to));
    hook.result.current.onPointerUpCapture(event(...to));
  });
  return { ...hook, onSelect, event, swipe, props, surface };
}

test("left and right swipes select adjacent categories, preserving numeric IDs", () => {
  const { swipe, onSelect } = setup();
  swipe([200, 100], [100, 105]);
  expect(onSelect).toHaveBeenLastCalledWith(20);
  swipe([100, 100], [200, 105]);
  expect(onSelect).toHaveBeenLastCalledWith("offers");
});

test("vertical scrolling locks the gesture out even if the finger later moves sideways", () => {
  const { result, event, onSelect } = setup();
  act(() => {
    result.current.onPointerDownCapture(event(200, 100));
    result.current.onPointerMoveCapture(event(198, 180));
    result.current.onPointerUpCapture(event(80, 185));
  });
  expect(onSelect).not.toHaveBeenCalled();
});

test("native cancellation and multitouch never change category", () => {
  const { result, event, onSelect } = setup();
  act(() => {
    result.current.onPointerDownCapture(event(200, 100));
    result.current.onPointerMoveCapture(event(100, 100));
    result.current.onPointerCancel();
    result.current.onPointerUpCapture(event(100, 100));
    result.current.onPointerDownCapture(event(200, 100));
    result.current.onPointerDownCapture(event(150, 100, { pointerId: 2, isPrimary: false }));
    result.current.onPointerUpCapture(event(100, 100));
  });
  expect(onSelect).not.toHaveBeenCalled();
});

test("implicit touch capture transferring from a pizza to the stage does not cancel the swipe", () => {
  const { result, event, onSelect, surface } = setup();
  result.current.onPointerDownCapture(event(220, 100));
  result.current.onPointerMoveCapture(event(185, 102));
  // A real touch browser emits this from the previously captured image.
  result.current.onLostPointerCapture(event(175, 102));
  result.current.onPointerMoveCapture(event(120, 102, { target: surface }));
  result.current.onPointerUpCapture(event(120, 102, { target: surface }));
  expect(onSelect).toHaveBeenCalledWith(20);
});

test("losing the stage's own capture cancels the swipe", () => {
  const { result, event, onSelect, surface } = setup();
  result.current.onPointerDownCapture(event(220, 100));
  result.current.onPointerMoveCapture(event(185, 102));
  result.current.onLostPointerCapture(event(175, 102, { target: surface }));
  result.current.onPointerUpCapture(event(120, 102));
  expect(onSelect).not.toHaveBeenCalled();
});

test("a swipe suppresses the generated click so the product does not flip", () => {
  const { swipe, result } = setup();
  swipe([200, 100], [100, 100]);
  const click = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
  result.current.onClickCapture(click);
  expect(click.preventDefault).toHaveBeenCalledTimes(1);
  expect(click.stopPropagation).toHaveBeenCalledTimes(1);
});

test("short taps keep the product click; buttons and right clicks do not swipe", () => {
  const { swipe, result, event, onSelect } = setup();
  swipe([200, 100], [195, 103]);
  const click = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
  result.current.onClickCapture(click);
  expect(click.preventDefault).not.toHaveBeenCalled();
  for (const extra of [{ target: document.createElement("button") }, { pointerType: "mouse", button: 2 }]) {
    result.current.onPointerDownCapture(event(200, 100, extra));
    result.current.onPointerUpCapture(event(100, 100, extra));
  }
  expect(onSelect).not.toHaveBeenCalled();
});

test("a slow left-button mouse drag across a pizza image changes category", () => {
  jest.useFakeTimers();
  const { result, event, onSelect } = setup();
  const mouse = { pointerType: "mouse" };
  result.current.onPointerDownCapture(event(240, 100, mouse));
  const nativeDrag = { preventDefault: jest.fn() };
  result.current.onDragStart(nativeDrag);
  expect(nativeDrag.preventDefault).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(1500));
  result.current.onPointerMoveCapture(event(100, 105, mouse));
  result.current.onPointerUpCapture(event(100, 105, mouse));
  expect(onSelect).toHaveBeenCalledWith(20);
  jest.useRealTimers();
});

test("a new tap on Comprar immediately after a swipe remains actionable", () => {
  const { swipe, result, event } = setup();
  swipe([200, 100], [100, 100]);
  const button = document.createElement("button");
  result.current.onPointerDownCapture(event(100, 100, { target: button }));
  result.current.onPointerUpCapture(event(100, 100, { target: button }));
  const click = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
  result.current.onClickCapture(click);
  expect(click.preventDefault).not.toHaveBeenCalled();
});

test("swipe stops at the first and last categories", () => {
  const first = setup({ activeId: "offers" });
  first.swipe([100, 100], [200, 100]);
  const last = setup({ activeId: 20 });
  last.swipe([200, 100], [100, 100]);
  expect(first.onSelect).not.toHaveBeenCalled();
  expect(last.onSelect).not.toHaveBeenCalled();
});

test("search/dialog state and a changed category invalidate an in-progress swipe", () => {
  const { result, event, rerender, props, onSelect } = setup();
  result.current.onPointerDownCapture(event(200, 100));
  rerender({ ...props, enabled: false });
  result.current.onPointerUpCapture(event(100, 100));
  rerender(props);
  result.current.onPointerDownCapture(event(200, 100));
  rerender({ ...props, activeId: 20 });
  result.current.onPointerUpCapture(event(100, 100));
  expect(onSelect).not.toHaveBeenCalled();
});

test("swiping from Haz un regalo changes category without opening the gift; a tap still works", () => {
  const onGift = jest.fn();
  render(<GestureSurface onGift={onGift} />);
  const gift = screen.getByText("Haz un regalo");
  dispatchPointer(gift, "pointerdown", 250, 200);
  dispatchPointer(gift, "pointermove", 130, 203);
  dispatchPointer(gift, "pointerup", 130, 203);
  fireEvent.click(gift);
  expect(screen.getByTestId("category").textContent).toBe("20");
  expect(onGift).not.toHaveBeenCalled();
  dispatchPointer(gift, "pointerdown", 130, 200);
  dispatchPointer(gift, "pointerup", 130, 200);
  fireEvent.click(gift);
  expect(onGift).toHaveBeenCalledTimes(1);
});

test("horizontal trackpad gesture changes one category, ignores inertia, then allows reverse swipe", () => {
  jest.useFakeTimers();
  render(<GestureSurface />);
  const surface = screen.getByTestId("products");
  fireEvent.wheel(surface, { deltaX: 35, deltaY: 3 });
  fireEvent.wheel(surface, { deltaX: 35, deltaY: 3 });
  expect(screen.getByTestId("category").textContent).toBe("20");
  fireEvent.wheel(surface, { deltaX: -130, deltaY: 3 });
  expect(screen.getByTestId("category").textContent).toBe("20");
  act(() => jest.advanceTimersByTime(300));
  fireEvent.wheel(surface, { deltaX: -75 });
  expect(screen.getByTestId("category").textContent).toBe("10");
  jest.useRealTimers();
});

test("vertical wheel and pinch zoom are not blocked or interpreted as category changes", () => {
  render(<GestureSurface />);
  const surface = screen.getByTestId("products");
  const vertical = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 140, deltaX: 6 });
  const zoom = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 140, ctrlKey: true });
  fireEvent(surface, vertical);
  fireEvent(surface, zoom);
  expect(vertical.defaultPrevented).toBe(false);
  expect(zoom.defaultPrevented).toBe(false);
  expect(screen.getByTestId("category").textContent).toBe("10");
});

test("trackpad support attaches after the asynchronous store has loaded", () => {
  const { rerender } = render(<GestureSurface ready={false} />);
  rerender(<GestureSurface ready />);
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 90 });
  fireEvent(screen.getByText("Haz un regalo"), event);
  expect(event.defaultPrevented).toBe(true);
  expect(screen.getByTestId("category").textContent).toBe("20");
});
