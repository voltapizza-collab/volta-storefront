import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PosUpdates from './PosUpdates';
import { nativeCall } from './nativeBridge';
jest.mock('./nativeBridge', () => ({ nativeCall: jest.fn() }));

const sha = 'a'.repeat(64);
const base = () => ({ configured:true, versionName:'0.3.13-https', state:'pending', available:true,
  target:{sha256:sha, versionName:'0.3.14-https', title:'Actualizaciones bajo tu control', releaseNotes:'Primera mejora\nSegunda mejora'},
  decision:'pending', scheduledAt:0, authorizedUntil:0, canInstall:true });
let current;
beforeEach(() => {
  current = base();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open',''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  nativeCall.mockReset();
  nativeCall.mockImplementation(async (op, payload) => {
    if (op === 'updateDecision') current = {...current, decision:payload.decision, state:payload.decision === 'scheduled' ? 'scheduled' : payload.decision === 'now' ? 'waiting_safe' : 'pending',
      scheduledAt:payload.scheduledAt || 0, authorizedUntil:payload.decision === 'scheduled' ? payload.scheduledAt+3600000 : Date.now()+900000};
    return current;
  });
});
test('persistent notice does not open or authorize an update on arrival', async () => {
  const onOpen=jest.fn(); render(<PosUpdates open={false} onOpen={onOpen} onClose={()=>{}} />);
  expect(await screen.findByText('Tienes una actualización pendiente')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Ver detalles')); expect(onOpen).toHaveBeenCalled();
  expect(nativeCall.mock.calls.every(([op]) => op === 'updateStatus')).toBe(true);
});
test('details are plain text and update now authorizes the exact APK', async () => {
  current.target.releaseNotes = '<script>bad()</script>\nUna mejora';
  const close=jest.fn(); render(<PosUpdates open onOpen={()=>{}} onClose={close} />);
  expect(await screen.findByText(/<script>bad/)).toBeVisible();
  expect(document.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByText('Actualizar ahora'));
  await waitFor(()=>expect(nativeCall).toHaveBeenCalledWith('updateDecision',{sha256:sha,decision:'now'}));
  await waitFor(()=>expect(close).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Actualización autorizada')).toBeVisible();
  expect(screen.getByRole('button',{name:'Solicitud aceptada'})).toBeDisabled();
  expect(screen.getByText(/La tienda seguirá abierta/)).toBeVisible();
});
test('declining offers scheduling or keeping pending without granting consent', async () => {
  const close=jest.fn(); render(<PosUpdates open onOpen={()=>{}} onClose={close} />);
  fireEvent.click(await screen.findByText('Ahora no'));
  expect(screen.getByText('¿Quieres programar la actualización?')).toBeVisible();
  expect(nativeCall.mock.calls.some(([op])=>op==='updateDecision')).toBe(false);
  fireEvent.click(screen.getByText('Dejar pendiente'));
  await waitFor(()=>expect(nativeCall).toHaveBeenCalledWith('updateDecision',{sha256:sha,decision:'pending'}));
  await waitFor(()=>expect(close).toHaveBeenCalled());
});
test('scheduling validates local date, persists epoch time and can be cancelled', async () => {
  const close=jest.fn(); render(<PosUpdates open onOpen={()=>{}} onClose={close} />);
  fireEvent.click(await screen.findByText('Ahora no')); fireEvent.click(screen.getByText('Programar fecha y hora'));
  fireEvent.change(screen.getByLabelText('Fecha y hora del terminal'),{target:{value:'2000-01-01T12:00'}});
  fireEvent.click(screen.getByText('Guardar programación'));
  expect(screen.getByRole('alert')).toHaveTextContent('fecha futura');
  expect(close).not.toHaveBeenCalled();
  const future=new Date(Date.now()+86400000); future.setSeconds(0,0);
  const local=new Date(future.getTime()-future.getTimezoneOffset()*60000).toISOString().slice(0,16);
  fireEvent.change(screen.getByLabelText('Fecha y hora del terminal'),{target:{value:local}});
  fireEvent.click(screen.getByText('Guardar programación'));
  await waitFor(()=>expect(nativeCall).toHaveBeenCalledWith('updateDecision',{sha256:sha,decision:'scheduled',scheduledAt:future.getTime()}));
  await waitFor(()=>expect(close).toHaveBeenCalledTimes(1));
  fireEvent.click(await screen.findByText('Cambiar o cancelar programación'));
  await waitFor(()=>expect(nativeCall).toHaveBeenCalledWith('updateDecision',{sha256:sha,decision:'pending'}));
});
test('new version resets an open schedule form instead of authorizing unseen changes', async () => {
  jest.useFakeTimers();
  try {
    render(<PosUpdates open onOpen={()=>{}} onClose={()=>{}} />);
    await act(async()=>{});
    fireEvent.click(screen.getByText('Ahora no')); fireEvent.click(screen.getByText('Programar fecha y hora'));
    current={...current,target:{...current.target,sha256:'b'.repeat(64),title:'Otra versión'}};
    await act(async()=>{jest.advanceTimersByTime(10000);});
    expect(screen.getByText('Otra versión')).toBeVisible();
    expect(screen.queryByText('Guardar programación')).not.toBeInTheDocument();
    expect(nativeCall.mock.calls.some(([op])=>op==='updateDecision')).toBe(false);
  } finally { jest.useRealTimers(); }
});
test('failed decision is not shown as approved', async () => {
  nativeCall.mockImplementation(async op=>{if(op==='updateDecision')throw new Error('update_target_changed');return current;});
  const close=jest.fn(); render(<PosUpdates open onOpen={()=>{}} onClose={close} />);
  fireEvent.click(await screen.findByText('Actualizar ahora'));
  expect(await screen.findByRole('alert')).toHaveTextContent('versión disponible ha cambiado');
  expect(screen.queryByText(/Has autorizado/)).not.toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
});

test('daily reminder opens once after the native persistent claim, without authorizing installation', async () => {
  current.reminderDue=true;
  nativeCall.mockImplementation(async op => op === 'updateNoticeSeen' ? {claimed:true} : current);
  const onOpen=jest.fn(); render(<PosUpdates open={false} onOpen={onOpen} onClose={()=>{}} />);
  await waitFor(()=>expect(onOpen).toHaveBeenCalledTimes(1));
  expect(nativeCall).toHaveBeenCalledWith('updateNoticeSeen',{sha256:sha});
  expect(nativeCall.mock.calls.some(([op])=>op==='updateDecision')).toBe(false);
});

test('a reminder already claimed on the terminal does not open again', async () => {
  current.reminderDue=true;
  nativeCall.mockImplementation(async op => op === 'updateNoticeSeen' ? {claimed:false} : current);
  const onOpen=jest.fn(); render(<PosUpdates open={false} onOpen={onOpen} onClose={()=>{}} />);
  await waitFor(()=>expect(nativeCall).toHaveBeenCalledWith('updateNoticeSeen',{sha256:sha}));
  expect(onOpen).not.toHaveBeenCalled();
});

test('daily reminder waits while another operation dialog is open', async () => {
  current.reminderDue=true;
  const other=document.createElement('dialog'); other.setAttribute('open',''); document.body.appendChild(other);
  const onOpen=jest.fn();
  try {
    render(<PosUpdates open={false} onOpen={onOpen} onClose={()=>{}} />);
    await screen.findByText('Tienes una actualización pendiente');
    expect(nativeCall.mock.calls.some(([op])=>op==='updateNoticeSeen')).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  } finally { other.remove(); }
});
