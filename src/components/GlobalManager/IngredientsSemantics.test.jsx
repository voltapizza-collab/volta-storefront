import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import IngredientsModule from "./IngredientsModule";
import api from "../../setupAxios";

jest.mock("../../setupAxios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const names = ["Pollo a la brasa", "Grilled chicken", "Pollo alla brace", "Poulet grillé", "Frango na brasa", "دجاج مشوي", "烤鸡"];
const translations = ["es", "en", "it", "fr", "pt", "ar", "zh"].map((locale, i) => ({ locale, name: names[i], description: i === 1 ? "Saved description" : "", isReviewed: i === 0 }));
let ingredient;

beforeEach(() => {
  jest.resetAllMocks();
  ingredient = { id: 143, name: names[0], category: "CARNES", isSystem: true, canonicalKey: "pollo_a_la_brasa",
    semanticCategoryId: 1, semanticStatus: "NEEDS_REVIEW", translations, aliases: [] };
  api.get.mockImplementation(async (url) => {
    if (url === "/ingredients") {
      const { translations: rows, ...rest } = ingredient;
      return { data: [{ ...rest, semanticTranslations: rows }] };
    }
    if (url === "/ingredients/143/semantics") return { data: ingredient };
    if (url === "/ingredients/semantic-categories") return { data: [{ id: 1, defaultName: "Carnes" }] };
    return { data: [] };
  });
  api.patch.mockImplementation(async (url, body) => {
    ingredient = { ...ingredient, ...body };
    return { data: ingredient };
  });
});

async function showCatalog() {
  render(<IngredientsModule />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Añadir ingrediente" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Buscar ya añadidos" }));
  fireEvent.change(screen.getByLabelText("Buscar ingredientes del catálogo"), { target: { value: "pollo a la brasa" } });
  return screen.getByRole("button", { name: "Semantics" });
}

test("stored names count as complete and reopen with all seven names and descriptions", async () => {
  const button = await showCatalog();
  expect(button).toHaveClass("gm-semanticBtn--reviewed");
  expect(button).toHaveTextContent("7/7");
  expect(document.querySelector(".gm-categoryIssueBadge")).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(await screen.findByLabelText("Nombre EN")).toHaveValue("Grilled chicken");
  translations.forEach((row) => expect(screen.getByLabelText(`Nombre ${row.locale.toUpperCase()}`)).toHaveValue(row.name));
  expect(screen.getByDisplayValue("Saved description")).toBeInTheDocument();
  expect(screen.getAllByText("Guardada")).toHaveLength(7);
  expect(screen.getByRole("button", { name: "Traducir idiomas pendientes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar y confirmar" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/ingredients/143/semantics", expect.objectContaining({
    semanticStatus: "REVIEWED", translations: translations.map((row) => ({ ...row, isReviewed: true })),
  })));
  await waitFor(() => expect(screen.queryByLabelText("Nombre EN")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Semantics" }));
  expect(await screen.findByLabelText("Nombre EN")).toHaveValue("Grilled chicken");
  expect(api.post).not.toHaveBeenCalled();
});

test("only genuinely missing languages trigger the alert and translating preserves existing names", async () => {
  ingredient.translations = translations.slice(0, 5);
  api.post.mockResolvedValue({ data: { translations: translations.map((row) => row.locale === "en" ? { ...row, name: "Different English" } : row) } });
  const button = await showCatalog();
  expect(button).toHaveClass("gm-semanticBtn--needsReview");
  expect(button).toHaveTextContent("5/7");
  expect(button).toHaveAttribute("title", "Faltan traducciones: AR, ZH");
  expect(document.querySelector(".gm-categoryIssueBadge")).toHaveTextContent("1");
  fireEvent.click(button);
  await screen.findByLabelText("Nombre AR");
  fireEvent.click(screen.getByRole("button", { name: "Traducir idiomas pendientes" }));
  await waitFor(() => expect(screen.getByLabelText("Nombre ZH")).toHaveValue("烤鸡"));
  expect(screen.getByLabelText("Nombre EN")).toHaveValue("Grilled chicken");
  expect(screen.getByDisplayValue("Saved description")).toBeInTheDocument();
  expect(screen.getAllByText("Sin guardar")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Guardar y confirmar" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Semantics" })).toHaveClass("gm-semanticBtn--reviewed"));
  expect(screen.getByRole("button", { name: "Semantics" })).toHaveTextContent("7/7");
  expect(document.querySelector(".gm-categoryIssueBadge")).not.toBeInTheDocument();
});

test("a failed detail request retains catalog names but cannot overwrite them with an incomplete draft", async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation((url, ...args) => url.endsWith("/semantics") ? Promise.reject(new Error("offline")) : originalGet(url, ...args));
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    fireEvent.click(await showCatalog());
    expect(await screen.findByLabelText("Nombre EN")).toHaveValue("Grilled chicken");
    expect(screen.getByRole("button", { name: "Guardar y confirmar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Traducir idiomas pendientes" })).toBeDisabled();
    api.get.mockImplementation(originalGet);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar y confirmar" })).toBeEnabled());
    expect(api.patch).not.toHaveBeenCalled();
  } finally { error.mockRestore(); }
});

test("a late response from a closed editor cannot replace the newly opened ingredient", async () => {
  const originalGet = api.get.getMockImplementation();
  let finish;
  let count = 0;
  api.get.mockImplementation((url, ...args) => url.endsWith("/semantics") && count++ === 0
    ? new Promise((resolve) => { finish = resolve; }) : originalGet(url, ...args));
  fireEvent.click(await showCatalog());
  fireEvent.click(within(document.querySelector(".gm-semanticModal")).getByRole("button", { name: "x" }));
  fireEvent.click(screen.getByRole("button", { name: "Semantics" }));
  expect(await screen.findByLabelText("Nombre EN")).toHaveValue("Grilled chicken");
  await act(async () => finish({ data: { ...ingredient, translations: [] } }));
  expect(screen.getByLabelText("Nombre EN")).toHaveValue("Grilled chicken");
});
