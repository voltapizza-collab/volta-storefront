import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createBackofficeTranslator } from '../../constants/i18n';
import '../../styles/BackofficeNotifications.css';

const copy = {
  es: { title:'No se puede eliminar', lead:'Este producto está vinculado con:', help:'Retira primero estas vinculaciones y después vuelve a intentar eliminarlo.', close:'Entendido', types:{TOP_DEAL:['Top Deal','Top Deals'],PROMO:['Promo','Promos'],INCENTIVE:['Incentivo','Incentivos'],PRICE_RULE:['Regla de precio','Reglas de precio']} },
  en: { title:'Cannot delete product', lead:'This product is linked to:', help:'Remove these links first, then try deleting the product again.', close:'Got it', types:{TOP_DEAL:['Top Deal','Top Deals'],PROMO:['Promo','Promos'],INCENTIVE:['Incentive','Incentives'],PRICE_RULE:['Price rule','Price rules']} },
  it: { title:'Impossibile eliminare il prodotto', lead:'Questo prodotto è collegato a:', help:'Rimuovi prima questi collegamenti, poi riprova a eliminare il prodotto.', close:'Ho capito', types:{TOP_DEAL:['Top Deal','Top Deal'],PROMO:['Promo','Promo'],INCENTIVE:['Incentivo','Incentivi'],PRICE_RULE:['Regola di prezzo','Regole di prezzo']} },
  fr: { title:'Impossible de supprimer le produit', lead:'Ce produit est lié à :', help:'Retirez d’abord ces liens, puis réessayez de supprimer le produit.', close:'Compris', types:{TOP_DEAL:['Top Deal','Top Deals'],PROMO:['Promo','Promos'],INCENTIVE:['Récompense','Récompenses'],PRICE_RULE:['Règle de prix','Règles de prix']} },
  pt: { title:'Não é possível eliminar o produto', lead:'Este produto está associado a:', help:'Remova primeiro estas associações e tente eliminar o produto novamente.', close:'Entendido', types:{TOP_DEAL:['Top Deal','Top Deals'],PROMO:['Promo','Promos'],INCENTIVE:['Incentivo','Incentivos'],PRICE_RULE:['Regra de preço','Regras de preço']} },
};
const errors = {
  es: { title:'No se pudo completar la eliminación', check:'No pudimos comprobar las vinculaciones. No se ha enviado la orden de eliminar. Vuelve a intentarlo.', delete:'No pudimos confirmar la eliminación. Actualiza la lista de productos para comprobar su estado antes de volver a intentarlo.' },
  en: { title:'Deletion could not be completed', check:'We could not check the product links. No delete request was sent. Please try again.', delete:'We could not confirm deletion. Refresh the product list to check its status before trying again.' },
  it: { title:'Impossibile completare l’eliminazione', check:'Non è stato possibile verificare i collegamenti. Nessuna richiesta di eliminazione è stata inviata. Riprova.', delete:'Non è stato possibile confermare l’eliminazione. Aggiorna l’elenco dei prodotti per verificarne lo stato prima di riprovare.' },
  fr: { title:'La suppression n’a pas pu être terminée', check:'Impossible de vérifier les liens. Aucune demande de suppression n’a été envoyée. Réessayez.', delete:'Impossible de confirmer la suppression. Actualisez la liste des produits pour vérifier son état avant de réessayer.' },
  pt: { title:'Não foi possível concluir a eliminação', check:'Não foi possível verificar as associações. Não foi enviado nenhum pedido de eliminação. Tente novamente.', delete:'Não foi possível confirmar a eliminação. Atualize a lista de produtos para verificar o estado antes de tentar novamente.' },
};
export default function ProductLinksAlert({ data, language='es', onClose }) {
  const closeRef=useRef(null);
  const dialogRef=useRef(null);
  const text=copy[String(language).slice(0,2).toLowerCase()] || copy.en;
  const errorText=errors[String(language).slice(0,2).toLowerCase()] || errors.en;
  const t=createBackofficeTranslator(language);
  useEffect(()=>{
    if(!data)return;
    const previous=document.activeElement;
    const dialog=dialogRef.current;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.showModal();
    closeRef.current?.focus();
    const handleKey=event=>{
      if(event.key==='Tab'){
        const controls=dialog.querySelectorAll('button');
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    dialog.addEventListener('keydown',handleKey);
    return ()=>{dialog.removeEventListener('keydown',handleKey);dialog.close();document.body.style.overflow=previousOverflow;previous?.focus?.();};
  },[data,onClose]);
  if(!data)return null;
  return createPortal(
    <dialog ref={dialogRef} className="bo-notices-dialog bo-productLinks-dialog" role="alertdialog" lang={language} aria-modal="true" aria-labelledby="product-links-title" aria-describedby="product-links-description"
      onCancel={event=>{event.preventDefault();onClose();}}>
      <div className="bo-notices-header">
        <div className="bo-notices-brand"><img src="/favicon.svg" alt=""/><span>VOLTA<small>{t('notices.tagline')}</small></span></div>
        <button className="bo-notices-close" type="button" onClick={onClose} aria-label={t('notices.close')}>×</button>
      </div>
      <div className="bo-notices-body">
        <div className="bo-notices-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m13 19 6-6M11 21l-2 2a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 0m2 12a5 5 0 0 0 7 0l6-6a5 5 0 0 0-7-7l-2 2"/></svg></div>
        <h2 id="product-links-title">{data.errorPhase ? errorText.title : text.title}</h2>
        <p className="bo-productLinks-name">{data.productName}</p>
        <p id="product-links-description">{data.errorPhase ? errorText[data.errorPhase] : text.lead}</p>
        {!data.errorPhase && <ul className="bo-notices-list bo-productLinks-list">{data.links.map(link=><li key={link.type}>
          <strong>{link.count} {(text.types[link.type] || [link.type,link.type])[link.count===1?0:1]}</strong>
          <span>{link.items.map(item=>item.name).join(' · ')}</span>
        </li>)}</ul>}
        {!data.errorPhase && <p className="bo-notices-detail">{text.help}</p>}
        <div className="bo-notices-actions"><button className="bo-notices-primary" type="button" ref={closeRef} onClick={onClose}>{text.close}</button></div>
      </div>
      <div className="bo-notices-footer">{t('notices.footer')}</div>
    </dialog>,document.body);
}
