import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import InventoryIngredientDialog from "./InventoryIngredientDialog";
import InventoryModule from "./InventoryModule";
import api from "../../setupAxios";
jest.mock("../../setupAxios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));

const ingredient = { id: 10, name: "Pechuga de pollo", category: "CARNES", displayCategory: "Carnes", costPrice: null,
  allergens: [], aliases: [], searchAliases: ["Alias pendiente"], semanticStatus: "NEEDS_REVIEW", semanticTranslations: [{ locale: "es", name: "Pechuga de pollo" }] };
const mount = (props = {}) => render(<InventoryIngredientDialog ingredient={ingredient} category="Carnes" language="es" onSave={jest.fn()} onDeactivate={jest.fn()} onClose={jest.fn()} {...props} />);
beforeEach(() => {
  jest.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  URL.createObjectURL = jest.fn(() => "blob:photo"); URL.revokeObjectURL = jest.fn();
});
test("unknown allergens never imply allergen-free and unpublished aliases are not displayed", () => {
  mount();
  expect(screen.getByText("Alérgenos sin informar")).toBeVisible();
  expect(screen.queryByText("NO ALLERGENIC")).not.toBeInTheDocument();
  expect(screen.queryByText("Alias pendiente")).not.toBeInTheDocument();
  expect(screen.getByText(/Puedes buscarlo por su nombre principal/)).toBeVisible();
});
test("inherited allergens and published aliases are shown without losing the global identity", () => {
  mount({ ingredient: { ...ingredient, aliases: ["Pechuga de pollo", "Pechuga"], semanticMapping: { globalIngredient: { allergens: ["SOY"], aliases: ["Pechuga"], semanticTranslations: ingredient.semanticTranslations } } } });
  expect(screen.getByText("Soja")).toBeVisible(); expect(screen.getAllByText("Pechuga")).toHaveLength(1);
  expect(screen.queryByText("Alérgenos sin informar")).not.toBeInTheDocument();
});
test("a suggestion changes only the draft and never turns into a bulk operation", () => {
  const onSave = jest.fn(); mount({ suggestedPrice: 2.5, onSave });
  const use = screen.getByRole("button", { name: /Usar sugerido/ });
  fireEvent.click(use); fireEvent.click(use);
  expect(screen.getByLabelText("Precio base de armado")).toHaveValue("2,50");
  expect(onSave).not.toHaveBeenCalled(); expect(screen.queryByText("Aplicar a todo")).not.toBeInTheDocument();
});
test("validates price without silently changing it, saves decimal comma, and keeps failed drafts", async () => {
  const onSave = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
  const onClose = jest.fn(); mount({ onSave, onClose });
  const input = screen.getByLabelText("Precio base de armado");
  fireEvent.change(input, { target: { value: "-1.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar y activar" }));
  expect(screen.getByRole("alert")).toHaveTextContent("mayor que cero"); expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "1,25" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar y activar" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tus cambios siguen aquí"));
  expect(input).toHaveValue("1,25"); expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar y activar" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onSave).toHaveBeenLastCalledWith({ costPrice: 1.25, description: "", imageFile: null });
});
test("uses the business currency and backoffice language", () => {
  mount({ language: "en", currency: "USD", suggestedPrice: 2.5 });
  expect(screen.getByText("USD")).toBeVisible();
  expect(screen.getByLabelText("Base ingredient price")).toBeVisible();
  expect(screen.getByRole("button", { name: "Use suggestion: $2.50" })).toBeVisible();
  expect(screen.getByText("Allergen information missing")).toBeVisible();
});
test("backoffice saves details through the scoped route without modifying the global ingredient", async () => {
  api.get.mockResolvedValue({ data: [ingredient] }); api.patch.mockResolvedValue({ data: {} });
  render(<InventoryModule partner={{ storeId: 2, currency: "EUR" }} language="es" />);
  fireEvent.click(await screen.findByRole("button", { name: /Carnes/ }));
  fireEvent.click(screen.getByRole("button", { name: /PECHUGA DE POLLO/ }));
  fireEvent.change(screen.getByLabelText("Precio base de armado"), { target: { value: "2.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar y activar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(api.patch.mock.calls[0][0]).toBe("/stores/2/ingredients/10/details");
  expect(api.patch.mock.calls[0][1].get("costPrice")).toBe("2.5");
  expect(api.post).not.toHaveBeenCalled();
});
