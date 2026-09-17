import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../../setupAxios";
import "../../styles/IngredientOnboarding.css";

export const INGREDIENT_LANGUAGES = [
  ["es", "Español"], ["en", "Inglés"], ["it", "Italiano"],
  ["fr", "Francés"], ["pt", "Portugués"], ["ar", "Árabe"], ["zh", "Chino"],
];
const emptyNames = (spanish = "") => Object.fromEntries(
  INGREDIENT_LANGUAGES.map(([locale]) => [locale, locale === "es" ? spanish : ""])
);
const ingredientCountFormat = new Intl.NumberFormat("es-ES", { useGrouping: true });
const savedTranslations = (ingredient) => [...(ingredient?.semanticTranslations || []), ...(Array.isArray(ingredient?.translations) ? ingredient.translations : [])];
const savedNames = (ingredient) => ({ ...emptyNames(ingredient?.name || ingredient?.defaultName || ""),
  ...Object.fromEntries(savedTranslations(ingredient).map(row => [row.locale, row.name || ""])) });
const aliasNames = (ingredient) => (ingredient?.aliases || ingredient?.semanticAliases || []).map(row => typeof row === "string" ? row : row.alias).filter(Boolean);

export const normalizeIngredientSearch = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const matchesIngredientSearch = (values, query) => {
  const text = normalizeIngredientSearch(values.join(" "));
  return normalizeIngredientSearch(query).split(/\s+/).filter(Boolean)
    .every((word) => text.includes(word));
};

export function IngredientSearchIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
}

