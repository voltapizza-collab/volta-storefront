import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../../styles/IngredientsModule.css";
import api from "../../setupAxios";
import ingredientMasterSource from "../../data/ingredientMasterSource.json";
import IngredientOnboardingModal, { INGREDIENT_LANGUAGES, IngredientSearchIcon, matchesIngredientSearch, normalizeIngredientSearch } from "./IngredientOnboardingModal";

const CATEGORY_LABELS = {
  ACEITES_GRASAS_VINAGRES: "Aceites, grasas y vinagres",
  AROMAS_Y_EXTRACTOS: "Aromas y extractos",
  CARNES: "Carnes",
  CREMAS_DULCES: "Cremas dulces",
  EMBUTIDOS: "Embutidos",
  ENDULZANTES: "Endulzantes",
  EXTRAS: "Extras",
  FRUTAS: "Frutas",
  HIERBAS_ESPECIAS: "Hierbas y especias",
  OTROS: "Otros",
  PESCADOS_Y_MARISCOS: "Pescados y mariscos",
  QUESOS: "Quesos",
  SALSAS: "Salsas",
  SETAS: "Setas",
  VERDURAS: "Verduras",
};

const normalizeCategory = (category) =>
  String(category || "OTROS")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "OTROS";

const getCanonicalCategory = (category) => {
  const normalized = normalizeCategory(category);
  const aliases = {
    ACEITES: "ACEITES_GRASAS_VINAGRES",
    ESPECIAS: "HIERBAS_ESPECIAS",
    FIAMBRES: "EMBUTIDOS",
    MARISCOS: "PESCADOS_Y_MARISCOS",
    PESCADOS: "PESCADOS_Y_MARISCOS",
    SAUCES: "SALSAS",
    CHEESE: "QUESOS",
    VEGETABLE: "VERDURAS",
    PROTEIN: "CARNES",
  };

  return aliases[normalized] || normalized;
};

const getCategoryLabel = (category) =>
  CATEGORY_LABELS[getCanonicalCategory(category)] || getCanonicalCategory(category);

const getDisplayName = (name) => String(name || "").toUpperCase();
const getIngredientDisplayName = (ingredient = {}) => {
  const safeIngredient = ingredient || {};
  return safeIngredient.displayName || safeIngredient.name || "";
};

const ingredientId = item => item.idValue || item.ingredientId || item.id;
const translationsOf = item => [...(item.semanticTranslations || []), ...(item.translations || [])];
const aliasesOf = item => (item.semanticAliases || item.aliases || []).map(row => typeof row === 'string' ? row : row.alias);
const missingLanguages = item => INGREDIENT_LANGUAGES.filter(([locale]) => !translationsOf(item).some(row => row.locale === locale && row.name?.trim()));
const usageOf = item => {
  if (item.usageStoreTotal == null) return { label: 'Sin datos', title: 'Todavía no se ha podido calcular el uso de este ingrediente.' };
  return { label: `${item.usageStoreCount || 0}/${item.usageStoreTotal} tiendas · ${item.usageStorePercent || 0}%`,
    title: `${item.usageStoreCount || 0} de ${item.usageStoreTotal} tiendas activas lo tienen habilitado. Figura en ${item.usageProductCount || 0} productos activos. No mide ventas ni cantidades consumidas.` };
};

