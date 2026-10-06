import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PosPrintStatus, { usePosPrinting } from './PosPrintStatus';
import { nativeCall } from './nativeBridge';

jest.mock('./nativeBridge', () => ({ nativeCall: jest.fn() }));
function Harness() {
  const [status, print] = usePosPrinting();
  return <><button onClick={() => print('print', { orderId: 772, lines: ['Ticket'] }, 'Impresión confirmada por SUNMI.')}>
    Imprimir</button><PosPrintStatus status={status} /><button>Ready</button></>;
}
beforeEach(() => jest.clearAllMocks());

test('confirmation stays in the ticket without a modal or focus change; a repeat print still reports its result', async () => {
  nativeCall.mockResolvedValue({});
  render(<Harness />);
  const print = screen.getByRole('button', { name: 'Imprimir' });
  print.focus();
  await act(async () => fireEvent.click(print));
  expect(screen.getByRole('status')).toHaveTextContent('Impresión confirmada por SUNMI.');
  expect(document.activeElement).toBe(print);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(async () => fireEvent.click(print));
  expect(nativeCall).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Ready' })).toBeEnabled();
});

test('two taps while waiting send one job and a failure warns before retrying', async () => {
  let fail;
  nativeCall.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
  render(<Harness />);
  const print = screen.getByRole('button', { name: 'Imprimir' });
  fireEvent.click(print);
  fireEvent.click(print);
  expect(nativeCall).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('Imprimiendo ticket');
  await act(async () => fail(new Error('printer unavailable')));
  expect(screen.getByRole('status')).toHaveTextContent('Comprueba papel y ticket antes de repetir');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  nativeCall.mockResolvedValue({});
  await act(async () => fireEvent.click(print));
  expect(screen.getByRole('status')).toHaveTextContent('Impresión confirmada por SUNMI.');
});
