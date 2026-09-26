import data from '../data/ingredientTaxonomy.json';
import { createTaxonomyResolver } from '../data/ingredientTaxonomyResolver';
export const { resolveIngredientTaxonomy, getIngredientTaxonomyKey, getTaxonomyCategoryLabel, getTaxonomyCategories } = createTaxonomyResolver(data);
