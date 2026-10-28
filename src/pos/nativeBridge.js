export const isNativePos = typeof window !== 'undefined' && !!window.VoltaNative;
const pending = new Map();
let sequence = 0;
if (isNativePos) window.__voltaResult = (id, result) => {
  const task = pending.get(id);
  if (!task) return;
  pending.delete(id); clearTimeout(task.timer);
  if (result.status >= 200 && result.status < 300) task.resolve(result.data);
  else {
    const error = new Error(result.data?.error || 'Error de conexión');
    error.response = { status: result.status, data: result.data };
    task.reject(error);
  }
};
export function nativeCall(operation, payload = {}, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(Object.assign(new Error('Petición cancelada'), { code: 'ERR_CANCELED' })); return; }
    const id = String(++sequence);
    const timeout = options.timeout > 0 ? options.timeout : ['updateStatus', 'updateNoticeSeen', 'updateCheck'].includes(operation) ? 5000 : 120000;
    const cleanup = () => { pending.delete(id); clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(Object.assign(new Error('Petición cancelada'), { code: 'ERR_CANCELED' })); };
    const timer = setTimeout(() => {
      cleanup(); reject(Object.assign(new Error('Sin confirmación del terminal. Comprueba el resultado antes de repetir.'), { code: 'ECONNABORTED', outcomeUnknown: operation === 'request' && payload.method !== 'GET' }));
    }, timeout);
    pending.set(id, { resolve: value => { cleanup(); resolve(value); }, reject: error => { cleanup(); reject(error); }, timer });
    options.signal?.addEventListener('abort', abort, { once: true });
    try { window.VoltaNative.call(id, operation, JSON.stringify(payload)); }
    catch (error) { cleanup(); reject(error); }
  });
}
export async function nativeAdapter(config) {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  let result;
  const method = (config.method || 'GET').toUpperCase();
  const timeout = config.timeout > 0 ? config.timeout : method === 'GET' ? 8000 : 120000;
  try { result = await nativeCall('request', {
    path: config.url, method, params: config.params || {}, body: data || null, timeoutMs: timeout,
  }, { timeout, signal: config.signal }); } catch (error) {
    const code = error.response?.data?.error;
    if (method !== 'GET' && (!error.response || error.response.status >= 500) &&
        !['terminal_updating', 'terminal_queue_full', 'terminal_request_expired'].includes(code)) error.outcomeUnknown = true;
    if (['session_expired','device_not_authorized'].includes(error.response?.data?.error)) window.location.reload();
    throw error;
  }
  return { data: result, status: 200, statusText: 'OK', headers: {}, config };
}
