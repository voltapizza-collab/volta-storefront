import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClaimModal } from '../components/CouponGallery/CouponGallery';
import ChannelShiftQrPanel from '../components/Backoffice/Coupons/ChannelShiftQrPanel';
import CouponShortRedirect from './CouponShortRedirect';
import api from '../setupAxios';
import { useNavigate, useParams } from 'react-router-dom';

jest.mock('../setupAxios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: jest.fn(), useParams: jest.fn(), useLocation: jest.fn() }), { virtual: true });
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));
const navigate = jest.fn();
const campaign = { code: 'DELIVERY', partnerName: 'Mi pizzería', title: 'Envío gratis para tu próximo pedido', claimValidityDays: 30,
  available: true, termsVersion: 'qr-delivery-2026-10-v1', stores: [{ id: 1, name: 'Centro' }] };
const success = { expiresAt: '2026-11-08T12:00:00Z', recovered: false, delivery: { sent: true, sentNow: true, status: 'queued' } };
beforeEach(() => { jest.clearAllMocks(); useNavigate.mockReturnValue(navigate); useParams.mockReturnValue({ code: 'DELIVERY' }); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

function fillClaim() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '600123456' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Recibir mi envío gratis' }));
}
test('QR submission closes the modal, shows the SMS confirmation and has no resend or shopping action', async () => {
  api.get.mockResolvedValue({ data: { mode: 'claim', campaign } });
  api.post.mockResolvedValue({ data: success });
  render(<CouponShortRedirect />);
  await screen.findByRole('dialog');
  expect(screen.getByLabelText('Telefono')).toHaveAttribute('type', 'tel');
  expect(screen.queryByLabelText(/postal|dirección/i)).not.toBeInTheDocument();
  fillClaim();
  await screen.findByText('SMS en camino');
  expect(screen.queryByText(/Tu cupón está en el SMS/)).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/api/coupons/qr-claim/DELIVERY', { name: 'Ana', phone: '600123456', termsVersion: campaign.termsVersion });
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /reenviar|recibir|comprar/i })).not.toBeInTheDocument();
});
test.each([
  [{ sent: true, sentNow: false, status: 'delivered' }, true, 'Ya te enviamos tu envío gratis', /un solo beneficio por teléfono, aunque ya lo hayas gastado/],
  [{ sent: true, sentNow: false, status: 'queued' }, true, 'Tu envío gratis ya está solicitado', /sigue en proceso de entrega/],
  [{ sent: true, status: 'delivered' }, true, 'Ya te enviamos tu envío gratis', /No hemos enviado otro SMS/],
  [{ sent: false, sentNow: false, status: 'pending' }, true, 'Solicitud registrada', /Todavía no tenemos confirmación/],
  [{ sent: true, sentNow: true, status: 'delivered' }, false, 'Revisa tus mensajes', /confirmó la entrega de tu SMS/],
])('confirmation distinguishes the actual SMS outcome: %j', async (delivery, recovered, title, detail) => {
  api.get.mockResolvedValue({ data: { mode: 'claim', campaign } });
  api.post.mockResolvedValue({ data: { ...success, recovered, delivery } });
  render(<CouponShortRedirect />);
  await screen.findByRole('dialog');
  fillClaim();
  await screen.findByText(title);
  expect(screen.getByRole('status')).toHaveTextContent(detail);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /reenviar|recibir/i })).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});
test('failed SMS closes the request with an honest outcome and no resend action', async () => {
  api.get.mockResolvedValue({ data: { mode: 'claim', campaign } });
  api.post.mockResolvedValue({ data: { ...success, delivery: { sent: false, status: 'failed' } } });
  render(<CouponShortRedirect />);
  await screen.findByRole('dialog');
  fillClaim();
  await screen.findByText('No se pudo enviar el SMS');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText(/Contacta con la pizzería/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /reenviar|recibir/i })).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});
test('QR lookup opens claim mode while old coupons still redirect straight to the store', async () => {
  api.get.mockResolvedValueOnce({ data: { mode: 'claim', campaign } });
  const view = render(<CouponShortRedirect />);
  await screen.findByRole('dialog');
  expect(navigate).not.toHaveBeenCalled();
  view.unmount();
  api.get.mockResolvedValueOnce({ data: { redeemUrl: `${window.location.origin}/pizza/centro?coupon=OLD` } });
  render(<CouponShortRedirect />);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/pizza/centro?coupon=OLD', { replace: true }));
});
test('stopped QR does not offer another SMS', () => {
  render(<ClaimModal campaign={{ ...campaign, available: false }} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Campaña finalizada' })).toBeDisabled();
  expect(screen.getByText(/no admite nuevas solicitudes/)).toBeVisible();
});
test('backoffice adds delivery type and individual validity without removing fixed discounts', async () => {
  api.get.mockImplementation(async path => ({ data: path.includes('/stores?') ? [{ id: 1, storeName: 'Centro' }] : { items: [] } }));
  api.post.mockResolvedValue({ data: { coupon: {} } });
  render(<ChannelShiftQrPanel partnerId={1} />);
  await screen.findByLabelText('Tipo de token');
  expect(screen.getByLabelText('Descuento EUR')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Tipo de token'), { target: { value: 'DELIVERY_FREE' } });
  expect(screen.queryByLabelText('Descuento EUR')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Validez de cada cupón')).toHaveValue('30');
  fireEvent.change(screen.getByLabelText('Campana'), { target: { value: 'Reparto' } });
  fireEvent.change(screen.getByLabelText('Validez de cada cupón'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear token QR' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/coupons/channel-shift-qr', expect.objectContaining({ benefitType: 'DELIVERY_FREE', claimValidityDays: 20, storeIds: [1], expiresAt: '' })));
});

test('QR results distinguish visits, new customer records, existing customers and SMS', async () => {
  api.get.mockImplementation(async path => ({ data: path.includes('/stores?') ? [{ id: 1, storeName: 'Centro' }] : { items: [
    { id: 4, code: 'DELIVERY', benefitType: 'DELIVERY_FREE', qrViewCount: 12, claimStats: {
      newCustomers: 3, existingCustomers: 2, issued: 5, smsSent: 4, smsFailed: 1, redeemed: 1,
    } }, { id: 5, code: 'FIXED', benefitType: 'FIXED_AMOUNT', amount: 5, usedCount: 18 },
  ] } }));
  render(<ChannelShiftQrPanel partnerId={1} />);
  const row = (await screen.findByText('Escaneos / visitas')).closest('tr');
  expect(within(row).getByText('12')).toBeVisible();
  expect(within(row).getByText('Clientes nuevos en BD')).toBeVisible();
  expect(within(row).getByText('3')).toBeVisible();
  expect(within(row).getByText('Clientes ya existentes')).not.toBeVisible();
  fireEvent.click(within(row).getByText('Ver detalle'));
  expect(within(row).getByText('Clientes ya existentes')).toBeVisible();
  expect(within(row).getByText(/los clientes ya están guardados/)).toBeVisible();
  expect(screen.getByText('18 usos')).toBeVisible();
  expect(screen.queryByText(/portes bonificados/)).not.toBeInTheDocument();
});
