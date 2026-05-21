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

export const STOREFRONT_MODE_ITEMS = [
  {
    id: "volta",
    name: "Modo Volta",
    status: "locked",
    label: "Actual",
    description:
      "Look oficial Volta con estructura tipo marketplace, botones intensos y paleta fija del motor.",
  },
  {
    id: "dark",
    name: "Modo oscuro",
    status: "coming",
    label: "Proximamente",
    description:
      "Misma estructura del storefront con contraste oscuro y lectura nocturna.",
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

export const normalizeStorefrontButtonConfig = (rawConfig) => {
  return STOREFRONT_BUTTON_ITEMS.reduce(
    (config, item) => ({
      ...config,
      [item.id]: true,
    }),
    {}
  );
};
