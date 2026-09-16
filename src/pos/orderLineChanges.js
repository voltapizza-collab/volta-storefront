import { ingredientRemovalRows, supportsIngredientRemovals } from '../utils/ingredientRemovals';

const readExtras = (value) => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};

const formatSide = (value) => {
  const raw = String(value || '').toUpperCase();
  if (raw === 'A' || raw === 'LEFT') return 'Mitad A';
  if (raw === 'B' || raw === 'RIGHT') return 'Mitad B';
  if (raw === 'FULL' || raw === 'ALL') return 'Entera';
  return value ? String(value) : '';
};

export const getLineChangeRows = (item) => {
  const changes = ingredientRemovalRows(item);
  readExtras(item?.extras).forEach((extra) => {
    const name = extra?.label || extra?.name || extra?.code || (typeof extra === 'string' ? extra : '');
    if (!name) return;
    const side = formatSide(extra?.side || extra?.placement);
    changes.push(side ? `Extra ${side}: ${name}` : `Extra: ${name}`);
  });
  if (changes.length) return ['CAMBIOS:', ...changes];
  const hasNote = [item?.notes, item?.note, item?.comment].some((value) => String(value || '').trim());
  return supportsIngredientRemovals(item) && !hasNote ? ['Receta original'] : [];
};
