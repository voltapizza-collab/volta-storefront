import { useEffect, useRef, useState } from 'react';
import api from '../../setupAxios';
import { STOREFRONT_MODE_ITEMS, DEFAULT_STOREFRONT_MODE, normalizeStorefrontMode } from '../../constants/storefrontButtons';
import '../../styles/StorefrontModesSettings.css';

const selectableMode = value => STOREFRONT_MODE_ITEMS.some(mode => mode.id === normalizeStorefrontMode(value)) ? normalizeStorefrontMode(value) : DEFAULT_STOREFRONT_MODE;

export default function SettingsBrandingModule({ partner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(DEFAULT_STOREFRONT_MODE);
  const [saved, setSaved] = useState(DEFAULT_STOREFRONT_MODE);
  const [restaurantName, setRestaurantName] = useState('Tu restaurante');
  const savingRef = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    setLoaded(false); setLoading(true); setError(''); setSuccess('');
    async function load() {
      try {
        if (!partner?.partnerId) throw new Error('missing_partner');
        const response = await api.get(`/partners/by-id/${partner.partnerId}`);
        if (version !== requestVersion.current) return;
        const mode = normalizeStorefrontMode(response.data?.storefrontMode);
        setSelected(selectableMode(mode)); setSaved(mode);
        setRestaurantName(response.data?.name || 'Tu restaurante');
        setLoaded(true);
      } catch {
        if (version === requestVersion.current) setError('No pudimos cargar la personalización. Vuelve a abrir esta pantalla para reintentar.');
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    }
    load();
    return () => { requestVersion.current++; };
  }, [partner?.partnerId]);

  const save = async event => {
    event.preventDefault();
    if (!loaded || savingRef.current || selected === saved) return;
    const version = requestVersion.current;
    savingRef.current = true; setSaving(true); setError(''); setSuccess('');
    try {
      const response = await api.patch(`/partners/by-id/${partner.partnerId}/storefront-mode`, { storefrontMode: selected });
      if (version !== requestVersion.current) return;
      if (response.data?.storefrontMode !== selected) throw new Error('unconfirmed_mode');
      setSaved(selected);
      setSuccess(`Modo ${STOREFRONT_MODE_ITEMS.find(mode => mode.id === selected).name.toLowerCase()} aplicado. Se mostrará al abrir o recargar tu tienda.`);
    } catch {
      if (version === requestVersion.current) setError('No se pudo aplicar el modo. Tu tienda conserva el anterior; puedes volver a intentarlo.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <section className="bo-settingsShell bo-storefrontModes">
    <div className="bo-settingsCard">
      <div className="bo-settingsHeader">
        <div>
          <div className="bo-settingsEyebrow">Personalización</div>
          <h2 className="bo-settingsTitle">El estilo de tu tienda</h2>
          <p className="bo-settingsHint">Elige un modo para tu restaurante. Tu carta, las fotos y las funciones siguen en el mismo lugar.</p>
        </div>
      </div>
      {loading ? <p role="status">Cargando personalización…</p> : <form onSubmit={save}>
        {loaded && <>
          {saved === 'volta' && <p className="bo-settingsHint">Tu tienda conserva el modo Volta. Elige uno de los nuevos modos y pulsa Aplicar modo para cambiarlo.</p>}
          <fieldset className="bo-storefrontModes__options" disabled={saving}>
            <legend>Elige el aspecto del storefront</legend>
            {STOREFRONT_MODE_ITEMS.map(mode => <label key={mode.id} className={`bo-storefrontMode ${selected === mode.id ? 'is-selected' : ''}`}>
              <input type="radio" name="storefront-mode" value={mode.id} checked={selected === mode.id}
                aria-label={mode.name} onChange={() => { setSelected(mode.id); setSuccess(''); setError(''); }} />
              <div className={`bo-storefrontMode__preview ${mode.id === 'commercial-dark' ? 'is-dark' : mode.id === 'sepia' ? 'is-sepia' : ''}`} aria-hidden="true">
                <div className="bo-storefrontMode__previewHeader"><span className="bo-storefrontMode__logo" />{restaurantName}<span>•••</span></div>
                <div className="bo-storefrontMode__previewTabs"><b>Carta</b><span>Ofertas</span><span>Buscar</span></div>
                <div className="bo-storefrontMode__previewGrid">{[0, 1, 2].map(index => <div key={index}><i /><span /><small /></div>)}</div>
                <div className="bo-storefrontMode__previewFooter"><span>Tu pedido</span><b>Ver carrito →</b></div>
              </div>
              <div className="bo-storefrontMode__copy"><div><strong>{mode.name}</strong>{saved === mode.id && <span className="bo-storefrontMode__badge">En uso</span>}</div><p>{mode.description}</p></div>
            </label>)}
          </fieldset>
          <p className="bo-storefrontModes__scope">El modo se aplica a las tiendas de este restaurante. Puedes cambiarlo cuando quieras.</p>
        </>}
        {error && <div className="bo-settingsError" role="alert">{error}</div>}
        {success && <div className="bo-settingsSuccess" role="status">{success}</div>}
        {loaded && <div className="bo-settingsActions"><button type="submit" className="bo-settingsSave" disabled={saving || selected === saved}>{saving ? 'Aplicando…' : 'Aplicar modo'}</button></div>}
      </form>}
    </div>
  </section>;
}
