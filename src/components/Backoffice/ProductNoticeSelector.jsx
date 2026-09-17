import { PRODUCT_NOTICE_KEYS, normalizeProductNotices, productNoticeLabels } from '../../constants/productNotices';

const copy = {
  es: ['Avisos especiales', 'Marcar todos', 'Quitar todos', 'Puedes combinar varios avisos según el plato.'],
  en: ['Special notices', 'Select all', 'Clear all', 'You can combine several notices for this dish.'],
  it: ['Avvisi speciali', 'Seleziona tutti', 'Deseleziona tutti', 'Puoi combinare più avvisi per questo piatto.'],
  fr: ['Mentions spéciales', 'Tout sélectionner', 'Tout désélectionner', 'Vous pouvez combiner plusieurs mentions pour ce plat.'],
  pt: ['Avisos especiais', 'Selecionar todos', 'Limpar todos', 'Pode combinar vários avisos para este prato.'],
};
export default function ProductNoticeSelector({value = [], onChange, language = 'es'}) {
  const [title, all, none, hint] = copy[String(language).slice(0, 2)] || copy.en;
  const labels = productNoticeLabels(language);
  const selected = normalizeProductNotices(value);
  return <fieldset className="pc-block pc-noticeSelector">
    <legend className="pc-subsectionTitle">{title}</legend>
    <p className="pc-noticeHint">{hint}</p>
    <div className="pc-noticeActions">
      <button type="button" disabled={selected.length === PRODUCT_NOTICE_KEYS.length} onClick={() => onChange([...PRODUCT_NOTICE_KEYS])}>{all}</button>
      <button type="button" disabled={!selected.length} onClick={() => onChange([])}>{none}</button>
    </div>
    <div className="pc-tagGrid">{PRODUCT_NOTICE_KEYS.map(key => <label key={key} className={`pc-tagOption ${selected.includes(key) ? 'is-active' : ''}`}>
      <input type="checkbox" checked={selected.includes(key)} onChange={() => onChange(selected.includes(key) ? selected.filter(item => item !== key) : normalizeProductNotices([...selected, key]))} />
      <span>{labels[key]}</span>
    </label>)}</div>
  </fieldset>;
}
