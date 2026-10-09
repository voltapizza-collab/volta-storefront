import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import LandingPage from './LandingPage';
import api from '../setupAxios';
jest.mock('../setupAxios', () => ({ __esModule: true, default: { post: jest.fn() } }));
// CRA's SVG test transformer emits legacy React elements; use the installed runtime.
jest.mock('../assets/logo/pizza.svg', () => ({
  ReactComponent: (props) => require('react').createElement('svg', props),
}));

beforeEach(() => jest.clearAllMocks());
const fill = () => {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Pizzería'), { target: { value: 'Pizza Test' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ana@example.invalid' } });
};

test('hero preserves the approved copy and destinations with one set of pillars and real product images', () => {
  const { container } = render(<LandingPage />);
  const hero = within(container.querySelector('.vp-hero'));
  expect(hero.getByRole('heading', { level: 1 })).toHaveTextContent(/^VOLTA PIZZA$/);
  expect(hero.getByText('El motor para vender pizzas por Internet.')).toBeVisible();
  const promise = hero.getByRole('heading', { level: 2 });
  expect(promise).toHaveTextContent(/^Aumenta las ventas directas de tu pizzería\.$/);
  expect(promise.querySelector('span')).toHaveTextContent(/^ventas directas$/);
  expect(hero.getByText(/Combinamos migración de clientes/)).toHaveTextContent('Combinamos migración de clientes, tecnología de venta e inteligencia comercial para atraer compradores de los marketplaces a tu canal directo y fomentar la repetición de compra.');
  expect(hero.getByRole('link', { name: 'Ver sistema' })).toHaveAttribute('href', '#sistema');
  expect(hero.getByRole('link', { name: 'Solicitar una demostración' })).toHaveAttribute('href', '#contacto');
  for (const name of ['Migración de clientes', 'Tecnología de venta', 'Inteligencia comercial']) expect(hero.getAllByText(name)).toHaveLength(1);
  expect(hero.getAllByRole('img')).toHaveLength(2);
  expect(hero.getByRole('img', { name: /Backoffice de Volta/ })).toHaveAttribute('width', '1280');
  expect(hero.getByRole('img', { name: /Storefront de MyCrushPizza/ })).toHaveAttribute('height', '789');
});
test('landing identifies the brand, labels the demo and sends only a demo inquiry', async () => {
  api.post.mockResolvedValue({ data: { ok: true } });
  render(<LandingPage />);
  expect(document.title).toBe('Volta Pizza — El motor para vender pizzas por Internet');
  expect(screen.getAllByText('El motor para vender pizzas por Internet.')).toHaveLength(1);
  expect(screen.queryByText(/más del 90|mas del 90/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Explorar la demo' })[0]).toHaveAttribute('href', expect.stringContaining('demo=1'));
  expect(screen.getByRole('option', { name: 'English — próximamente' })).toBeDisabled();
  expect(screen.queryByRole('link', { name: 'Instagram' })).not.toBeInTheDocument();
  fill(); fireEvent.click(screen.getByRole('button', { name: 'Solicitar demostración' }));
  await screen.findByText(/Solicitud de demostración recibida/);
  expect(api.post).toHaveBeenCalledWith('/api/onboarding/demo-requests', expect.objectContaining({ name: 'Ana', business: 'Pizza Test' }));
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('');
  expect(screen.queryByText(/fase 2/i)).not.toBeInTheDocument();
});
test('failed demo request preserves contact details for retry', async () => {
  api.post.mockRejectedValue(new Error('offline'));
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<LandingPage />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Solicitar demostración' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No pudimos enviar'));
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('ana@example.invalid');
  } finally { error.mockRestore(); }
});


test('incorporation presents the requested local offer and keeps the interactive demo destination', () => {
  const { container } = render(<LandingPage />);
  const section = within(container.querySelector('#como-empezar'));
  const cards = section.getAllByRole('article');
  expect(cards).toHaveLength(3);
  expect(cards[0]).toHaveTextContent('Pago únicoDesde 250 €Equipo en propiedad.');
  expect(cards[1]).toHaveTextContent('Pago fraccionado6 cuotasDesde 46 €/mesSin intereses.');
  expect(cards[2]).toHaveTextContent('Renting tecnológicoDesde 20 €/mes12 cuotas.');
  expect(section.getByText('Consulta las condiciones completas con nuestro equipo.')).toBeVisible();
  expect(section.queryByText(/incluye equipo y software|a consultar/i)).not.toBeInTheDocument();
  expect(section.getByRole('link', { name: 'Explorar la demo' })).toHaveAttribute('href', expect.stringContaining('demo=1'));
  expect(section.getByText('Ejemplo ilustrativo')).toBeVisible();
});

test('large English footer preserves language, contact and navigation destinations', () => {
  const { container } = render(<LandingPage />);
  const footer = within(container.querySelector('footer'));
  expect(container.querySelector('.vp-footerBottom')).toHaveTextContent(/^THE PIZZA SALE ENGINE$/);
  expect(footer.getByLabelText('Idioma')).toHaveValue('es');
  const destinations = { Email: 'mailto:contacto@voltapizza.com', Demo: '#contacto', 'Solicitar llamada': '#contacto', Storefront: '#sistema', Backoffice: '#sistema', 'Pizza Creator': '#sistema', 'CRM & Promos': '#sistema', 'Pedidos online': '#sistema', Reservas: '#sistema', Cupones: '#sistema', 'Demo comercial': '#contacto', 'Ventajas comerciales': '#venta-directa', 'Cómo empezar': '#como-empezar', 'Condiciones comerciales': '#condiciones' };
  for (const [name, href] of Object.entries(destinations)) expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
});
