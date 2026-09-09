import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CouponInfoModal } from "./StorePage";

jest.mock("react-router-dom", () => ({ Link: "a", useLocation: jest.fn(), useNavigate: jest.fn(), useParams: jest.fn() }), { virtual: true });
const coupon = { id: 1, code: "VOLTA", kind: "AMOUNT", amount: 5, expiresAt: "2027-10-14T12:00:00Z" };
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-09-09T12:00:00Z")); });
afterEach(() => jest.useRealTimers());
test("long validity uses days and a saved coupon leads to products", () => {
  const choose = jest.fn();
  render(<CouponInfoModal open data={{ coupon, status: "empty_cart", message: "Cupón guardado" }} onChooseProducts={choose} />);
  expect(screen.getByText("400 días")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Elegir productos" }));
  expect(choose).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Top Deals, Promos/)).toBeInTheDocument();
});
test("short validity uses minutes and validation blocks the main action", () => {
  render(<CouponInfoModal open validating data={{ coupon: { ...coupon, expiresAt: "2026-09-09T13:00:00Z" }, status: "valid", valid: true }} />);
  expect(screen.getByText("60 minutos")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Validando..." })).toBeDisabled();
});
test("delivery-free conditions and cash redemption are explicit", () => {
  render(<CouponInfoModal open data={{ coupon: { ...coupon, campaign: "DELIVERY_FREE" }, valid: true, status: "valid" }} />);
  expect(screen.getByText(/Elimina los gastos de envío/)).toBeInTheDocument();
  expect(screen.getByText(/En efectivo, al confirmar el pedido/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ir al carrito" })).toBeEnabled();
});
test("network error offers retry and removal even without coupon details", () => {
  const remove = jest.fn(), retry = jest.fn();
  render(<CouponInfoModal open data={{ status: "error", message: "Error temporal" }} onRemove={remove} onValidate={retry} />);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  fireEvent.click(screen.getByRole("button", { name: "Quitar cupon" }));
  expect(remove).toHaveBeenCalledTimes(1); expect(retry).toHaveBeenCalledTimes(1);
});
