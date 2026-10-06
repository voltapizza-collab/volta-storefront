import { nativeStartupError } from './nativeStartupError';
test('device registration and authorization failures are not presented as internet failures', () => {
  for (const code of ['device_required', 'device_not_authorized', 'invalid_device_proof']) {
    const result = nativeStartupError({ response: { data: { error: code } } });
    expect(result.code).toBe(code);
    expect(result.message).not.toMatch(/conexión a internet/);
  }
});
test('an unrecognized backend message cannot leak into the startup screen', () => {
  const result = nativeStartupError({ response: { data: { error: 'private server information' } } });
  expect(result.code).toBe('startup_unavailable');
  expect(JSON.stringify(result)).not.toContain('private server');
});
