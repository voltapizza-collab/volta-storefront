import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PosDayInfo from './PosDayInfo';
import { emptyDayInfo, loadDayInfo, nextHoliday } from './dayInfo';
jest.mock('./dayInfo', () => ({ ...jest.requireActual('./dayInfo'), loadDayInfo: jest.fn() }));
let info;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-28T12:00:00'));
  info = {...emptyDayInfo(), loading:false};
  loadDayInfo.mockReset().mockImplementation(async()=>info);
});
afterEach(()=>jest.useRealTimers());
const grid = () => screen.getByLabelText('Clima de tres días y próximo festivo');
const cardCount = () => {
  // Structural requirement: loading/error messages must never become extra cards.
  // eslint-disable-next-line testing-library/no-node-access
  return grid().childElementCount;
};
test('always renders exactly four cards while loading, offline and after refresh', async () => {
  let finish; loadDayInfo.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  render(<PosDayInfo />);
  expect(cardCount()).toBe(4);
  await act(async()=>finish(info));
  expect(cardCount()).toBe(4);
  expect(screen.getByText('Sin próximo festivo registrado')).toBeInTheDocument();
  await act(async()=>{jest.advanceTimersByTime(60000);});
  expect(cardCount()).toBe(4);
});
test('priority holiday reminder and discreet weather indicator remain in collapsed header; touch reveals impact', async () => {
  info.holiday = {date:'2026-10-31',dateLabel:'31 de octubre de 2026',name:'Festivo de prueba',scope:'Nacional · España',relative:'en 3 días',alert:true};
  info.days[1] = {...info.days[1],min:10,max:18,icon:'⛈️',condition:'Tormenta',alert:{title:'Tormentas',message:'Revisa cocina y repartidores.'}};
  render(<PosDayInfo />);
  expect(await screen.findByText('⚠ Festivo en 3 días')).toBeVisible();
  expect(screen.getByText('Festivo de prueba')).not.toBeVisible();
  expect(screen.getByText('31 de octubre de 2026')).not.toBeVisible();
  expect(screen.getByRole('img', {name: 'Previsión adversa · 1 día'})).toBeVisible();
  expect(grid()).not.toBeVisible();
  fireEvent.click(screen.getByText('Clima y próximos festivos:'));
  expect(screen.getByText('Festivo de prueba')).toBeVisible();
  expect(screen.getByText('31 de octubre de 2026')).toBeVisible();
  const button = screen.getByRole('button',{name:/Mañana: Tormentas/});
  expect(within(button).getByText('Mañana')).toBeVisible();
  expect(button).not.toHaveTextContent('Revisa');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded','true');
  expect(screen.getByText('Revisa cocina y repartidores.')).toBeVisible();
  expect(cardCount()).toBe(4);
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded','false');
  expect(screen.queryByText('Revisa cocina y repartidores.')).not.toBeInTheDocument();
});
test('ordinary weather and distant holidays create no alerts or weather actions', async () => {
  info.holiday = {date:'2026-11-01',name:'Todos los Santos',scope:'Nacional · España',alert:false};
  render(<PosDayInfo />); await screen.findByText('Todos los Santos');
  expect(screen.queryByText(/⚠ Festivo/)).not.toBeInTheDocument();
  expect(screen.queryByRole('img', {name: /Previsión adversa/})).not.toBeInTheDocument();
  expect(within(grid()).queryByRole('button',{hidden:true})).not.toBeInTheDocument();
});
test('local refresh starts the holiday alert over midnight and cleans timers on unmount', async () => {
  jest.setSystemTime(new Date('2026-10-27T23:59:30'));
  loadDayInfo.mockImplementation(async()=>({...emptyDayInfo(),loading:false,
    holiday:nextHoliday([{date:'2026-10-31',localName:'Festivo de prueba',global:true}],null)}));
  const {unmount}=render(<PosDayInfo />); await screen.findByText('Festivo de prueba');
  expect(screen.queryByText(/⚠ Festivo/)).not.toBeInTheDocument();
  await act(async()=>{jest.advanceTimersByTime(60000);});
  expect(screen.getByText(/Festivo en 3 días/)).toBeVisible();
  expect(cardCount()).toBe(4);
  expect(loadDayInfo).toHaveBeenCalledTimes(2);
  unmount(); await act(async()=>{jest.advanceTimersByTime(60000);});
  expect(loadDayInfo).toHaveBeenCalledTimes(2);
});
test('a location change ignores late responses for the previous store', async () => {
  let finish; loadDayInfo.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const {rerender}=render(<PosDayInfo city="Vigo" />);
  rerender(<PosDayInfo city="Madrid" zipCode="28001" />);
  await screen.findByText('Sin próximo festivo registrado');
  await act(async()=>finish({...info,holiday:{date:'2026-10-31',name:'Old store holiday',alert:true}}));
  expect(screen.queryByText(/Old store holiday/)).not.toBeInTheDocument();
});
