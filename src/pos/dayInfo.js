// Public, non-personal data only. Bounded persistent cache survives POS restarts.
const HOUR = 3600000;
const DAY = 24 * HOUR;
const CACHE_KEY = 'volta-pos-day-info-v2';
let entries;
const pending = new Map();
function cache() {
  if (!entries) {
    try { entries = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (_) { entries = {}; }
    if (typeof entries !== 'object' || Array.isArray(entries)) entries = {};
    entries = Object.fromEntries(Object.entries(entries).filter(([, entry]) => entry && Number.isFinite(entry.attempt) && Number.isFinite(entry.at)));
  }
  return entries;
}
function persist() {
  const keys = Object.keys(cache()).sort((a, b) => entries[b].attempt - entries[a].attempt);
  keys.slice(24).forEach(key => delete entries[key]);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entries)); } catch (_) { /* Memory cache works without storage. */ }
}
async function cached(key, ttl, url, valid) {
  if (pending.has(key)) return pending.get(key);
  const previous = cache()[key];
  const now = Date.now();
  if (previous && now >= previous.attempt && now - previous.attempt < (previous.failed ? HOUR : ttl)) return previous;
  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('day_info_unavailable');
      const data = await response.json();
      if (!valid(data)) throw new Error('day_info_invalid');
      cache()[key] = { data, at: now, attempt: now, failed: false };
    } catch (_) {
      cache()[key] = { data: previous?.data ?? null, at: previous?.at ?? 0, attempt: now, failed: true };
    } finally { clearTimeout(timer); }
    const result = cache()[key];
    persist();
    return result;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

