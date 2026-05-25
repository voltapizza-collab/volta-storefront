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
  {
    id: "commercial-light",
    name: "Modo claro comercial",
    status: "available",
    label: "Principal",
    description:
      "Superficie blanca, menos ruido visual y foco comercial en cupones, repetir pedido y Top Deal.",
  },
  {
    id: "volta",
    name: "Modo Volta",
    status: "available",
    label: "Volta",
    description:
      "Look oficial Volta preservado: arcade, botones intensos y paleta fija del motor.",
  },
  {
    id: "commercial-dark",
    name: "Modo oscuro comercial",
    status: "coming",
    label: "Proximamente",
    description:
      "Version de contraste oscuro para la misma estructura comercial.",
  },
  {
    id: "sepia",
    name: "Modo sepia",
    status: "coming",
    label: "Proximamente",
    description:
      "Misma estructura del storefront con una superficie mas calida y editorial.",
  },
  {
    id: "clean",
    name: "Modo clean",
    status: "coming",
    label: "Proximamente",
    description:
      "Misma estructura del storefront con menos ruido visual y colores mas neutros.",
  },
];

export const normalizeStorefrontMode = (mode) => {
  const normalized = String(mode || "").trim();
  return STOREFRONT_MODE_ITEMS.some((item) => item.id === normalized)
    ? normalized
    : DEFAULT_STOREFRONT_MODE;
};

export const normalizeStorefrontButtonConfig = (rawConfig) => {
  return STOREFRONT_BUTTON_ITEMS.reduce(
    (config, item) => ({
      ...config,
      [item.id]: true,
    }),
    {}
  );
};
