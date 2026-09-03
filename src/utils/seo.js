import { useEffect } from "react";

const DEFAULT_PUBLIC_TITLE = "Pide pizza online";
const DEFAULT_PUBLIC_DESCRIPTION =
  "Pide pizza online en tu pizzeria local. Elige recogida o delivery y completa tu pedido en linea.";
const PUBLIC_ORIGIN = "https://voltapizza.com";
const SEO_SCHEMA_ID = "volta-public-business-schema";
const SITE_NAME = "Volta Pizza";

const cleanText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeForCompare = (value) =>
  cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const slugToTitle = (value) =>
  cleanText(value)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getRuntimeOrigin = () => {
  if (typeof window === "undefined") return PUBLIC_ORIGIN;
  return window.location.origin || PUBLIC_ORIGIN;
};

const buildUrl = (path) => {
  const normalizedPath = `/${cleanText(path).replace(/^\/+/, "")}`;
  return `${getRuntimeOrigin()}${normalizedPath === "/" ? "" : normalizedPath}`;
};

const upsertMeta = ({ name, property, content }) => {
  if (typeof document === "undefined" || !content) return;

  const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    if (name) element.setAttribute("name", name);
    if (property) element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
};

const upsertCanonical = (href) => {
  if (typeof document === "undefined" || !href) return;

  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
};

const upsertJsonLd = (data) => {
  if (typeof document === "undefined") return;

  let element = document.getElementById(SEO_SCHEMA_ID);
  if (!data) {
    element?.remove();
    return;
  }

  if (!element) {
    element = document.createElement("script");
    element.id = SEO_SCHEMA_ID;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(data);
};

const getPartnerName = (partner, fallbackSlug) =>
  cleanText(partner?.name || partner?.partnerName) || slugToTitle(fallbackSlug) || "Tu pizzeria";

const getStoreName = (store, fallbackSlug) =>
  cleanText(store?.storeName || store?.name) || slugToTitle(fallbackSlug);

const includesText = (source, target) => {
  const normalizedSource = normalizeForCompare(source);
  const normalizedTarget = normalizeForCompare(target);
  return Boolean(normalizedSource && normalizedTarget && normalizedSource.includes(normalizedTarget));
};

const buildStoreDisplayName = ({ partner, store, partnerSlug, storeSlug }) => {
  const partnerName = getPartnerName(partner || store?.partner, partnerSlug);
  const storeName = getStoreName(store, storeSlug);
  const city = cleanText(store?.city);

  if (!storeName) {
    return city ? `${partnerName} en ${city}` : partnerName;
  }

  if (normalizeForCompare(storeName) === normalizeForCompare(partnerName)) {
    return city && !includesText(storeName, city) ? `${storeName} en ${city}` : storeName;
  }

  if (city && normalizeForCompare(storeName) === normalizeForCompare(city)) {
    return `${partnerName} en ${city}`;
  }

  const locationSuffix = city && !includesText(storeName, city) ? ` en ${city}` : "";
  return `${partnerName} - ${storeName}${locationSuffix}`;
};

export const buildPartnerSeo = ({ partner, partnerSlug } = {}) => {
  const partnerName = getPartnerName(partner, partnerSlug);
  const slug = cleanText(partner?.slug || partnerSlug);
  const canonicalUrl = buildUrl(slug || "/");
  const title = `${partnerName} | Tienda oficial - Pide pizza ahora`;
  const description = `Tienda oficial de ${partnerName}. Elige recogida o delivery y pide pizza directamente a la pizzeria.`;
  const image = cleanText(partner?.brandLogoUrl);

  return {
    title,
    description,
    canonicalUrl,
    image,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: partnerName,
      url: canonicalUrl,
      image: image || undefined,
      servesCuisine: "Pizza",
      potentialAction: {
        "@type": "OrderAction",
        target: canonicalUrl,
        name: `Pide pizza en ${partnerName}`,
      },
    },
  };
};

export const buildStorefrontSeo = ({ partner, store, partnerSlug, storeSlug } = {}) => {
  const partnerName = getPartnerName(partner || store?.partner, partnerSlug);
  const displayName = buildStoreDisplayName({ partner, store, partnerSlug, storeSlug });
  const slug = [cleanText(partner?.slug || partnerSlug), cleanText(store?.slug || storeSlug)]
    .filter(Boolean)
    .join("/");
  const canonicalUrl = buildUrl(slug || "/");
  const title = `${displayName} | Tienda oficial - Pide pizza ahora`;
  const city = cleanText(store?.city);
  const storeName = getStoreName(store, storeSlug);
  const deliveryText =
    store?.deliveryEnabled === false
      ? "Haz tu pedido para recoger."
      : store?.pickupEnabled === false
        ? "Haz tu pedido a domicilio."
        : "Elige recogida o delivery.";
  const description = city
    ? `Tienda oficial de ${displayName}: carta online, pizzas y ofertas en ${city}. ${deliveryText}`
    : `Tienda oficial de ${displayName}: carta online, pizzas y ofertas. ${deliveryText}`;
  const image = cleanText(partner?.brandLogoUrl || store?.partner?.brandLogoUrl);

  return {
    title,
    description,
    canonicalUrl,
    image,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: displayName,
      url: canonicalUrl,
      image: image || undefined,
      telephone: cleanText(store?.tlf) || undefined,
      servesCuisine: "Pizza",
      brand: {
        "@type": "Brand",
        name: partnerName,
      },
      address: store
        ? {
            "@type": "PostalAddress",
            streetAddress: cleanText(store.address) || undefined,
            addressLocality: city || undefined,
            addressCountry: cleanText(partner?.country || store?.partner?.country) || undefined,
            name: storeName || undefined,
          }
        : undefined,
      potentialAction: {
        "@type": "OrderAction",
        target: canonicalUrl,
        name: `Pide pizza en ${displayName}`,
      },
    },
  };
};

export const applyPublicSeo = (seo = {}) => {
  if (typeof document === "undefined") return;

  const title = cleanText(seo.title) || DEFAULT_PUBLIC_TITLE;
  const description = cleanText(seo.description) || DEFAULT_PUBLIC_DESCRIPTION;
  const canonicalUrl = cleanText(seo.canonicalUrl) || buildUrl(window.location.pathname || "/");
  const image = cleanText(seo.image);

  document.title = title;

  upsertMeta({ name: "description", content: description });
  upsertMeta({ name: "application-name", content: SITE_NAME });
  upsertMeta({ property: "og:title", content: title });
  upsertMeta({ property: "og:description", content: description });
  upsertMeta({ property: "og:url", content: canonicalUrl });
  upsertMeta({ property: "og:type", content: "website" });
  upsertMeta({ property: "og:site_name", content: SITE_NAME });
  upsertMeta({ name: "twitter:card", content: image ? "summary_large_image" : "summary" });
  upsertMeta({ name: "twitter:title", content: title });
  upsertMeta({ name: "twitter:description", content: description });
  if (image) {
    upsertMeta({ property: "og:image", content: image });
    upsertMeta({ name: "twitter:image", content: image });
  }
  upsertCanonical(canonicalUrl);
  upsertJsonLd(seo.structuredData || null);
};

export const usePublicSeo = (seo) => {
  useEffect(() => {
    applyPublicSeo(seo);
  }, [seo]);
};