const normalize = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const GALICIA = new Set(['ourense', 'orense', 'vigo', 'pontevedra', 'coruna', 'a coruna', 'lugo']);
// Spanish postal province prefixes -> Nager.Date first-level subdivisions.
const REGIONS = [
  ['AN', 'Andalucía', '04 11 14 18 21 23 29 41'], ['AR', 'Aragón', '22 44 50'],
  ['AS', 'Asturias', '33'], ['IB', 'Illes Balears', '07'], ['CN', 'Canarias', '35 38'],
  ['CB', 'Cantabria', '39'], ['CM', 'Castilla-La Mancha', '02 13 16 19 45'],
  ['CL', 'Castilla y León', '05 09 24 34 37 40 42 47 49'], ['CT', 'Cataluña', '08 17 25 43'],
  ['EX', 'Extremadura', '06 10'], ['GA', 'Galicia', '15 27 32 36'], ['MD', 'Madrid', '28'],
  ['MC', 'Región de Murcia', '30'], ['NC', 'Navarra', '31'], ['PV', 'País Vasco', '01 20 48'],
  ['RI', 'La Rioja', '26'], ['VC', 'Comunitat Valenciana', '03 12 46'], ['CE', 'Ceuta', '51'], ['ML', 'Melilla', '52'],
];
export function holidayRegion(city, zipCode) {
  const postal = String(zipCode || '').trim();
  const match = /^\d{5}$/.test(postal) ? REGIONS.find(([, , prefixes]) => prefixes.split(' ').includes(postal.slice(0, 2))) : null;
  const region = match || (GALICIA.has(normalize(city)) ? REGIONS.find(([code]) => code === 'GA') : null);
  return region ? { code: `ES-${region[0]}`, name: region[1] } : null;
}
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function offset(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
const fullDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
function dateLabel(iso) { return fullDate.format(new Date(`${iso}T12:00:00`)); }
function validDate(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso;
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function coordinates(latitude, longitude) {
  return latitude !== null && latitude !== undefined && latitude !== '' && longitude !== null && longitude !== undefined && longitude !== '' &&
    finite(Number(latitude)) && finite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180
    ? { lat: Number(latitude), lon: Number(longitude) } : null;
}
export function nextHoliday(holidays, region, today = new Date()) {
  const iso = dateKey(today);
  const applicable = holidays.filter(h => validDate(h?.date) && h.date >= iso && (h.localName || h.name) &&
    (!h.types || (Array.isArray(h.types) && h.types.includes('Public'))) &&
    (h.global === true || (Array.isArray(h.counties) && h.counties.length
      ? region && h.counties.includes(region.code) : h.global !== false)))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!applicable.length) return null;
  const first = applicable[0];
  const sameDay = applicable.filter(h => h.date === first.date);
  const scopes = sameDay.map(h => h.global === true || !h.counties?.length ? 'Nacional · España' : `Autonómico · ${region.name}`);
  // UTC date-only arithmetic avoids 23/25-hour DST days.
  const days = (Date.parse(first.date) - Date.parse(iso)) / DAY;
  return { date: first.date, dateLabel: dateLabel(first.date),
    name: [...new Set(sameDay.map(h => h.localName || h.name))].join(' · '),
    scope: [...new Set(scopes)].join(' / '), alert: days >= 0 && days <= 3,
    relative: days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días` };
}
const weatherNames = { 0: 'Despejado', 1: 'Mayormente claro', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla', 51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa', 66: 'Lluvia helada', 67: 'Lluvia helada intensa', 71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa', 77: 'Granos de nieve', 80: 'Chubascos', 81: 'Chubascos', 82: 'Chubascos fuertes', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve intensos', 95: 'Tormenta', 96: 'Tormenta con granizo', 97: 'Tormenta fuerte', 99: 'Tormenta con granizo' };
function weatherIcon(code) {
  if ([0, 1].includes(code)) return '☀️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
  if ([95, 96, 97, 99].includes(code)) return '⛈️';
  return weatherNames[code] ? '🌧️' : '—';
}
export function adverseWeather(daily, i, units = {}) {
  const code = daily?.weather_code?.[i];
  const phenomena = [];
  // Specific WMO phenomena, never generic icons or precipitation probability.
  if ([65, 82].includes(code)) phenomena.push('Lluvia intensa');
  if ([95, 96, 97, 99].includes(code)) phenomena.push('Tormentas');
  if ([71, 73, 75, 77, 85, 86].includes(code)) phenomena.push('Nieve');
  if ([56, 57, 66, 67].includes(code)) phenomena.push('Precipitación helada');
  const wind = daily?.wind_speed_10m_max?.[i], gust = daily?.wind_gusts_10m_max?.[i];
  // Conservative operational thresholds; these are not official weather warnings.
  if ((units?.wind_speed_10m_max === 'km/h' && finite(wind) && wind >= 50) ||
      (units?.wind_gusts_10m_max === 'km/h' && finite(gust) && gust >= 70)) phenomena.push('Viento fuerte');
  if (!phenomena.length) return null;
  return { title: phenomena.join(' · '),
    message: 'Puede afectar al reparto y a la demanda. Revisa la preparación de cocina y la disponibilidad de repartidores; valora si conviene adaptar tus campañas. Previsión informativa, no aviso meteorológico oficial.' };
}
export function emptyDayInfo(today = new Date()) {
  return { days: ['Hoy', 'Mañana', 'Pasado mañana'].map((label, index) => ({
    date: dateKey(offset(today, index)), label, icon: '—', condition: 'Previsión no disponible', min: null, max: null, alert: null,
  })), holiday: null, loading: true, status: [] };
}
export async function loadDayInfo({ city = '', zipCode, latitude, longitude }, today = new Date()) {
  const region = holidayRegion(city, zipCode);
  const calendarTask = (async () => {
    const getYear = year => cached(`holidays:ES:${year}`, 30 * DAY,
      `https://date.nager.at/api/v3/PublicHolidays/${year}/ES`, Array.isArray);
    const calendars = [await getYear(today.getFullYear())];
    // Only request the following year when no remaining applicable holiday is registered.
    if (!nextHoliday(calendars[0].data || [], region, today)) calendars.push(await getYear(today.getFullYear() + 1));
    return calendars;
  })();
  const weatherTask = (async () => {
    let coords = coordinates(latitude, longitude);
    if (!coords && city.trim()) {
      const place = await cached(`geo:ES:${normalize(city)}`, Number.MAX_SAFE_INTEGER,
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=es&format=json&countryCode=ES`, data => Array.isArray(data?.results) && !!coordinates(data.results[0]?.latitude, data.results[0]?.longitude));
      coords = coordinates(place.data?.results?.[0]?.latitude, place.data?.results?.[0]?.longitude);
    }
    if (!coords) return null;
    // Keep the existing cache key: older forecasts remain usable until normal revalidation.
    return cached(`weather:${coords.lat}:${coords.lon}`, HOUR,
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max&forecast_days=3&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto`,
      data => Array.isArray(data?.daily?.time));
  })();
  const [calendars, weather] = await Promise.all([calendarTask, weatherTask]);
  const info = emptyDayInfo(today);
  info.loading = false;
  info.holiday = nextHoliday(calendars.flatMap(c => c.data || []), region, today);
  info.status.push(region ? 'Calendario nacional y autonómico; no incluye festivos municipales.' : 'Comunidad autónoma sin identificar: solo festivos nacionales. No incluye festivos municipales.');
  if (calendars.some(c => c.failed)) info.status.push('No se pudo actualizar el calendario; se muestran los registros guardados disponibles.');
  const weatherFresh = weather && Date.now() >= weather.at && Date.now() - weather.at < 6 * HOUR;
  if (weatherFresh) {
    const daily = weather.data?.daily;
    info.days = info.days.map(day => {
      const i = daily?.time?.indexOf(day.date) ?? -1;
      if (i < 0) return day;
      const code = daily.weather_code?.[i];
      return { ...day, min: finite(daily.temperature_2m_min?.[i]) ? Math.round(daily.temperature_2m_min[i]) : null,
        max: finite(daily.temperature_2m_max?.[i]) ? Math.round(daily.temperature_2m_max[i]) : null,
        icon: weatherIcon(code), condition: weatherNames[code] || 'Previsión no disponible',
        alert: adverseWeather(daily, i, weather.data?.daily_units) };
    });
  }
  if (!weatherFresh || weather?.failed) info.status.push(weather?.at
    ? `Última consulta correcta: ${new Date(weather.at).toLocaleString('es-ES')}. Previsión pendiente de actualizar.`
    : 'Previsión no disponible para esta ubicación.');
  else if (info.days.some(day => day.min === null || day.max === null)) info.status.push('Previsión incompleta: las temperaturas no disponibles se muestran con —.');
  return info;
}
