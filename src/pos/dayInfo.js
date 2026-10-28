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
const weatherNames = { 0: 'Despejado', 1: 'Mayormente claro', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla', 51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa', 71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa', 80: 'Chubascos', 81: 'Chubascos', 82: 'Chubascos fuertes', 95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo' };
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function offset(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
const fullDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function dateLabel(iso) { return fullDate.format(new Date(`${iso}T12:00:00`)); }
function finite(value) { return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)); }
function coordinates(latitude, longitude) {
  return finite(latitude) && finite(longitude) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180
    ? { lat: Number(latitude), lon: Number(longitude) } : null;
}
export function holidayItems(holidays, city, today = new Date()) {
  const region = GALICIA.has(normalize(city)) ? 'ES-GA' : null;
  const result = [];
  for (let days = 0; days <= 3; days++) {
    const iso = dateKey(offset(today, days));
    const matching = holidays.filter(h => h?.date === iso && (!h.counties?.length || (region && h.counties.includes(region))));
    // Retain the existing local calendar, but do not duplicate provider entries.
    const local = iso.endsWith('-01-06') ? 'Reyes' : region && iso.endsWith('-05-17') ? 'Día das Letras Galegas' : region && iso.endsWith('-07-25') ? 'Día de Galicia' : null;
    if (!matching.length && local) matching.push({ localName: local });
    if (matching.length) result.push({ key: `holiday-${iso}`, label: `Festivo · ${days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}`,
      value: `${[...new Set(matching.map(h => h.localName || h.name))].join(' · ')} · ${dateLabel(iso)}`, tone: 'warning' });
  }
  return result;
}
export async function loadDayInfo({ city = '', latitude, longitude }, today = new Date()) {
  // Weather and calendar are independent: a slow weather provider cannot delay holiday retrieval.
  const years = [...new Set([today.getFullYear(), offset(today, 3).getFullYear()])];
  const calendarTask = Promise.all(years.map(year => cached(`holidays:ES:${year}`, 30 * DAY,
    `https://date.nager.at/api/v3/PublicHolidays/${year}/ES`, Array.isArray)));
  const weatherTask = (async () => {
    let coords = coordinates(latitude, longitude);
    if (!coords && city.trim()) {
      const place = await cached(`geo:ES:${normalize(city)}`, Number.MAX_SAFE_INTEGER,
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=es&format=json&countryCode=ES`, data => Array.isArray(data?.results) && !!coordinates(data.results[0]?.latitude, data.results[0]?.longitude));
      coords = coordinates(place.data?.results?.[0]?.latitude, place.data?.results?.[0]?.longitude);
    }
    if (!coords) return null;
    return cached(`weather:${coords.lat}:${coords.lon}`, HOUR,
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=auto`,
      data => finite(data?.current?.temperature_2m) || Array.isArray(data?.daily?.time));
  })();
  const [calendars, weather] = await Promise.all([calendarTask, weatherTask]);
  const items = holidayItems(calendars.flatMap(c => c.data || []), city, today);
  if (calendars.some(c => c.failed)) items.push({ key: 'calendar-status', label: 'Calendario', value: 'No se pudo actualizar el calendario. Se muestran los datos guardados disponibles.' });
  if (!items.length) items.push({ key: 'calendar-empty', label: 'Festivos próximos', value: 'Sin festivos cargados para hoy y los próximos 3 días. La cobertura local puede ser incompleta.' });
  const current = weather?.data?.current;
  const weatherFresh = weather && Date.now() - weather.at < 6 * HOUR;
  if (weatherFresh && finite(current?.temperature_2m)) items.push({ key: 'weather', label: weather.failed ? 'Clima · dato guardado' : 'Clima actual', value: `${Math.round(current.temperature_2m)} °C · ${weatherNames[current.weather_code] || 'Tiempo actual'}` });
  const daily = weather?.data?.daily;
  if (weatherFresh) for (let days = 1; days <= 3; days++) {
    const iso = dateKey(offset(today, days));
    const i = daily?.time?.indexOf(iso) ?? -1;
    if (i < 0) continue;
    const min = daily.temperature_2m_min?.[i], max = daily.temperature_2m_max?.[i], rain = daily.precipitation_probability_max?.[i];
    const parts = [weatherNames[daily.weather_code?.[i]] || 'Previsión'];
    if (finite(min) && finite(max)) parts.push(`${Math.round(min)}–${Math.round(max)} °C`);
    if (finite(rain)) parts.push(`${Math.round(rain)} % de probabilidad de precipitación`);
    items.push({ key: `forecast-${iso}`, label: `Previsión · ${dateLabel(iso)}`, value: parts.join(' · ') });
  }
  if (!weatherFresh || weather.failed) items.push({ key: 'weather-status', label: 'Clima', value: weather?.at ? `Última consulta correcta: ${new Date(weather.at).toLocaleString('es-ES')}. Previsión pendiente de actualizar.` : 'Previsión no disponible para esta ubicación.' });
  return items;
}
