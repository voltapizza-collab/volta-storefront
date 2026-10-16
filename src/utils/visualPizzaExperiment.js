// Local preview only. Public storefronts retain the traditional builder.
export const isLocalVisualPizzaEnabled = hostname =>
  ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
