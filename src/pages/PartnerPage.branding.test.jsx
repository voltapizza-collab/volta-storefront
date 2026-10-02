import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PartnerPage from "./PartnerPage";
import OrderPortalTransition from "../components/Storefront/OrderPortalTransition";
import api from "../services/api";
import { useNavigate, useParams } from "react-router-dom";

jest.mock("../services/api", () => ({ get: jest.fn() }));
jest.mock("../utils/seo", () => ({ buildPartnerSeo: () => ({}), usePublicSeo: () => {} }));
jest.mock("react-router-dom", () => ({ useNavigate: jest.fn(), useParams: jest.fn() }), { virtual: true });

const partner = { id: 20, slug: "pizzeria-nueva", name: "Pizzería Nueva", brandLogoUrl: "https://example.com/nueva.png" };
const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useParams.mockReturnValue({ partnerSlug: partner.slug });
  useNavigate.mockReturnValue(navigate);
  api.get.mockResolvedValue(partner);
});

test("a new business shows its uploaded logo and opens its own order route", async () => {
  render(<PartnerPage />);
  expect(await screen.findByRole("img", { name: partner.name })).toHaveAttribute("src", partner.brandLogoUrl);
  fireEvent.click(screen.getByRole("button", { name: `Pedir en línea - ${partner.name}` }));
  expect(navigate).toHaveBeenCalledWith(`/${partner.slug}/order`, expect.objectContaining({ state: { orderTrail: "landing", partnerName: partner.name } }));
});

test("a business without a logo displays its own name and can receive orders", async () => {
  api.get.mockResolvedValue({ ...partner, brandLogoUrl: null });
  render(<PartnerPage />);
  expect(await screen.findByRole("heading", { name: partner.name })).toBeVisible();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Pedir en línea - ${partner.name}` })).toBeEnabled();
  expect(screen.queryByText(/MyCrush/)).not.toBeInTheDocument();
});

test("a broken logo disappears while the business name and order button remain", async () => {
  render(<PartnerPage />);
  fireEvent.error(await screen.findByRole("img", { name: partner.name }));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: partner.name })).toBeVisible();
  expect(screen.getByRole("button", { name: `Pedir en línea - ${partner.name}` })).toBeEnabled();
});

test("MyCrushPizza uses the same gate and gives priority to a new uploaded logo", async () => {
  useParams.mockReturnValue({ partnerSlug: "mycrushpizza" });
  api.get.mockResolvedValue({ ...partner, slug: "mycrushpizza", name: "MyCrushPizza" });
  render(<PartnerPage />);
  expect(await screen.findByRole("img", { name: "MyCrushPizza" })).toHaveAttribute("src", partner.brandLogoUrl);
  expect(screen.getByRole("main")).toHaveClass("mcp-landing");
  expect(screen.getByRole("button", { name: "Pedir en línea - MyCrushPizza" })).toHaveClass("mcp-orderButton");
});

test("a slow response never flashes a temporary MyCrushPizza logo before the definitive image", async () => {
  useParams.mockReturnValue({ partnerSlug: "mycrushpizza" });
  let resolvePartner;
  api.get.mockReturnValue(new Promise(resolve => { resolvePartner = resolve; }));
  render(<PartnerPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando pizzería");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button")).toBeDisabled();
  await act(async () => resolvePartner({ ...partner, slug: "mycrushpizza", name: "MyCrushPizza" }));
  expect(screen.getByRole("img", { name: "MyCrushPizza" })).toHaveAttribute("src", partner.brandLogoUrl);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button")).toBeEnabled();
});

test("every new business uses the same entrance design and Spanish order button", async () => {
  render(<PartnerPage />);
  await screen.findByRole("img", { name: partner.name });
  expect(screen.getByRole("main")).toHaveClass("mcp-landing");
  expect(screen.getByRole("button", { name: `Pedir en línea - ${partner.name}` })).toHaveClass("mcp-orderButton");
  expect(screen.queryByText("Order Here")).not.toBeInTheDocument();
});

test("failed loading shows an error without presenting another business or enabling orders", async () => {
  api.get.mockRejectedValue(new Error("offline"));
  render(<PartnerPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la pizzería");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button")).toBeDisabled();
});

test("the entrance uses the saved logo without substituting a bundled image", async () => {
  useParams.mockReturnValue({ partnerSlug: "mycrushpizza" });
  api.get.mockResolvedValue({ ...partner, slug: "mycrushpizza", name: "MyCrushPizza",
    brandLogoUrl: "https://res.cloudinary.com/dkgqrt7uk/image/upload/v1780562892/volta/partners/1/branding/nzhcyoyqrzpg1wtsb6hg.jpg" });
  render(<PartnerPage />);
  expect(await screen.findByRole("img", { name: "MyCrushPizza" })).toHaveAttribute("src", "https://res.cloudinary.com/dkgqrt7uk/image/upload/v1780562892/volta/partners/1/branding/nzhcyoyqrzpg1wtsb6hg.jpg");
});

test("switching businesses cannot restore the previous business from a late response", async () => {
  let finishFirst;
  api.get.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
  const { rerender } = render(<PartnerPage />);
  useParams.mockReturnValue({ partnerSlug: "segunda" });
  api.get.mockResolvedValue({ ...partner, slug: "segunda", name: "Segunda", brandLogoUrl: null });
  rerender(<PartnerPage />);
  await screen.findByRole("heading", { name: "Segunda" });
  finishFirst(partner);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Segunda" })).toBeVisible());
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("welcome uses the uploaded logo, tolerates failure, and can show a replacement", () => {
  const { rerender } = render(<OrderPortalTransition mode="brand" partnerName={partner.name} partnerLogoUrl={partner.brandLogoUrl} />);
  fireEvent.error(screen.getByRole("img", { name: partner.name }));
  expect(screen.getByText(partner.name)).toBeVisible();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  rerender(<OrderPortalTransition mode="brand" partnerName={partner.name} partnerLogoUrl="https://example.com/replacement.png" />);
  expect(screen.getByRole("img", { name: partner.name })).toHaveAttribute("src", "https://example.com/replacement.png");
});
