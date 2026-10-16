import { isLocalVisualPizzaEnabled } from './visualPizzaExperiment';

test('the experiment is limited to loopback hosts, including production builds served locally', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) expect(isLocalVisualPizzaEnabled(host)).toBe(true);
  for (const host of ['voltapizza.com', 'mycrushpizza.com', 'localhost.example.com', '192.168.1.2', '']) expect(isLocalVisualPizzaEnabled(host)).toBe(false);
});