function ReturnToPoolDialog({ ingredient, busy, error, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal(); dialog.querySelector('button').focus();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  const blocked = Number(ingredient.usageStoreCount || 0) > 0 || Number(ingredient.usageProductCount || 0) > 0;
  return createPortal(<dialog ref={dialogRef} className="gm-return-dialog" aria-labelledby="gm-return-title" aria-describedby="gm-return-description"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="gm-return-title">Eliminar del panel</h2>
    <p id="gm-return-description">¿Quieres devolver <strong>{getIngredientDisplayName(ingredient)}</strong> a la bolsa general?</p>
    <p>Se conservarán su foto, idiomas e identidad. Podrás volver a añadirlo con la misma ficha. <strong>No se borrará de la lista maestra.</strong></p>
    {blocked ? <p className="gm-return-warning" role="alert">No se puede retirar: está habilitado en {ingredient.usageStoreCount || 0} tiendas y vinculado a {ingredient.usageProductCount || 0} productos activos. Desvincúlalo antes de eliminarlo del panel.</p>
      : <p className="gm-return-note">Antes de retirarlo comprobaremos también las recetas, extras y demás vínculos guardados.</p>}
    {error && <p className="gm-return-warning" role="alert">{error}</p>}
    <div className="gm-return-actions">
      <button type="button" disabled={busy} onClick={onClose}>{blocked ? 'Cerrar' : 'Cancelar'}</button>
      {!blocked && <button type="button" className="gm-return-confirm" disabled={busy} onClick={onConfirm}>{busy ? 'Devolviendo…' : 'Eliminar del panel'}</button>}
    </div>
  </dialog>, document.body);
}

export default function IngredientsModule() {
  const [ingredients, setIngredients] = useState([]);
  const [pool, setPool] = useState([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const removeRef = useRef(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogSearchOpen, setCatalogSearchOpen] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedIngredient, setSavedIngredient] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [semanticAvailable, setSemanticAvailable] = useState(false);
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const treeRef = useRef(null);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const [catalog, archived] = await Promise.allSettled([api.get('/ingredients'), api.get('/ingredients/catalog-pool')]);
      if (catalog.status === 'fulfilled') setIngredients(Array.isArray(catalog.value.data) ? catalog.value.data : []);
      if (catalog.status === 'rejected' || archived.status === 'rejected') throw new Error('Incomplete catalog');
      setPool(Array.isArray(archived.value.data) ? archived.value.data.map(item => ({ ...item, category: getCanonicalCategory(item.category) })) : []);
      setCatalogLoaded(true); setError('');
    } catch {
      setCatalogLoaded(false);
      setError('No se pudo cargar el catálogo y su bolsa. La edición se habilitará cuando el servidor tenga la actualización completa. Puedes reintentar.');
    } finally { setLoading(false); }
  };
  const loadSuggestions = async () => {
    try { const { data } = await api.get('/ingredients/suggestions?status=PENDING'); setSuggestions(Array.isArray(data) ? data : []); }
    catch { /* Suggestions do not prevent working with the catalog. */ }
  };
  useEffect(() => {
    loadCatalog(); loadSuggestions();
    api.get('/ingredients/semantic-categories').then(() => setSemanticAvailable(true)).catch(() => setError('No se pudieron cargar las categorías para editar ingredientes.'));
  }, []);
  useEffect(() => {
    if (savedIngredient) treeRef.current?.querySelector(`[data-ingredient-id="${ingredientId(savedIngredient)}"]`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [savedIngredient, ingredients]);

  const catalog = useMemo(() => ingredients.filter(item => item.isSystem !== false && !item.catalogState?.archivedAt), [ingredients]);
  const existingKeys = useMemo(() => new Set(catalog.flatMap(item => [item.name, item.displayName, item.canonicalKey,
    item.catalogState?.masterCanonicalKey, ...translationsOf(item).map(row => row.name), ...aliasesOf(item)]).filter(Boolean).map(normalizeIngredientSearch)), [catalog]);
  const categories = useMemo(() => Object.keys(CATEGORY_LABELS).filter(key => ingredientMasterSource.some(row => row.category === key))
    .map(key => ({ key, label: getCategoryLabel(key) })), []);
  const masterCandidates = useMemo(() => ingredientMasterSource.map(item => ({ ...item, categoryLabel: getCategoryLabel(item.category),
    isExisting: [item.canonicalKey, ...(item.legacyCanonicalKeys || []), item.defaultName, ...item.aliases].some(value => existingKeys.has(normalizeIngredientSearch(value))),
    savedIngredient: pool.find(saved => saved.masterCanonicalKey === item.canonicalKey),
  })), [existingKeys, pool]);
  const groups = useMemo(() => {
    const grouped = new Map();
    for (const item of catalog) {
      if (!matchesIngredientSearch([item.name, item.displayName, getCategoryLabel(item.category), ...translationsOf(item).map(row => row.name), ...aliasesOf(item)], catalogQuery)) continue;
      const key = getCanonicalCategory(item.category);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    }
    return [...grouped].sort(([a], [b]) => getCategoryLabel(a).localeCompare(getCategoryLabel(b)))
      .map(([category, items]) => ({ category, items: items.sort((a, b) => getIngredientDisplayName(a).localeCompare(getIngredientDisplayName(b))) }));
  }, [catalog, catalogQuery]);
  const toggleCategory = category => setOpenCategories(current => {
    const next = new Set(current); if (next.has(category)) next.delete(category); else next.add(category); return next;
  });
  const handleSaved = item => {
    setNotice(`${getIngredientDisplayName(item)}: ${editing ? 'cambios guardados' : 'añadido al catálogo'}.`);
    setSavedIngredient(item); setEditing(null); setOnboardingOpen(false); setCatalogQuery('');
    setIngredients(current => [...current.filter(row => ingredientId(row) !== ingredientId(item)), item]);
    setOpenCategories(current => new Set([...current, getCanonicalCategory(item.category)]));
    loadCatalog();
  };
  const remove = async () => {
    if (!removing || removeRef.current) return;
    removeRef.current = true; setRemovingBusy(true); setRemoveError('');
    try {
      await api.delete(`/ingredients/${ingredientId(removing)}`, { data: { confirmReturnToPool: true } });
      setNotice(`${getIngredientDisplayName(removing)} ha vuelto a la bolsa general. Su foto e idiomas se conservan.`);
      setIngredients(current => current.filter(row => ingredientId(row) !== ingredientId(removing)));
      setSavedIngredient(null); setRemoving(null); await loadCatalog();
    } catch (err) { setRemoveError(err.response?.data?.error || 'No se pudo retirar el ingrediente. Su ficha se conserva.'); }
    finally { removeRef.current = false; setRemovingBusy(false); }
  };
  const resolveSuggestion = async (id, action) => {
    try { await api.patch(`/ingredients/suggestions/${id}/${action}`); await Promise.all([loadCatalog(), loadSuggestions()]); }
    catch (err) { setError(err.response?.data?.error || 'No se pudo actualizar la sugerencia.'); }
  };

  return <div className="gm-ingredientsModule">
    <div className="gm-ingredient-toolbar">
      <div className="gm-ingredient-toolbar-title"><strong>Ingredientes</strong><span>{catalog.length} añadidos al catálogo global</span></div>
      <button type="button" className="gm-ingredient-filter-toggle" aria-expanded={catalogSearchOpen} aria-controls="gm-catalog-filter"
        onClick={() => { setCatalogSearchOpen(!catalogSearchOpen); if (catalogSearchOpen) setCatalogQuery(''); }}><IngredientSearchIcon />Buscar ya añadidos</button>
      <button type="button" disabled={loading || !catalogLoaded || !semanticAvailable} onClick={() => setOnboardingOpen(true)}>+ Añadir ingrediente</button>
    </div>
    <p className="gm-master-protection">Lista maestra protegida · Editar o eliminar de este panel conserva las identidades de la bolsa general.</p>
    {catalogSearchOpen && <label id="gm-catalog-filter" className="gm-ingredient-search gm-ingredient-catalog-filter"><IngredientSearchIcon />
      <input aria-label="Buscar ingredientes del catálogo" placeholder="Busca un ingrediente ya añadido…" value={catalogQuery} onChange={event => setCatalogQuery(event.target.value)} />
    </label>}
    {notice && <p className="gm-ingredient-added" role="status">{notice}</p>}
    {error && <div className="gm-semanticError" role="alert">{error} <button type="button" onClick={loadCatalog}>Reintentar</button></div>}
    {loading && <p>Cargando ingredientes…</p>}
    <div className="gm-tree" ref={treeRef}>
      {groups.map(({ category, items }) => {
        const isOpen = Boolean(catalogQuery.trim()) || openCategories.has(category);
        const needsNames = items.filter(item => missingLanguages(item).length > 0).length;
        return <section className="gm-categoryBlock" key={category}>
          <button type="button" className="gm-categoryHeader" onClick={() => toggleCategory(category)} aria-expanded={isOpen}>
            <strong>{isOpen ? '▾' : '▸'} {getDisplayName(getCategoryLabel(category))}</strong>
            <span className="gm-categoryCounters">{needsNames > 0 && <span className="gm-categoryIssueBadge" title="Ingredientes con idiomas pendientes">{needsNames}</span>}
              <em>{items.length} / {ingredientMasterSource.filter(row => row.category === category).length}</em></span>
          </button>
          {isOpen && <div className="gm-categoryItems">{items.map(item => {
            const id = ingredientId(item); const usage = usageOf(item); const missing = missingLanguages(item);
            return <div className={`gm-node ${savedIngredient && ingredientId(savedIngredient) === id ? 'is-new' : ''}`} key={id} data-ingredient-id={id}>
              <div className="gm-node-left"><span className={`gm-imageThumb ${item.image ? '' : 'gm-imageThumb--empty'}`}>{item.image ? <img src={item.image} alt={getIngredientDisplayName(item)} /> : 'IMG'}</span>
                <span>{getDisplayName(getIngredientDisplayName(item))}</span></div>
              <div className="gm-node-right">
                <span className={`gm-availabilityBadge ${item.status === 'INACTIVE' ? 'is-inactive' : 'is-active'}`}>{item.status === 'INACTIVE' ? 'Inactivo' : 'Activo'}</span>
                <span className={`gm-usageBadge ${item.usageStorePercent > 0 ? 'is-medium' : 'is-low'}`} title={usage.title}><small>Uso global</small><strong>{usage.label}</strong></span>
                <button type="button" className="gm-catalog-action" title={missing.length ? `Completar idiomas: ${missing.map(([locale]) => locale.toUpperCase()).join(', ')}. Editar nombres y foto.` : 'Editar nombres, idiomas y foto'}
                  disabled={!catalogLoaded || loading || !semanticAvailable} onClick={() => setEditing({ ...item, id, category: getCanonicalCategory(item.category), categoryLabel: getCategoryLabel(item.category) })}>Editar</button>
                <button type="button" className="gm-catalog-action gm-catalog-action--delete" disabled={!catalogLoaded || loading} onClick={() => { setRemoving(item); setRemoveError(''); }}>Eliminar</button>
              </div>
            </div>;
          })}</div>}
        </section>;
      })}
      {!loading && !groups.length && <p>No hay ingredientes que coincidan con la búsqueda.</p>}
    </div>
    {suggestions.length > 0 && <section className="gm-suggestions"><h3>Sugerencias pendientes</h3>{suggestions.map(item => <div className="gm-suggestionRow" key={item.id}>
      <strong>{item.name}</strong><span>{item.category}</span><button type="button" onClick={() => resolveSuggestion(item.id, 'approve')}>Aprobar</button><button type="button" onClick={() => resolveSuggestion(item.id, 'reject')}>Rechazar</button>
    </div>)}</section>}
    {(onboardingOpen || editing) && <IngredientOnboardingModal key={editing ? ingredientId(editing) : 'new'} candidates={masterCandidates} categories={categories}
      ingredient={editing} onClose={() => { setOnboardingOpen(false); setEditing(null); }} onCreated={handleSaved} />}
    {removing && <ReturnToPoolDialog ingredient={removing} busy={removingBusy} error={removeError} onClose={() => setRemoving(null)} onConfirm={remove} />}
  </div>;
}
