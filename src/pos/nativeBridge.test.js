let bridge;
beforeEach(() => { jest.resetModules(); jest.useFakeTimers(); window.VoltaNative = { call: jest.fn() }; bridge = require('./nativeBridge'); });
afterEach(() => { jest.useRealTimers(); delete window.VoltaNative; delete window.__voltaResult; });
test('native GET respects Axios deadline and forwards timeout for queue expiry', async () => {
  const result = bridge.nativeAdapter({ url: '/api/myorders/pending', method: 'get', timeout: 8000 }).catch(error => error);
  expect(JSON.parse(window.VoltaNative.call.mock.calls[0][2]).timeoutMs).toBe(8000);
  jest.advanceTimersByTime(8000);
  expect((await result).code).toBe('ECONNABORTED');
  window.__voltaResult('1', { status: 200, data: { late: true } });
  expect(jest.getTimerCount()).toBe(0);
});
test('bridge exceptions and cancellation clean up pending timers', async () => {
  window.VoltaNative.call.mockImplementationOnce(() => { throw new Error('bridge unavailable'); });
  await expect(bridge.nativeCall('updateStatus')).rejects.toThrow('bridge unavailable');
  const controller = new AbortController();
  const result = bridge.nativeAdapter({ url: '/api/stock/1', signal: controller.signal }).catch(error => error);
  controller.abort(); expect((await result).code).toBe('ERR_CANCELED'); expect(jest.getTimerCount()).toBe(0);
});
test('write timeout flags an unknown outcome and never resubmits', async () => {
  const result = bridge.nativeAdapter({ url: '/api/stock/1/2/active', method: 'patch', timeout: 2000 }).catch(error => error);
  jest.advanceTimersByTime(2000); expect((await result).outcomeUnknown).toBe(true);
  expect(window.VoltaNative.call).toHaveBeenCalledTimes(1);
});
test('native transport failure after a write remains uncertain, queue rejection does not', async () => {
  const uncertain = bridge.nativeAdapter({ url: '/api/stock/1/2/active', method: 'patch' }).catch(error => error);
  window.__voltaResult('1', { status: 503, data: { error: 'terminal_operation_failed' } });
  expect((await uncertain).outcomeUnknown).toBe(true);
  const rejected = bridge.nativeAdapter({ url: '/api/stock/1/2/active', method: 'patch' }).catch(error => error);
  window.__voltaResult('2', { status: 503, data: { error: 'terminal_queue_full' } });
  expect((await rejected).outcomeUnknown).not.toBe(true);
});
