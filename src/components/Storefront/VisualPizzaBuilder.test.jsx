import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VisualPizzaBuilder from './VisualPizzaBuilder';

const catalog = Array.from({ length: 13 }, (_, index) => ({ id: index + 1, name: `Queso ${index + 1}`, category: 'QUESOS', costPrice: 1 }));
catalog.push({ id: 99, name: 'Salsa Tomate', category: 'SALSAS_CONDIMENTOS_BASES', costPrice: 2 });
function Builder() {
  const [ingredients, setIngredients] = useState({});
  return <VisualPizzaBuilder category={{ name: 'Pizza', selectSize: ['M'], priceBySize: { M: 8 } }} size="M" qty={1} catalog={catalog} ingredients={ingredients} loading={false} getUnitPrice={row => row.costPrice} onIngredientsChange={setIngredients} onSize={() => {}} onQty={() => {}} onQuick={() => {}} onChangeBase={() => {}} />;
}
test('families and pagination keep the workbench bounded; search crosses families and preserves the recipe', () => {
  render(<Builder />);
  expect(screen.queryByRole('button', { name: 'Elegir Queso 1', exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Quesos' }));
  expect(screen.getAllByRole('button', { name: /^Elegir Queso/ })).toHaveLength(6);
  fireEvent.click(screen.getByRole('button', { name: 'Más ingredientes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Más ingredientes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Elegir Queso 13' }));
  expect(screen.queryByRole('button', { name: 'Más ingredientes' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Derecha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Doble' }));
  fireEvent.click(screen.getByRole('button', { name: 'Poner en mi pizza · EUR 1.00' }));
  expect(screen.getAllByRole('button', { name: /^Abrir / })).toHaveLength(5);
  expect(screen.queryByRole('button', { name: 'Más ingredientes' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar ingrediente visual' }), { target: { value: 'tomáte' } });
  fireEvent.click(screen.getByRole('button', { name: 'Elegir Salsa Tomate' }));
  fireEvent.click(screen.getByRole('button', { name: 'Poner en mi pizza · EUR 2.00' }));
  expect(screen.getByRole('textbox', { name: 'Buscar ingrediente visual' })).toHaveValue('');
  expect(screen.getAllByRole('button', { name: /^Abrir / })).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: /Tu receta/ }));
  expect(screen.getByText('Derecha · Doble')).toBeVisible();
  expect(screen.getByText('Toda · Simple')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar Queso 13' }));
  expect(screen.queryByText('Derecha · Doble')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }));
  expect(screen.getByText('Derecha · Doble')).toBeVisible();
});

test('confirming a recipe edit returns to all families and preserves placement, quantity and undo', async () => {
  render(<Builder />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Quesos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Elegir Queso 1', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar controles' }));
  expect(screen.getByRole('button', { name: 'Elegir Queso 1', exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Elegir Queso 1', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Poner en mi pizza · EUR 1.00' }));
  fireEvent.click(screen.getByRole('button', { name: /Tu receta/ }));
  fireEvent.click(screen.getByRole('button', { name: /Queso 1 Toda · Simple/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Izquierda' }));
  fireEvent.click(screen.getByRole('button', { name: 'Doble' }));
  fireEvent.click(screen.getByRole('button', { name: 'Poner en mi pizza · EUR 1.00' }));
  expect(screen.getAllByRole('button', { name: /^Abrir / })).toHaveLength(5);
  expect(screen.getByRole('button', { name: /Tu receta/ })).toHaveAttribute('aria-pressed', 'false');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ver familias de ingredientes' })).toHaveFocus());
  fireEvent.click(screen.getByRole('button', { name: /Tu receta/ }));
  expect(screen.getByText('Izquierda · Doble')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }));
  expect(screen.getByText('Toda · Simple')).toBeVisible();
});
