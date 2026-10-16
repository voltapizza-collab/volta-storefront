import { sortIngredientsForBuilding } from '../../utils/ingredientPresentationOrder';
import { useMemo, useRef, useState } from 'react';
import PizzaVisual, { IngredientMark } from '../../experiments/pizza-lab/PizzaVisual';
import { getCustomIngredientPrice } from '../../utils/customPizza';
import { getIngredientTaxonomyKey } from '../../utils/ingredientTaxonomy';
import { ingredientArtwork } from '../../utils/ingredientArtwork';
import './VisualPizzaBuilder.css';

const positions = [['FULL', 'Toda'], ['RIGHT', 'Derecha'], ['LEFT', 'Izquierda']];
const stations = [
  { key: 'sauces', name: 'Salsas', art: 'sauce', color: '#c6472c' },
  { key: 'cheese', name: 'Quesos', art: 'cheese', color: '#f6d781' },
  { key: 'meat', name: 'Carnes', art: 'bacon', color: '#b64c36' },
  { key: 'vegetables', name: 'Vegetales', art: 'basil', color: '#44824d' },
  { key: 'other', name: 'Otros', art: 'mushroom', color: '#9b795b' },
];
const stationFor = row => {
  const key = getIngredientTaxonomyKey(row);
  if (['SALSAS_CONDIMENTOS_BASES', 'ACEITES_GRASAS_VINAGRES'].includes(key)) return 'sauces';
  if (key === 'QUESOS') return 'cheese';
  if (['CARNES_AVES', 'EMBUTIDOS_CHARCUTERIA'].includes(key)) return 'meat';
  if (['VERDURAS_SETAS_ALGAS', 'LEGUMBRES_PROTEINAS_VEGETALES'].includes(key)) return 'vegetables';
  return 'other';
};
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const pageSize = 6;
function IngredientBowl({ ingredient }) {
  return <svg viewBox="-30 -25 60 55" aria-hidden="true"><ellipse cy="12" rx="26" ry="13" fill="#dcd5c5" /><path d="M-26 6Q-23 28 0 28Q23 28 26 6" fill="#fffdf7" stroke="#d1c7b3" /><ellipse cy="6" rx="26" ry="12" fill="#eee7d7" stroke="#d1c7b3" /><g transform="translate(0 2)"><IngredientMark ingredient={ingredient} /></g></svg>;
}

