let info;
const holiday = (date, name = 'Festivo de prueba', counties = null) => ({ date, localName: name, counties, global: !counties, types: ['Public'] });
const originalFetch = global.fetch;
const location = { city: 'Vigo', latitude: 42, longitude: -8 };
let forecast;
beforeEach(() => {
  jest.resetModules(); localStorage.clear(); jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00'));
  info = require('./dayInfo');
  forecast = { daily: { time: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'],
    temperature_2m_min: [9,10,11,12], temperature_2m_max: [17,18,19,20],
    weather_code: [0,61,63,95], precipitation_probability_max: [0,70,100,90],
    wind_speed_10m_max: [10,15,20,50], wind_gusts_10m_max: [20,30,40,70] },
    daily_units: { wind_speed_10m_max: 'km/h', wind_gusts_10m_max: 'km/h' } };
  global.fetch = jest.fn(async url => ({ ok: true, json: async () => url.includes('PublicHolidays')
    ? [holiday('2026-10-31')] : url.includes('geocoding') ? { results: [{ latitude: 42, longitude: -8 }] } : forecast }));
});
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; });

test.each([[4,false], [3,true], [2,true], [1,true], [0,true]])('holiday alert starts at D-3 and persists: D-%i', (days, expected) => {
  const day = new Date('2026-10-31T12:00:00'); day.setDate(day.getDate() - days);
  const result = info.nextHoliday([holiday('2026-10-31')], null, day);
  expect(result.alert).toBe(expected);
  expect(result.dateLabel).toBe('31 de octubre de 2026');
  expect(result.scope).toBe('Nacional · España');
});
test('selects only the next recorded holiday, including beyond the alert window; removes past holidays', () => {
  const result = info.nextHoliday([holiday('2026-12-25'), holiday('2026-11-01'), holiday('2026-10-27')], null);
  expect(result.date).toBe('2026-11-01'); expect(result.alert).toBe(false);
  expect(info.nextHoliday([holiday('2026-10-27')], null)).toBeNull();
  expect(info.nextHoliday([], info.holidayRegion('Vigo'), new Date('2027-05-16T12:00:00'))).toBeNull();
});
test('calendar arithmetic crosses DST and year; duplicate holidays share one card', () => {
  expect(info.nextHoliday([holiday('2027-01-01')], null, new Date('2026-12-29T12:00:00')).relative).toBe('en 3 días');
  expect(info.nextHoliday([holiday('2026-10-26')], null, new Date('2026-10-23T12:00:00')).relative).toBe('en 3 días');
  const result = info.nextHoliday([holiday('2026-10-31'), holiday('2026-10-31'), holiday('2026-10-31', 'Galicia', ['ES-GA'])], info.holidayRegion('Vigo'));
  expect(result.name).toBe('Festivo de prueba · Galicia');
  expect(result.scope).toBe('Nacional · España / Autonómico · Galicia');
});
test('regional applicability uses existing postal code, falls back to known city, excludes nonpublic/unknown/malformed records', () => {
  const records = [holiday('2026-10-29', 'Madrid', ['ES-MD']), holiday('2026-10-30', 'Galicia', ['ES-GA']), holiday('2026-11-01')];
  expect(info.nextHoliday(records, info.holidayRegion('Vigo')).name).toBe('Galicia');
  expect(info.nextHoliday(records, info.holidayRegion('', '28001')).name).toBe('Madrid');
  expect(info.nextHoliday(records, info.holidayRegion('Unknown')).date).toBe('2026-11-01');
  expect(info.holidayRegion('', '15001').code).toBe('ES-GA');
  expect(info.holidayRegion('', '35001').code).toBe('ES-CN');
  expect(info.holidayRegion('', '99999')).toBeNull();
  expect(info.nextHoliday([{...holiday('2026-10-29'), types: ['School']}, {...holiday('2026-10-29'), global: false}, holiday('2026-02-31'), holiday('bad')], null)).toBeNull();
});
test('exactly today, tomorrow and day after; no warning for rain probability or fourth-day storm', async () => {
  const result = await info.loadDayInfo(location);
  expect(result.days.map(d => d.date)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30']);
  expect(result.days[0]).toMatchObject({ min: 9, max: 17, label: 'Hoy' });
  expect(result.days.every(d => d.alert === null)).toBe(true);
  const url = fetch.mock.calls.find(([url]) => url.includes('/forecast?'))[0];
  expect(url).toContain('wind_speed_10m_max,wind_gusts_10m_max');
  expect(url).toContain('forecast_days=3');
  expect(url).not.toContain('current=');
});
test.each([65,82,95,96,97,99,71,73,75,77,85,86,56,57,66,67])('specific WMO code %i supplies evidence for adverse weather', code => {
  expect(info.adverseWeather({weather_code:[code]}, 0)).not.toBeNull();
});
test.each([0,1,2,3,45,48,51,53,55,61,63,80,81,null,undefined,999,'95'])('normal or unverified code %s does not trigger warnings', code => {
  expect(info.adverseWeather({weather_code:[code], precipitation_probability_max:[100]}, 0)).toBeNull();
});
test('wind thresholds require numeric data and known units, combining hazards once', () => {
  const units = forecast.daily_units;
  expect(info.adverseWeather({wind_speed_10m_max:[49],wind_gusts_10m_max:[69]},0,units)).toBeNull();
  expect(info.adverseWeather({wind_speed_10m_max:[50]},0,units).title).toBe('Viento fuerte');
  expect(info.adverseWeather({wind_gusts_10m_max:[70]},0,units).title).toBe('Viento fuerte');
  expect(info.adverseWeather({wind_gusts_10m_max:[100]},0,{})).toBeNull();
  expect(info.adverseWeather({wind_gusts_10m_max:[100]},0,null)).toBeNull();
  expect(info.adverseWeather({wind_gusts_10m_max:[100]},0,{wind_gusts_10m_max:'mph'})).toBeNull();
  expect(info.adverseWeather({wind_gusts_10m_max:['80']},0,units)).toBeNull();
  expect(info.adverseWeather({weather_code:[95],wind_speed_10m_max:[60],wind_gusts_10m_max:[90]},0,units).title).toBe('Tormentas · Viento fuerte');
});
test('concurrent callers, rerenders and restart reuse persistent cache and hourly weather cadence', async () => {
  await Promise.all([info.loadDayInfo(location), info.loadDayInfo(location)]);
  expect(fetch).toHaveBeenCalledTimes(2);
  for (let i=0; i<4; i++) { jest.setSystemTime(Date.now()+15000); await info.loadDayInfo(location); }
  expect(fetch).toHaveBeenCalledTimes(2);
  jest.resetModules(); info = require('./dayInfo'); fetch.mockClear(); await info.loadDayInfo(location);
  expect(fetch).not.toHaveBeenCalled();
  jest.setSystemTime(Date.now()+3600000); await info.loadDayInfo(location);
  expect(fetch.mock.calls.filter(([url]) => url.includes('/forecast?'))).toHaveLength(1);
  expect(fetch.mock.calls.filter(([url]) => url.includes('PublicHolidays'))).toHaveLength(0);
});
test('existing v2 forecasts are reused without an upgrade request or invented wind warning', async () => {
  delete forecast.daily.wind_speed_10m_max; delete forecast.daily.wind_gusts_10m_max; delete forecast.daily_units;
  forecast.daily.weather_code[0] = 95;
  localStorage.setItem('volta-pos-day-info-v2', JSON.stringify({
    'weather:42:-8': {data:forecast, at:Date.now(),attempt:Date.now(),failed:false},
    'holidays:ES:2026': {data:[holiday('2026-11-01')],at:Date.now(),attempt:Date.now(),failed:false},
  }));
  const result = await info.loadDayInfo(location);
  expect(fetch).not.toHaveBeenCalled(); expect(result.days[0].alert.title).toBe('Tormentas');
});
test('calendar revalidates after thirty days', async () => {
  fetch.mockResolvedValue({ok:true,json:async()=>[holiday('2026-12-25')]});
  await info.loadDayInfo({}); jest.setSystemTime(Date.now()+29*86400000); await info.loadDayInfo({});
  expect(fetch).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now()+86400000); await info.loadDayInfo({}); expect(fetch).toHaveBeenCalledTimes(2);
});
test('geocoding is reused and invalid coordinates do not become zero', async () => {
  await info.loadDayInfo({city:'Vigo',latitude:null,longitude:null});
  jest.setSystemTime(Date.now()+3600000); await info.loadDayInfo({city:'Vigo'});
  expect(fetch.mock.calls.filter(([url])=>url.includes('geocoding'))).toHaveLength(1);
  await info.loadDayInfo({city:'Ourense'});
  expect(fetch.mock.calls.filter(([url])=>url.includes('geocoding'))).toHaveLength(2);
  expect(fetch.mock.calls.some(([url])=>url.includes('latitude=0&longitude=0'))).toBe(false);
});
test('offline backoff retains recent forecast with notice, then suppresses stale values and alerts', async () => {
  forecast.daily.weather_code[0] = 95;
  await info.loadDayInfo(location);
  jest.setSystemTime(Date.now()+2*3600000); fetch.mockRejectedValue(new Error('offline'));
  const recent = await info.loadDayInfo(location);
  expect(recent.days[0].alert.title).toBe('Tormentas'); expect(recent.status.join(' ')).toContain('pendiente');
  await info.loadDayInfo(location); expect(fetch).toHaveBeenCalledTimes(3);
  jest.setSystemTime(Date.now()+5*3600000);
  const stale = await info.loadDayInfo(location);
  expect(stale.days).toHaveLength(3);
  expect(stale.days.every(d=>d.min === null && d.alert === null)).toBe(true);
});
test('unavailable providers still return three placeholders and calendar status without fake holidays', async () => {
  fetch.mockRejectedValue(new Error('offline'));
  const result = await info.loadDayInfo(location);
  expect(result.days).toHaveLength(3); expect(result.holiday).toBeNull();
  expect(result.status.join(' ')).toContain('No se pudo actualizar');
  expect(result.status.join(' ')).toContain('no disponible');
  const count = fetch.mock.calls.length; await info.loadDayInfo(location); expect(fetch).toHaveBeenCalledTimes(count);
});
test('year rollover requests the following year only when needed and reuses both calendars', async () => {
  jest.setSystemTime(new Date('2026-12-30T12:00:00'));
  fetch.mockImplementation(async url => ({ok:true,json:async()=>url.includes('/2026/') ? [holiday('2026-12-25')] : [holiday('2027-01-01')]}));
  const result = await info.loadDayInfo({});
  expect(result.holiday).toMatchObject({date:'2027-01-01',alert:true});
  expect(fetch).toHaveBeenCalledTimes(2);
  jest.setSystemTime(new Date('2027-01-01T12:00:00'));
  expect((await info.loadDayInfo({})).holiday.relative).toBe('hoy');
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('missing daily rows or null temperatures stay unknown rather than zero', async () => {
  forecast.daily.time = ['2026-10-29']; forecast.daily.temperature_2m_min = [null];
  const result = await info.loadDayInfo(location);
  expect(result.days[0].min).toBeNull(); expect(result.days[1].min).toBeNull(); expect(result.days[2].min).toBeNull();
  expect(result.status.join(' ')).toContain('incompleta');
});
