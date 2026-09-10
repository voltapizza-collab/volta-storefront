import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import useCatalogSwipe from "./useCatalogSwipe";

const items = [{ id: "offers" }, { id: 10 }, { id: 20 }];

function TouchCatalog({ enabled = true, ready = true, onSelect = () => {}, onBuy = () => {} }) {
  const [activeId, setActiveId] = useState(10);
  const surfaceRef = useRef(null);
  const handlers = useCatalogSwipe({ items, activeId, enabled, ready, surfaceRef,
    onSelect: id => { setActiveId(id); onSelect(id); } });
  if (!ready) return <span>Cargando</span>;
  return <>
    <button onClick={() => setActiveId("offers")}>Cambiar externamente</button>
    <div ref={surfaceRef} {...handlers} data-testid="surface">
    <output data-testid="category">{activeId}</output>
    <div className="lsf-grid-wrap"><article className="lsf-card">
      <div className="lsf-flip__front"><div className="lsf-card__image"><img alt="Pizza" /></div></div>
      <button onClick={onBuy}>Comprar</button>
      <input aria-label="Cantidad" />
    </article></div>
    </div>
  </>;
}

const finger = (target, x, y, identifier = 7) => ({ identifier, target, clientX: x, clientY: y });
const touch = (target, type, points, changed = points) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { touches: { value: points }, changedTouches: { value: changed } });
  fireEvent(target, event);
  return event;
};
const pointer = (target, type, x, y) => {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerType: { value: "touch" }, pointerId: { value: 7 }, isPrimary: { value: true } });
  fireEvent(target, event);
};
const swipe = (target, from = [220, 100], to = [100, 103]) => {
  touch(target, "touchstart", [finger(target, ...from)]);
  const move = touch(target, "touchmove", [finger(target, ...to)]);
  touch(target, "touchend", [], [finger(target, ...to)]);
  return move;
};

test("native finger gestures change one category in either direction without capturing a pointer", () => {
  const onSelect = jest.fn();
  render(<TouchCatalog onSelect={onSelect} />);
  const image = screen.getByAltText("Pizza");
  const surface = screen.getByTestId("surface");
  surface.setPointerCapture = jest.fn(() => { throw new Error("No pointer capture for touches"); });
  expect(swipe(image).defaultPrevented).toBe(true);
  expect(screen.getByTestId("category").textContent).toBe("20");
  swipe(image, [100, 100], [220, 103]);
  expect(screen.getByTestId("category").textContent).toBe("10");
  expect(onSelect.mock.calls).toEqual([[20], [10]]);
  expect(surface.setPointerCapture).not.toHaveBeenCalled();
});

test("iPhone pointer cancellation and capture events do not cancel or duplicate its touch gesture", () => {
  const onSelect = jest.fn();
  render(<TouchCatalog onSelect={onSelect} />);
  const image = screen.getByAltText("Pizza"), surface = screen.getByTestId("surface");
  pointer(image, "pointerdown", 220, 100);
  touch(image, "touchstart", [finger(image, 220, 100)]);
  pointer(image, "pointermove", 190, 101);
  touch(image, "touchmove", [finger(image, 190, 101)]);
  pointer(image, "pointercancel", 190, 101);
  pointer(surface, "lostpointercapture", 190, 101);
  touch(image, "touchmove", [finger(image, 100, 103)]);
  pointer(image, "pointerup", 100, 103);
  touch(image, "touchend", [], [finger(image, 100, 103)]);
  expect(onSelect.mock.calls).toEqual([[20]]);
});

test("vertical scrolling remains native and cannot turn into a category swipe", () => {
  render(<TouchCatalog />);
  const image = screen.getByAltText("Pizza");
  touch(image, "touchstart", [finger(image, 220, 100)]);
  expect(touch(image, "touchmove", [finger(image, 218, 160)]).defaultPrevented).toBe(false);
  expect(touch(image, "touchmove", [finger(image, 100, 190)]).defaultPrevented).toBe(false);
  touch(image, "touchend", [], [finger(image, 100, 190)]);
  expect(screen.getByTestId("category").textContent).toBe("10");
});

test("swiping Comprar suppresses the residual click, while the next deliberate tap buys once", () => {
  const onBuy = jest.fn();
  render(<TouchCatalog onBuy={onBuy} />);
  const button = screen.getByRole("button", { name: "Comprar" });
  swipe(button);
  fireEvent.click(button);
  expect(onBuy).not.toHaveBeenCalled();
  swipe(button, [100, 100], [101, 101]);
  fireEvent.click(button);
  expect(onBuy).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("category").textContent).toBe("20");
});

test("pinch and touchcancel abandon the swipe without blocking zoom", () => {
  render(<TouchCatalog />);
  const image = screen.getByAltText("Pizza");
  touch(image, "touchstart", [finger(image, 220, 100)]);
  touch(image, "touchmove", [finger(image, 180, 101)]);
  touch(image, "touchstart", [finger(image, 180, 101), finger(image, 240, 100, 8)], [finger(image, 240, 100, 8)]);
  expect(touch(image, "touchmove", [finger(image, 120, 101), finger(image, 260, 100, 8)]).defaultPrevented).toBe(false);
  touch(image, "touchend", [], [finger(image, 120, 101)]);
  expect(screen.getByTestId("category").textContent).toBe("10");
  touch(image, "touchstart", [finger(image, 220, 100)]);
  touch(image, "touchmove", [finger(image, 120, 101)]);
  touch(image, "touchcancel", [], [finger(image, 120, 101)]);
  touch(image, "touchend", [], [finger(image, 120, 101)]);
  expect(screen.getByTestId("category").textContent).toBe("10");
});

test("touch listeners attach after loading and are disabled for search or a dialog", () => {
  const { rerender } = render(<TouchCatalog ready={false} />);
  rerender(<TouchCatalog />);
  swipe(screen.getByAltText("Pizza"));
  expect(screen.getByTestId("category").textContent).toBe("20");
  rerender(<TouchCatalog enabled={false} />);
  expect(swipe(screen.getByAltText("Pizza"), [100, 100], [220, 103]).defaultPrevented).toBe(false);
  expect(screen.getByTestId("category").textContent).toBe("20");
});

test("editing and a category selected externally do not trigger a leftover swipe", () => {
  render(<TouchCatalog />);
  expect(swipe(screen.getByRole("textbox")).defaultPrevented).toBe(false);
  const image = screen.getByAltText("Pizza");
  touch(image, "touchstart", [finger(image, 220, 100)]);
  touch(image, "touchmove", [finger(image, 190, 100)]);
  fireEvent.click(screen.getByRole("button", { name: "Cambiar externamente" }));
  touch(image, "touchend", [], [finger(image, 100, 100)]);
  expect(screen.getByTestId("category").textContent).toBe("offers");
});
