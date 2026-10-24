import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FoodPackageSelector from '../FoodPackageSelector';
import FoodAssignment from './FoodAssignment';
import FoodPackagesModule from './FoodPackagesModule';
import api from '../../setupAxios';
jest.mock('../../setupAxios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const packages=[{id:1,name:'Pizza',categoryIds:[1,4],active:true,description:''},{id:2,name:'Hamburguesas',categoryIds:[2,4],active:true,description:''},{id:3,name:'Kebab',categoryIds:[3,4],active:true,description:''}];
const categories=[{id:1,name:'Artesanas',builderType:'PIZZA',customizable:true,halfAndHalf:true},{id:2,name:'Burgers',builderType:'NONE'},{id:3,name:'Kebabs',builderType:'NONE'},{id:4,name:'Bebidas',builderType:'NONE'}];
beforeEach(()=>{jest.clearAllMocks();api.get.mockImplementation(url=>Promise.resolve({data:url==='/api/food-packages'?packages:url==='/api/categories'?categories:{configuration:null,editable:true}}));});
test('multiple food selections are independent and locked forms cannot change them',()=>{
  const change=jest.fn();const view=render(<FoodPackageSelector packages={packages} value={[2]} onChange={change} />);
  fireEvent.click(screen.getByRole('checkbox',{name:'Kebab'}));expect(change).toHaveBeenCalledWith([2,3]);
  view.rerender(<FoodPackageSelector packages={packages} value={[2,3]} onChange={change} disabled />);
  expect(screen.getByRole('checkbox',{name:'Kebab'})).toBeDisabled();
});
test('business package edits require review and send the expected snapshot on apply',async()=>{
  const config={version:1,packages:[packages[1],packages[2]]};
  api.post.mockImplementation(url=>Promise.resolve({data:url.endsWith('/preview')?{configuration:config,enabled:categories.slice(1),disabled:[categories[0]]}:{configuration:config}}));
  render(<FoodAssignment partnerId={7} />);
  await screen.findByRole('checkbox',{name:'Hamburguesas'});
  fireEvent.click(screen.getByRole('checkbox',{name:'Hamburguesas'}));fireEvent.click(screen.getByRole('checkbox',{name:'Kebab'}));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Revisar cambio'}));
  await screen.findByText('Se desactivarán:');
  expect(api.post).toHaveBeenCalledWith('/api/food-packages/partners/7/preview',{packageIds:[2,3],expectedConfiguration:null});
  fireEvent.click(screen.getByRole('button',{name:'Aplicar paquetes'}));
  await screen.findByText('Paquetes guardados.');
  expect(api.post).toHaveBeenLastCalledWith('/api/food-packages/partners/7/apply',{packageIds:[2,3],expectedConfiguration:null,previewConfiguration:config});
});
test('failed assignment loading prevents saving an empty or invented configuration',async()=>{
  api.get.mockRejectedValue(Error('offline'));render(<FoodAssignment partnerId={7} />);
  await screen.findByText(/No se pudo cargar la configuración/);
  expect(screen.queryByRole('button',{name:'Revisar cambio'})).not.toBeInTheDocument();
});
test('global administrator creates a package using existing categories',async()=>{
  api.post.mockResolvedValue({data:{}});render(<FoodPackagesModule />);
  await waitFor(()=>expect(screen.getByRole('button',{name:'+ Crear paquete'})).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Burger y kebab'}});
  fireEvent.click(screen.getByLabelText('Burgers'));fireEvent.click(screen.getByLabelText('Kebabs'));fireEvent.click(screen.getByLabelText('Bebidas'));
  fireEvent.click(screen.getByLabelText('Disponible para nuevas altas'));
  fireEvent.click(screen.getByRole('button',{name:'Guardar paquete'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/api/food-packages',expect.objectContaining({name:'Burger y kebab',categoryIds:[2,3,4],active:true})));
});
