let info;
const holiday = (date, name = 'Festivo de prueba', counties = null) => ({ date, localName: name, counties });
beforeEach(() => {
  jest.resetModules(); localStorage.clear(); jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00'));
  info = require('./dayInfo');
  global.fetch = jest.fn(async url => ({ ok: true, json: async () => url.includes('PublicHolidays') ? [holiday('2026-10-31')] : url.includes('geocoding') ? { results: [{ latitude: 42, longitude: -8 }] } : { current: { temperature_2m: 18, weather_code: 0 }, daily: { time: ['2026-10-29','2026-10-30','2026-10-31'], temperature_2m_min: [10,11,12], temperature_2m_max: [18,19,20], weather_code: [61,63,3], precipitation_probability_max: [70,80,30] } } }));
});
afterEach(() => { jest.useRealTimers(); delete global.fetch; });
test('announces three calendar days ahead with full date, without inventing closures', () => {
  const items = info.holidayItems([holiday('2026-10-31'), holiday('2026-11-01')], 'Vigo');
  expect(items).toHaveLength(1);
  expect(items[0].label).toContain('en 3 días');
  expect(items[0].value).toContain('sábado, 31 de octubre de 2026');
  expect(items[0].value).not.toMatch(/cerrad|cierre/i);
});
test('calendar window crosses year and DST, excluding unrelated regions', () => {
  expect(info.holidayItems([holiday('2027-01-01')], '', new Date('2026-12-29T12:00:00'))).toHaveLength(1);
  expect(info.holidayItems([holiday('2026-10-26')], '', new Date('2026-10-23T12:00:00'))[0].label).toContain('3 días');
  expect(info.holidayItems([holiday('2026-10-31', 'Madrid', ['ES-MD'])], 'Vigo')).toEqual([]);
});
test('independent rerenders, concurrent callers and restart reuse persisted cache', async () => {
  const location = { city: 'Vigo', latitude: 42, longitude: -8 };
  const [items] = await Promise.all([info.loadDayInfo(location), info.loadDayInfo(location)]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(items.filter(i => i.key.startsWith('forecast-'))).toHaveLength(3);
  for (let i = 0; i < 4; i++) { jest.setSystemTime(Date.now() + 15000); await info.loadDayInfo(location); }
  expect(fetch).toHaveBeenCalledTimes(2);
  jest.resetModules(); info = require('./dayInfo'); fetch.mockClear(); await info.loadDayInfo(location);
  expect(fetch).not.toHaveBeenCalled();
  jest.setSystemTime(Date.now() + 3600000); await info.loadDayInfo(location);
  expect(fetch.mock.calls.filter(([url]) => url.includes('/forecast?'))).toHaveLength(1);
  expect(fetch.mock.calls.filter(([url]) => url.includes('PublicHolidays'))).toHaveLength(0);
});
test('annual calendar revalidates after thirty days', async () => {
  await info.loadDayInfo({}); jest.setSystemTime(Date.now() + 29 * 86400000); await info.loadDayInfo({});
  expect(fetch).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 86400000); await info.loadDayInfo({}); expect(fetch).toHaveBeenCalledTimes(2);
});
test('null coordinates geocode once; a changed city uses another cache entry', async () => {
  await info.loadDayInfo({ city: 'Vigo', latitude: null, longitude: null });
  jest.setSystemTime(Date.now() + 3600000); await info.loadDayInfo({ city: 'Vigo' });
  expect(fetch.mock.calls.filter(([url]) => url.includes('geocoding'))).toHaveLength(1);
  await info.loadDayInfo({ city: 'Ourense' });
  expect(fetch.mock.calls.filter(([url]) => url.includes('geocoding'))).toHaveLength(2);
  expect(fetch.mock.calls.some(([url]) => url.includes('latitude=0&longitude=0'))).toBe(false);
});
test('provider failure backs off and does not present an old forecast as current', async () => {
  const location = { latitude: 42, longitude: -8 };
  await info.loadDayInfo(location);
  jest.setSystemTime(Date.now() + 7 * 3600000);
  fetch.mockRejectedValue(new Error('offline'));
  const items = await info.loadDayInfo(location);
  expect(items.some(item => item.key === 'weather')).toBe(false);
  expect(items.find(item => item.key === 'weather-status').value).toContain('pendiente');
  await info.loadDayInfo(location); expect(fetch).toHaveBeenCalledTimes(3);
});
test('late December fetches both years once', async () => {
  jest.setSystemTime(new Date('2026-12-30T12:00:00')); await info.loadDayInfo({});
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(['https://date.nager.at/api/v3/PublicHolidays/2026/ES', 'https://date.nager.at/api/v3/PublicHolidays/2027/ES']));
});
