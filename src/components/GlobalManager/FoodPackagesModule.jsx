import React, { useCallback, useEffect, useState } from 'react';
import api from '../../setupAxios';
import '../../styles/FoodPackages.css';

const empty = { name: '', description: '', active: false, position: 0, categoryIds: [] };
export default function FoodPackagesModule() {
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const [packs, cats] = await Promise.all([api.get('/api/food-packages'), api.get('/api/categories')]);
    setPackages(packs.data); setCategories(cats.data);
  }, []);
  useEffect(() => { load().catch(() => setMessage('No se pudieron cargar los paquetes.')).finally(() => setBusy(false)); }, [load]);
  const save = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const data = { ...form, position: Number(form.position) };
      if (form.id) await api.patch(`/api/food-packages/${form.id}`, data);
      else await api.post('/api/food-packages', data);
      await load(); setForm(empty); setMessage('Paquete guardado. Los negocios y solicitudes existentes conservan su configuración.');
    } catch { setMessage('No se pudo guardar. Revisa el nombre y las categorías; un paquete activo necesita al menos una categoría.'); }
    finally { setBusy(false); }
  };
  return <section className="food-panel">
    <h2>Paquetes de comida</h2>
    <p>Agrupa las categorías del catálogo. Configura los constructores visuales y mitad y mitad en la pestaña Categorías. Los extras son independientes.</p>
    {message && <p role="status">{message}</p>}
    <div className="food-packages__layout"><div className="food-packages__list">
      {packages.map(pack => <button type="button" key={pack.id} disabled={busy} onClick={() => { setForm(pack); setMessage(''); }}>
        <strong>{pack.name}</strong><small>{pack.active ? 'Disponible en el alta' : 'Borrador / no disponible'} · {pack.categoryIds.length} categorías</small>
      </button>)}
      <button type="button" disabled={busy} onClick={() => setForm(empty)}>+ Crear paquete</button>
    </div><form onSubmit={save} className="food-package-form">
      <h3>{form.id ? 'Editar paquete' : 'Crear paquete'}</h3>
      <label>Nombre<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Descripción<textarea maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label>Orden<input type="number" min="0" max="10000" required value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></label>
      <fieldset><legend>Categorías incluidas</legend><div className="food-category-list">{categories.map(cat => <label key={cat.id}>
        <input type="checkbox" checked={form.categoryIds.includes(cat.id)} onChange={e => setForm({ ...form, categoryIds: e.target.checked ? [...form.categoryIds, cat.id] : form.categoryIds.filter(id => id !== cat.id) })} />
        {cat.name}{cat.builderType === 'PIZZA' ? ' · Constructor de pizza' : ''}{cat.halfAndHalf ? ' · Mitad y mitad' : ''}
      </label>)}</div></fieldset>
      <label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Disponible para nuevas altas</label>
      <button type="submit" disabled={busy || !form.name.trim() || (form.active && !form.categoryIds.length)}>{busy ? 'Guardando…' : 'Guardar paquete'}</button>
    </form></div>
  </section>;
}
