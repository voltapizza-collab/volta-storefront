import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import CouponGallery from "./CouponGallery";
import api from "../../setupAxios";
import { useLocation, useNavigate } from "react-router-dom";

jest.mock("../../setupAxios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("react-router-dom", () => ({
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
}), { virtual: true });

const plaza = { id: 1, slug: "plaza-diario", active: true, acceptingOrders: true };
const vigo = { id: 2, slug: "vigocity", active: false, acceptingOrders: true };
const partner = { id: 1, slug: "mycrushpizza", name: "MyCrushPizza", stores: [plaza] };
const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.localStorage.setItem("volta_coupon_gallery_zip_1", "32004");
  window.localStorage.setItem("volta_coupon_gallery_legal_2026-05-coupon-games-legal-v1", "accepted");
  useNavigate.mockReturnValue(navigate);
  useLocation.mockReturnValue({ pathname: "/mycrushpizza/coupons", state: null });
  api.get.mockImplementation(async (path) => {
    if (path === "/stores?partnerId=1") return { data: [vigo, plaza] };
    if (path.startsWith("/api/coupons/gallery-context")) return { data: { zipCodes: ["32004"] } };
    if (path.startsWith("/api/coupons/gallery?")) return { data: { cards: [] } };
    throw new Error(`Unexpected request: ${path}`);
  });
  api.post.mockResolvedValue({ data: {} });
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

async function returnToStore(nextPartner = partner) {
  render(<CouponGallery partner={nextPartner} />);
  await screen.findByText(/No hay cupones publicos disponibles/);
  fireEvent.click(screen.getByRole("button", { name: "Volver a tienda" }));
}

test("direct QR entry opens the active public store even when the store list starts with inactive Vigo", async () => {
  await returnToStore();
  expect(navigate).toHaveBeenCalledWith("/mycrushpizza/plaza-diario");
  expect(api.post).toHaveBeenCalledWith("/api/presence/heartbeat", expect.objectContaining({ storeId: 1 }));
});

test("returning from an active store preserves its route and query", async () => {
  const route = "/mycrushpizza/centro?coupon=DEMO#menu";
  useLocation.mockReturnValue({ state: { returnToStorePath: route } });
  await returnToStore({ ...partner, stores: [plaza, { ...plaza, id: 3, slug: "centro" }] });
  expect(navigate).toHaveBeenCalledWith(route);
  expect(api.post).toHaveBeenCalledWith("/api/presence/heartbeat", expect.objectContaining({ storeId: 3 }));
});

test.each([
  "/mycrushpizza/vigocity",
  "/mycrushpizza/tienda-antigua",
  "/otro-partner/plaza-diario",
  "/mycrushpizza",
])("an unavailable or obsolete return route (%s) falls back to an active store", async (route) => {
  useLocation.mockReturnValue({ state: { returnToStorePath: route } });
  await returnToStore({ ...partner, stores: [vigo, plaza] });
  expect(navigate).toHaveBeenCalledWith("/mycrushpizza/plaza-diario");
});

test("with no stores accepting orders, navigation goes to the order page instead of an inactive store", async () => {
  await returnToStore({ ...partner, stores: [vigo, { ...plaza, acceptingOrders: false }] });
  expect(navigate).toHaveBeenCalledWith("/mycrushpizza/order");
  expect(api.post).not.toHaveBeenCalledWith("/api/presence/heartbeat", expect.anything());
});

test("the game opened from the gallery receives the same active store destination", async () => {
  api.get.mockImplementation(async (path) => {
    if (path === "/stores?partnerId=1") return { data: [vigo, plaza] };
    if (path.startsWith("/api/coupons/gallery-context")) return { data: { zipCodes: ["32004"] } };
    return { data: { cards: [{ type: "GAME", key: "gold", title: "Premio dorado", remaining: 1,
      game: { slug: "winning-number", name: "Premio dorado" } }] } };
  });
  render(<CouponGallery partner={partner} />);
  await waitFor(() => expect(screen.getByRole("region", { name: "Cupones disponibles" })).toBeInTheDocument());
  const gallery = screen.getByRole("region", { name: "Cupones disponibles" });
  fireEvent.click(within(gallery).getByRole("button"));
  expect(navigate).toHaveBeenCalledWith("/mycrushpizza/games/winning-number", expect.objectContaining({
    state: expect.objectContaining({ returnToStorePath: "/mycrushpizza/plaza-diario" }),
  }));
});