export default function IngredientOnboardingModal({ candidates = [], categories = [], ingredient = null, onClose, onCreated }) {
  const editing = Boolean(ingredient);
  const dialogRef = useRef(null);
  const requestRef = useRef(null);
  const detailsRef = useRef(null);
  const busyRef = useRef(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(60);
  const [selected, setSelected] = useState(ingredient);
  const [names, setNames] = useState(() => ingredient ? savedNames(ingredient) : emptyNames());
  const [detailsLoaded, setDetailsLoaded] = useState(!ingredient);
  const [detailsLoading, setDetailsLoading] = useState(Boolean(ingredient));
  const [aliasesText, setAliasesText] = useState(() => aliasNames(ingredient).join("\n"));
  const [catalogStatus, setCatalogStatus] = useState(ingredient?.status || "ACTIVE");
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDragActive, setPhotoDragActive] = useState(false);
  const photoDragDepth = useRef(0);

  const loadDetails = useCallback(async () => {
    if (!ingredient) return;
    detailsRef.current?.abort();
    const controller = new AbortController(); detailsRef.current = controller;
    setDetailsLoading(true); setDetailsLoaded(false); setError("");
    try {
      const { data } = await api.get(`/ingredients/${ingredient.id}/semantics`, { signal: controller.signal });
      if (detailsRef.current !== controller || controller.signal.aborted) return;
      const full = { ...ingredient, ...data, category: ingredient.category, categoryLabel: ingredient.categoryLabel,
        semanticTranslations: data.translations || data.semanticTranslations || [] };
      setSelected(full); setNames(savedNames(full)); setAliasesText(aliasNames(full).join("\n"));
      setCatalogStatus(full.status || "ACTIVE"); setDetailsLoaded(true);
    } catch (err) {
      if (!controller.signal.aborted) setError("No se pudo cargar la ficha completa. Reintenta antes de guardar.");
    } finally {
      if (detailsRef.current === controller) setDetailsLoading(false);
    }
  }, [ingredient]);
  useEffect(() => { loadDetails(); return () => detailsRef.current?.abort(); }, [loadDetails]);

  useEffect(() => {
    if (!photo) { setPhotoPreview(""); return; }
    const preview = URL.createObjectURL(photo);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector("input")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      requestRef.current?.abort();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const availableCount = useMemo(() => candidates.filter((candidate) => !candidate.isExisting).length, [candidates]);
  const results = useMemo(() => candidates.filter((candidate) =>
    (!category || candidate.category === category) &&
    matchesIngredientSearch([candidate.defaultName, candidate.categoryLabel,
      candidate.canonicalKey, ...(candidate.aliases || [])], query)
  ), [candidates, category, query]);

  const close = () => { if (!busyRef.current) onClose(); };
  const select = (candidate) => {
    if (selected?.canonicalKey === candidate.canonicalKey) return;
    requestRef.current?.abort();
    requestRef.current = null;
    setTranslating(false);
    const chosen = candidate.savedIngredient ? { ...candidate, ...candidate.savedIngredient, canonicalKey: candidate.canonicalKey,
      categoryLabel: categories.find(row => row.key === candidate.savedIngredient.category)?.label || candidate.categoryLabel } : candidate;
    setSelected(chosen);
    setPhoto(null);
    setPhotoDragActive(false); photoDragDepth.current = 0;
    setNames(candidate.savedIngredient ? savedNames(chosen) : emptyNames(candidate.translations?.es || candidate.defaultName));
    setAliasesText(aliasNames(chosen).join("\n"));
    setCatalogStatus(chosen.catalogState?.previousStatus || chosen.status || "ACTIVE");
    setError(""); setNotice("");
  };
  const updateName = (locale, value) => {
    requestRef.current?.abort(); requestRef.current = null; setTranslating(false);
    setError(""); setNotice("");
    setNames((current) => locale === "es" && !editing && !selected?.savedIngredient
      ? emptyNames(value)
      : { ...current, [locale]: value });
  };
  const invalidSpanish = !names.es.trim() || /\uFFFD/.test(names.es);
  const complete = INGREDIENT_LANGUAGES.every(([locale]) => names[locale]?.trim() && !/\uFFFD/.test(names[locale]));
  const choosePhoto = (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Usa una foto JPG, PNG o WebP de hasta 5 MB."); return;
    }
    setError(""); setPhoto(file);
  };

  const translate = async () => {
    if (requestRef.current || translating || saving || invalidSpanish || !detailsLoaded) return;
    const controller = new AbortController(); requestRef.current = controller;
    setTranslating(true); setError(""); setNotice("");
    try {
      const { data } = await api.post("/ingredients/translate", {
        name: names.es.trim(), category: selected.categoryLabel,
      }, { signal: controller.signal, timeout: 30000 });
      if (requestRef.current !== controller) return;
      const translated = Object.fromEntries((data.translations || []).map((item) => [item.locale, item.name]));
      if (!INGREDIENT_LANGUAGES.every(([locale]) => typeof translated[locale] === "string" && translated[locale].trim() && !translated[locale].includes("\uFFFD"))) {
        throw new Error("La traducción llegó incompleta. Inténtalo de nuevo.");
      }
      // Keep anything already entered by the operator.
      setNames((current) => Object.fromEntries(INGREDIENT_LANGUAGES.map(([locale]) =>
        [locale, current[locale].trim() ? current[locale] : translated[locale]])));
      setNotice("Traducciones listas. Revisa los nombres antes de añadir.");
    } catch (err) {
      if (requestRef.current === controller && !controller.signal.aborted) {
        setError(err.response?.data?.error || err.message || "No se pudo traducir. Puedes completar los idiomas manualmente.");
      }
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setTranslating(false); }
    }
  };

  const save = async () => {
    if (!selected || !complete || busyRef.current || translating || !detailsLoaded) return;
    busyRef.current = true; setSaving(true); setError("");
    try {
      const payload = {
        name: names.es.trim(), category: selected.category,
        canonicalKey: selected.canonicalKey, semanticCategoryKey: selected.semanticCategoryKey,
        legacyCanonicalKeys: selected.legacyCanonicalKeys || [],
        allergens: selected.allergens || [],
        aliases: aliasesText.split("\n").map(name => name.trim()).filter(name => name && !name.includes("\uFFFD")),
        translations: INGREDIENT_LANGUAGES.map(([locale]) => {
          const original = savedTranslations(selected).find(row => row.locale === locale);
          return { locale, name: names[locale].trim(), ...(original?.description != null ? { description: original.description } : {}) };
        }),
        ...(editing || selected.savedIngredient ? { status: catalogStatus } : {}),
        confirmTranslations: true,
      };
      let requestBody = payload;
      let config;
      if (photo) {
        requestBody = new FormData();
        requestBody.append("payload", JSON.stringify(payload));
        requestBody.append("image", photo);
        config = { headers: { "Content-Type": "multipart/form-data" } };
      }
      const endpoint = editing ? `/ingredients/${ingredient.id}/editor` : "/ingredients/onboarding";
      const method = editing ? "patch" : "post";
      const { data } = photo ? await api[method](endpoint, requestBody, config) : await api[method](endpoint, requestBody);
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el ingrediente. Tus nombres siguen aquí para reintentar.");
    } finally {
      busyRef.current = false; setSaving(false);
    }
  };

  return createPortal(
    <dialog className="gm-onboarding" ref={dialogRef} aria-labelledby="gm-onboarding-title"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <header className="gm-onboarding-head">
        <div><span>CATÁLOGO GLOBAL · VOLTA</span><h2 id="gm-onboarding-title">{editing ? "Editar ingrediente" : "Añadir ingrediente"}</h2>
          <p>{editing ? "Nombres, idiomas y foto en una sola ficha." : "Busca en español, traduce y añade la foto desde aquí."}</p></div>
        <button type="button" className="gm-onboarding-close" aria-label="Cerrar" disabled={saving} onClick={close}>×</button>
      </header>
      <div className="gm-onboarding-body">
        <div className="gm-onboarding-picker">
          {editing ? <div className="gm-onboarding-edit-context">
            <h3>{ingredient.displayName || ingredient.name}</h3>
            <p>Estás editando la ficha del catálogo global. La lista maestra permanece protegida.</p>
            <label>Categoría<select value={selected?.category || ""} disabled={saving || !detailsLoaded}
              onChange={event => setSelected(current => ({ ...current, category: event.target.value,
                categoryLabel: categories.find(row => row.key === event.target.value)?.label }))}>
              {categories.map(row => <option key={row.key} value={row.key}>{row.label}</option>)}
            </select></label>
            <label>Estado general<select value={catalogStatus} disabled={saving || !detailsLoaded} onChange={event => setCatalogStatus(event.target.value)}>
              <option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option>
            </select></label>
            <details><summary>Identidad y otros nombres</summary>
              <label>Identificador protegido<input value={selected?.canonicalKey || ""} readOnly /></label>
              <label>Otros nombres conocidos<textarea value={aliasesText} disabled={saving || !detailsLoaded} onChange={event => setAliasesText(event.target.value)} /></label>
              <small>Un nombre por línea. Los nombres anteriores se conservan para reconocer el ingrediente.</small>
            </details>
          </div> : <>
          <section className="gm-onboarding-summary" aria-label="Resumen de la lista maestra">
            <p className="gm-onboarding-summary-total"><strong>{ingredientCountFormat.format(candidates.length)}</strong>
              <span>{candidates.length === 1 ? "ingrediente en la lista maestra" : "ingredientes en la lista maestra"}</span></p>
            <p className="gm-onboarding-summary-detail">{ingredientCountFormat.format(availableCount)} disponibles para añadir
              {" · "}{ingredientCountFormat.format(candidates.length - availableCount)} ya añadidos</p>
          </section>
          <label className="gm-ingredient-search"><IngredientSearchIcon />
            <input autoFocus aria-label="Buscar en la lista maestra" placeholder="Busca pollo, queso, salsa…" value={query}
              onChange={(event) => { setQuery(event.target.value); setLimit(60); }} disabled={saving} />
          </label>
          <label className="gm-onboarding-category">Categoría
            <select value={category} onChange={(event) => { setCategory(event.target.value); setLimit(60); }} disabled={saving}>
              <option value="">Todas las categorías</option>
              {categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <p className="gm-onboarding-count" role="status">{results.length} resultados · {results.filter((item) => !item.isExisting).length} disponibles</p>
          <div className="gm-onboarding-results" aria-label="Ingredientes de la lista maestra">
            {results.slice(0, limit).map((candidate) => <button type="button" key={candidate.canonicalKey}
              className={`gm-onboarding-option ${selected?.canonicalKey === candidate.canonicalKey ? "is-selected" : ""}`}
              aria-pressed={selected?.canonicalKey === candidate.canonicalKey} disabled={candidate.isExisting || saving}
              onClick={() => select(candidate)}>
              <span><strong>{candidate.defaultName}</strong><small>{candidate.categoryLabel}</small></span>
              <span className="gm-onboarding-option-status">{candidate.isExisting ? "Ya añadido" : selected?.canonicalKey === candidate.canonicalKey ? "✓" : "+"}</span>
            </button>)}
            {!results.length && <p className="gm-onboarding-empty">No hay coincidencias. Prueba otro nombre o selecciona todas las categorías.</p>}
            {results.length > limit && <button className="gm-onboarding-more" type="button" onClick={() => setLimit(limit + 60)}>Mostrar más resultados</button>}
          </div>
          </>}
        </div>
        <section className="gm-onboarding-detail" aria-label="Idiomas del ingrediente">
          {detailsLoading && <p role="status">Cargando la ficha…</p>}
          {editing && !detailsLoading && !detailsLoaded && <button type="button" onClick={loadDetails}>Reintentar carga</button>}
          {selected ? <>
            <span className="gm-onboarding-category-tag">{selected.categoryLabel}</span>
            <h3>Un ingrediente, siete idiomas</h3>
            <p>Revisa los siete nombres. Al guardar quedan confirmados en su ficha.</p>
            {selected.savedIngredient && <p className="gm-onboarding-notice">Recuperarás su foto e idiomas guardados. Puedes revisarlos antes de añadirlo.</p>}
            <div className="gm-onboarding-names">
              {INGREDIENT_LANGUAGES.map(([locale, label]) => <label key={locale}>
                <span><b>{locale.toUpperCase()}</b> {label}{locale === "es" ? " · Original" : ""}</span>
                <input aria-label={`Nombre en ${label.toLowerCase()}`} lang={locale === "zh" ? "zh-Hans" : locale} dir={locale === "ar" ? "rtl" : "ltr"} value={names[locale]} maxLength={locale === "es" ? 120 : 160}
                  placeholder={locale === "es" ? "Nombre original" : "Traducción"} disabled={saving || !detailsLoaded}
                  onChange={(event) => updateName(locale, event.target.value)} />
              </label>)}
            </div>
            {names.es.includes("\uFFFD") && <p className="gm-onboarding-warning">Este nombre tiene un carácter dañado. Corrígelo en español antes de traducir.</p>}
            <button type="button" className="gm-onboarding-translate" disabled={invalidSpanish || translating || saving || !detailsLoaded || complete} onClick={translate}>
              {translating ? "Traduciendo…" : "Traducir idiomas pendientes"}
            </button>
            {notice && <p className="gm-onboarding-notice" role="status">{notice}</p>}
            <section className={`gm-onboarding-photo ${photoDragActive ? "is-dragging" : ""}`} aria-label="Foto del ingrediente"
              onDragEnter={(event) => {
                event.preventDefault();
                if (!saving && Array.from(event.dataTransfer.types || []).includes("Files")) {
                  photoDragDepth.current += 1; setPhotoDragActive(true);
                }
              }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = saving ? "none" : "copy"; }}
              onDragLeave={(event) => {
                event.preventDefault(); photoDragDepth.current = Math.max(0, photoDragDepth.current - 1);
                if (!photoDragDepth.current) setPhotoDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault(); event.stopPropagation();
                photoDragDepth.current = 0; setPhotoDragActive(false);
                if (saving) return;
                const files = Array.from(event.dataTransfer.files || []);
                if (files.length > 1) { setError("Sube una sola foto para este ingrediente."); return; }
                choosePhoto(files[0]);
              }}>
              <div className="gm-onboarding-photo-preview">
                {photoPreview || selected.image ? <img src={photoPreview || selected.image} alt={`Vista previa de ${names.es}`} /> :
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 6h4l2-3h6l2 3h4v15H3z"/><circle cx="12" cy="13" r="4"/></svg>}
              </div>
              <div className="gm-onboarding-photo-controls">
                <strong>Foto del ingrediente <small>Opcional</small></strong>
                <p>{photoDragActive ? "Suelta la foto aquí" : "Arrastra tu foto aquí o selecciona un archivo."}</p>
                <label className={`gm-onboarding-photo-upload ${saving ? "is-disabled" : ""}`}>
                  {photo || selected.image ? "Cambiar foto" : "Subir foto"}
                  <input type="file" aria-label="Subir foto del ingrediente" accept="image/jpeg,image/png,image/webp" disabled={saving || !detailsLoaded}
                    onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }} />
                </label>
                {photo && <button type="button" disabled={saving} onClick={() => setPhoto(null)}>Quitar foto</button>}
                {photo && <span className="gm-onboarding-photo-filename">{photo.name}</span>}
                <small className="gm-onboarding-photo-formats">JPG, PNG o WebP · hasta 5 MB</small>
              </div>
            </section>
          </> : <div className="gm-onboarding-intro"><span aria-hidden="true">＋</span><h3>Encuentra tu próximo ingrediente</h3>
            <p>Busca en todas las categorías y selecciona una opción para preparar sus traducciones.</p></div>}
          {error && <p className="gm-onboarding-error" role="alert">{error}</p>}
        </section>
      </div>
      <footer className="gm-onboarding-footer"><p>{photo ? "Los idiomas quedarán confirmados. La foto se guarda para revisión." : editing ? "La foto actual se conserva si no eliges otra." : "Al añadir confirmas los nombres. La foto es opcional."}</p>
        <button type="button" className="gm-onboarding-secondary" disabled={saving} onClick={close}>Cancelar</button>
        <button type="button" className="gm-onboarding-primary" disabled={!selected || !complete || saving || translating || !detailsLoaded} onClick={save}>
          {saving ? (photo ? "Guardando con foto…" : "Guardando…") : editing ? "Guardar cambios" : "Añadir ingrediente"}
        </button>
      </footer>
    </dialog>, document.body
  );
}
