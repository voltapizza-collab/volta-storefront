import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PartnerLogoUpload from "./PartnerLogoUpload";
import api from "../../setupAxios";

jest.mock("../../setupAxios", () => ({ post: jest.fn() }));
const partner = { id: 7, name: "Pizzería Nueva", brandLogoUrl: "https://example.com/current.png" };
const next = { ...partner, brandLogoUrl: "https://example.com/prepared.png", brandLogoProcessing: "background_removed" };
const onSaved = jest.fn();
const select = file => fireEvent.change(screen.getByLabelText("Subir logo"), { target: { files: [file || new File(["image"], "logo.jpg", { type: "image/jpeg" })] } });
beforeEach(() => { jest.clearAllMocks(); api.post.mockResolvedValue({ data: next }); });
const setup = () => render(<PartnerLogoUpload partnerId={7} partner={partner} onSaved={onSaved} />);

test("upload prepares and saves in one request, without previews or confirmation", async () => {
  const view = setup(); select();
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(next));
  expect(api.post).toHaveBeenCalledTimes(1);
  const [path, body, config] = api.post.mock.calls[0];
  expect(path).toBe("/partners/by-id/7/logo");
  expect(body.get("logo").name).toBe("logo.jpg");
  expect(body.get("removeBackground")).toBe("true");
  expect(config).toEqual({ headers: { "Content-Type": "multipart/form-data" } });
  view.rerender(<PartnerLogoUpload partnerId={7} partner={next} onSaved={onSaved} />);
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(screen.getByRole("img")).toHaveAttribute("src", next.brandLogoUrl);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByText("Usar este logo")).not.toBeInTheDocument();
  expect(screen.queryByText("Preparar logo actual")).not.toBeInTheDocument();
});

test("pending upload keeps current logo and blocks duplicate submissions", async () => {
  let finish;
  api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  setup(); select(); select();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Subir logo")).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Preparando y guardando");
  expect(screen.getByRole("img")).toHaveAttribute("src", partner.brandLogoUrl);
  await act(async () => finish({ data: next }));
  expect(screen.getByLabelText("Subir logo")).toBeEnabled();
});

test("unmount ignores late results", async () => {
  let finish;
  api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = setup(); select(); view.unmount();
  await act(async () => finish({ data: next }));
  expect(onSaved).not.toHaveBeenCalled();
});

test("failed upload retains the logo and allows selecting the file again", async () => {
  api.post.mockRejectedValueOnce(new Error("offline"));
  setup(); select();
  expect(await screen.findByRole("alert")).toHaveTextContent("Tu logo anterior se conserva");
  expect(screen.getByRole("img")).toHaveAttribute("src", partner.brandLogoUrl);
  expect(onSaved).not.toHaveBeenCalled();
  select();
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(next));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("ambiguous background saves automatically with a short notice", async () => {
  api.post.mockResolvedValue({ data: { ...next, brandLogoProcessing: "needs_review" } });
  setup(); select();
  expect(await screen.findByText(/Logo guardado. Conservamos el fondo/)).toBeInTheDocument();
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test("oversized file is rejected before uploading", () => {
  setup();
  const file = new File(["image"], "big.png", { type: "image/png" });
  Object.defineProperty(file, "size", { value: 8 * 1024 * 1024 + 1 });
  select(file);
  expect(screen.getByRole("alert")).toHaveTextContent("máximo 8 MB");
  expect(api.post).not.toHaveBeenCalled();
});
