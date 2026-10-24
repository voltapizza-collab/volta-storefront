import React, { useEffect, useState } from 'react';
import api from '../../setupAxios';
import FoodPackageSelector from '../FoodPackageSelector';

export default function FoodAssignment({ partnerId, requestId }) {
  const base = `/api/food-packages/${partnerId ? 'partners' : 'requests'}/${partnerId || requestId}`;
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [configuration, setConfiguration] = useState(null);
  const [ids, setIds] = useState([]);
  const [editable, setEditable] = useState(true);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    let live = true; setBusy(true); setPreview(null); setMessage('');
    Promise.all([api.get(base), api.get('/api/food-packages'), api.get('/api/categories')]).then(([assignment, catalog, cats]) => {
      if (!live) return;
      if (!Array.isArray(catalog.data) || !Array.isArray(cats.data)) throw new Error("invalid_food_catalog");
      setConfiguration(assignment.data.configuration); setIds((assignment.data.configuration?.packages || []).map(p => p.id));
      setEditable(assignment.data.editable !== false); setPackages(catalog.data); setCategories(cats.data);
    }).catch(() => { if (live) { setMessage('No se pudo cargar la configuración. Vuelve a abrir la ficha.'); setEditable(false); } }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [base]);
  const selectedPackages = ids.map(id => configuration?.packages.find(p => p.id === id) || packages.find(p => p.id === id)).filter(Boolean);
  const selectedCategories = categories.filter(cat => selectedPackages.some(pack => pack.categoryIds.includes(cat.id)));
  const available = [...packages.filter(p => p.active || configuration?.packages.some(old => old.id === p.id)), ...(configuration?.packages || []).filter(p => !packages.some(row => row.id === p.id))];
  const body = { packageIds: ids, expectedConfiguration: configuration };
  const prepare = async () => {
    setBusy(true); setMessage('');
    try {
      if (partnerId) setPreview((await api.post(`${base}/preview`, body)).data);
      else setPreview({ enabled: selectedCategories, disabled: [] });
    } catch { setMessage('No se pudo preparar el cambio. La configuración puede haber cambiado; vuelve a abrir la ficha.'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await api.post(`${base}/apply`, { ...body, ...(partnerId ? { previewConfiguration: preview.configuration } : {}) });
      setConfiguration(response.data.configuration); setPreview(null); setMessage('Paquetes guardados.');
    } catch { setMessage('No se pudo guardar. Vuelve a abrir la ficha para revisar la configuración actual.'); }
    finally { setBusy(false); }
  };
  return <section className="food-panel food-assignment">
    <h3>Paquetes de comida</h3>
    {!configuration && <p>{partnerId ? 'Este negocio conserva su configuración anterior. Asignar paquetes limitará sus categorías a la selección.' : 'Todavía no hay paquetes seleccionados.'}</p>}
    {busy && <p role="status">Cargando…</p>}
    {message && <p role="status">{message}</p>}
    <FoodPackageSelector packages={available} value={ids} disabled={busy || !editable} onChange={next => { setIds(next); setPreview(null); }} />
    <p><strong>Categorías incluidas:</strong> {selectedCategories.map(c => c.name).join(', ') || 'Ninguna'}</p>
    <p>Constructor de pizza: {selectedCategories.some(c => c.builderType === 'PIZZA' && c.customizable) ? 'Disponible' : 'No'} · Mitad y mitad: {selectedCategories.some(c => c.halfAndHalf) ? 'Disponible' : 'No'}</p>
    {editable && !preview && <button type="button" disabled={busy || !ids.length} onClick={prepare}>Revisar cambio</button>}
    {preview && <div className="food-preview">
      <p><strong>Categorías asignadas:</strong> {preview.enabled.map(c => c.name).join(', ') || 'Ninguna'}</p>
      {!!preview.disabled.length && <p><strong>Se desactivarán:</strong> {preview.disabled.map(c => c.name).join(', ')}</p>}
      <p>Se conservan los productos, precios y pedidos históricos. Las categorías compartidas permanecen asignadas.</p>
      <button type="button" disabled={busy} onClick={apply}>Aplicar paquetes</button>{' '}
      <button type="button" disabled={busy} onClick={() => setPreview(null)}>Cancelar</button>
    </div>}
  </section>;
}
