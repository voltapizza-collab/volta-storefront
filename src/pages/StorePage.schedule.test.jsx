import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const draftKey = "volta-repeat-cart-draft:test:centro";
let availability;
let slot;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.scrollTo = jest.fn();
  Element.prototype.scrollTo = jest.fn();
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setUTCHours(18, 30, 0, 0);
  slot = { time: "20:30", scheduledFor: tomorrow.toISOString() };
  availability = { acceptingOrders: true, serviceOpen: false, requiresSchedule: true, timeZone: "Europe/Madrid",
    days: [{ date: tomorrow.toISOString().slice(0, 10), slots: [slot] }] };
  window.localStorage.setItem(draftKey, JSON.stringify({ items: [
    { id: "pizza-1", pizzaId: 1, name: "Margherita", qty: 1, unitPrice: 10, subtotal: 10, source: "menu", size: "M" },
  ] }));
  window.localStorage.setItem("volta-checkout-customer:test", JSON.stringify({ name: "Test", phone: "612345678" }));
  api.get.mockImplementation(async (path) => {
    if (path.includes("/availability/")) return availability;
    if (path === "/partners/test") return { id: 1, slug: "test", name: "Test", currency: "EUR" };
    if (path.endsWith("/menu")) return { store: { id: 1, partnerId: 1, storeName: "Centro", pickupEnabled: true }, menu: [] };
    return {};
  });
  api.post.mockResolvedValue({});
});

async function openCart() {
  render(<StorePage />);
  const buttons = await screen.findAllByRole("button", { name: "Abrir carrito" }, { timeout: 4000 });
  fireEvent.click(buttons[0]);
}

test("off-hours checkout requires a selected slot; closing the modal cannot submit payment", async () => {
  await openCart();
  fireEvent.click(await screen.findByRole("button", { name: "Programar y continuar" }));
  const modal = await screen.findByRole("dialog", { name: "Programar pedido" });
  expect(within(modal).getByRole("button", { name: "Confirmar y continuar" })).toBeDisabled();
  fireEvent.click(within(modal).getByRole("button", { name: "Volver al carrito" }));
  expect(api.post.mock.calls.filter(([path]) => path === "/api/checkout/session")).toHaveLength(0);
  fireEvent.click(await screen.findByRole("button", { name: "Programar y continuar" }));
  const reopened = await screen.findByRole("dialog", { name: "Programar pedido" });
  fireEvent.click(await within(reopened).findByRole("button", { name: "20:30" }));
  fireEvent.click(within(reopened).getByRole("button", { name: "Confirmar y continuar" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/checkout/session", expect.objectContaining({ scheduledFor: slot.scheduledFor })));
  expect(JSON.parse(window.localStorage.getItem(draftKey)).scheduledFor).toBe(slot.scheduledFor);
});

test("no available slots keeps checkout blocked with a return to the cart", async () => {
  availability = { ...availability, days: availability.days.map((day) => ({ ...day, slots: [] })) };
  await openCart();
  fireEvent.click(await screen.findByRole("button", { name: "Programar y continuar" }));
  const modal = await screen.findByRole("dialog", { name: "Programar pedido" });
  expect(within(modal).getByText(/No hay franjas disponibles/)).toBeInTheDocument();
  expect(within(modal).getByRole("button", { name: "Confirmar y continuar" })).toBeDisabled();
  expect(api.post.mock.calls.filter(([path]) => path === "/api/checkout/session")).toHaveLength(0);
});

test("a store closing after the cart opened is rechecked before payment", async () => {
  availability = { ...availability, serviceOpen: true, requiresSchedule: false };
  await openCart();
  const pay = await screen.findByRole("button", { name: "Pagar ahora" });
  availability = { ...availability, serviceOpen: false, requiresSchedule: true };
  fireEvent.click(pay);
  expect(await screen.findByRole("dialog", { name: "Programar pedido" })).toBeInTheDocument();
  expect(api.post.mock.calls.filter(([path]) => path === "/api/checkout/session")).toHaveLength(0);
});

test("during service the existing immediate checkout remains available", async () => {
  availability = { ...availability, serviceOpen: true, requiresSchedule: false };
  await openCart();
  fireEvent.click(await screen.findByRole("button", { name: "Pagar ahora" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/checkout/session", expect.objectContaining({ scheduledFor: null })));
  expect(screen.queryByRole("dialog", { name: "Programar pedido" })).not.toBeInTheDocument();
});

test("restored schedules survive reload and are sent as the same instant", async () => {
  const draft = JSON.parse(window.localStorage.getItem(draftKey));
  window.localStorage.setItem(draftKey, JSON.stringify({ ...draft, scheduledFor: slot.scheduledFor }));
  await openCart();
  expect((await screen.findAllByText(/Pedido programado:/)).length).toBeGreaterThan(0);
  fireEvent.click(await screen.findByRole("button", { name: "Pagar ahora" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/checkout/session", expect.objectContaining({ scheduledFor: slot.scheduledFor })));
});

test("manual closure blocks checkout even with a previously selected schedule", async () => {
  const draft = JSON.parse(window.localStorage.getItem(draftKey));
  window.localStorage.setItem(draftKey, JSON.stringify({ ...draft, scheduledFor: slot.scheduledFor }));
  await openCart();
  const pay = await screen.findByRole("button", { name: "Pagar ahora" });
  availability = { ...availability, acceptingOrders: false, days: [] };
  fireEvent.click(pay);
  await screen.findAllByText("La tienda ha cerrado los pedidos online temporalmente.");
  expect(api.post.mock.calls.filter(([path]) => path === "/api/checkout/session")).toHaveLength(0);
});
