import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PizzaCreator from './PizzaCreator';
import api from '../../setupAxios';
jest.mock('../../setupAxios',()=>({__esModule:true,default:{get:jest.fn(),delete:jest.fn()}}));
const links={productName:'Ravioli Frito',links:[{type:'TOP_DEAL',count:1,items:[{id:14,name:'Liquidación'}]},{type:'PROMO',count:1,items:[{id:3,name:'Menú para dos'}]}]};
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 jest.clearAllMocks();
 api.get.mockImplementation(async url=>({data:url.endsWith('/links')?links:url.startsWith('/api/pizzas?')?[{id:63,name:'Ravioli Frito',category:'Pizza',status:'ACTIVE',ingredients:[],priceBySize:{M:5}}]:url.includes('categories')?[{id:2,name:'Pizza'}]:[]}));
 jest.spyOn(window,'confirm').mockReturnValue(true);
});
afterEach(()=>jest.restoreAllMocks());
async function attemptDelete(){
 render(<PizzaCreator partner={{partnerId:1,storeId:1}}/>);
 const categories=await screen.findAllByRole('button',{name:/Pizza.*1 producto/});
 fireEvent.click(categories.find(element=>element.tagName==='BUTTON'));
 const deleteButton=await screen.findByRole('button',{name:'Eliminar',exact:true});
 await act(async()=>{ fireEvent.click(deleteButton); });
}
test('linked product shows its uses before confirmation and never sends DELETE',async()=>{
 await attemptDelete();
 await screen.findByRole('alertdialog');
 expect(screen.getByText('1 Top Deal')).toBeInTheDocument();expect(screen.getByText('1 Promo')).toBeInTheDocument();
 expect(window.confirm).not.toHaveBeenCalled();expect(api.delete).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Entendido'}));
 expect(screen.getByRole('button',{name:'Eliminar',exact:true})).toBeInTheDocument();
});
test('server recheck still blocks a link added after preview',async()=>{
 const get=api.get.getMockImplementation();api.get.mockImplementation(url=>url.endsWith('/links')?Promise.resolve({data:{links:[]}}):get(url));
 api.delete.mockRejectedValue({response:{data:{error:'product_linked',...links}}});
 await attemptDelete();await screen.findByRole('alertdialog');
 expect(api.delete).toHaveBeenCalledWith('/api/pizzas/63');
 expect(screen.getByText('Menú para dos')).toBeInTheDocument();
});
test('unlinked product can be deleted after confirmation',async()=>{
 const get=api.get.getMockImplementation();api.get.mockImplementation(url=>url.endsWith('/links')?Promise.resolve({data:{links:[]}}):get(url));
 api.delete.mockResolvedValue({data:{ok:true}});
 await attemptDelete();await waitFor(()=>expect(api.delete).toHaveBeenCalledWith('/api/pizzas/63'));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Eliminar',exact:true})).not.toBeInTheDocument());
});
test('failed link lookup uses the Volta dialog and does not send a delete request',async()=>{
 const get=api.get.getMockImplementation();api.get.mockImplementation(url=>url.endsWith('/links')?Promise.reject(new Error('Network unavailable')):get(url));
 jest.spyOn(console,'error').mockImplementation(()=>{});
 const alert=jest.spyOn(window,'alert').mockImplementation(()=>{});
 await attemptDelete();await screen.findByRole('alertdialog');
 expect(screen.getByText(/No pudimos comprobar las vinculaciones/)).toBeInTheDocument();
 expect(api.delete).not.toHaveBeenCalled();expect(alert).not.toHaveBeenCalled();
});
