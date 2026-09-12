export const normalizeIngredientText = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const unique = (values) => [...new Map(values.filter((value) => typeof value === "string" && value.trim())
  .map((value) => [normalizeIngredientText(value), value.trim()])).values()];
export const ingredientReference = (ingredient) => ingredient?.semanticMapping?.globalIngredient || ingredient || {};
export const ingredientAliases = (ingredient) => unique([
  ...(ingredient?.aliases || []), ...(ingredientReference(ingredient)?.aliases || []),
]).filter((alias) => ![ingredient?.name, ingredient?.displayName].some((name) => normalizeIngredientText(name) === normalizeIngredientText(alias)));
export const ingredientAllergens = (ingredient) => unique([
  ...(Array.isArray(ingredient?.allergens) ? ingredient.allergens : []),
  ...(Array.isArray(ingredientReference(ingredient)?.allergens) ? ingredientReference(ingredient).allergens : []),
]).filter((value) => !["no allergenic", "none", "sin alergenos", "no allergens"].includes(normalizeIngredientText(value)));
export const parseIngredientPrice = (value) => {
  const input = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(input) || Number(input) <= 0) return null;
  return Number(input);
};
export const formatIngredientMoney = (value, language, currency = "EUR") => {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return "";
  try { return new Intl.NumberFormat(language, { style: "currency", currency }).format(price); }
  catch { return `${currency} ${price.toFixed(2)}`; }
};
