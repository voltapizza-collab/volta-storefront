import { fireEvent, render, screen } from "@testing-library/react";
import CatalogNavigation, { CatalogSearch, CatalogTools } from "./CatalogNavigation";

const offers = [{ id: "top-deals", label: "Top Deal" }, { id: "promos", label: "Promos" }];
const categories = [{ id: 10, label: "Deep Dish" }, { id: 20, label: "Bebidas" }];

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
