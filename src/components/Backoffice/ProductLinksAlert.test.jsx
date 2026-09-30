import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductLinksAlert from './ProductLinksAlert';
const data={productName:'Ravioli Frito',links:[{type:'TOP_DEAL',count:1,items:[{id:1,name:'Últimas unidades'}]},{type:'PROMO',count:2,items:[{id:2,name:'Combo del día'},{id:3,name:'Cena doble'}]}]};
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
test('linked product alert lists vertical counts and names without a delete action',()=>{
  const onClose=jest.fn();render(<ProductLinksAlert data={data} onClose={onClose}/>);
  expect(screen.getByRole('alertdialog')).toHaveAccessibleName('No se puede eliminar');
  expect(screen.getByText('Este producto está vinculado con:')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('1 Top Deal')).toBeInTheDocument();expect(screen.getByText('2 Promos')).toBeInTheDocument();
  expect(screen.getByText('Combo del día · Cena doble')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Entendido'})).toHaveFocus();
  expect(screen.queryByRole('button',{name:/eliminar/i})).not.toBeInTheDocument();
  fireEvent(screen.getByRole('alertdialog'),new Event('cancel',{cancelable:true}));expect(onClose).toHaveBeenCalledTimes(1);
});
test.each([['en','This product is linked to:'],['it','Questo prodotto è collegato a:'],['fr','Ce produit est lié à :'],['pt','Este produto está associado a:']])('supports backoffice language %s',(language,lead)=>{
 render(<ProductLinksAlert data={data} onClose={()=>{}} language={language}/>);
 expect(screen.getByText(lead)).toBeInTheDocument();
});
