import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import IngredientsModule from "./IngredientsModule";
import api from "../../setupAxios";

jest.mock("../../setupAxios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
const names = ["Pollo a la brasa", "Grilled chicken", "Pollo alla brace", "Poulet grillé", "Frango na brasa", "دجاج مشوي", "烤鸡"];
const translations = ["es", "en", "it", "fr", "pt", "ar", "zh"].map((locale, i) => ({ locale, name: names[i], description: i === 1 ? "Saved description" : "", isReviewed: i === 0 }));
let ingredient;

beforeEach(() => {
  jest.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
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
  return screen.getByRole("button", { name: "Editar" });
}

test("stored names count as complete and reopen with all seven names and descriptions", async () => {
  const button = await showCatalog();
  expect(document.querySelector(".gm-categoryIssueBadge")).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(await screen.findByLabelText("Nombre en inglés")).toHaveValue("Grilled chicken");
  translations.forEach((row) => expect(screen.getByLabelText(`Nombre en ${{ es: "español", en: "inglés", it: "italiano", fr: "francés", pt: "portugués", ar: "árabe", zh: "chino" }[row.locale]}`)).toHaveValue(row.name));
  expect(screen.getByRole("button", { name: "Traducir idiomas pendientes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/ingredients/143/editor", expect.objectContaining({
    confirmTranslations: true, translations: translations.map(({ locale, name, description }) => ({ locale, name, description })),
  })));
  await waitFor(() => expect(screen.queryByLabelText("Nombre en inglés")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(await screen.findByLabelText("Nombre en inglés")).toHaveValue("Grilled chicken");
  expect(api.post).not.toHaveBeenCalled();
});

test("only genuinely missing languages trigger the alert and translating preserves existing names", async () => {
  ingredient.translations = translations.slice(0, 5);
  api.post.mockResolvedValue({ data: { translations: translations.map((row) => row.locale === "en" ? { ...row, name: "Different English" } : row) } });
  const button = await showCatalog();
  expect(button).toHaveAttribute("title", "Completar idiomas: AR, ZH. Editar nombres y foto.");
  expect(document.querySelector(".gm-categoryIssueBadge")).toHaveTextContent("1");
  fireEvent.click(button);
  await screen.findByLabelText("Nombre en árabe");
  fireEvent.click(screen.getByRole("button", { name: "Traducir idiomas pendientes" }));
  await waitFor(() => expect(screen.getByLabelText("Nombre en chino")).toHaveValue("烤鸡"));
  expect(screen.getByLabelText("Nombre en inglés")).toHaveValue("Grilled chicken");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Editar" })).toHaveAttribute("title", "Editar nombres, idiomas y foto");
  expect(document.querySelector(".gm-categoryIssueBadge")).not.toBeInTheDocument();
});

test("a failed detail request retains catalog names but cannot overwrite them with an incomplete draft", async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation((url, ...args) => url.endsWith("/semantics") ? Promise.reject(new Error("offline")) : originalGet(url, ...args));
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    fireEvent.click(await showCatalog());
    expect(await screen.findByLabelText("Nombre en inglés")).toHaveValue("Grilled chicken");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Traducir idiomas pendientes" })).toBeDisabled();
    api.get.mockImplementation(originalGet);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled());
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
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(await screen.findByLabelText("Nombre en inglés")).toHaveValue("Grilled chicken");
  await act(async () => finish({ data: { ...ingredient, translations: [] } }));
  expect(screen.getByLabelText("Nombre en inglés")).toHaveValue("Grilled chicken");
});

test("removal requires confirmation and cancel never changes the ingredient", async () => {
  await showCatalog();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(screen.getByText('No se borrará de la lista maestra.')).toBeVisible();
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible();
  expect(api.delete).not.toHaveBeenCalled();
});

test('an older server keeps the catalog visible but cannot invoke its former destructive delete', async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation((url, ...args) => url === '/ingredients/catalog-pool' ? Promise.reject(new Error('404')) : originalGet(url, ...args));
  render(<IngredientsModule />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Buscar ya añadidos' }));
  fireEvent.change(screen.getByLabelText('Buscar ingredientes del catálogo'), { target: { value: 'pollo' } });
  expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '+ Añadir ingrediente' })).toBeDisabled();
  expect(api.delete).not.toHaveBeenCalled();
});

test('known store usage blocks removal before sending a request', async () => {
  ingredient.usageStoreCount = 1;
  ingredient.usageStoreTotal = 4;
  await showCatalog();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(screen.getByRole('alert')).toHaveTextContent('No se puede retirar');
  expect(screen.queryByRole('button', { name: 'Eliminar del panel' })).not.toBeInTheDocument();
  expect(api.delete).not.toHaveBeenCalled();
});

test('a server-side link discovered during removal keeps the ingredient and explains the block', async () => {
  api.delete.mockRejectedValue({ response: { data: { error: 'Ingrediente vinculado a una tienda inactiva.' } } });
  await showCatalog();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar del panel' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('tienda inactiva');
  expect(api.delete).toHaveBeenCalledWith('/ingredients/143', { data: { confirmReturnToPool: true } });
  expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
});

test('returning to the pool and re-adding preserves saved names and photo', async () => {
  let archived = false;
  ingredient.image = 'https://example.test/saved-photo.jpg';
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation((url, ...args) => {
    if (url === '/ingredients' && archived) return Promise.resolve({ data: [] });
    if (url === '/ingredients/catalog-pool') return Promise.resolve({ data: archived ? [{ ...ingredient,
      masterCanonicalKey: 'pollo_a_la_brasa', catalogState: { previousStatus: 'ACTIVE', archivedAt: '2026-09-17' } }] : [] });
    return originalGet(url, ...args);
  });
  api.delete.mockImplementation(async () => { archived = true; return { data: { ok: true } }; });
  api.post.mockImplementation(async (_url, body) => { archived = false; return { data: { ...ingredient, ...body } }; });
  await showCatalog();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar del panel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: '+ Añadir ingrediente' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Añadir ingrediente' }));
  fireEvent.change(screen.getByLabelText('Buscar en la lista maestra'), { target: { value: 'pollo a la brasa' } });
  fireEvent.click(screen.getByRole('button', { name: /Pollo a la brasa Carnes/ }));
  expect(screen.getByLabelText('Nombre en inglés')).toHaveValue('Grilled chicken');
  expect(screen.getByAltText('Vista previa de Pollo a la brasa')).toHaveAttribute('src', ingredient.image);
  expect(screen.getByRole('button', { name: 'Traducir idiomas pendientes' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Añadir ingrediente' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ingredients/onboarding', expect.objectContaining({ canonicalKey: 'pollo_a_la_brasa', status: 'ACTIVE' })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible());
});
