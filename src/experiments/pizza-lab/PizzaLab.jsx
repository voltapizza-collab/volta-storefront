import { useReducer, useRef, useState } from 'react';
import { catalog, category } from './catalog';
import { initialPizza, makeLabLine, pizzaReducer } from './model';
import PizzaVisual, { IngredientMark } from './PizzaVisual';
import { getCustomIngredientPrice, scaleIngredientPriceForSize } from '../../utils/customPizza';
import { getLineDetailRows } from '../../pos/orderLineDetails';
import './pizza-lab.css';

const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
const positions = [['FULL', 'Toda'], ['RIGHT', 'Derecha'], ['LEFT', 'Izquierda']];
const groups = [['all', 'Todo'], ['sauce', 'Salsas'], ['cheese', 'Quesos'], ['toppings', 'Ingredientes']];
const groupOf = row => row.category === 'SALSAS_CONDIMENTOS_BASES' ? 'sauce' : row.category === 'QUESOS' ? 'cheese' : 'toppings';

export default function PizzaLab() {
  const [state, dispatch] = useReducer(pizzaReducer, { present: initialPizza, past: [] });
  const [group, setGroup] = useState('sauce');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [placement, setPlacement] = useState('FULL');
  const [quantity, setQuantity] = useState('SIMPLE');
  const [animate, setAnimate] = useState(true);
  const [quick, setQuick] = useState(false);
  const [review, setReview] = useState(false);
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState('');
  const panelRef = useRef(null);
  const lastTrigger = useRef(null);
  const pizza = state.present;
  const line = makeLabLine(pizza, category, catalog, 1);
  const selected = line.ingredients;
  const visible = catalog.filter(row => (group === 'all' || groupOf(row) === group) && row.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  const ingredient = catalog.find(row => row.id === editing);
  const priceFor = (row, zone = 'FULL', amount = 'SIMPLE') => getCustomIngredientPrice({ basePrice: scaleIngredientPriceForSize(row.costPrice, pizza.size), placement: zone, quantity: amount });
  const openEditor = (row, event) => {
    lastTrigger.current = event.currentTarget;
    setEditing(row.id);
    setPlacement(pizza.ingredients[row.id]?.placement || 'FULL');
    setQuantity(pizza.ingredients[row.id]?.quantity || 'SIMPLE');
    requestAnimationFrame(() => panelRef.current?.focus());
  };
  const closeEditor = () => { setEditing(null); lastTrigger.current?.focus(); };
  const apply = () => {
    dispatch({ type: 'ingredient', id: editing, placement, quantity });
    setMessage(`${ingredient.name}, ${positions.find(([key]) => key === placement)[1].toLowerCase()}, ${quantity === 'DOUBLE' ? 'doble' : 'simple'}.`);
    closeEditor();
  };
  return <div className="pl-app">
    <header className="pl-header"><a href="#main" className="pl-brand" aria-label="Volta Pizza, ir al constructor">volta<span>pizza</span><i>✳</i></a><span className="pl-labBadge">EL OBRADOR · EXPERIMENTAL</span><span className="pl-cartCount">Tu bandeja <b>{cart.length}</b></span></header>
    <main id="main" className="pl-main">
      <div className="pl-intro"><div><p className="pl-eyebrow">HECHA A TU MANERA</p><h1>Un poco de ti.<br /><em>Una pizza única.</em></h1><p>Elige, combina y mira cómo toma forma.</p></div><div className="pl-mode"><button aria-pressed={quick} onClick={() => { setQuick(!quick); setGroup('all'); }}>Armado rápido {quick ? '✓' : '↗'}</button><label><input type="checkbox" checked={!animate} onChange={e => setAnimate(!e.target.checked)} /> Reducir movimiento</label></div></div>
      <div className="pl-workbench">
        <section className="pl-preview" aria-label="Pizza en construcción">
          <div className="pl-previewTop"><span>TU CREACIÓN</span><button disabled={!state.past.length} onClick={() => { dispatch({ type: 'undo' }); setEditing(null); setMessage('Último cambio deshecho.'); }}>↶ Deshacer</button></div>
          <div className="pl-pizzaFrame"><PizzaVisual ingredients={selected} catalog={catalog} animate={animate} /><span className="pl-side pl-sideLeft">IZQUIERDA</span><span className="pl-side pl-sideRight">DERECHA</span></div>
          <div className="pl-previewCaption"><strong>{selected.length ? `${selected.length} ingredientes, a tu gusto.` : 'Todo empieza con una buena base.'}</strong><span>La colocación es ilustrativa. Tú eliges la zona.</span></div>
          <div className="pl-baseControls"><label>Base<span>{category.baseName}</span></label><fieldset><legend>Tamaño</legend>{category.selectSize.map(size => <button key={size} aria-pressed={pizza.size === size} onClick={() => { dispatch({ type: 'size', value: size }); setEditing(null); }}>{size}</button>)}</fieldset></div>
        </section>
        <section className="pl-ingredients" aria-label="Catálogo de ingredientes">
          <div className="pl-sectionHead"><div><p className="pl-eyebrow">EL TOQUE ES TUYO</p><h2>{review ? 'Así queda tu pizza' : '¿Qué le ponemos?'}</h2></div><span className="pl-count">{selected.length.toString().padStart(2, '0')}</span></div>
          {!review && <><nav className="pl-tabs" aria-label="Familias de ingredientes">{groups.map(([key, label]) => <button key={key} aria-pressed={group === key} onClick={() => setGroup(key)}>{label}</button>)}</nav>
            <label className="pl-search"><span>⌕</span><input aria-label="Buscar ingrediente" value={query} onChange={e => setQuery(e.target.value)} placeholder="Encuentra tu ingrediente" /></label>
            <div className={`pl-catalog ${quick ? 'pl-catalogQuick' : ''}`}>{visible.map(row => <button className={`pl-ingredient ${pizza.ingredients[row.id] ? 'is-selected' : ''}`} key={row.id} aria-label={`${pizza.ingredients[row.id] ? 'Editar' : 'Elegir'} ${row.name}`} aria-pressed={Boolean(pizza.ingredients[row.id])} onClick={e => openEditor(row, e)}>
              <span className="pl-ingredientArt"><svg viewBox="-25 -25 50 50" aria-hidden="true"><IngredientMark ingredient={row} /></svg></span><strong>{row.name}</strong><small>{money(priceFor(row))} · toda / simple</small><span className="pl-add" aria-hidden="true">{pizza.ingredients[row.id] ? '✓' : '+'}</span>
            </button>)}</div>{!visible.length && <p>No hay ingredientes con ese nombre.</p>}
            {ingredient && <section className="pl-editor" aria-label={`Configurar ${ingredient.name}`} tabIndex="-1" ref={panelRef} onKeyDown={e => { if (e.key === 'Escape') closeEditor(); }}>
              <div className="pl-editorTitle"><strong>{ingredient.name}</strong><button aria-label="Cerrar controles" onClick={closeEditor}>×</button></div>
              <fieldset><legend>¿Dónde lo ponemos?</legend><div className="pl-segments">{positions.map(([key, label]) => <button key={key} aria-pressed={placement === key} onClick={() => setPlacement(key)}><span className={`pl-zone pl-zone${key}`} aria-hidden="true" />{label}</button>)}</div></fieldset>
              <fieldset><legend>Cantidad</legend><div className="pl-segments">{['SIMPLE', 'DOUBLE'].map(value => <button key={value} aria-pressed={quantity === value} onClick={() => setQuantity(value)}>{value === 'SIMPLE' ? 'Simple' : 'Doble'}</button>)}</div></fieldset>
              <button className="pl-primary" onClick={apply}>{pizza.ingredients[editing] ? 'Guardar cambio' : 'Poner en mi pizza'} <span>{money(priceFor(ingredient, placement, quantity))}</span></button>
              {pizza.ingredients[editing] && <button className="pl-remove" onClick={() => { dispatch({ type: 'remove', id: editing }); setMessage(`${ingredient.name} eliminado.`); closeEditor(); }}>Quitar ingrediente</button>}
            </section>}
          </>}
          <section className="pl-recipe" aria-label="Tu receta"><div className="pl-recipeHead"><h3>Tu receta</h3><span>{money(line.price)} de base</span></div>
            {!selected.length && <p className="pl-muted">Añade tu primer ingrediente para empezar.</p>}
            {selected.map(row => <div className="pl-recipeRow" key={row.id}><button onClick={e => { setReview(false); openEditor(row, e); }}><strong>{row.name}</strong><span>{positions.find(([key]) => key === row.placement)[1]} · {row.quantity === 'DOUBLE' ? 'Doble' : 'Simple'}</span></button><span>{money(row.price)}</span><button aria-label={`Quitar ${row.name}`} onClick={() => { dispatch({ type: 'remove', id: row.id }); setMessage(`${row.name} eliminado.`); }}>×</button></div>)}
          </section>
          {review && <div className="pl-review"><label>Observaciones<textarea value={pizza.notes} maxLength="500" onChange={e => dispatch({ type: 'notes', value: e.target.value })} placeholder="Por ejemplo, cortar en ocho" /></label><p>Alérgenos seleccionados: {line.allergens.length ? line.allergens.join(', ') : 'ninguno en los ingredientes de muestra'}. La base de muestra contiene gluten.</p><details><summary>Ver comanda por zonas</summary><pre>{getLineDetailRows(line).join('\n')}</pre></details><button className="pl-back" onClick={() => setReview(false)}>← Seguir creando</button></div>}
        </section>
      </div>
      <p role="status" className="pl-status">{message}</p>
      <aside className="pl-disclaimer">Un espacio para probar. Catálogo y precios de muestra; la bandeja es local y no envía pedidos.</aside>
      {cart.length > 0 && <section className="pl-demoCart" aria-label="Bandeja de prueba"><h2>En tu bandeja</h2>{cart.map((item, index) => <details key={item.cartLineId}><summary>{item.qty} × {item.name} {item.size} · {money(item.subtotal)}</summary><pre>{getLineDetailRows(item).join('\n')}</pre><button onClick={() => setCart(cart.filter((_, i) => i !== index))}>Retirar de la bandeja</button></details>)}</section>}
    </main>
    <footer className="pl-footer"><div className="pl-quantity"><button aria-label="Menos pizzas" disabled={pizza.qty <= 1} onClick={() => dispatch({ type: 'qty', value: pizza.qty - 1 })}>−</button><span>{pizza.qty}</span><button aria-label="Más pizzas" disabled={pizza.qty >= 20} onClick={() => dispatch({ type: 'qty', value: pizza.qty + 1 })}>+</button></div><div className="pl-total"><small>Tu pizza · {pizza.size}</small><strong>{money(line.subtotal)}</strong></div><button className="pl-primary" disabled={!selected.length} onClick={() => {
      if (!review) { setReview(true); setEditing(null); setMessage('Revisa tu receta y sus observaciones.'); return; }
      setCart([...cart, { ...line, cartLineId: `custom-lab-${Date.now()}-${cart.length}` }]); setMessage('Pizza añadida a la bandeja de prueba.');
    }}>{review ? 'Añadir a bandeja de prueba' : 'Mi pizza está lista'} <span aria-hidden="true">↗</span></button></footer>
  </div>;
}
