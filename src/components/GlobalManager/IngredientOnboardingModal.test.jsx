import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import IngredientOnboardingModal, { getIngredientDiscoveryNote, matchesIngredientSearch } from "./IngredientOnboardingModal";
import ingredientDiscoveryHints from "../../data/ingredientDiscoveryHints.json";
import ingredientMasterSource from "../../data/ingredientMasterSource.json";
import IngredientsModule from "./IngredientsModule";
import api from "../../setupAxios";
import { getTaxonomyCategories, resolveIngredientTaxonomy } from '../../utils/ingredientTaxonomy';

jest.mock("../../setupAxios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const chicken = { canonicalKey: "pollo_frito", defaultName: "Pollo frito", category: "CARNES", categoryLabel: "Carnes", aliases: [], semanticCategoryKey: "meats" };
const candidates = [chicken,
  { canonicalKey: "queso_cabra", defaultName: "Queso de cabra", category: "QUESOS", categoryLabel: "Quesos", isExisting: true },
  { canonicalKey: "salsa_barbacoa", defaultName: "Salsa barbacoa", category: "SALSAS", categoryLabel: "Salsas", aliases: ["BBQ"] },
  { canonicalKey: "jamon", defaultName: "Jamón cocido", category: "CARNES", categoryLabel: "Carnes" },
];
const translations = ["Pollo frito", "Fried chicken", "Pollo fritto", "Poulet frit", "Frango frito", "دجاج مقلي", "炸鸡"].map((name, i) => ({ locale: ["es", "en", "it", "fr", "pt", "ar", "zh"][i], name }));
const mount = (props = {}) => render(<IngredientOnboardingModal candidates={candidates} categories={[{ key: "CARNES", label: "Carnes" }, { key: "SALSAS", label: "Salsas" }]} onClose={jest.fn()} onCreated={jest.fn()} {...props} />);
const chooseChicken = () => fireEvent.click(screen.getByRole("button", { name: /Pollo frito Carnes/ }));
const fillNames = () => ["español", "inglés", "italiano", "francés", "portugués", "árabe", "chino"].forEach((locale, i) => fireEvent.change(screen.getByLabelText(`Nombre en ${locale}`), { target: { value: translations[i].name } }));

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => "blob:ingredient-preview");
  URL.revokeObjectURL = jest.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

test("everyday discovery terms find multiple candidates without changing their identities", () => {
  const search = query => ingredientMasterSource.filter(row => matchesIngredientSearch([row.defaultName, ...row.aliases], query));
  expect(search("gambas").map(row => row.canonicalKey)).toEqual(expect.arrayContaining(["gamba_blanca", "gamba_roja_del_mediterraneo"]));
  expect(search("gambas blanca").map(row => row.canonicalKey)).toContain("gamba_blanca");
  expect(search("gambas blanca").map(row => row.canonicalKey)).not.toContain("gamba_roja_del_mediterraneo");
  expect(search("plátano").map(row => row.canonicalKey)).toContain("bananas");
  expect(search("plátano macho").map(row => row.canonicalKey)).not.toContain("bananas");
  expect(search("plátano macho").map(row => row.canonicalKey)).toContain("platano_macho_verde");
  expect(matchesIngredientSearch(["bananabread"], "plátano")).toBe(false);
  expect(matchesIngredientSearch(["Gamba blanca"], "presa de cerdo")).toBe(false);
  expect(ingredientMasterSource.find(row => row.canonicalKey === "bananas").aliases).toEqual(["Bananas"]);
});

