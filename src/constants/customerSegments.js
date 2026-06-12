export const CUSTOMER_SEGMENTS = [
  {
    key: "potencial",
    label: "Potencial",
    shortLabel: "Potencial",
    description: "0 compras",
    color: "#7c3aed",
    tone: "potencial",
  },
  {
    key: "nuevo",
    label: "Nuevo",
    shortLabel: "Nuevo",
    description: "1 compra",
    color: "#0ea5e9",
    tone: "nuevo",
  },
  {
    key: "dormido",
    label: "Dormido",
    shortLabel: "Dormido",
    description: "2+ compras y +30 dias",
    color: "#f59e0b",
    tone: "dormido",
  },
  {
    key: "activo",
    label: "Activo",
    shortLabel: "Activo",
    description: "2+ compras y compra reciente",
    color: "#16a34a",
    tone: "activo",
  },
  {
    key: "vip",
    label: "VIP",
    shortLabel: "VIP",
    description: "5+ compras y sobre media",
    color: "#db2777",
    tone: "vip",
  },
];

const SEGMENT_ALIASES = {
  potencial: "potencial",
  potential: "potencial",
  nuevo: "nuevo",
  new: "nuevo",
  dormido: "dormido",
  sleeping: "dormido",
  activo: "activo",
  active: "activo",
  vip: "vip",
};

CUSTOMER_SEGMENTS.forEach((segment, index) => {
  SEGMENT_ALIASES[`s${index + 1}`] = segment.key;
});

export const DEFAULT_CUSTOMER_SEGMENT = "potencial";
export const VIP_CUSTOMER_SEGMENT = "vip";

const normalizeKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeCustomerSegment = (value, fallback = null) =>
  SEGMENT_ALIASES[normalizeKey(value)] || fallback;

export const customerSegmentMeta = (value) => {
  const key = normalizeCustomerSegment(value, DEFAULT_CUSTOMER_SEGMENT);
  return CUSTOMER_SEGMENTS.find((segment) => segment.key === key) || CUSTOMER_SEGMENTS[0];
};

export const customerSegmentLabel = (value) =>
  customerSegmentMeta(value).label;

export const createCustomerSegmentCounts = () =>
  Object.fromEntries(CUSTOMER_SEGMENTS.map((segment) => [segment.key, 0]));
