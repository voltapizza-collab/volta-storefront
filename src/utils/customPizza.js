// Shared by the traditional builder and the isolated visual experiment.
// Pricing/serialization extracted without changing the checkout contract.
const num = value => {
  if (value == null || value === '') return 0;
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const roundMoney = value => Math.round(Number(value || 0) * 100) / 100;

const INGREDIENT_BASE_SIZE = "M";
const INGREDIENT_SIZE_DIAMETERS_CM = {
  XS: 20,
  S: 25,
  M: 30,
  L: 35,
  XL: 40,
  XXL: 45,
  ST: 30,
};
export const scaleIngredientPriceForSize = (basePrice, size = INGREDIENT_BASE_SIZE) => {
  const price = num(basePrice);
  if (price <= 0) return 0;

  const baseDiameter =
    INGREDIENT_SIZE_DIAMETERS_CM[INGREDIENT_BASE_SIZE] || 30;
  const targetDiameter =
    INGREDIENT_SIZE_DIAMETERS_CM[size] || baseDiameter;
  const areaFactor = (targetDiameter * targetDiameter) / (baseDiameter * baseDiameter);

  return roundMoney(price * areaFactor);
};

const formatCustomPlacementLabel = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "FULL") return "Entera";
  if (raw === "LEFT") return "Mitad izquierda";
  if (raw === "RIGHT") return "Mitad derecha";
  return value ? String(value) : "";
};

const formatCustomQuantityLabel = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "DOUBLE") return "Doble";
  if (raw === "SIMPLE") return "Simple";
  return value ? String(value) : "";
};

export const buildCustomIngredientDetail = (ingredient) => {
  const name = String(ingredient?.name || ingredient?.label || "Ingrediente").trim();
  const placement =
    ingredient?.placementLabel || formatCustomPlacementLabel(ingredient?.placement);
  const quantity =
    ingredient?.quantityLabel || formatCustomQuantityLabel(ingredient?.quantity);
  const meta = [placement, quantity].filter(Boolean).join(" - ");

  return {
    ingredientId: ingredient?.ingredientId ?? ingredient?.id ?? null,
    name,
    category: ingredient?.category || "OTROS",
    placement: ingredient?.placement || "",
    quantity: ingredient?.quantity || "SIMPLE",
    placementLabel: placement,
    quantityLabel: quantity,
    label: meta ? `${name}: ${meta}` : name,
  };
};

export const getCustomIngredientPrice = (ingredient) => {
  const base = num(ingredient?.basePrice ?? ingredient?.costPrice);
  const quantityMultiplier = ingredient?.quantity === "DOUBLE" ? 2 : 1;
  const placementMultiplier = ingredient?.placement === "FULL" ? 1 : 0.5;

  if (!ingredient?.placement) return 0;
  return base * quantityMultiplier * placementMultiplier;
};

export function buildCustomPizzaLine({ selectedCustomCategory, selectedCustomBase = selectedCustomCategory, customSize, customQty, customBasePrice, customIngredients, scopedCustomIngredientsCatalog, customIngredientsCatalog = scopedCustomIngredientsCatalog, customSelectedAllergens, customGrandTotal, now = Date.now() }) {
    const ingredients = Object.entries(customIngredients).map(([id, data]) => {
      const catalogIngredient = scopedCustomIngredientsCatalog.find(
        (ingredient) => Number(ingredient.id) === Number(id)
      ) || customIngredientsCatalog.find(
        (ingredient) => Number(ingredient.id) === Number(id)
      );

      return {
        id: Number(id),
        ingredientId: Number(id),
        name: catalogIngredient?.name || data.name || "Ingrediente",
        category: catalogIngredient?.category || "OTROS",
        placement: data.placement,
        quantity: data.quantity,
        placementLabel:
          data.placement === "FULL"
            ? "Entera"
            : data.placement === "LEFT"
            ? "Mitad izquierda"
            : data.placement === "RIGHT"
            ? "Mitad derecha"
            : data.placement,
        quantityLabel: data.quantity === "DOUBLE" ? "Doble" : "Simple",
        basePrice: Number(data.basePrice || catalogIngredient?.costPrice || 0),
        allergens: Array.isArray(catalogIngredient?.allergens)
          ? catalogIngredient.allergens
          : [],
        price: getCustomIngredientPrice(data),
      };
    });
    const customDetailIngredients = ingredients.map(buildCustomIngredientDetail);

    const line = {
      cartLineId: `custom-${selectedCustomCategory.key}-${now}`,
      type: "CUSTOM_BUILD",
      pizzaId: selectedCustomCategory.samplePizzaId,
      name: `Personalizada ${selectedCustomCategory.name}`,
      category: selectedCustomCategory.name,
      size: customSize,
      qty: Number(customQty || 1),
      price: customBasePrice,
      ingredients,
      allergens: customSelectedAllergens,
      extras: [],
      subtotal: customGrandTotal,
      customDetails: {
        categoryName: selectedCustomCategory.name,
        baseProductName:
          selectedCustomBase?.name ||
          selectedCustomCategory.baseName ||
          selectedCustomCategory.name,
        ingredients: customDetailIngredients,
        summary: customDetailIngredients.map((ingredient) => ingredient.label).join(" | "),
      },
      customMeta: {
        categoryId: selectedCustomCategory.categoryId,
        categoryName: selectedCustomCategory.name,
        baseName: selectedCustomCategory.baseName,
        basePizzaId: selectedCustomBase?.pizzaId || selectedCustomCategory.samplePizzaId || null,
        baseProductName: selectedCustomBase?.name || selectedCustomCategory.baseName || selectedCustomCategory.name,
        pricingRule: "CATEGORY_CONFIGURED",
      },
      image: selectedCustomCategory.sampleImage || "",
    };

    return line;
}
