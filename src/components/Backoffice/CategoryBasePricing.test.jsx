import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PizzaCreator from './PizzaCreator';
import api from '../../setupAxios';
jest.mock('../../setupAxios',()=>({__esModule:true,default:{get:jest.fn(),patch:jest.fn()}}));
const categories=[{id:3,name:'Pizza Básica',customizable:true,halfAndHalf:true,customBasePrices:{M:8}},{id:4,name:'Bebidas',customizable:false,halfAndHalf:false}];
beforeEach(()=>{
  jest.clearAllMocks();
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  api.get.mockImplementation(async url=>({data:url.includes('categories')?categories:url.startsWith('/api/pizzas?')?[
    {id:1,name:'Oferta',category:'Pizza Básica',status:'ACTIVE',ingredients:[],selectSize:['M','L'],priceBySize:{M:4.94,L:6}},
    {id:2,name:'Agua',category:'Bebidas',status:'ACTIVE',ingredients:[],selectSize:['ST'],priceBySize:{ST:2}},
  ]:[]}));
  api.patch.mockImplementation(async (_url,body)=>({data:{id:3,...body}}));
});
async function open(){
  render(<PizzaCreator partner={{partnerId:7,storeId:1}} language="es" />);
  fireEvent.click(await screen.findByRole('button',{name:'Configurar precio de la base: Pizza Básica'}));
  return screen.getByRole('dialog',{name:'Precio de la base para armar tu pizza'});
}
test('category icons follow global flags; price dialog saves configured sizes without opening product list',async()=>{
  const dialog=within(await open());
  expect(screen.getByRole('img',{name:'Disponible para mitad y mitad'})).toBeVisible();
  expect(screen.queryByRole('button',{name:'Configurar precio de la base: Bebidas'})).not.toBeInTheDocument();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(dialog.getByLabelText('Precio de la base M')).toHaveValue('8');
  expect(dialog.getByLabelText('Precio de la base L')).toHaveValue('');
  fireEvent.change(dialog.getByLabelText('Precio de la base M'),{target:{value:'8,25'}});
  fireEvent.change(dialog.getByLabelText('Precio de la base L'),{target:{value:'10.50'}});
  fireEvent.click(dialog.getByRole('button',{name:'Guardar precios'}));
  await waitFor(()=>expect(api.patch).toHaveBeenCalledWith('/api/partners/7/categories/3',{customBasePrices:{M:8.25,L:10.5}}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Configurar precio de la base: Pizza Básica'}));
  expect(screen.getByLabelText('Precio de la base M')).toHaveValue('8.25');
  expect(screen.getByLabelText('Precio de la base L')).toHaveValue('10.5');
});
test('invalid price never saves; server failure retains the entered draft',async()=>{
  const dialog=within(await open());
  fireEvent.change(dialog.getByLabelText('Precio de la base M'),{target:{value:'-3'}});
  fireEvent.click(dialog.getByRole('button',{name:'Guardar precios'}));
  expect(api.patch).not.toHaveBeenCalled();
  expect(dialog.getByRole('alert')).toHaveTextContent('mayores que 0');
  api.patch.mockRejectedValue(new Error('offline'));
  fireEvent.change(dialog.getByLabelText('Precio de la base M'),{target:{value:'9'}});
  fireEvent.click(dialog.getByRole('button',{name:'Guardar precios'}));
  await waitFor(()=>expect(dialog.getByRole('alert')).toHaveTextContent('No se pudieron guardar'));
  expect(dialog.getByLabelText('Precio de la base M')).toHaveValue('9');
});
