import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../setupAxios';
import './CategoryBasePricing.css';

const copy = {
  es: { title: 'Precio de la base para armar tu pizza', edit: 'Configurar precio de la base', half: 'Disponible para mitad y mitad', pending: 'Precio de base pendiente', partial: 'Faltan precios de base', hint: 'Precio de venta de la base, antes de añadir ingredientes. Se aplica al armado visual y rápido de este negocio; las ofertas de pizzas no lo modifican.', blank: 'Deja vacío un tamaño para que no se ofrezca en el armado.', size: 'Tamaño', price: 'Precio de la base', empty: 'Sin configurar', save: 'Guardar precios', saving: 'Guardando…', cancel: 'Cancelar', error: 'No se pudieron guardar los precios. Inténtalo de nuevo.', invalid: 'Introduce importes mayores que 0, hasta 10.000, con un máximo de dos decimales.', disabled: 'Global Manager ya no permite personalizar esta categoría. Actualiza las categorías.', none: 'Añade tamaños a los productos de esta categoría para configurar sus bases.' },
  en: { title: 'Base price for building your pizza', edit: 'Configure base price', half: 'Available for half and half', pending: 'Base price not configured', partial: 'Some base prices are missing', hint: 'Selling price of the base before adding ingredients. Applies to visual and quick building for this business; pizza offers do not change it.', blank: 'Leave a size empty to exclude it from the builder.', size: 'Size', price: 'Base price', empty: 'Not configured', save: 'Save prices', saving: 'Saving…', cancel: 'Cancel', error: 'Prices could not be saved. Please try again.', invalid: 'Enter amounts greater than 0, up to 10,000, with no more than two decimal places.', disabled: 'Global Manager no longer allows customization for this category. Refresh the categories.', none: 'Add sizes to products in this category to configure their bases.' },
  it: { title: 'Prezzo della base per comporre la pizza', edit: 'Configura prezzo della base', half: 'Disponibile per metà e metà', pending: 'Prezzo della base da configurare', partial: 'Mancano alcuni prezzi delle basi', hint: 'Prezzo di vendita della base prima di aggiungere gli ingredienti. Vale per la composizione visiva e rapida di questa attività; le offerte delle pizze non lo modificano.', blank: 'Lascia vuoto un formato per escluderlo dalla composizione.', size: 'Formato', price: 'Prezzo della base', empty: 'Non configurato', save: 'Salva prezzi', saving: 'Salvataggio…', cancel: 'Annulla', error: 'Impossibile salvare i prezzi. Riprova.', invalid: 'Inserisci importi maggiori di 0, fino a 10.000, con al massimo due decimali.', disabled: 'Global Manager non consente più di personalizzare questa categoria. Aggiorna le categorie.', none: 'Aggiungi i formati ai prodotti della categoria per configurare le basi.' },
  fr: { title: 'Prix de la base pour composer votre pizza', edit: 'Configurer le prix de la base', half: 'Disponible pour moitié-moitié', pending: 'Prix de base à configurer', partial: 'Certains prix de base manquent', hint: 'Prix de vente de la base avant les ingrédients. Il s’applique aux modes visuel et rapide de cet établissement ; les offres de pizzas ne le modifient pas.', blank: 'Laissez une taille vide pour l’exclure de la composition.', size: 'Taille', price: 'Prix de la base', empty: 'Non configuré', save: 'Enregistrer les prix', saving: 'Enregistrement…', cancel: 'Annuler', error: 'Impossible d’enregistrer les prix. Réessayez.', invalid: 'Saisissez des montants supérieurs à 0, jusqu’à 10 000, avec deux décimales maximum.', disabled: 'Global Manager ne permet plus de personnaliser cette catégorie. Actualisez les catégories.', none: 'Ajoutez des tailles aux produits de cette catégorie pour configurer les bases.' },
  pt: { title: 'Preço da base para montar a pizza', edit: 'Configurar preço da base', half: 'Disponível para metade e metade', pending: 'Preço da base por configurar', partial: 'Faltam alguns preços das bases', hint: 'Preço de venda da base antes de adicionar ingredientes. Aplica-se à montagem visual e rápida deste negócio; as ofertas de pizzas não o alteram.', blank: 'Deixe um tamanho vazio para o excluir da montagem.', size: 'Tamanho', price: 'Preço da base', empty: 'Por configurar', save: 'Guardar preços', saving: 'A guardar…', cancel: 'Cancelar', error: 'Não foi possível guardar os preços. Tente novamente.', invalid: 'Introduza valores superiores a 0, até 10.000, com no máximo duas casas decimais.', disabled: 'O Global Manager já não permite personalizar esta categoria. Atualize as categorias.', none: 'Adicione tamanhos aos produtos desta categoria para configurar as bases.' },
};
export const basePricingCopy = language => copy[String(language || 'es').toLowerCase().split('-')[0]] || copy.es;
export const categorySizes = products => ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ST'].filter(size => products.some(product => Array.isArray(product.selectSize) && product.selectSize.includes(size)));
const hasPrice = (prices, size) => typeof prices?.[size] === 'number' && prices[size] > 0;

