import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DirectDiscountsPanel from './DirectDiscountsPanel';
import api from '../../../setupAxios';
jest.mock('../../../setupAxios',()=>({__esModule:true,default:{get:jest.fn(),put:jest.fn(),post:jest.fn()}}));
const deal={id:8,title:'Últimas pizzas',isClearance:true,discountType:'FIXED_AMOUNT',value:5,targetType:'PRODUCT',productIds:[1],storeIds:[3],status:'ACTIVE',usageLimit:5};
beforeEach(()=>{
 jest.clearAllMocks();
 api.get.mockImplementation(async path=>({data:path.includes('/pizzas')?[{id:1,name:'Pizza',category:'Pizzas'}]:path.includes('/stores')?[{id:3,storeName:'Centro'}]:{discounts:[deal]}}));
 api.put.mockResolvedValue({data:{ok:true}});
});
test('editing an existing clearance keeps the checkbox and persisted flag',async()=>{
 render(<DirectDiscountsPanel partnerId={1}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Editar'}));
 expect(screen.getByRole('checkbox',{name:'Producto en liquidación'})).toBeChecked();
 fireEvent.submit(screen.getByRole('checkbox',{name:'Producto en liquidación'}).closest('form'));
 await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/api/direct-discounts/8',expect.objectContaining({isClearance:true})));
});
test('clearance can be explicitly disabled when editing',async()=>{
 render(<DirectDiscountsPanel partnerId={1}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Editar'}));
 const checkbox=screen.getByRole('checkbox',{name:'Producto en liquidación'});
 fireEvent.click(checkbox);fireEvent.submit(checkbox.closest('form'));
 await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/api/direct-discounts/8',expect.objectContaining({isClearance:false})));
});
test('daily quantity edits preserve the clearance flag',async()=>{
 render(<DirectDiscountsPanel partnerId={1}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Configurar hoy'}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar hoy'}));
 await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/api/direct-discounts/8',expect.objectContaining({isClearance:true})));
});
test('saving explains removal of deleted products while keeping the clearance choice',async()=>{
 api.put.mockResolvedValue({data:{ok:true,removedProductIds:[64]}});
 render(<DirectDiscountsPanel partnerId={1}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Editar'}));
 fireEvent.submit(screen.getByRole('checkbox',{name:'Producto en liquidación'}).closest('form'));
 await screen.findByText('Top Deal actualizado. Se han retirado las referencias a productos que ya no existen.');
 expect(api.put).toHaveBeenCalledWith('/api/direct-discounts/8',expect.objectContaining({isClearance:true}));
});
test('an invalid product response is readable and retains unsaved edits',async()=>{
 api.put.mockRejectedValue({response:{data:{error:'bad_product_ids'}}});
 const silence=jest.spyOn(console,'error').mockImplementation(()=>{});
 try{
  render(<DirectDiscountsPanel partnerId={1}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Editar'}));
  fireEvent.submit(screen.getByRole('checkbox',{name:'Producto en liquidación'}).closest('form'));
  await screen.findByText('Algún producto seleccionado ya no está disponible para este negocio. Revisa la selección y vuelve a guardar.');
  expect(screen.getByRole('checkbox',{name:'Producto en liquidación'})).toBeChecked();
 }finally{silence.mockRestore();}
});

test.each([
 ['daily', {usageLimitScope:'DAILY',todayUsageLimit:5,usedCount:1,remainingQuantity:4}, '4 / 1'],
 ['exhausted', {usageLimit:5,usedCount:5,remainingQuantity:0}, '0 / 5'],
 ['unlimited', {usageLimit:null,usedCount:3}, '∞ / 3'],
])('published quantities preserve %s availability and usage',async(_name,usage,expected)=>{
 const originalGet=api.get.getMockImplementation();
 api.get.mockImplementation(path=>path.includes('/direct-discounts')
  ? Promise.resolve({data:{discounts:[{...deal,...usage}]}}) : originalGet(path));
 render(<DirectDiscountsPanel partnerId={1}/>);
 const row=(await screen.findByText('Últimas pizzas')).closest('tr');
 const cells=within(row).getAllByRole('cell');
 expect(cells[2]).toHaveTextContent(expected);
 expect(cells[3]).toHaveTextContent(/^1$/);
 expect(cells[4]).toHaveTextContent(/^1$/);
});
