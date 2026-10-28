import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../setupAxios';
import { getIngredientTaxonomyKey, getTaxonomyCategoryLabel, resolveIngredientTaxonomy } from '../utils/ingredientTaxonomy';
import PosNotice, { usePosNotice } from './PosNotice';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export async function fetchPosInventory(storeId) {
  const [ingredients, products] = await Promise.all([
    api.get(`/api/stores/${storeId}/ingredients`, { params: { scope: 'menu' }, timeout: 8000 }),
    api.get(`/api/stock/${storeId}`, { timeout: 8000 }),
  ]);
  if (!Array.isArray(ingredients.data) || !Array.isArray(products.data)) throw new Error('Invalid inventory response');
  return { ingredients: ingredients.data, products: products.data };
}

function PosInventory({ session, ingredients, setIngredients, products, setProducts }) {
  const [openCategory, setOpenCategory] = useState('');
  const [view, setView] = useState('inventory');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState(new Set());
  const writes = useRef(new Set());
  const [uncertainIds, setUncertainIds] = useState(new Set());
  const busy = useRef(false);
  const mounted = useRef(false);
  const [message, setMessage, dismissMessage] = usePosNotice();

  const load = useCallback(async () => {
    if (!session?.storeId || busy.current || writes.current.size) return;
    busy.current = true;
    setLoading(true);
    try {
      const data = await fetchPosInventory(session.storeId);
      if (!mounted.current) return;
      setIngredients(data.ingredients);
      setProducts(data.products);
      setUncertainIds(new Set());
      setOpenCategory('');
      setMessage('');
    } catch (error) {
      if (mounted.current) setMessage('No se pudo cargar inventario. Pulsa Sync para reintentar.');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [session?.storeId, setIngredients, setProducts, setMessage]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [load]);

  const ingredientsById = useMemo(() => new Map(ingredients.map(item => [item.id, item])), [ingredients]);
  const rows = useMemo(() => [
    ...ingredients.map(item => ({
      key: `ingredient-${item.id}`, kind: 'ingredient', id: item.id, name: item.name,
      active: Boolean(item.exists && item.active),
      group: `ingredient-${getIngredientTaxonomyKey(item)}`,
      groupLabel: getTaxonomyCategoryLabel(getIngredientTaxonomyKey(item)),
      detail: `Ingrediente · ${item.affectedProducts || 0} producto${item.affectedProducts === 1 ? '' : 's'}`,
      terms: [item.name, item.category, resolveIngredientTaxonomy(item).label, ...(item.affectedProductNames || [])],
    })),
    ...products.map(item => {
      const missing = (item.pizza.ingredients || []).filter(ingredient => {
        const current = ingredientsById.get(ingredient.id);
        if (ingredient.globalStatus !== 'ACTIVE') return true;
        return current ? !(current.exists && current.active) : ingredient.active !== true;
      });
      return {
        key: `product-${item.pizzaId}`, kind: 'product', id: item.pizzaId, name: item.pizza.name,
        active: item.active === true, group: 'products', groupLabel: 'Productos',
        detail: `Producto · ${item.pizza.category || 'Sin categoría'}`,
        warning: item.active && missing.length ? `No disponible: ${missing.map(row => row.name || 'Ingrediente').join(', ')}` : '',
        terms: [item.pizza.name, item.pizza.category],
      };
    }),
  ].map(row => ({ ...row, searchText: normalize(row.terms.join(' ')) })), [ingredients, ingredientsById, products]);

  const categories = useMemo(() => {
    const groups = new Map();
    rows.forEach(row => {
      if (!groups.has(row.group)) groups.set(row.group, { key: row.group, label: row.groupLabel, items: [] });
      groups.get(row.group).items.push(row);
    });
    return [...groups.values()].sort((a, b) => a.key === 'products' ? -1 : b.key === 'products' ? 1 : a.label.localeCompare(b.label, 'es'));
  }, [rows]);
  const query = normalize(search.trim());
  const filtered = useMemo(() => rows.filter(row => !query || row.searchText.includes(query)), [rows, query]);

  const toggle = async row => {
    if (busy.current || writes.current.has(row.key) || uncertainIds.has(row.key)) return;
    writes.current.add(row.key);
    setSavingIds(new Set(writes.current));
    const active = !row.active;
    try {
      if (row.kind === 'ingredient') {
        await api.patch(`/stores/${session.storeId}/ingredients/${row.id}`, { active, source: 'pos' });
        if (mounted.current) setIngredients(current => current.map(item => item.id === row.id ? { ...item, exists: true, active } : item));
      } else {
        await api.patch(`/api/stock/${session.storeId}/${row.id}/active`, { active });
        if (mounted.current) setProducts(current => current.map(item => item.pizzaId === row.id ? { ...item, active } : item));
      }
      if (mounted.current) setMessage('');
    } catch (error) {
      if (mounted.current) {
        if (error.outcomeUnknown || error.code === 'ECONNABORTED' || !error.response || error.response.status >= 500) {
          setUncertainIds(current => new Set([...current, row.key]));
          setMessage('No hay confirmación del cambio. Pulsa Sync para comprobar el estado antes de repetir.');
        } else setMessage(row.kind === 'ingredient' ? 'No se pudo cambiar el ingrediente.' : 'No se pudo cambiar el producto.');
      }
    } finally {
      writes.current.delete(row.key);
      if (mounted.current) setSavingIds(new Set(writes.current));
    }
  };

  const renderRow = row => (
    <div key={row.key} className={`pos-invItem ${row.active ? 'is-active' : 'is-inactive'}`}>
      <span>
        {String(row.name || '').toUpperCase()}
        <small>{row.detail}</small>
        {row.warning && <small className="pos-invWarning">{row.warning}</small>}
      </span>
      <button type="button" role="switch" aria-checked={row.active}
        aria-label={`${row.kind === 'product' ? 'Producto' : 'Ingrediente'}: ${row.name}`}
        className={`pos-invToggle ${row.active ? 'on' : 'off'}`}
        onClick={() => toggle(row)} disabled={loading || savingIds.has(row.key) || uncertainIds.has(row.key)}>
        {row.active ? 'ACTIVO' : 'INACTIVO'}
      </button>
    </div>
  );

  return (
    <section className="pos-inventoryPane">
      <div className="pos-sectionHead">
        <div><span>Inventario</span><h2>Ingredientes y productos</h2><small>{session.storeName}</small></div>
        <div className="pos-invHeadActions">
          {view === 'inventory' && <button type="button" className="pos-invSearchBtn"
            onClick={() => { setView('search'); setSearch(''); }} aria-label="Buscar ingredientes o productos" title="Buscar ingredientes o productos"><span aria-hidden="true" /></button>}
          <button type="button" onClick={load} disabled={loading || savingIds.size > 0}>{loading ? '...' : 'Sync'}</button>
        </div>
      </div>
      <PosNotice message={message} onDismiss={dismissMessage} />
      {view === 'search' ? <div className="pos-invSearchView">
        <div className="pos-invSearchBar">
          <button type="button" onClick={() => setView('inventory')}>Volver</button>
          <input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar ingredientes o productos" placeholder="Buscar ingrediente o producto..." autoFocus />
        </div>
        <div className="pos-invItems pos-invItems--search">
          {filtered.map(renderRow)}
          {!loading && filtered.length === 0 && <div className="pos-emptySmall">No encontramos ingredientes ni productos.</div>}
        </div>
      </div> : <div className="pos-inventoryList">
        {categories.map(category => <div key={category.key} className="pos-invCategory">
          <button type="button" className="pos-invCategoryBtn" aria-expanded={openCategory === category.key}
            onClick={() => setOpenCategory(openCategory === category.key ? '' : category.key)}>
            <span>{category.label}</span><strong>{category.items.filter(item => item.active).length}/{category.items.length}</strong>
          </button>
          {openCategory === category.key && <div className="pos-invItems">{category.items.map(renderRow)}</div>}
        </div>)}
        {!loading && categories.length === 0 && <div className="pos-emptySmall">No hay ingredientes ni productos configurados.</div>}
      </div>}
    </section>
  );
}
export default memo(PosInventory);
