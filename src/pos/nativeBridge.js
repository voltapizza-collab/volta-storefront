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
export function nativeCall(operation, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = String(++sequence);
    const timer = setTimeout(() => {
      pending.delete(id); reject(new Error('Sin confirmación del terminal. Comprueba el resultado antes de repetir.'));
    }, 120000);
    pending.set(id, { resolve, reject, timer });
    window.VoltaNative.call(id, operation, JSON.stringify(payload));
  });
}
export async function nativeAdapter(config) {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  let result;
  try { result = await nativeCall('request', {
    path: config.url, method: (config.method || 'GET').toUpperCase(), params: config.params || {}, body: data || null,
  }); } catch (error) {
    if (['session_expired','device_not_authorized'].includes(error.response?.data?.error)) window.location.reload();
    throw error;
  }
  return { data: result, status: 200, statusText: 'OK', headers: {}, config };
}
