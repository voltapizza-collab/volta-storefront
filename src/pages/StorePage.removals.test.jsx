import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import StorePage from "./StorePage";
import api from "../services/api";

jest.mock("../services/api", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../utils/seo", () => ({ buildStorefrontSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock("react-router-dom", () => {
  const location = { pathname: "/test/centro/menu", search: "", state: null };
  return { useParams: () => ({ partnerSlug: "test", storeSlug: "centro" }), useLocation: () => location,
    useNavigate: () => jest.fn(), Link: ({ children }) => children };
}, { virtual: true });

const product = { pizzaId: 1, name: "Barbacoa", categoryId: 1, category: "Pizzas", selectSize: ["M"], priceBySize: { M: 10 }, available: true,
  ingredients: [
    { id: 10, name: "Cebolla", removable: false, qtyBySize: { M: 0 } },
    { id: 11, name: "Masa", removable: false, qtyBySize: { M: 100 } },
    { id: 12, name: "Maíz" },
  ] };
const draftKey = "volta-repeat-cart-draft:test:centro";

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  window.scrollTo = jest.fn(); Element.prototype.scrollTo = jest.fn();
  localStorage.setItem("volta-checkout-customer:test", JSON.stringify({ name: "Test", phone: "612345678" }));
  api.get.mockImplementation(async (path) => {
    if (path.includes("/availability/")) return { acceptingOrders: true, serviceOpen: true, days: [], paymentMethods: ["card"] };
    if (path === "/partners/test") return { id: 1, slug: "test", name: "Test", currency: "EUR" };
    if (path.endsWith("/menu")) return { store: { id: 1, partnerId: 1, storeName: "Centro", pickupEnabled: true }, menu: [product] };
    if (path.includes("ingredient-extras")) return [{ ingredientId: 10, name: "Cebolla", price: 2 }];
    return {};
  });
  api.post.mockResolvedValue({});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function openProduct() {
  const button = (await screen.findAllByRole("button", { name: "Comprar Barbacoa" }))[0];
  await act(async () => fireEvent.click(button));
  const modal = document.querySelector(".sf-standardProductModal");
  fireEvent.click(within(modal).getByText("Quitar ingredientes"));
  return within(modal);
}
const cartDraft = () => JSON.parse(localStorage.getItem(draftKey)).items;

test("repeating an order preserves its removals in the preview and the new cart", async () => {
  const previousGet = api.get.getMockImplementation();
  api.get.mockImplementation(async (path) => path.includes("/repeat/recent") ? { orders: [{ cartDraft: {
    sourceOrderCode: "DEMO-1", currency: "EUR", items: [{ pizzaId: 1, name: "Barbacoa", size: "M", qty: 1, price: 10, subtotal: 10,
      removedIngredients: [{ ingredientId: 10, name: "Cebolla" }] }],
  } }] } : previousGet(path));
  render(<StorePage />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Repetir pedido anterior" }))[0]);
  fireEvent.change(screen.getByLabelText("Telefono"), { target: { value: "612345678" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver ultimos 3" }));
  const choice = await screen.findByRole("button", { name: /Pedido DEMO-1/ });
  expect(choice).toHaveTextContent("SIN CEBOLLA");
  fireEvent.click(choice);
  await waitFor(() => expect(cartDraft()[0].removedIngredients).toEqual([{ ingredientId: 10, name: "Cebolla" }]));
  fireEvent.click(screen.getAllByRole("button", { name: "Abrir carrito" })[0]);
  expect(screen.getByText("SIN CEBOLLA")).toBeInTheDocument();
});

test("selecting an extra prevents removing the same ingredient until the extra is unchecked", async () => {
  render(<StorePage />);
  const modal = await openProduct();
  fireEvent.click(modal.getByRole("button", { name: /Extras/ }));
  fireEvent.click(modal.getByRole("checkbox", { name: /Cebolla.*EUR/ }));
  expect(modal.getByRole("checkbox", { name: /Sin Cebolla/ })).toBeDisabled();
  fireEvent.click(modal.getByRole("checkbox", { name: /Cebolla.*EUR/ }));
  expect(modal.getByRole("checkbox", { name: "Sin Cebolla" })).toBeEnabled();
});

test("dropdown, extra conflict, separate pizzas, editable cart and checkout keep removals at the same price", async () => {
  render(<StorePage />);
  let modal = await openProduct();
  expect(modal.getByRole("checkbox", { name: "Sin Masa" })).toBeEnabled();
  fireEvent.click(modal.getByRole("checkbox", { name: "Sin Cebolla" }));
  await waitFor(() => expect(modal.getByRole("button", { name: /Extras/ })).toBeEnabled());
  fireEvent.click(modal.getByRole("button", { name: /Extras/ }));
  expect(modal.getByRole("checkbox", { name: /Cebolla.*Marcado para quitar/ })).toBeDisabled();
  fireEvent.click(modal.getByRole("button", { name: /Agregar|Añadir|Anadir|Add/i }));
  await waitFor(() => expect(cartDraft()).toHaveLength(1));
  expect(cartDraft()[0]).toEqual(expect.objectContaining({ subtotal: 10, removedIngredients: [{ ingredientId: 10, name: "Cebolla" }] }));
  modal = await openProduct();
  expect(modal.getByRole("checkbox", { name: "Sin Cebolla" })).not.toBeChecked();
  fireEvent.click(modal.getByRole("button", { name: /Agregar|Añadir|Anadir|Add/i }));
  await waitFor(() => expect(cartDraft()).toHaveLength(2));
  fireEvent.click(screen.getAllByRole("button", { name: "Abrir carrito" })[0]);
  const rows = document.querySelectorAll(".sf-cartRow");
  expect(within(rows[0]).getByText("SIN CEBOLLA")).toBeInTheDocument();
  expect(rows[1]).not.toHaveTextContent("SIN CEBOLLA");
  fireEvent.click(within(rows[0]).getByText("Quitar ingredientes"));
  fireEvent.click(within(rows[0]).getByRole("checkbox", { name: "Sin Maíz" }));
  fireEvent.click(screen.getByRole("button", { name: "Pagar ahora" }));
  await waitFor(() => expect(api.post.mock.calls.some(([path]) => path === "/api/checkout/session")).toBe(true));
  const payload = api.post.mock.calls.find(([path]) => path === "/api/checkout/session")[1];
  expect(payload.total).toBe(20);
  expect(payload.cart[0].removedIngredients).toHaveLength(2);
  expect(payload.cart[1].removedIngredients).toEqual([]);
});

test("restored drafts keep old removals visible and allow clearing a changed recipe without changing its price", async () => {
  localStorage.setItem(draftKey, JSON.stringify({ items: [{ pizzaId: 1, name: "Barbacoa", qty: 1, price: 10, subtotal: 10, size: "M",
    removedIngredients: [{ ingredientId: 99, name: "Ingrediente anterior" }] }] }));
  render(<StorePage />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Abrir carrito" }))[0]);
  expect(screen.getByText("SIN INGREDIENTE ANTERIOR")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Quitar ingredientes"));
  fireEvent.click(screen.getByRole("checkbox", { name: /Sin Ingrediente anterior/ }));
  await waitFor(() => expect(cartDraft()[0].removedIngredients).toEqual([]));
  expect(cartDraft()[0].subtotal).toBe(10);
});
