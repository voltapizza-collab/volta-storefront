import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StorePage from './StorePage';
import api from '../services/api';
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn()}}));
jest.mock('../utils/seo',()=>({buildStorefrontSeo:()=>({}),usePublicSeo:()=>{}}));
jest.mock('react-router-dom',()=>{
 const location={pathname:'/test/centro/menu',search:'',state:null};
 return {useParams:()=>({partnerSlug:'test',storeSlug:'centro'}),useLocation:()=>location,useNavigate:()=>jest.fn(),Link:({children,to})=><a href={to}>{children}</a>};
},{virtual:true});
const calls=()=>api.post.mock.calls.filter(([path])=>path==='/api/checkout/session');
beforeEach(()=>{
 jest.clearAllMocks();localStorage.clear();sessionStorage.clear();window.scrollTo=jest.fn();Element.prototype.scrollTo=jest.fn();
 sessionStorage.setItem('volta_storefront_delivery_selection',JSON.stringify({partnerSlug:'test',storeSlug:'centro',serviceMode:'delivery',deliveryAddress:'Calle de prueba 1',deliveryResolution:{deliveryFee:3,coords:{lat:40,lng:-3}}}));
 localStorage.setItem('volta-checkout-customer:test',JSON.stringify({name:'Test',phone:'612345678'}));
 localStorage.setItem('volta-repeat-cart-draft:test:centro',JSON.stringify({items:[{cartLineId:'saved',pizzaId:1,name:'Pizza',size:'M',qty:1,price:10,subtotal:10}]}));
 api.get.mockImplementation(async path=>{
  if(path.includes('/availability/'))return {acceptingOrders:true,serviceOpen:true,days:[],paymentMethods:['card']};
  if(path==='/partners/test')return {id:1,slug:'test',name:'Test',currency:'EUR',deliveryPricingMode:'VARIABLE',deliveryFeeBase:3};
  if(path.endsWith('/menu'))return {store:{id:1,partnerId:1,storeName:'Centro',deliveryEnabled:true},menu:[]};
  return {};
 });
 jest.spyOn(console,'error').mockImplementation(()=>{});jest.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>jest.restoreAllMocks());
test.each([false,true])('delivery correction preserves the cart and requires another click, manual=%s',async manual=>{
 let submitted=0;
 api.post.mockImplementation(async path=>{
  if(path!=='/api/checkout/session')return {};
  if(++submitted===1)throw {response:{data:{error:'delivery_price_changed',deliveryQuote:{deliveryFee:manual?3:6.75,manualReviewRequired:manual,source:manual?'MANUAL_FALLBACK':'DRIVING_ROUTE'}}}};
  return {};
 });
 render(<StorePage/>);
 fireEvent.click((await screen.findAllByRole('button',{name:'Abrir carrito'}))[0]);
 fireEvent.click(await screen.findByRole('button',{name:'Pagar ahora'}));
 await screen.findByText(manual?/No pudimos validar la ruta/:/Hemos actualizado el coste del reparto/);
 expect(calls()).toHaveLength(1);
 expect(JSON.parse(localStorage.getItem('volta-repeat-cart-draft:test:centro')).items).toHaveLength(1);
 if(manual)expect(screen.getByText(/Reparto pendiente de confirmación por la tienda/)).toHaveAttribute('role','status');
 fireEvent.click(screen.getByRole('button',{name:'Pagar ahora'}));
 await waitFor(()=>expect(calls()).toHaveLength(2));
 expect(calls()[1][1].delivery.deliveryFee).toBe(manual?3:6.75);
 expect(calls()[1][1].delivery.manualReviewAccepted).toBe(manual);
 expect(calls()[1][1].total).toBe(manual?13:16.75);
});
test('outside coverage keeps the cart and offers the address selection screen',async()=>{
 api.post.mockImplementation(async path=>{if(path==='/api/checkout/session')throw {response:{data:{error:'delivery_outside_area'}}};return {}});
 render(<StorePage/>);
 fireEvent.click((await screen.findAllByRole('button',{name:'Abrir carrito'}))[0]);
 fireEvent.click(await screen.findByRole('button',{name:'Pagar ahora'}));
 await screen.findByText(/La dirección está fuera del área de reparto/);
 expect(screen.getByRole('link',{name:'Revisar dirección de entrega'})).toHaveAttribute('href','/test/order');
 expect(calls()).toHaveLength(1);
 expect(JSON.parse(localStorage.getItem('volta-repeat-cart-draft:test:centro')).items).toHaveLength(1);
});
