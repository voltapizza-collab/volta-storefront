import { useEffect, useRef } from 'react';
import StoreReception from './StoreReception';
import { receptionText } from '../../utils/storeReception';

export default function StoreManagementDialog({ store, language, t, onClose, onAction, enabled, coordinateBlocked }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  const reception = receptionText(language);
  return <dialog ref={dialog} className="sc-storeManageDialog" aria-labelledby="store-manage-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="sc-storeManageContent">
      <header className="sc-modalHead"><div><p className="sc-modalEyebrow">{t('section.manage')}</p><h2 id="store-manage-title">{store.storeName}</h2></div>
        <button className="sc-iconBtn" type="button" aria-label={t('action.close')} onClick={onClose}>×</button>
      </header>
      <p className="sc-subtitle">{[store.address, store.city].filter(Boolean).join(' · ')}</p>
      <section className="sc-storeReceptionPanel"><h3>{reception.heading}</h3><StoreReception store={store} language={language} /></section>
      <div className="sc-storeTools">
        {[['edit', 'action.edit'], ['menu', 'table.menu'], ['hours', 'table.hours'], ['pos', 'action.pos'], ['report', 'table.report'], ['reservations', 'table.reservations']].map(([action, key]) =>
          <button key={action} type="button" className="sc-btn" onClick={() => onAction(action)}>{t(key)}<span aria-hidden="true">↗</span></button>)}
      </div>
      <footer className="sc-storeManageFooter">
        <div><span>{t('section.access')}</span><button type="button" className={`table-btn status ${enabled ? 'active' : 'inactive'}`} onClick={() => onAction('active')}
          title={coordinateBlocked ? t('status.coordsTitle') : t('status.changeTitle')}>{enabled ? reception.enabled : coordinateBlocked ? t('status.coords') : reception.disabled}</button></div>
        <button type="button" className="sc-deleteStore" onClick={() => onAction('delete')}>{t('action.delete')}</button>
      </footer>
    </div>
  </dialog>;
}
