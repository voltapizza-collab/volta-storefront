import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OrderItems, buildWindowsPrintTicketHtml } from "./PosApp";
import { buildOrderLines } from "./printers/mockPrinter";
import { getRemovableIngredients } from "../utils/ingredientRemovals";
import { getLineChangeRows } from './orderLineChanges';
jest.mock("../setupAxios", () => ({ __esModule: true, default: {} }));
jest.mock("../components/Backoffice/EngineBackground", () => () => null);
jest.mock("../assets/logo/pizza.svg", () => ({ __esModule: true, default: "pizza.svg", ReactComponent: () => null }));

const order = { id: 1, total: 20, products: [
  { pizzaId: 1, name: "Barbacoa", qty: 1, size: "M", removedIngredients: [{ ingredientId: 10, name: "Cebolla" }], extras: [{ name: 'Mozzarella' }] },
  { pizzaId: 1, name: "Barbacoa", qty: 1, size: "M" },
] };
test("kitchen, Windows and Sunmi ticket show the removal under only its own pizza", () => {
  render(<OrderItems order={order} />);
  expect(screen.getAllByText("SIN CEBOLLA")).toHaveLength(1);
  expect(screen.getByText("SIN CEBOLLA")).toHaveClass("pos-ingredientRemoval");
  expect(screen.getAllByText('CAMBIOS:')).toHaveLength(1);
  expect(screen.getAllByText('Receta original')).toHaveLength(1);
  expect(screen.getByText('Extra: Mozzarella')).toBeInTheDocument();
  const lines = buildOrderLines(order);
  const first = lines.indexOf("1 x Barbacoa M");
  expect(lines.slice(first, first + 6)).toEqual([
    '1 x Barbacoa M', '  CAMBIOS:', '  - SIN CEBOLLA', '  - Extra: Mozzarella',
    '1 x Barbacoa M', '  Receta original',
  ]);
  expect(buildWindowsPrintTicketHtml(order)).toContain('<li class="removal">SIN CEBOLLA</li>');
  expect(buildWindowsPrintTicketHtml(order)).toContain('<li class="changesHeading">CAMBIOS:</li>');
  expect(buildWindowsPrintTicketHtml(order)).toContain('<li class="recipeOriginal">Receta original</li>');
});
test('extras alone are changes, including stored JSON and half placement, without claiming an original recipe', () => {
  expect(getLineChangeRows({ ...order.products[1], extras: JSON.stringify([{ name: 'Bacon', side: 'LEFT' }]) }))
    .toEqual(['CAMBIOS:', 'Extra Mitad A: Bacon']);
  for (const fields of [{ type: 'CUSTOM_BUILD' }, { type: 'HALF_HALF' }, { promoId: 2 }, { notes: 'Muy hecha' }, { source: 'incentive_reward' }]) {
    expect(getLineChangeRows({ ...order.products[1], ...fields })).toEqual([]);
  }
});
test("Windows printing escapes ingredient names", () => {
  const html = buildWindowsPrintTicketHtml({ ...order, products: [{ ...order.products[0], removedIngredients: [{ ingredientId: 10, name: "<img src=x>" }] }] });
  expect(html).not.toContain("<IMG SRC=X>");
  expect(html).toContain("&lt;IMG SRC=X&gt;");
});
test("recipe ingredients are offered automatically even without quantities or permissions, excluding random placeholders", () => {
  const product = { pizzaId: 1, ingredients: [
    { id: 1, name: "Cebolla", removable: false, qtyBySize: { M: 0, L: 0 } },
    { id: 2, name: "Mozzarella" },
    { id: 3, name: "Random", canonicalKey: "random_selection_1", removable: true, qtyBySize: { M: 1 } },
    { id: 4, name: "Random selection 2" },
  ] };
  const recipe = [{ ingredientId: 1, name: "Cebolla" }, { ingredientId: 2, name: "Mozzarella" }];
  expect(getRemovableIngredients(product, "M")).toEqual(recipe);
  expect(getRemovableIngredients(product, "L")).toEqual(recipe);
  expect(getRemovableIngredients(product, "")).toEqual([]);
  for (const fields of [{ type: "HALF_HALF" }, { promoId: 1 }, { type: "CUSTOM_BUILD" }, { source: "incentive_reward" }]) {
    expect(getRemovableIngredients({ ...product, ...fields }, "M")).toEqual([]);
  }
});
