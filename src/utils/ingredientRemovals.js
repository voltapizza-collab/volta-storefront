export const supportsIngredientRemovals = (line) => {
  const type = String(line?.type || "").toUpperCase();
  const source = String(line?.source || "").toLowerCase();
  return Number(line?.pizzaId ?? line?.id) > 0 &&
    ["", "SELLABLE"].includes(type) &&
    !["promo", "incentive_reward", "coupon", "queue_boost"].includes(source) &&
    !line?.promoId && !line?.promoItems?.length && !line?.leftPizzaId &&
    !line?.rightPizzaId && !line?.leftName && !line?.rightName &&
    !line?.halfMeta && !line?.customMeta && !line?.customDetails &&
    !/^(half|promo|custom|reward)-/i.test(String(line?.cartLineId || ""));
};

export function normalizeRemovedIngredients(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  value.forEach((item) => {
    const ingredientId = Number(item?.ingredientId ?? item?.id);
    const name = String(item?.name || "").trim();
    if (Number.isSafeInteger(ingredientId) && ingredientId > 0 && name) {
      unique.set(ingredientId, { ingredientId, name });
    }
  });
  return [...unique.values()];
}

export function getRemovableIngredients(product, size) {
  if (!supportsIngredientRemovals(product) || !size) return [];
  // Recipe membership also drives the description; quantities may be unset or zero.
  return normalizeRemovedIngredients((product.ingredients || []).filter((ingredient) =>
    !String(ingredient.canonicalKey || "").startsWith("random_selection_") &&
    !/^random[\s_-]+selection[\s_-]+[123]$/i.test(String(ingredient.name || "").trim())
  ));
}

export const ingredientRemovalRows = (line) =>
  normalizeRemovedIngredients(line?.removedIngredients).map(({ name }) => `SIN ${name.toLocaleUpperCase("es")}`);
