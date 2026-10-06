import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../setupAxios';
import { receptionText } from '../../utils/storeReception';

export default function StoreReception({ store, language = 'es', refreshKey = '', compact = false }) {
  const text = receptionText(language);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const saving = useRef(false);
  const load = useCallback(async () => {
    if (saving.current) return;
    const version = ++request.current;
    try {
      const { data } = await api.get(`/api/stores/${store.id}/order-reception`);
      if (version === request.current) { setState(data); setError(''); }
    } catch {
      if (version === request.current) { setState(null); setError(text.error); }
    }
  }, [store.id, text.error]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('focus', load);
    return () => { ++request.current; clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load, store.active, store.acceptingOrders, refreshKey]);

  const opened = state ? state.active && state.acceptingOrders : store.active && store.acceptingOrders;
  const toggle = async () => {
    if (saving.current) return;
    saving.current = true; ++request.current; setBusy(true); setError('');
    try {
      const { data } = await api.patch(`/api/stores/${store.id}/order-reception`, { acceptingOrders: !opened });
      setState(current => ({ ...current, ...data, status: data.acceptingOrders ? data.operationsPaused ? 'paused' : 'open' : 'reception_closed' }));
    } catch (err) {
      if (err.response?.data?.error === 'store_not_ready') setState(err.response.data);
      else setError(text.error);
    } finally {
      saving.current = false; setBusy(false); load();
    }
  };
  if (compact) return <span className={`sc-orderStatus sc-orderStatus--${error ? 'unknown' : state?.status || 'loading'}`}
    aria-label={`${text.heading}: ${store.storeName}`} title={error || (state?.scheduledOrdersAvailable ? text.scheduled : undefined)}>
    <span className="sc-orderStatusDot" aria-hidden="true" />
    {error ? text.unknown : state ? text.status[state.status] || text.closed : text.checking}
  </span>;
  return <div className="sc-reception" aria-label={`${text.heading}: ${store.storeName}`}>
    <strong>{state ? text.status[state.status] || text.closed : text.checking}</strong>
    {state?.scheduledOrdersAvailable && ['paused', 'outside_hours'].includes(state.status) && <small>{text.scheduled}</small>}
    {!opened && state?.blockers?.length > 0 && <ul>{state.blockers.map(code => <li key={code}>{text.blockers[code] || text.error}</li>)}</ul>}
    <button type="button" className={`table-btn status ${opened ? 'active' : 'inactive'}`}
      disabled={busy || (!opened && !state?.canOpen)} onClick={toggle}>
      {busy ? text.saving : opened ? text.close : text.open}
    </button>
    {error && <small role="alert">{error} <button type="button" onClick={load}>{text.retry}</button></small>}
  </div>;
}
