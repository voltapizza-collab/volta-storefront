import { useState } from 'react';
import api from '../../setupAxios';

export default function SettingsAccountModule({ partner, onSessionChanged, t }) {
  const [form, setForm] = useState({ currentPassword: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setSuccess(false);
    if (!form.password || !form.currentPassword) { setMessage(t('account.required')); return; }
    if (form.password !== form.confirm) { setMessage(t('account.mismatch')); return; }
    setBusy(true); setMessage('');
    try {
      const response = await api.post('/partners/backoffice-password/change', { currentPassword: form.currentPassword, password: form.password });
      onSessionChanged(response.data);
      setForm({ currentPassword: '', password: '', confirm: '' });
      setSuccess(true); setMessage(t('account.success'));
    } catch (error) {
      setMessage(t(error.response?.data?.error === 'incorrect_current_password' ? 'account.incorrect' : 'account.error'));
    } finally { setBusy(false); }
  };
  return <section className="bo-settingsShell"><div className="bo-settingsCard bo-accountCard">
    <h2 className="bo-settingsTitle">{t('account.title')}</h2>
    <p><strong>{partner.partnerSlug}</strong></p>
    <p className="bo-settingsHint">{t('account.hint')}</p>
    <form className="bo-accountForm" onSubmit={submit}>
      {[['currentPassword', 'current'], ['password', 'new'], ['confirm', 'confirm']].map(([name, key]) =>
        <label key={name}>{t(`account.${key}`)}
          <input type="password" name={name} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} required maxLength={1024}
            value={form[name]} disabled={busy} onChange={event => setForm(previous => ({ ...previous, [name]: event.target.value }))} />
        </label>)}
      {message && <p role={success ? 'status' : 'alert'}>{message}</p>}
      <button type="submit" className="bo-settingsMiniCta" disabled={busy}>{t(busy ? 'account.saving' : 'account.save')}</button>
    </form>
    <p className="bo-settingsHint bo-accountResponsibility">{t('account.responsibility')}</p>
  </div></section>;
}
