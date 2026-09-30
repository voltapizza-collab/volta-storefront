import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StorePage from './StorePage';
import api from '../services/api';
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn()}}));
jest.mock('../utils/seo',()=>({buildStorefrontSeo:()=>({}),usePublicSeo:()=>{}}));
const mockNavigate=jest.fn();
jest.mock('react-router-dom',()=>{
 const location={pathname:'/test/centro/menu',search:'',state:null};
 return {useParams:()=>({partnerSlug:'test',storeSlug:'centro'}),useLocation:()=>location,useNavigate:()=>mockNavigate,Link:({children,to})=><a href={to}>{children}</a>};
},{virtual:true});
const deal={id:8,isClearance:true,remainingQuantity:10,kind:'FIXED_PRICE',value:5};
const liquidated={cartLineId:'clearance',pizzaId:1,name:'Pizza liquidación',category:'Pizzas',size:'M',qty:1,price:5,subtotal:5,directDiscount:deal};
const regular={cartLineId:'normal',pizzaId:2,name:'Pizza normal',category:'Pizzas',size:'M',qty:1,price:3,subtotal:3};
let menu, partner;
const calls=()=>api.post.mock.calls.filter(([path])=>path==='/api/checkout/session');
function setupCart(serviceMode='pickup',items=[liquidated,regular]) {
 sessionStorage.setItem('volta_storefront_delivery_selection',JSON.stringify({partnerSlug:'test',storeSlug:'centro',serviceMode,...(serviceMode==='delivery'?{deliveryAddress:'Calle ejemplo 1',deliveryResolution:{deliveryFee:2.5}}:{})}));
 localStorage.setItem('volta-repeat-cart-draft:test:centro',JSON.stringify({items}));
}
beforeEach(()=>{
 jest.clearAllMocks();localStorage.clear();sessionStorage.clear();window.scrollTo=jest.fn();Element.prototype.scrollTo=jest.fn();
 partner={id:1,slug:'test',name:'Test',currency:'EUR',minimumPaymentAmount:9.99,deliveryPricingMode:'FIXED',deliveryFeeFixed:2.5,deliveryFeeBlockSize:5};
 menu=[{...liquidated,selectSize:['M'],priceBySize:{M:5}},{...regular,selectSize:['M'],priceBySize:{M:3}}];
 localStorage.setItem('volta-checkout-customer:test',JSON.stringify({name:'Test',phone:'612345678'}));
 api.get.mockImplementation(async path=>{
  if(path.includes('/availability/'))return {acceptingOrders:true,serviceOpen:true,days:[],paymentMethods:['card']};
  if(path==='/partners/test')return partner;
  if(path.endsWith('/menu'))return {store:{id:1,partnerId:1,storeName:'Centro',deliveryEnabled:true,pickupEnabled:true},menu};
  return {};
 });
 api.post.mockResolvedValue({});
 jest.spyOn(console,'error').mockImplementation(()=>{});jest.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>jest.restoreAllMocks());
async function openCart(){render(<StorePage/>);fireEvent.click((await screen.findAllByRole('button',{name:'Abrir carrito'}))[0]);}
test('mixed pickup below minimum reaches checkout with the clearance price intact',async()=>{
 setupCart();await openCart();
 await screen.findByText('Tu pedido incluye liquidación: recogida sin pedido mínimo.');
 fireEvent.click(screen.getByRole('button',{name:'Pagar ahora'}));
 await waitFor(()=>expect(calls()).toHaveLength(1));
 expect(calls()[0][1].total).toBe(8);
 expect(calls()[0][1].delivery.method).toBe('PICKUP');
});
test('delivery below minimum offers both actions and cannot submit payment',async()=>{
 setupCart('delivery');await openCart();
 await screen.findByText(/Faltan.*1,99/);
 expect(screen.getByRole('button',{name:'Pagar ahora'})).toBeDisabled();
 expect(screen.getAllByRole('button',{name:'Seguir comprando'})[0]).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Cambiar a recogida'}));
 expect(mockNavigate).toHaveBeenCalledWith('/test/order',expect.objectContaining({state:expect.objectContaining({startServiceMode:'pickup'})}));
 expect(calls()).toHaveLength(0);
});
test('without clearance the ordinary pickup minimum returns',async()=>{
 setupCart('pickup',[regular]);await openCart();
 await screen.findByText(/Faltan.*6,99/);
 expect(screen.getByRole('button',{name:'Pagar ahora'})).toBeDisabled();
 expect(screen.queryByText('Tu pedido incluye liquidación: recogida sin pedido mínimo.')).not.toBeInTheDocument();
});
test('six physical pizzas send two delivery blocks to checkout',async()=>{
 setupCart('delivery',[{...regular,qty:5,subtotal:15},liquidated]);await openCart();
 fireEvent.click(await screen.findByRole('button',{name:'Pagar ahora'}));
 await waitFor(()=>expect(calls()).toHaveLength(1));
 expect(calls()[0][1].delivery.deliveryFee).toBe(5);
 expect(calls()[0][1].total).toBe(25);
});
test('a corrected delivery block size is retained on the next payment attempt',async()=>{
 setupCart('delivery',[{...regular,qty:5,subtotal:15},liquidated]);
 let attempts=0;
 api.post.mockImplementation(async path=>{
  if(path==='/api/checkout/session' && ++attempts===1)throw {response:{data:{error:'delivery_price_changed',deliveryQuote:{baseFee:2.5,deliveryFee:7.5,deliveryBlocks:3,deliveryFeeBlockSize:2}}}};
  return {};
 });
 await openCart();fireEvent.click(await screen.findByRole('button',{name:'Pagar ahora'}));
 await screen.findByText(/Hemos actualizado el coste del reparto/);
 fireEvent.click(screen.getByRole('button',{name:'Pagar ahora'}));
 await waitFor(()=>expect(calls()).toHaveLength(2));
 expect(calls()[1][1].delivery.deliveryFee).toBe(7.5);
});
