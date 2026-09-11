import { fireEvent, render, screen } from "@testing-library/react";
import CatalogNavigation, { CatalogFocusCategory, CatalogSearch, CatalogTools } from "./CatalogNavigation";

const offers = [{ id: "top-deals", label: "Top Deal" }, { id: "promos", label: "Promos" }];
const categories = [{ id: 10, label: "Deep Dish" }, { id: 20, label: "Bebidas" }];

test("focused category picker preserves IDs and reflects swipe selection without a button rail", () => {
  const onSelect = jest.fn();
  const props = { offers, categories, activeId: 10, onSelect, resultCount: 5 };
  const { rerender } = render(<CatalogFocusCategory {...props} />);
  const picker = screen.getByRole("combobox", { name: "Cambiar categoría" });
  fireEvent.change(picker, { target: { value: "20" } });
  fireEvent.change(picker, { target: { value: "promos" } });
  expect(onSelect.mock.calls).toEqual([[20], ["promos"]]);
  rerender(<CatalogFocusCategory {...props} activeId={20} resultCount={1} />);
  expect(picker.value).toBe("20");
  expect(screen.getByRole("status").textContent).toBe("Bebidas: 1 producto");
  expect(screen.queryByRole("navigation")).toBeNull();
});

test("global search shows results without a misleading category picker", () => {
  const props = { offers, categories, activeId: 10, onSelect: jest.fn(), resultCount: 3 };
  const { rerender } = render(<CatalogFocusCategory {...props} searching />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Resultados: 3 productos");
  rerender(<CatalogFocusCategory {...props} />);
  expect(screen.getByRole("combobox").value).toBe("10");
});

test("scrolling categories and elapsed time never change the selection", () => {
  jest.useFakeTimers();
  const onSelect = jest.fn();
  const { container } = render(<CatalogNavigation offers={offers} categories={categories} activeId={10} onSelect={onSelect} />);
  fireEvent.scroll(container.querySelector(".sf-catalogCategories"), { target: { scrollLeft: 200 } });
  jest.advanceTimersByTime(15000);
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Deep Dish" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Bebidas" }));
  expect(onSelect).toHaveBeenCalledWith(20);
  jest.useRealTimers();
});

test("mobile offers select and desktop buttons select the same category", () => {
  const onSelect = jest.fn();
  const { container } = render(<CatalogNavigation offers={offers} categories={categories} activeId="top-deals" onSelect={onSelect} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Ofertas" }), { target: { value: "promos" } });
  fireEvent.click(screen.getByRole("button", { name: "Promos" }));
  expect(onSelect.mock.calls).toEqual([["promos"], ["promos"]]);
  expect(container.querySelector(".sf-catalogCategories .sf-catalogOffers")).toBeNull();
});

test("closing search clears its filter", () => {
  const onChange = jest.fn(), onClose = jest.fn();
  render(<CatalogSearch value="tomate" onChange={onChange} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "Cerrar búsqueda" }));
  expect(onChange).toHaveBeenCalledWith("");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("search updates live and announces the result count", () => {
  const onChange = jest.fn();
  render(<CatalogSearch value="pollo" resultCount={3} onChange={onChange} onClose={() => {}} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "queso" } });
  expect(onChange).toHaveBeenCalledWith("queso");
  expect(screen.getByRole("status").textContent).toBe("3 productos encontrados en la vitrina");
});

test("clear keeps search open, while Escape clears and closes it", () => {
  const onChange = jest.fn(), onClose = jest.fn();
  render(<CatalogSearch value="pollo" onChange={onChange} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
  expect(onChange).toHaveBeenCalledWith("");
  expect(onClose).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Más closes outside or with Escape without selecting an action", () => {
  const action = jest.fn();
  const { container } = render(<CatalogTools><button onClick={action}>Arma tu pizza</button></CatalogTools>);
  const details = container.querySelector("details");
  details.open = true;
  fireEvent.pointerDown(document.body);
  expect(details.open).toBe(false);
  details.open = true;
  fireEvent.keyDown(document, { key: "Escape" });
  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(container.querySelector("summary"));
  expect(action).not.toHaveBeenCalled();
});
