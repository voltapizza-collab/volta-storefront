import { useId } from "react";
import { normalizeRemovedIngredients } from "../../utils/ingredientRemovals";
import "../../styles/IngredientRemovalPicker.css";

export default function IngredientRemovalPicker({ options = [], selected = [], extras = [], onChange, disabled = false }) {
  const id = useId();
  const removals = normalizeRemovedIngredients(selected);
  // Keep old selections visible so customers can clear a recipe that has changed.
  const choices = normalizeRemovedIngredients([...options, ...removals]);
  const allowedIds = new Set(options.map((item) => Number(item.ingredientId)));
  const extraIds = new Set(extras.map((item) => Number(item.ingredientId ?? item.id)));
  return (
    <details className="sf-removalPicker">
      <summary aria-controls={id}>
        <span>Quitar ingredientes</span>
        <small>{removals.length ? `${removals.length} sin incluir` : "Receta original"}</small>
      </summary>
      <div id={id} className="sf-removalPickerBody">
        <p>El precio de la pizza se mantiene.</p>
        {disabled ? <p>Selecciona un tamaño para ver los ingredientes.</p> : choices.length === 0 ?
          <p>Esta receta no tiene ingredientes que se puedan quitar.</p> : choices.map((ingredient) => {
            const checked = removals.some((item) => item.ingredientId === ingredient.ingredientId);
            const conflict = extraIds.has(ingredient.ingredientId);
            const unavailable = !allowedIds.has(ingredient.ingredientId);
            return (
              <label className="sf-removalOption" key={ingredient.ingredientId}>
                <input type="checkbox" checked={checked} disabled={!checked && (conflict || unavailable)}
                  onChange={() => onChange(checked ? removals.filter((item) => item.ingredientId !== ingredient.ingredientId) : [...removals, ingredient])} />
                <span>Sin {ingredient.name}
                  {conflict && <small>Ya lo has añadido como extra.</small>}
                  {unavailable && checked && <small>La receta ha cambiado. Desmarca esta retirada antes de pagar.</small>}
                </span>
              </label>
            );
          })}
      </div>
    </details>
  );
}