export default function VisualPizzaBuilder({ category, size, qty, catalog, ingredients, loading,
  getUnitPrice, onSize, onQty, onIngredientsChange, onQuick, onChangeBase }) {
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState(null);
  const [page, setPage] = useState(0);
  const [recipe, setRecipe] = useState(false);
  const [editing, setEditing] = useState(null);
  const [placement, setPlacement] = useState('FULL');
  const [quantity, setQuantity] = useState('SIMPLE');
  const [history, setHistory] = useState([]);
  const [animate, setAnimate] = useState(true);
  const [message, setMessage] = useState('');
  const editorRef = useRef(null);
  const backRef = useRef(null);
  const artCatalog = useMemo(() => sortIngredientsForBuilding(catalog).map(row => ({ ...row, ...ingredientArtwork(row) })), [catalog]);
  const selected = Object.entries(ingredients).map(([id, row]) => ({ ...artCatalog.find(item => Number(item.id) === Number(id)), ...row, id: Number(id) }));
  const matching = artCatalog.filter(row => search.trim() ? normalize(row.name).includes(normalize(search.trim())) : stationFor(row) === family);
  const items = recipe ? selected : matching;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const activePage = Math.min(page, pages - 1);
  const current = editing === null ? null : artCatalog.find(row => Number(row.id) === Number(editing));
  const money = value => `EUR ${Number(value || 0).toFixed(2)}`;
  const change = next => { setHistory(previous => [...previous, ingredients].slice(-50)); onIngredientsChange(next); };
  const close = () => { setEditing(null); requestAnimationFrame(() => backRef.current?.focus({ preventScroll: true })); };
  const edit = row => {
    setEditing(row.id); setPlacement(ingredients[row.id]?.placement || 'FULL'); setQuantity(ingredients[row.id]?.quantity || 'SIMPLE');
    requestAnimationFrame(() => editorRef.current?.focus({ preventScroll: true }));
  };
  const resetPanel = () => { setFamily(null); setSearch(''); setRecipe(false); setEditing(null); setPage(0); };
  const remove = id => {
    const next = { ...ingredients }; delete next[id]; change(next);
    setMessage('Ingrediente retirado. Puedes deshacer el cambio.');
  };
  const browsing = family || search.trim() || recipe;
  return <section className={`svb${current ? ' svb--editing' : ''}`} aria-label="Armado visual de pizza">
    <div className="svb-toolbar">
      <button type="button" className="svb-base" onClick={onChangeBase} aria-label="Cambiar base"><span>Tu base</span><strong>{category.baseName || category.name} <span aria-hidden="true">⌄</span></strong></button>
      <label className="svb-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar ingrediente visual" placeholder="Buscar ingrediente…" value={search} onChange={e => { setSearch(e.target.value); setFamily(null); setRecipe(false); setEditing(null); setPage(0); }} />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={resetPanel}>×</button>}</label>
      <button type="button" className="svb-quick" onClick={onQuick}>Armado rápido</button>
    </div>
    <div className="svb-layout">
      <section className="svb-preview" aria-label="Pizza en construcción">
        <div className="svb-previewHead"><span>TU PIZZA</span><button type="button" disabled={!history.length} onClick={() => { onIngredientsChange(history[history.length - 1]); setHistory(history.slice(0, -1)); setEditing(null); setMessage('Último cambio deshecho.'); }}>↶ Deshacer</button></div>
        <div className="svb-pizza"><PizzaVisual ingredients={selected} catalog={artCatalog} animate={animate} /></div>
        <div className="svb-sides"><span>IZQUIERDA</span><span>DERECHA</span></div>
        <div className="svb-baseControls">
          <label className="svb-size">Tamaño<select aria-label="Tamaño de pizza" value={size} onChange={e => { onSize(e.target.value); setEditing(null); }}><option value="" disabled>Elegir</option>{category.selectSize.map(value => <option key={value} value={value}>{value} · {money(category.priceBySize[value])}</option>)}</select></label>
          <div className="svb-qty"><span>Pizzas</span><button type="button" aria-label="Menos pizzas" disabled={qty <= 1} onClick={() => onQty(Math.max(1, qty - 1))}>−</button><strong>{qty}</strong><button type="button" aria-label="Más pizzas" disabled={qty >= 12} onClick={() => onQty(Math.min(12, qty + 1))}>+</button></div>
        </div>
        <label className="svb-motion"><input type="checkbox" checked={!animate} onChange={event => setAnimate(!event.target.checked)} /> Reducir movimiento</label>
      </section>
      <section className="svb-options" aria-label="Ingredientes para tu pizza">
        <div className="svb-panelHead"><button ref={backRef} type="button" onClick={resetPanel} aria-label="Ver familias de ingredientes">{browsing || current ? '‹ Ingredientes' : '¿Qué le ponemos?'}</button><button type="button" aria-pressed={recipe} onClick={() => { setRecipe(true); setEditing(null); setPage(0); }}>Tu receta <span>{selected.length}</span></button></div>
        <div className="svb-panelBody">
          {!size ? <p role="status">Elige un tamaño para empezar a poner ingredientes.</p> : loading ? <p role="status">Cargando ingredientes de esta base…</p> : current ?
            <section className="svb-editor" tabIndex="-1" ref={editorRef} aria-label={`Configurar ${current.name}`} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
              <div className="svb-editorHead"><IngredientBowl ingredient={current} /><strong>{current.name}</strong><button type="button" aria-label="Cerrar controles" onClick={close}>×</button></div>
              <fieldset className="svb-placementGroup"><legend>¿Dónde lo ponemos?</legend><div>{positions.map(([key, label]) => <button type="button" key={key} aria-pressed={placement === key} onClick={() => setPlacement(key)}>{label}</button>)}</div></fieldset>
              <fieldset className="svb-quantityGroup"><legend>Cantidad</legend><div>{['SIMPLE', 'DOUBLE'].map(key => <button type="button" key={key} aria-pressed={quantity === key} onClick={() => setQuantity(key)}>{key === 'DOUBLE' ? 'Doble' : 'Simple'}</button>)}</div></fieldset>
              <button type="button" className="svb-confirm" onClick={() => {
                change({ ...ingredients, [current.id]: { ingredientId: current.id, name: current.name, basePrice: getUnitPrice(current), placement, quantity } });
                setMessage(`${current.name} · ${positions.find(([key]) => key === placement)[1]} · ${quantity === 'DOUBLE' ? 'Doble' : 'Simple'}.`);
                resetPanel(); close();
              }}>Poner en mi pizza · {money(getCustomIngredientPrice({ basePrice: getUnitPrice(current), placement, quantity }))}</button>
            </section>
          : browsing ? <div className="svb-tray">
              <div className="svb-trayTitle"><h4>{recipe ? 'Tu receta' : search.trim() ? 'Resultados' : stations.find(row => row.key === family)?.name}</h4><span>{items.length} {recipe ? (items.length === 1 ? 'elegido' : 'elegidos') : (items.length === 1 ? 'disponible' : 'disponibles')}</span></div>
              <div className={recipe ? 'svb-recipe' : 'svb-catalog'}>{items.slice(activePage * pageSize, (activePage + 1) * pageSize).map(row => recipe ? <div key={row.id}><button type="button" onClick={() => edit(row)}><strong>{row.name}</strong><small>{positions.find(([key]) => key === row.placement)?.[1]} · {row.quantity === 'DOUBLE' ? 'Doble' : 'Simple'}</small></button><span>{money(getCustomIngredientPrice(row))}</span><button type="button" aria-label={`Quitar ${row.name}`} onClick={() => remove(row.id)}>×</button></div> : <button type="button" key={row.id} data-family={stationFor(row)} aria-label={`${ingredients[row.id] ? 'Editar' : 'Elegir'} ${row.name}`} aria-pressed={Boolean(ingredients[row.id])} onClick={() => edit(row)}><IngredientBowl ingredient={row} /><strong>{row.name}</strong><small>{money(getUnitPrice(row))}</small><span aria-hidden="true">{ingredients[row.id] ? '✓' : '+'}</span></button>)}</div>
              {!items.length && <p>{recipe ? 'Tu pizza está lista para su primer ingrediente.' : 'No hay ingredientes para esta búsqueda.'}</p>}
              {pages > 1 && <nav className="svb-pages" aria-label="Páginas de ingredientes"><button type="button" aria-label="Ingredientes anteriores" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>‹</button><span>{activePage + 1} / {pages}</span><button type="button" aria-label="Más ingredientes" disabled={activePage + 1 === pages} onClick={() => setPage(activePage + 1)}>›</button></nav>}
            </div>
          : <div className="svb-stations">{stations.map(station => {
              const rows = artCatalog.filter(row => stationFor(row) === station.key);
              const chosen = rows.filter(row => ingredients[row.id]).length;
              return <button type="button" key={station.key} data-family={station.key} disabled={!rows.length} aria-label={`Abrir ${station.name}`} onClick={() => { setFamily(station.key); setPage(0); }}><IngredientBowl ingredient={station} /><strong>{station.name}</strong><small>{chosen ? `${chosen} en tu pizza · ` : ''}{rows.length} {rows.length === 1 ? 'opción' : 'opciones'}</small><span aria-hidden="true">›</span></button>;
            })}</div>}
        </div>
        <p className="svb-status" role="status">{message || 'Elige un ingrediente y colócalo a tu gusto.'}</p>
      </section>
    </div>
  </section>;
}
