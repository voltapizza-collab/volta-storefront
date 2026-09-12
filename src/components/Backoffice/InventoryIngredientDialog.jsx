import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ingredientAliases, ingredientAllergens, ingredientReference, parseIngredientPrice, formatIngredientMoney } from "./ingredientDetails";
import { inventoryDetailTranslator, inventoryAllergenLabel } from "../../constants/inventoryDetailTranslations";
import "../../styles/InventoryIngredientDialog.css";

const locales = ["es", "en", "it", "fr", "pt", "ar", "zh"];
export default function InventoryIngredientDialog({ ingredient, category, language, currency = "EUR", suggestedPrice, onSave, onDeactivate, onClose }) {
  const dialog = useRef(null);
  const busy = useRef(false);
  const decimal = (value) => new Intl.NumberFormat(language || "en", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [price, setPrice] = useState(ingredient.costPrice == null ? "" : decimal(ingredient.costPrice));
  const [description, setDescription] = useState(ingredient.description || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const t = inventoryDetailTranslator(language);
  const reference = ingredientReference(ingredient);
  const aliases = ingredientAliases(ingredient);
  const allergens = ingredientAllergens(ingredient);
  const translations = new Map((reference.semanticTranslations || []).map((row) => [row.locale, row.name]));
  const name = ingredient.displayName || ingredient.name;
  const image = preview || ingredient.image || reference.image;
  const active = ingredient.exists && ingredient.active;

  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => { node.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const close = () => { if (!busy.current) onClose(); };
  const submit = async (deactivate = false) => {
    if (busy.current) return;
    const costPrice = parseIngredientPrice(price);
    if (!deactivate && costPrice === null) { setError(t("invalidPrice")); return; }
    busy.current = true; setSaving(true); setError("");
    try {
      if (deactivate) await onDeactivate();
      else await onSave({ costPrice, description, imageFile: file });
      onClose();
    } catch { setError(t("saveError")); }
    finally { busy.current = false; setSaving(false); }
  };
  return createPortal(<dialog ref={dialog} className="inventory-dialog" aria-labelledby="inventory-dialog-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <header className="inventory-dialog-header">
        <span>{t("setup")}</span><button type="button" onClick={close} disabled={saving} aria-label={t("close")}>×</button>
      </header>
      <div className="inventory-dialog-body">
        <div className="inventory-dialog-hero">
          <label className="inventory-dialog-photo" title={t("photoHelp")}>
            {image ? <img src={image} alt="" /> : <span aria-hidden="true">{name?.slice(0, 2).toUpperCase()}</span>}
            <span>{t(image ? "changePhoto" : "photo")}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={t("photo")} disabled={saving}
              onChange={(event) => { const photo = event.target.files?.[0]; event.target.value = "";
                if (!photo) return;
                if (!["image/png", "image/jpeg", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) { setError(t("invalidPhoto")); return; }
                setFile(photo); setError(""); }} />
          </label>
          <div><h2 id="inventory-dialog-title">{name}</h2><p>{category}</p><span className={`inventory-dialog-status ${active ? "is-active" : ""}`}>{t(active ? "active" : "inactive")}</span></div>
        </div>
        <p className="inventory-dialog-scope">{t("scope")}</p>
        {error && <p className="inventory-dialog-error" role="alert">{error}</p>}
        <section className="inventory-dialog-price">
          <label htmlFor="inventory-detail-price">{t("price")}</label>
          <div className="inventory-dialog-price-control"><span>{currency}</span><input id="inventory-detail-price" type="text" inputMode="decimal" autoComplete="off"
            value={price} placeholder={decimal(0)} maxLength={12} aria-describedby="inventory-price-help" disabled={saving}
            onChange={(event) => { setPrice(event.target.value); setError(""); }}
            onBlur={() => { const value = parseIngredientPrice(price); if (value !== null) setPrice(decimal(value)); }} /></div>
          <p id="inventory-price-help">{t("priceHelp")}</p>
          {suggestedPrice > 0 && <div className="inventory-dialog-suggestion">
            <button type="button" disabled={saving} onClick={() => { setPrice(decimal(suggestedPrice)); setError(""); }}>{t("suggestion", { price: formatIngredientMoney(suggestedPrice, language, currency) })}</button>
            <small>{t("suggestionHelp")}</small>
          </div>}
        </section>
        <section className="inventory-dialog-section" aria-label={t("aliases")}>
          <h3>{t("aliases")}</h3>
          {aliases.length ? <div className="inventory-dialog-tags">{aliases.map((alias) => <span key={alias} dir="auto">{alias}</span>)}</div> : <p>{t("noAliases")}</p>}
          <small>{t("aliasesHelp")}</small>
        </section>
        <section className={`inventory-dialog-section ${allergens.length ? "" : "inventory-dialog-unknown"}`} aria-label={t("allergens")}>
          <h3>{t("allergens")}</h3>
          {allergens.length ? <div className="inventory-dialog-tags">{allergens.map((allergen) => <span key={allergen}>{inventoryAllergenLabel(allergen, language)}</span>)}</div> : <strong>{t("unknown")}</strong>}
          <p>{t(allergens.length ? "knownHelp" : "allergenHelp")}</p>
        </section>
        <label className="inventory-dialog-description">{t("description")}
          <textarea value={description} maxLength={420} rows={3} placeholder={t("placeholder")} disabled={saving} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <details className="inventory-dialog-reference"><summary>{t("identity")} · {translations.size}/7</summary>
          <p>{reference.semanticStatus === "REVIEWED" ? t("reviewed") : t("pending")}</p>
          <p>{t("reviewHelp")}</p>
          <div className="inventory-dialog-translations">{locales.map((locale) => <div key={locale}><b>{locale.toUpperCase()}</b><span lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{translations.get(locale) || t("pending")}</span></div>)}</div>
        </details>
      </div>
      <footer className="inventory-dialog-footer"><button type="button" onClick={close} disabled={saving}>{t("cancel")}</button>
        {active && <button type="button" className="inventory-dialog-deactivate" onClick={() => submit(true)} disabled={saving}>{t("deactivate")}</button>}
        <button type="submit" className="inventory-dialog-save" disabled={saving}>{t(saving ? "saving" : active ? "save" : "activate")}</button>
      </footer>
    </form>
  </dialog>, document.body);
}
