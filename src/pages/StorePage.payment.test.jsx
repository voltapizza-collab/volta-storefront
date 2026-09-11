import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import StorePage from "./StorePage";
import api from "../services/api";

jest.mock("../services/api", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../utils/seo", () => ({ buildStorefrontSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock("react-router-dom", () => {
  const location = { pathname: "/test/centro/menu", search: "", state: null };
  const navigate = jest.fn();
  return { useParams: () => ({ partnerSlug: "test", storeSlug: "centro" }), useLocation: () => location,
    useNavigate: () => navigate, Link: ({ children }) => children };
}, { virtual: true });

let availability;
let holdAvailability;
let cashEnabled;
const checkoutCalls = () => api.post.mock.calls.filter(([path]) => path === "/api/checkout/session");
const availabilityCalls = () => api.get.mock.calls.filter(([path]) => path.includes("/availability/"));

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.scrollTo = jest.fn();
  Element.prototype.scrollTo = jest.fn();
  cashEnabled = true;
  holdAvailability = null;
  availability = { acceptingOrders: true, serviceOpen: true, requiresSchedule: false, days: [], paymentMethods: ["card", "klarna"] };
  window.localStorage.setItem("volta-repeat-cart-draft:test:centro", JSON.stringify({ items: [
    { id: "pizza-1", pizzaId: 1, name: "Margherita", qty: 1, unitPrice: 10, subtotal: 10, source: "menu", size: "M" },
  ] }));
  window.localStorage.setItem("volta-checkout-customer:test", JSON.stringify({ name: "Test", phone: "612345678" }));
  api.get.mockImplementation(async (path) => {
    if (path.includes("/availability/")) return holdAvailability ? holdAvailability : availability;
    if (path === "/partners/test") return { id: 1, slug: "test", name: "Test", currency: "EUR", paymentPolicySettings: { cash: cashEnabled } };
    if (path.endsWith("/menu")) return { store: { id: 1, partnerId: 1, storeName: "Centro", pickupEnabled: true }, menu: [] };
    return {};
  });
  api.post.mockResolvedValue({});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function openCart() {
  render(<StorePage />);
  const buttons = await screen.findAllByRole("button", { name: "Abrir carrito" }, { timeout: 4000 });
  fireEvent.click(buttons[0]);
  await screen.findByRole("radio", { name: /Tarjeta/ });
  await waitFor(() => expect(availabilityCalls().length).toBeGreaterThan(0));
}
async function openPicker() {
  fireEvent.click(screen.getByRole("radio", { name: /Tarjeta/ }));
  return screen.findByRole("dialog", { name: "¿Cómo quieres pagar?" });
}

test("cart card selector opens locally without awaiting availability or starting checkout", async () => {
  await openCart();
  const callsBefore = availabilityCalls().length;
  holdAvailability = new Promise(() => {});
  const modal = await openPicker();
  expect(within(modal).getByRole("button", { name: /Tarjeta de débito o crédito/ })).toBeEnabled();
  expect(within(modal).getByRole("button", { name: /Klarna/ })).toBeEnabled();
  expect(within(modal).queryByRole("button", { name: /Efectivo/ })).not.toBeInTheDocument();
  expect(modal).not.toHaveTextContent(/Stripe|Link/);
  expect(availabilityCalls()).toHaveLength(callsBefore);
  expect(checkoutCalls()).toHaveLength(0);
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(await screen.findByRole("radio", { name: /Tarjeta/ })).toBeInTheDocument();
});

test.each([["Tarjeta", "card", "Pagar ahora"], ["Klarna", "klarna", "Pagar con Klarna"]])(
  "selecting %s returns to the cart and only the final pay button submits its method", async (title, paymentMethod, payLabel) => {
    await openCart();
    const modal = await openPicker();
    fireEvent.click(within(modal).getByRole("button", { name: new RegExp(title) }));
    expect(checkoutCalls()).toHaveLength(0);
    fireEvent.click(await screen.findByRole("button", { name: payLabel }));
    await waitFor(() => expect(checkoutCalls()).toHaveLength(1));
    expect(checkoutCalls()[0][1]).toEqual(expect.objectContaining({ paymentMode: "card", paymentMethod, total: 10 }));
  }
);

test("a slow availability check disables checkout and repeated taps create only one request", async () => {
  await openCart();
  let release;
  holdAvailability = new Promise(resolve => { release = resolve; });
  const countBefore = availabilityCalls().length;
  const pay = screen.getByRole("button", { name: "Pagar ahora" });
  fireEvent.click(pay);
  fireEvent.click(pay);
  expect(pay).toBeDisabled();
  expect(availabilityCalls()).toHaveLength(countBefore + 1);
  expect(checkoutCalls()).toHaveLength(0);
  await act(async () => release(availability));
  await waitFor(() => expect(checkoutCalls()).toHaveLength(1));
});

test("Klarna survives scheduling and the contact form", async () => {
  window.localStorage.removeItem("volta-checkout-customer:test");
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setUTCHours(18, 30, 0, 0);
  const slot = { time: "20:30", scheduledFor: tomorrow.toISOString() };
  availability = { ...availability, requiresSchedule: true, serviceOpen: false,
    days: [{ date: tomorrow.toISOString().slice(0, 10), slots: [slot] }] };
  await openCart();
  const modal = await openPicker();
  fireEvent.click(within(modal).getByRole("button", { name: /Klarna/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Programar y continuar" }));
  const schedule = await screen.findByRole("dialog", { name: "Programar pedido" });
  fireEvent.click(await within(schedule).findByRole("button", { name: "20:30" }));
  fireEvent.click(within(schedule).getByRole("button", { name: "Confirmar y continuar" }));
  fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "Cliente" } });
  fireEvent.change(screen.getByLabelText("Telefono"), { target: { value: "612345678" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));
  await waitFor(() => expect(checkoutCalls()).toHaveLength(1));
  expect(checkoutCalls()[0][1]).toEqual(expect.objectContaining({ paymentMode: "card", paymentMethod: "klarna", scheduledFor: slot.scheduledFor }));
});

test("cash still requires confirmation and submits no online payment method", async () => {
  await openCart();
  fireEvent.click(screen.getByRole("radio", { name: /Efectivo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar pedido" }));
  const confirmation = await screen.findByRole("dialog", { name: "Pagar en efectivo" });
  expect(checkoutCalls()).toHaveLength(0);
  fireEvent.click(within(confirmation).getByRole("button", { name: "Confirmar pedido en efectivo" }));
  await waitFor(() => expect(checkoutCalls()).toHaveLength(1));
  expect(checkoutCalls()[0][1].paymentMode).toBe("cash");
  expect(checkoutCalls()[0][1]).not.toHaveProperty("paymentMethod");
});

test("the selector still opens when card is the only configured method", async () => {
  availability.paymentMethods = ["card"];
  cashEnabled = false;
  await openCart();
  const modal = await openPicker();
  expect(within(modal).getByRole("button", { name: /Tarjeta de débito o crédito/ })).toBeEnabled();
  expect(within(modal).queryByRole("button", { name: /Klarna|Efectivo/ })).not.toBeInTheDocument();
});
