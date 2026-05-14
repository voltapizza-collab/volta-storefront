export const BRANDING_DEFAULTS = {
  brandPrimary: "#3B008B",
  brandSecondary: "#FFB61C",
  brandAccent: "#6A3DF0",
  brandSurface: "#FFF7E8",
  brandTextColor: "#171717",
  brandFontFamily: "moderno",
  brandOfferButtonStyle: "sunset-pill",
};

export const BRAND_FONT_OPTIONS = [
  {
    id: "moderno",
    label: "Moderno",
    family: '"Avenir Next", "Segoe UI", sans-serif',
    preview: "Avenir Next",
  },
  {
    id: "editorial",
    label: "Editorial",
    family: '"Georgia", "Times New Roman", serif',
    preview: "Georgia",
  },
  {
    id: "compacto",
    label: "Compacto",
    family: '"Trebuchet MS", "Arial Narrow", sans-serif',
    preview: "Trebuchet MS",
  },
];

export const OFFER_BUTTON_VARIANTS = [
  {
    id: "sunset-pill",
    name: "Neon Stripe",
    label: "coupons",
    accent: "#FF4F87",
    className: "is-sunset",
  },
  {
    id: "midnight-outline",
    name: "Mono Frame",
    label: "coupons",
    accent: "#171717",
    className: "is-outline",
  },
  {
    id: "gold-ticket",
    name: "Soft Signal",
    label: "coupons",
    accent: "#E9A400",
    className: "is-gold",
  },
];

export const getBrandFontOption = (fontId) =>
  BRAND_FONT_OPTIONS.find((option) => option.id === fontId) || BRAND_FONT_OPTIONS[0];

export const getOfferButtonVariant = (variantId) =>
  OFFER_BUTTON_VARIANTS.find((variant) => variant.id === variantId) || OFFER_BUTTON_VARIANTS[0];

const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex) => {
  const normalized = String(hex || "").trim().replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;

const mixHex = (baseHex, targetHex, amount = 0.5) => {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);

  if (!base || !target) return baseHex;

  return rgbToHex({
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount,
  });
};

const getRelativeLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const toLinear = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const getContrastRatio = (foregroundHex, backgroundHex) => {
  const fg = getRelativeLuminance(foregroundHex);
  const bg = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
};

export const getReadableTextColor = (
  backgroundHex,
  preferredTextHex = BRANDING_DEFAULTS.brandTextColor
) => {
  const normalizedBackground = backgroundHex || BRANDING_DEFAULTS.brandSurface;
  const preferred = preferredTextHex || BRANDING_DEFAULTS.brandTextColor;
  const white = "#FFFFFF";
  const black = "#171717";

  const preferredContrast = getContrastRatio(preferred, normalizedBackground);
  if (preferredContrast >= 4.5) return preferred;

  const whiteContrast = getContrastRatio(white, normalizedBackground);
  const blackContrast = getContrastRatio(black, normalizedBackground);

  return whiteContrast >= blackContrast ? white : black;
};

export const buildBrandThemeVars = ({
  brandPrimary,
  brandSecondary,
  brandAccent,
  brandSurface,
  brandTextColor,
  brandFontFamily,
}) => {
  const primary = brandPrimary || BRANDING_DEFAULTS.brandPrimary;
  const secondary = brandSecondary || BRANDING_DEFAULTS.brandSecondary;
  const accent = brandAccent || BRANDING_DEFAULTS.brandAccent;
  const surface = brandSurface || BRANDING_DEFAULTS.brandSurface;
  const text = brandTextColor || BRANDING_DEFAULTS.brandTextColor;
  const fontFamily =
    getBrandFontOption(brandFontFamily || BRANDING_DEFAULTS.brandFontFamily).family;

  return {
    primary,
    secondary,
    accent,
    surface,
    text,
    fontFamily,
    onPrimary: getReadableTextColor(primary, text),
    onSecondary: getReadableTextColor(secondary, text),
    onAccent: getReadableTextColor(accent, text),
    onSurface: getReadableTextColor(surface, text),
    textSoft: mixHex(text, surface, 0.32),
    textMuted: mixHex(text, surface, 0.48),
  };
};
