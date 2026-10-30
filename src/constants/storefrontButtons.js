export const STOREFRONT_BUTTON_ITEMS = [
  {
    id: "selectProducts",
    label: "Selecciona productos",
    area: "Header",
    preview: "Selecciona productos",
  },
  {
    id: "coupons",
    label: "Cupones",
    area: "Acciones superiores",
    preview: "coupons",
  },
  {
    id: "halfAndHalf",
    label: "Mitad / Mitad",
    area: "Acciones superiores",
    preview: "Mitad / Mitad",
  },
  {
    id: "customPizza",
    label: "Arma tu pizza",
    area: "Acciones superiores",
    preview: "Arma tu pizza",
  },
  {
    id: "scheduleOrder",
    label: "Programar",
    area: "Top bar",
    preview: "Programar",
  },
  {
    id: "repeatOrder",
    label: "Repetir pedido",
    area: "Busqueda",
    preview: "Repetir pedido",
  },
  {
    id: "call",
    label: "Llamar",
    area: "Footer",
    preview: "Llamar",
  },
  {
    id: "reservations",
    label: "Reservas",
    area: "Footer",
    preview: "Reservas",
  },
  {
    id: "payNow",
    label: "Pay now",
    area: "Footer",
    preview: "PAY NOW",
  },
  {
    id: "couponCode",
    label: "Codigo cupon",
    area: "Footer",
    preview: "% Codigo cupon",
  },
  {
    id: "boost",
    label: "Boost Up",
    area: "Footer",
    preview: "BOOST UP",
  },
];

export const DEFAULT_STOREFRONT_BUTTON_CONFIG = STOREFRONT_BUTTON_ITEMS.reduce(
  (config, item) => ({
    ...config,
    [item.id]: true,
  }),
  {}
);

export const DEFAULT_STOREFRONT_MODE = "commercial-light";

export const STOREFRONT_MODE_ITEMS = [
  { id: 'commercial-light', name: 'Claro', status: 'available', description: 'Fondos claros y un aspecto luminoso para dar protagonismo a tu carta.' },
  { id: 'commercial-dark', name: 'Oscuro', status: 'available', description: 'Fondos oscuros, texto cálido y detalles suaves para un ambiente más elegante.' },
  { id: 'sepia', name: 'Sepia', status: 'available', description: 'Fondos crema, tonos café y detalles cobre para un ambiente cálido y acogedor.' },
];

export const normalizeStorefrontMode = (mode) => {
  const normalized = String(mode || "").trim();
  // Preserve existing legacy restaurants until their owner chooses a new mode.
  return normalized === 'volta' || STOREFRONT_MODE_ITEMS.some((item) => item.id === normalized)
    ? normalized
    : DEFAULT_STOREFRONT_MODE;
};

export const normalizeStorefrontButtonConfig = (rawConfig) => {
  const source = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig) ? rawConfig : {};
  return STOREFRONT_BUTTON_ITEMS.reduce(
    (config, item) => ({
      ...config,
      [item.id]: source[item.id] !== false,
    }),
    {}
  );
};