test("searches across categories, accents and aliases and marks existing ingredients", () => {
  mount();
  expect(screen.getByLabelText("Buscar en la lista maestra")).toHaveFocus();
  expect(screen.getByRole("button", { name: /Queso de cabra.*Ya añadido/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Buscar en la lista maestra"), { target: { value: "jamon" } });
  expect(screen.getByRole("button", { name: /Jamón cocido/ })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Buscar en la lista maestra"), { target: { value: "bbq" } });
  expect(screen.getByRole("button", { name: /Salsa barbacoa/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Pollo frito/ })).not.toBeInTheDocument();
});

test("translates and saves seven languages atomically in the original category", async () => {
  const onCreated = jest.fn(); mount({ onCreated }); chooseChicken();
  expect(screen.getByRole("button", { name: "Añadir ingrediente" })).toBeDisabled();
  api.post.mockResolvedValueOnce({ data: { translations } }).mockResolvedValueOnce({ data: { id: 9, name: "Pollo frito", category: "CARNES" } });
  fireEvent.click(screen.getByRole("button", { name: "Traducir idiomas pendientes" }));
  await waitFor(() => expect(screen.getByLabelText("Nombre en francés")).toHaveValue("Poulet frit"));
  expect(screen.getByLabelText("Nombre en árabe")).toHaveValue("دجاج مقلي");
  expect(screen.getByLabelText("Nombre en árabe")).toHaveAttribute("dir", "rtl");
  expect(screen.getByLabelText("Nombre en chino")).toHaveValue("炸鸡");
  expect(screen.getByLabelText("Nombre en chino")).toHaveAttribute("lang", "zh-Hans");
  fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 9 })));
  expect(api.post).toHaveBeenLastCalledWith("/ingredients/onboarding", expect.objectContaining({ name: "Pollo frito", category: "CARNES", canonicalKey: "pollo_frito", translations, confirmTranslations: true }));
  expect(api.patch).not.toHaveBeenCalled();
});

