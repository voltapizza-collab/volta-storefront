import {
  CUSTOMER_SEGMENTS,
  customerSegmentLabel,
  normalizeCustomerSegment,
} from "./customerSegments";

export const COUPON_SEGMENTS = [
  ...CUSTOMER_SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    type: "segment",
  })),
  { key: "HOT", label: "Hot" },
  { key: "COLD", label: "Cold" },
];

export const COUPON_TYPES = [
  { key: "RANDOM_PERCENT", label: "Random (%)" },
  { key: "FIXED_PERCENT", label: "Porcentaje fijo" },
  { key: "FIXED_AMOUNT", label: "Importe fijo" },
  { key: "SURPRISE_AMOUNT", label: "Cupon sorpresa" },
  { key: "DELIVERY_FREE", label: "Delivery Free" },
];

export const couponSegmentLabel = (segment) => {
  const customerSegment = normalizeCustomerSegment(segment);
  if (customerSegment) return customerSegmentLabel(customerSegment);
  return COUPON_SEGMENTS.find((item) => item.key === segment)?.label || segment;
};
