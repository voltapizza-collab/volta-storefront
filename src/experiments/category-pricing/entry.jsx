// Isolated visual QA: real backoffice components, synthetic data, no network or real saves.
import React from 'react';
import { createRoot } from 'react-dom/client';
import PizzaCreator from '../../components/Backoffice/PizzaCreator';
import api from '../../setupAxios';
import './preview.css';
const categories = [
  { id: 1, name: 'Deep Dish Pizza', customizable: true, halfAndHalf: true, enabled: true, customBasePrices: {} },
  { id: 2, name: 'Pizza Básica', customizable: true, halfAndHalf: true, enabled: true, customBasePrices: {} },
  { id: 3, name: 'Bebidas', customizable: false, halfAndHalf: false, enabled: true, customBasePrices: {} },
];
const products = categories.flatMap(category => Array.from({length: category.id === 3 ? 2 : 4}, (_,i) => ({
  id: category.id * 10 + i, name: `${category.name} ${i+1}`, category: category.name, categoryId: category.id,
  status: 'ACTIVE', type: 'SELLABLE', ingredients: [], selectSize: category.id === 3 ? ['ST'] : ['M','L'], priceBySize: {M:14.99,L:18.99,ST:2},
})));
api.defaults.adapter = async config => {
  let data = [];
  if (config.method === 'patch') {
    const match = config.url.match(/^\/api\/partners\/1\/categories\/(\d+)$/);
    if (!match) throw new Error('Only sample base prices can be changed');
    const category = categories.find(row=>row.id === Number(match[1]));
    category.customBasePrices = JSON.parse(config.data).customBasePrices;
    data = {id: category.id, customBasePrices: category.customBasePrices};
  } else if (config.method !== 'get') throw new Error('Read-only sample catalog');
  else if (config.url.includes('/categories')) data = categories;
  else if (config.url.startsWith('/api/pizzas?')) data = products;
  return {data, status:200, statusText:'OK',headers:{},config};
};
createRoot(document.getElementById('root')).render(<><div className="pricing-preview-note">REVISIÓN LOCAL · Datos de muestra. Guardar no cambia precios del negocio.</div><div className="pricing-preview-body"><PizzaCreator partner={{partnerId:1,storeId:1,currency:'EUR'}} language="es" /></div></>);
