import { useState } from 'react';
import api from '../../setupAxios';

export default function DemoRequestPanel({ request, onUpdate }) {
  const [note, setNote] = useState(request.reviewerNote || '');
  const [status, setStatus] = useState(request.status);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const act = async invite => {
    setBusy(true); setMessage('');
    try {
      const { data } = invite
        ? await api.post(`/api/onboarding/requests/${request.id}/invite-onboarding`, { requestedByBusiness: requested })
        : await api.patch(`/api/onboarding/requests/${request.id}/status`, { status, reviewerNote: note });
      onUpdate(data.request);
      setMessage(invite ? 'Invitación al alta enviada.' : 'Seguimiento guardado.');
    } catch (error) {
      if (error.response?.data?.request) onUpdate(error.response.data.request);
      setMessage(invite ? 'No se pudo enviar la invitación. La demo sigue separada del alta; revisa el correo y vuelve a intentarlo.' : 'No se pudo guardar el seguimiento.');
    } finally { setBusy(false); }
  };
  return <div>
    <header className="gmon-detailHead"><div><span>Demostración</span><h3>{request.businessName}</h3>
      <p>Solicitud comercial. Todavía no se han solicitado documentos, firma ni pago.</p></div></header>
    <div className="gmon-summaryGrid">
      <div><span>Contacto</span><strong>{request.name}</strong><a href={`mailto:${request.email}`}>{request.email}</a></div>
      <div><span>Teléfono</span><strong>{request.phone || 'No indicado'}</strong></div>
      <div><span>Confirmación de demo por correo</span><strong>{request.emailStatus === 'SENT' ? 'Enviada' : 'Pendiente o fallida: contactar directamente'}</strong></div>
    </div>
    <p>{request.message || 'Sin mensaje adicional.'}</p>
    <label>Seguimiento<select value={status} disabled={busy} onChange={e => setStatus(e.target.value)}>
      <option value="RECEIVED">Pendiente de contactar</option><option value="IN_REVIEW">Contacto o demo en curso</option><option value="REJECTED">Cerrada</option>
    </select></label>
    <label>Nota comercial<textarea value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></label>
    <button type="button" disabled={busy} onClick={() => act(false)}>Guardar seguimiento</button>
    <div className="gmon-phaseBox"><strong>Después de la demostración</strong>
      <p>Invita a completar el alta únicamente cuando la pizzería quiera continuar. Recibirá el formulario de datos y la elección de equipo.</p>
      <label><input type="checkbox" checked={requested} disabled={busy || request.status === 'REJECTED'} onChange={e => setRequested(e.target.checked)} />La pizzería ha solicitado continuar con el alta.</label>
      <button type="button" disabled={busy || !requested || request.status === 'REJECTED'} onClick={() => act(true)}>{busy ? 'Guardando…' : 'Enviar invitación al alta'}</button>
    </div>
    {message && <p role="status">{message}</p>}
  </div>;
}
