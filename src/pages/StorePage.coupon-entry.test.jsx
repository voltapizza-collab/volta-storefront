import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import StorePage from "./StorePage";
import api from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../utils/seo", () => ({ buildStorefrontSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock("react-router-dom", () => {
  const location = { pathname: "/test/centro", search: "", hash: "", state: null };
  const navigate = jest.fn();
  return { useParams: () => ({ partnerSlug: "test", storeSlug: "centro" }), useLocation: () => location,
    useNavigate: () => navigate, Link: ({ children }) => children };
}, { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.scrollTo = jest.fn();
  Element.prototype.scrollTo = jest.fn();
  window.localStorage.setItem("volta-repeat-cart-draft:test:centro", JSON.stringify({ items: [
    { id: "pizza-1", pizzaId: 1, name: "Margherita", qty: 1, unitPrice: 10, subtotal: 10, source: "menu", size: "M" },
  ] }));
  api.get.mockImplementation(async path => {
    if (path === "/partners/test") return { id: 1, slug: "test", name: "Test", currency: "EUR", storefrontMode: "commercial-light" };
    if (path.endsWith("/menu")) return { store: { id: 1, partnerId: 1, storeName: "Centro", pickupEnabled: true }, menu: [] };
    return {};
  });
  api.post.mockResolvedValue({ valid: false, status: "not_found", message: "No encontramos ese cupón." });
});

async function openCouponEntry() {
  render(<StorePage />);
  const trigger = await screen.findByRole("button", { name: "Cupones: introducir o validar código" }, { timeout: 4000 });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Introduce tu cupón" });
  return { trigger, dialog, input: within(dialog).getByRole("textbox", { name: "Código del cupón" }) };
}

test("footer opens code entry without validation, then shows and retains the applied coupon", async () => {
  api.post.mockResolvedValue({ valid: true, status: "valid", message: "Descuento aplicado.", discount: 2,
    coupon: { id: 20, code: "PROMO20", kind: "PERCENT", percent: 20 } });
  const { trigger, dialog, input } = await openCouponEntry();
  expect(api.post).not.toHaveBeenCalledWith("/api/coupons/validate", expect.anything());
  expect(input).toHaveFocus();
  expect(within(dialog).getByRole("button", { name: "Validar cupón" })).toBeDisabled();
  fireEvent.change(input, { target: { value: " promo20 " } });
  fireEvent.submit(input.closest("form"));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/coupons/validate", expect.objectContaining({ code: "PROMO20", storeId: 1 })));
  expect(await screen.findByText("Descuento aplicado.")).toBeInTheDocument();
  expect(trigger).toHaveTextContent("20% OFF");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar", exact: true }));
  expect(screen.queryByRole("dialog", { name: "Condiciones de la oferta" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Condiciones de la oferta" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Código del cupón" })).toHaveValue("PROMO20");
  expect(api.post.mock.calls.filter(([path]) => path === "/api/coupons/validate")).toHaveLength(1);
});

test("an invalid code can be edited and closing the modal preserves the draft", async () => {
  const { trigger, dialog, input } = await openCouponEntry();
  fireEvent.change(input, { target: { value: "incorrecto" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Validar cupón" }));
  expect(await screen.findByText("No encontramos ese cupón.")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "nuevo" } });
  expect(screen.queryByText("No encontramos ese cupón.")).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Introduce tu cupón" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  expect(screen.getByRole("textbox", { name: "Código del cupón" })).toHaveValue("NUEVO");
  expect(api.post.mock.calls.filter(([path]) => path === "/api/coupons/validate")).toHaveLength(1);
});