export function CategoryCapabilities({ category, products, language, onConfigure }) {
  const t = basePricingCopy(language);
  const sizes = categorySizes(products);
  const count = sizes.filter(size => hasPrice(category.customBasePrices, size)).length;
  const pending = count < sizes.length || !sizes.length;
  return <div className="pc-baseCapabilities">
    {category.customizable && <button type="button" className={pending ? 'pc-baseIcon pc-baseIcon--pending' : 'pc-baseIcon'} aria-label={`${t.edit}: ${category.name}`} title={`${t.edit}${pending ? ` · ${count ? t.partial : t.pending}` : ''}`} onClick={onConfigure}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19 10 3a23 23 0 0 1 11 11Z" /><path d="m10 3 1.5 3A19 19 0 0 1 18 12l3 2" /><circle cx="10" cy="13" r="1" /><circle cx="14" cy="10" r="1" /></svg>
      {pending && <span className="pc-basePending" aria-label={count ? t.partial : t.pending} />}
    </button>}
    {category.halfAndHalf && <span className="pc-baseHalf" title={t.half} role="img" aria-label={t.half}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18Z" /><path d="M12 3v18" /></svg></span>}
  </div>;
}

export default function CategoryBasePricing({ category, products, partnerId, language, currency = 'EUR', onSaved, onClose }) {
  const t = basePricingCopy(language), titleId = useId(), dialogRef = useRef(null);
  const sizes = categorySizes(products);
  const [values, setValues] = useState(() => Object.fromEntries(sizes.map(size => [size, category.customBasePrices?.[size] ?? ''])));
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialogRef.current?.showModal(); return () => dialogRef.current?.close(); }, []);
  const save = async event => {
    event.preventDefault(); if (saving) return;
    const customBasePrices = {};
    for (const size of sizes) {
      const value = String(values[size] ?? '').trim().replace(',', '.');
      if (!value) continue;
      const price = Number(value);
      if (!/^\d+(\.\d{1,2})?$/.test(value) || price <= 0 || price > 10000) { setError(t.invalid); return; }
      customBasePrices[size] = price;
    }
    setSaving(true); setError('');
    try {
      const { data } = await api.patch(`/api/partners/${partnerId}/categories/${category.id}`, { customBasePrices });
      if (!data?.customBasePrices || data.fallback) throw new Error('No saved prices');
      onSaved(data.customBasePrices); onClose();
    } catch (err) { setError(err.response?.data?.error === 'category_not_customizable' ? t.disabled : t.error); }
    finally { setSaving(false); }
  };
  return createPortal(<dialog ref={dialogRef} className="pc-baseDialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={save}>
      <header><div><small>{category.name}</small><h2 id={titleId}>{t.title}</h2></div><button type="button" aria-label={t.cancel} disabled={saving} onClick={onClose}>×</button></header>
      <p>{t.hint}</p>
      {sizes.length ? <div className="pc-basePrices">{sizes.map(size => <label key={size}><strong>{t.size} {size}</strong><span><input autoFocus={size === sizes[0]} aria-label={`${t.price} ${size}`} type="text" inputMode="decimal" placeholder={t.empty} value={values[size]} disabled={saving} onChange={event => setValues(previous => ({ ...previous, [size]: event.target.value }))} /><small>{currency}</small></span></label>)}</div> : <p>{t.none}</p>}
      <p className="pc-baseHint">{t.blank}</p>
      {error && <p role="alert" className="pc-baseError">{error}</p>}
      <footer><button type="button" disabled={saving} onClick={onClose}>{t.cancel}</button><button type="submit" disabled={saving || !sizes.length}>{saving ? t.saving : t.save}</button></footer>
    </form>
  </dialog>, document.body);
}
