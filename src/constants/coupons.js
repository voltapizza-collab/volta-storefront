export const COUPON_SEGMENTS = [
  { key: "S1", label: "Potencial" },
  { key: "S2", label: "Nuevo" },
  { key: "S3", label: "Dormido" },
  { key: "S4", label: "Activo" },
  { key: "S5", label: "VIP" },
  { key: "HOT", label: "Hot" },
  { key: "COLD", label: "Cold" },
];

export const COUPON_TYPES = [
  { key: "RANDOM_PERCENT", label: "Random (%)" },
  { key: "FIXED_PERCENT", label: "Porcentaje fijo" },
  { key: "FIXED_AMOUNT", label: "Importe fijo" },
];

export const couponSegmentLabel = (segment) =>
  COUPON_SEGMENTS.find((item) => item.key === segment)?.label || segment;
