import { memo, useEffect, useState } from 'react';
import { loadDayInfo } from './dayInfo';

export default memo(function PosDayInfo({ city, latitude, longitude }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await loadDayInfo({ city, latitude, longitude });
      if (!cancelled) setItems(current => JSON.stringify(current) === JSON.stringify(result) ? current : result);
    };
    setItems([]);
    refresh();
    // Recompute relative dates locally, including midnight. Cache controls network cadence.
    const timer = setInterval(refresh, 60000);
    const resume = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [city, latitude, longitude]);
  return <details className="pos-dayOutlook">
    <summary>{items.filter(item => item.key.startsWith('holiday-')).map(item => `${item.label}: ${item.value}`).join(' · ') || 'Festivos y previsión de los próximos 3 días'}</summary>
    <div className="pos-dayInfoGrid" aria-label="Información relevante del día">
      {!items.length && <span>Cargando información…</span>}
      {items.map(item => <span key={item.key} className={`pos-dayInfoChip ${item.tone ? `pos-dayInfoChip--${item.tone}` : ''}`}><em>{item.label}</em><b>{item.value}</b></span>)}
    </div>
  </details>;
});