test("preserves manual names during translation and clears translations when the Spanish identity changes", async () => {
  mount(); chooseChicken();
  fireEvent.change(screen.getByLabelText("Nombre en inglés"), { target: { value: "Crispy fried chicken" } });
  api.post.mockResolvedValue({ data: { translations } });
  fireEvent.click(screen.getByRole("button", { name: "Traducir idiomas pendientes" }));
  await waitFor(() => expect(screen.getByLabelText("Nombre en francés")).toHaveValue("Poulet frit"));
  expect(screen.getByLabelText("Nombre en inglés")).toHaveValue("Crispy fried chicken");
  fireEvent.change(screen.getByLabelText("Nombre en español"), { target: { value: "Pollo ahumado" } });
  expect(screen.getByLabelText("Nombre en inglés")).toHaveValue("");
  expect(screen.getByLabelText("Nombre en árabe")).toHaveValue("");
  expect(screen.getByLabelText("Nombre en chino")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Añadir ingrediente" })).toBeDisabled();
});

test("an old translation response cannot overwrite a different ingredient", async () => {
  mount(); chooseChicken();
  let resolve; api.post.mockImplementation(() => new Promise((done) => { resolve = done; }));
  fireEvent.click(screen.getByRole("button", { name: "Traducir idiomas pendientes" }));
  fireEvent.click(screen.getByRole("button", { name: /Salsa barbacoa/ }));
  resolve({ data: { translations } });
  await waitFor(() => expect(screen.getByLabelText("Nombre en español")).toHaveValue("Salsa barbacoa"));
  expect(screen.getByLabelText("Nombre en inglés")).toHaveValue("");
});

test("provider failure keeps the draft and allows manual completion", async () => {
  mount(); chooseChicken();
  api.post.mockRejectedValue({ response: { data: { error: "La traducción automática todavía no está conectada." } } });
  fireEvent.click(screen.getByRole("button", { name: "Traducir idiomas pendientes" }));
  await screen.findByRole("alert");
  fillNames(); expect(screen.getByRole("button", { name: "Añadir ingrediente" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Nombre en francés")).toHaveValue("Poulet frit");
});

test("damaged Spanish must be corrected and saving cannot submit twice", async () => {
  mount({ candidates: [{ ...chicken, defaultName: "Pollo d�ner" }] });
  fireEvent.click(screen.getByRole("button", { name: /Pollo d�ner/ }));
  expect(screen.getByRole("button", { name: "Traducir idiomas pendientes" })).toBeDisabled();
  fillNames();
  api.post.mockImplementation(() => new Promise(() => {}));
  const add = screen.getByRole("button", { name: "Añadir ingrediente" });
  fireEvent.click(add); fireEvent.click(add);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
});

test("catalog search expands matching categories and Add opens the master picker", async () => {
  api.get.mockImplementation((path) => Promise.resolve({ data: path === "/ingredients" ? [
    { id: 1, name: "Pollo frito", category: "CARNES", isSystem: true },
    { id: 2, name: "Mozzarella", category: "QUESOS", isSystem: true },
  ] : [] }));
  render(<IngredientsModule />);
  const add = await screen.findByRole("button", { name: "+ Añadir ingrediente" });
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Buscar ya añadidos" }));
  fireEvent.change(screen.getByLabelText("Buscar ingredientes del catálogo"), { target: { value: "pollo" } });
  expect(screen.getByText("POLLO FRITO")).toBeVisible();
  expect(screen.queryByText("MOZZARELLA")).not.toBeInTheDocument();
  fireEvent.click(add);
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText("Buscar en la lista maestra")).toHaveValue("");
  expect(api.post).not.toHaveBeenCalled();
});

test("successful onboarding opens the ingredient category and retains its image upload control", async () => {
  let catalog = [];
  api.get.mockImplementation((path) => Promise.resolve({ data: path === "/ingredients" ? catalog : [] }));
  api.post.mockImplementation((path, body) => {
    if (path === "/ingredients/translate") return Promise.resolve({ data: { translations } });
    const ingredient = { ...body, id: 22, isSystem: true, semanticTranslations: body.translations };
    catalog = [ingredient]; return Promise.resolve({ data: ingredient });
  });
  render(<IngredientsModule />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Añadir ingrediente" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "+ Añadir ingrediente" }));
  fireEvent.change(screen.getByLabelText("Buscar en la lista maestra"), { target: { value: "pollo frito" } });
  chooseChicken();
  fireEvent.click(screen.getByRole("button", { name: "Traducir idiomas pendientes" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Añadir ingrediente" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findByText("POLLO FRITO")).toBeVisible();
  expect(screen.getByRole("button", { name: "Editar" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Eliminar" })).toBeVisible();
});

test.each(ingredientDiscoveryHints)("discovery for $canonicalKey shows its scope and preserves the selected identity", (hint) => {
  const row = ingredientMasterSource.find(item => item.canonicalKey === hint.canonicalKey);
  const before = JSON.stringify(row);
  mount({ candidates: [{ ...row, categoryLabel: row.category }] });
  fireEvent.change(screen.getByLabelText("Buscar en la lista maestra"), { target: { value: hint.queries[0] } });
  expect(screen.getByText(hint.note)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: new RegExp(row.defaultName) }));
  expect(screen.getByLabelText("Nombre en español")).toHaveValue(row.defaultName);
  expect(screen.getByText(hint.note)).toBeVisible();
  expect(JSON.stringify(row)).toBe(before);
  fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "SALSAS" } });
  expect(screen.queryByText(hint.note)).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("documented suggestions need the exact identity and do not discard preparation qualifiers", () => {
  for (const hint of ingredientDiscoveryHints) {
    for (const query of hint.queries) {
      expect(getIngredientDiscoveryNote({ canonicalKey: hint.canonicalKey }, `  ${query.toUpperCase().replaceAll(' ', '  ')}  `)).toBe(hint.note);
      expect(getIngredientDiscoveryNote({ canonicalKey: "unknown", name: hint.canonicalKey }, query)).toBe("");
      expect(getIngredientDiscoveryNote({ canonicalKey: hint.canonicalKey }, `${query} ahumado`)).toBe("");
    }
    expect(getIngredientDiscoveryNote({ canonicalKey: hint.canonicalKey }, "")).toBe("");
  }
  expect(getIngredientDiscoveryNote({ canonicalKey: "ojo_de_lomo_de_vacuno" }, "entrecot de lomo bajo")).toBe("");
  expect(getIngredientDiscoveryNote({ canonicalKey: "aceituna_gordal_sevillana" }, "aceitunas negras")).toBe("");
  expect(getIngredientDiscoveryNote({ canonicalKey: "aceituna_gordal_sevillana" }, "aceitunas verdes rellenas")).toBe("");
});

test.each(ingredientDiscoveryHints)("saved catalogue finds $canonicalKey through its master link with a visible scope", async (hint) => {
  const row = ingredientMasterSource.find(item => item.canonicalKey === hint.canonicalKey);
  api.get.mockImplementation(async url => ({ data: url === '/ingredients' ? [
    { id: 700, name: row.defaultName, category: row.category, canonicalKey: 'saved_local_key', catalogState: { masterCanonicalKey: row.canonicalKey } },
    { id: 701, name: 'Otro ingrediente', category: row.category, canonicalKey: 'unrelated' },
  ] : [] }));
  render(<IngredientsModule />);
  await waitFor(() => expect(screen.getByRole('button', { name: '+ Añadir ingrediente' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Buscar ya añadidos' }));
  fireEvent.change(screen.getByLabelText('Buscar ingredientes del catálogo'), { target: { value: hint.queries[0] } });
  expect(screen.getByText(hint.note)).toBeVisible();
  expect(screen.queryByText('OTRO INGREDIENTE')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Buscar ingredientes del catálogo'), { target: { value: `${hint.queries[0]} ahumado` } });
  expect(screen.queryByText(hint.note)).not.toBeInTheDocument();
  expect(screen.getByText('No hay ingredientes que coincidan con la búsqueda.')).toBeVisible();
});

test('restaurant families filter the master while onboarding preserves each original category', async () => {
  const restaurantCandidates = ingredientMasterSource.map(row => ({ ...row,
    categoryLabel: resolveIngredientTaxonomy(row).label, taxonomyCategoryKey: resolveIngredientTaxonomy(row).categoryKey }));
  mount({ candidates: restaurantCandidates, categories: getTaxonomyCategories() });
  for (const key of ['PANES_MASAS_HARINAS', 'PASTAS_ARROCES_CEREALES']) {
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: key } });
    const expected = restaurantCandidates.filter(row => row.taxonomyCategoryKey === key);
    expect(screen.getByText(`${expected.length} resultados · ${expected.length} disponibles`)).toBeVisible();
    expect(screen.getByText(expected[0].defaultName, { exact: true }).closest('button')).toBeVisible();
  }
  const selected = restaurantCandidates.find(row => row.taxonomyCategoryKey === 'PASTAS_ARROCES_CEREALES');
  fireEvent.click(screen.getByText(selected.defaultName, { exact: true }).closest('button'));
  ['inglés', 'italiano', 'francés', 'portugués', 'árabe', 'chino'].forEach(locale => fireEvent.change(screen.getByLabelText(`Nombre en ${locale}`), { target: { value: selected.defaultName } }));
  api.post.mockResolvedValue({ data: { ...selected, id: 200 } });
  fireEvent.click(screen.getByRole('button', { name: 'Añadir ingrediente' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ingredients/onboarding', expect.objectContaining({ canonicalKey: selected.canonicalKey, category: selected.category })));
});

test("real master keeps synonyms on one identity and distinguishes preparations", () => {
  const search = (query) => ingredientMasterSource.filter((row) => matchesIngredientSearch([row.defaultName, ...row.aliases], query));
  expect(search("palta").filter((row) => row.category === "VERDURAS").map((row) => row.canonicalKey)).toEqual(["aguacate"]);
  expect(search("aceite de palta").map((row) => row.canonicalKey)).toEqual(["aceite_de_aguacate"]);
  expect(search("aguaymanto").map((row) => row.canonicalKey)).toEqual(["uchuva"]);
  expect(search("colin de alaska").map((row) => row.canonicalKey)).toEqual(["abadejo_de_alaska"]);
  expect(search("carne molida de res").map((row) => row.canonicalKey)).toEqual(["carne_molida_de_vacuno"]);
  expect(search("champinones blancos").map((row) => row.canonicalKey)).toEqual(["champi_ones_blancos"]);
  const peanut = ingredientMasterSource.find((row) => row.canonicalKey === "cacahuete_man");
  for (const term of ["maní", "mani", "cacahuate", "cacahuete"]) expect(matchesIngredientSearch(peanut.aliases, term)).toBe(true);
  expect(search("pina caramelizada").map((row) => row.canonicalKey)).toEqual(["pi_a_caramelizada"]);
  expect(ingredientMasterSource.find((row) => row.canonicalKey === "pi_a")).toBeDefined();
  expect(search("queso duro blando")).toHaveLength(0);
  expect(matchesIngredientSearch(["奶酪"], "豆腐")).toBe(false);
  expect(matchesIngredientSearch(["奶酪"], "奶酪")).toBe(true);
});

test("the single surviving master choice recognizes an existing retired key", async () => {
  api.get.mockImplementation((path) => Promise.resolve({ data: path === "/ingredients"
    ? [{ id: 81, name: "Nombre histórico", canonicalKey: "champi_nes_blancos", category: "SETAS", isSystem: true }] : [] }));
  render(<IngredientsModule />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Añadir ingrediente" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "+ Añadir ingrediente" }));
  fireEvent.change(screen.getByLabelText("Buscar en la lista maestra"), { target: { value: "champiñones blancos" } });
  const choices = screen.getAllByRole("button", { name: /Champiñones blancos.*Ya añadido/ });
  expect(choices).toHaveLength(1);
  expect(choices[0]).toBeDisabled();
});

test("photo selection previews locally and saves the file with the seven languages", async () => {
  const onCreated = jest.fn(); mount({ onCreated }); chooseChicken(); fillNames();
  const file = new File(["photo"], "pollo.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Subir foto del ingrediente"), { target: { files: [file] } });
  expect(screen.getByAltText("Vista previa de Pollo frito")).toHaveAttribute("src", "blob:ingredient-preview");
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce({ data: { id: 45, image: "saved-photo.png" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 45, image: "saved-photo.png" }));
  const [path, form] = api.post.mock.calls[0];
  expect(path).toBe("/ingredients/onboarding"); expect(form.get("image")).toBe(file);
  expect(JSON.parse(form.get("payload"))).toEqual(expect.objectContaining({ category: "CARNES", translations }));
  expect(api.post).toHaveBeenCalledTimes(1); expect(api.patch).not.toHaveBeenCalled();
});

test("drag and drop keeps the draft after a failed save and permits retry", async () => {
  const onCreated = jest.fn(); mount({ onCreated }); chooseChicken(); fillNames();
  const file = new File(["photo"], "pollo.webp", { type: "image/webp" });
  const area = screen.getByRole("region", { name: "Foto del ingrediente" });
  fireEvent.dragEnter(area, { dataTransfer: { types: ["Files"] } });
  expect(screen.getByText("Suelta la foto aquí")).toBeVisible();
  fireEvent.drop(area, { dataTransfer: { files: [file] } });
  expect(screen.getByText("pollo.webp")).toBeVisible();
  api.post.mockRejectedValueOnce({ response: { data: { error: "No se pudo subir la foto. Inténtalo de nuevo." } } })
    .mockResolvedValueOnce({ data: { id: 46 } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo subir la foto");
  expect(screen.getByAltText("Vista previa de Pollo frito")).toBeVisible();
  expect(screen.getByLabelText("Nombre en francés")).toHaveValue("Poulet frit");
  fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 46 }));
  expect(api.post.mock.calls[1][1].get("image")).toBe(file);
});

test("rejects unsupported, oversized and multiple files and releases removed previews", () => {
  mount(); chooseChicken();
  const input = screen.getByLabelText("Subir foto del ingrediente");
  fireEvent.change(input, { target: { files: [new File(["text"], "photo.svg", { type: "image/svg+xml" })] } });
  expect(screen.getByRole("alert")).toHaveTextContent("JPG, PNG o WebP");
  const large = new File(["photo"], "large.png", { type: "image/png" });
  Object.defineProperty(large, "size", { value: 5 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [large] } });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  const photo = new File(["photo"], "photo.png", { type: "image/png" });
  fireEvent.drop(screen.getByRole("region", { name: "Foto del ingrediente" }), { dataTransfer: { files: [photo, photo] } });
  expect(screen.getByRole("alert")).toHaveTextContent("una sola foto");
  fireEvent.change(input, { target: { files: [photo] } });
  fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:ingredient-preview");
  fireEvent.change(input, { target: { files: [photo] } });
  fireEvent.click(screen.getByRole("button", { name: /Salsa barbacoa/ }));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("an existing ingredient can translate when only Arabic and Chinese are missing", async () => {
  const ingredient = { id: 7, name: "Pollo frito", category: "CARNES", isSystem: true,
    canonicalKey: "pollo_frito", semanticCategoryId: 1,
    translations: translations.slice(0, 5).map((item) => ({ ...item, isReviewed: true })),
  };
  api.get.mockImplementation((path) => Promise.resolve({ data: path === "/ingredients" ? [ingredient]
    : path === "/ingredients/7/semantics" ? ingredient : [] }));
  api.post.mockResolvedValue({ data: { translations } });
  render(<IngredientsModule />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Añadir ingrediente" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Buscar ya añadidos" }));
  fireEvent.change(screen.getByLabelText("Buscar ingredientes del catálogo"), { target: { value: "pollo" } });
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(await screen.findByLabelText("Nombre en árabe")).toHaveValue("");
  const translate = screen.getByRole("button", { name: "Traducir idiomas pendientes" });
  expect(translate).toBeEnabled(); fireEvent.click(translate);
  await waitFor(() => expect(screen.getByLabelText("Nombre en chino")).toHaveValue("炸鸡"));
  expect(screen.getByLabelText("Nombre en árabe")).toHaveValue("دجاج مقلي");
  expect(screen.getByLabelText("Nombre en árabe")).toHaveAttribute("dir", "rtl");
  expect(screen.getByLabelText("Nombre en inglés")).toHaveValue("Fried chicken");
  expect(translate).toBeDisabled();
});
