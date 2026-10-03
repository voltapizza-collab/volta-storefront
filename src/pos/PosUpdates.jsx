import { useCallback, useEffect, useRef, useState } from 'react';
import { nativeCall } from './nativeBridge';
import './PosUpdates.css';

const reasons = {
  maintenance_not_authorized: 'La versión ya no está habilitada para instalar desde el canal de distribución. Volta debe renovar su disponibilidad.',
  battery_below_30: 'Esperando que la batería alcance el 30 %.',
  insufficient_storage: 'No hay espacio suficiente en el terminal.',
  operations_in_progress: 'Esperando que terminen las operaciones y la impresión.',
  install_permission_required: 'Android necesita la autorización inicial de Volta para instalar actualizaciones.',
  authorization_expired: 'No se pudo actualizar en el plazo elegido. Sigue pendiente: puedes actualizar ahora o programar otra hora.',
  installation_timeout: 'Android no confirmó la instalación. Contacta con Volta antes de volver a intentarlo.',
  update_consent_required: 'La autorización cambió. Elige cuándo quieres actualizar.',
};
const labels = {
  idle: 'No hay actualizaciones pendientes.', pending: 'Tienes una actualización pendiente.',
  scheduled: 'Actualización programada.', downloading: 'Descargando la actualización…', ready: 'Actualización preparada.',
  waiting_safe: 'Esperando condiciones para actualizar.', waiting_permission: 'Falta la autorización de Android.',
  installing: 'Instalando la actualización…', installed: 'Versión instalada; comprobando el funcionamiento.',
  healthy: 'Actualización completada y comprobada.', failed: 'La actualización no se completó. Tus datos se conservan.',
  confirmation_required: 'Android solicita confirmación. La instalación se ha detenido; contacta con Volta.',
};
const decisionErrors = {
  update_target_changed: 'La versión disponible ha cambiado. Revisa sus detalles antes de decidir.',
  invalid_update_schedule: 'Elige una fecha futura dentro de los próximos 30 días.',
  update_session_changed: 'La tienda ha cambiado. Vuelve a abrir el aviso.',
  terminal_updating: 'La instalación ya ha comenzado. Espera a que termine.',
};
function localInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function PosUpdates({ open, onOpen, onClose, onVersionChange }) {
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState('details');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const feedback = useRef(null);
  const claimingReminder = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    if (typeof status?.versionName === 'string' && status.versionName.trim()) {
      onVersionChange?.(status.versionName.trim());
    }
  }, [status?.versionName, onVersionChange]);
  const refresh = useCallback(async () => {
    try { const data = await nativeCall('updateStatus'); if (alive.current) setStatus(data); }
    catch (_) { /* Keep the last known notice during an operation or installation. */ }
  }, []);
  useEffect(() => {
    alive.current = true; refresh();
    const timer = setInterval(refresh, 10000);
    const resume = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { alive.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [refresh]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    setStep('details'); setError(''); refresh();
    dialog.current?.showModal();
    return () => { dialog.current?.close(); previous?.focus?.(); };
  }, [open, refresh]);
  useEffect(() => { setStep('details'); setError(''); }, [status?.target?.sha256]);
  useEffect(() => {
    if (!status?.reminderDue || !status.available || claimingReminder.current || document.hidden ||
        ['downloading', 'ready', 'installing'].includes(status.state) ||
        (!open && document.querySelector('dialog[open]'))) return;
    claimingReminder.current = true;
    nativeCall('updateNoticeSeen', { sha256: status.target.sha256 }).then(result => {
      if (!alive.current) return;
      setStatus(previous => previous ? { ...previous, reminderDue: false } : previous);
      if (result.claimed && !open) onOpen();
    }).catch(() => { /* Retry on the next status refresh. */ })
      .finally(() => { claimingReminder.current = false; });
  }, [status, open, onOpen]);

  const choose = async (decision) => {
    const scheduledAt = decision === 'scheduled' ? new Date(when).getTime() : undefined;
    if (decision === 'scheduled' && (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now() || scheduledAt > Date.now() + 30 * 86400000)) {
      setError(decisionErrors.invalid_update_schedule); return;
    }
    setBusy(true); setError('');
    try {
      const result = await nativeCall('updateDecision', { sha256: status.target.sha256, decision, ...(scheduledAt ? { scheduledAt } : {}) });
      if (!alive.current) return;
      setStatus(result); setStep('details');
      onClose();
    } catch (e) { if (alive.current) { setError(decisionErrors[e.message] || 'No se pudo guardar tu elección. Comprueba la conexión y vuelve a intentarlo.'); refresh(); } }
    finally { if (alive.current) setBusy(false); }
  };
  const action = async (operation) => {
    setBusy(true); setError('');
    try { await nativeCall(operation); await refresh(); }
    catch (_) { setError('No se pudo completar la consulta. Comprueba la conexión.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const available = status?.available;
  const scheduled = available && status.decision === 'scheduled';
  const active = ['downloading', 'ready', 'installing'].includes(status?.state);
  const expired = status?.authorizedUntil > 0 && status.authorizedUntil <= Date.now();
  const accepted = available && status.decision === 'now' && !expired;
  const description = expired ? reasons.authorization_expired : reasons[status?.error] || labels[status?.state] || 'Consultando el terminal…';
  return <>
    {available && <aside className="pos-updateNotice" aria-label="Actualización del terminal">
      <span><strong>{scheduled && !expired ? 'Actualización programada' : 'Tienes una actualización pendiente'}</strong>
        <small>{accepted ? description : scheduled && !expired ? new Date(status.scheduledAt).toLocaleString('es-ES') : `Volta POS ${status.target.versionName}`}</small></span>
      <button type="button" onClick={onOpen}>Ver detalles</button>
    </aside>}
    {!available && status?.state === 'healthy' && <p className="pos-updateSuccess" role="status">Volta POS {status.versionName}: actualización completada.</p>}
    {open && <dialog className="pos-updateDialog" ref={dialog} aria-labelledby="pos-update-title" onCancel={event => { event.preventDefault(); onClose(); }}>
      <header><div><small>VOLTA POS · ACTUALIZACIONES</small><h2 id="pos-update-title">{available ? status.target.title : 'Actualizaciones del terminal'}</h2></div>
        <button type="button" onClick={onClose} autoFocus aria-label="Cerrar actualizaciones">×</button></header>
      {!status ? <p>Consultando el terminal…</p> : <>
        <p className="pos-updateVersion">Instalada: {status.versionName}{available && <> · Disponible: {status.target.versionName}</>}</p>
        <p role="status">{status.configured ? description : 'El canal de actualizaciones todavía no está configurado.'}</p>
        {available && <>
          <h3>Qué incluye esta versión</h3><div className="pos-updateNotes">{status.target.releaseNotes}</div>
          <p>La aplicación se cerrará para aplicar la versión. Si vuelves al escritorio, abre Volta desde su icono. Se conservarán la tienda y la sesión.</p>
          {scheduled && !expired && <p><strong>Programada: {new Date(status.scheduledAt).toLocaleString('es-ES')}</strong></p>}
          {step === 'details' && <>
            <p className="pos-updateHelp">La tienda seguirá abierta y recibiendo pedidos. Necesita batería ≥30 % y que terminen las operaciones e impresiones del terminal. «Actualizar ahora» autoriza el intento durante 15 minutos. Si Android vuelve al escritorio, abre Volta desde su icono.</p>
            {accepted && <div ref={feedback} className="pos-updateFeedback" role="status"><strong>Actualización autorizada</strong><p>{description}</p><small>No tienes que pulsar de nuevo. Esperará hasta las {new Date(status.authorizedUntil).toLocaleTimeString('es-ES')}.</small></div>}
            <div className="pos-updateActions">
              <button type="button" className="pos-updatePrimary" disabled={busy || active || status.blocked || accepted} onClick={() => choose('now')}>{busy ? 'Guardando…' : accepted ? 'Solicitud aceptada' : 'Actualizar ahora'}</button>
              <button type="button" disabled={busy || status.state === 'installing'} onClick={async () => {
                // Revoke an earlier approval before offering another date.
                if (status.decision !== 'pending') {
                  setBusy(true); setError('');
                  try { setStatus(await nativeCall('updateDecision', { sha256: status.target.sha256, decision: 'pending' })); setStep('later'); }
                  catch (_) { setError('No se pudo dejar pendiente. Vuelve a intentarlo.'); }
                  finally { setBusy(false); }
                } else setStep('later');
              }}>{scheduled ? 'Cambiar o cancelar programación' : 'Ahora no'}</button>
            </div>
          </>}
          {status.blocked && <p>Esta versión está detenida por un error de instalación. Volta debe revisar el terminal o publicar una nueva versión antes de continuar.</p>}
          {step === 'later' && <section aria-label="Opciones para más tarde"><h3>¿Quieres programar la actualización?</h3>
            <div className="pos-updateActions"><button type="button" disabled={busy} onClick={() => { setWhen(localInput(new Date(Date.now() + 3600000))); setStep('schedule'); }}>Programar fecha y hora</button>
              <button type="button" disabled={busy} onClick={() => choose('pending')}>Dejar pendiente</button></div></section>}
          {step === 'schedule' && <section aria-label="Programar actualización"><label htmlFor="pos-update-when">Fecha y hora del terminal</label>
            <input id="pos-update-when" type="datetime-local" value={when} min={localInput(new Date())} max={localInput(new Date(Date.now() + 30 * 86400000))} onChange={event => setWhen(event.target.value)} />
            <p className="pos-updateHelp">Deja Volta abierto y conectado a internet. Intentará actualizar durante la hora siguiente a la elegida. Si está apagado, cerrado o no reúne las condiciones en ese plazo, quedará pendiente y te avisará al volver.</p>
            <div className="pos-updateActions"><button className="pos-updatePrimary" type="button" disabled={busy} onClick={() => choose('scheduled')}>Guardar programación</button>
              <button type="button" disabled={busy} onClick={() => setStep('later')}>Volver</button></div></section>}
        </>}
        {status.configured && !status.canInstall && <button type="button" disabled={busy} onClick={() => action('updatePermission')}>Autorizar Volta en Android</button>}
      </>}
      {error && <p role="alert" className="pos-updateError">{error}</p>}
    </dialog>}
  </>;
}
