const DEFAULT_TITLE = "Pide pizza online";
const DEFAULT_DESCRIPTION =
  "Pide pizza online en tu pizzeria local. Elige recogida o delivery y completa tu pedido en linea.";
const DEFAULT_API_ORIGIN = "https://api.voltapizza.com";
const SITE_NAME = "Volta Pizza";
const SEO_TAG_MARKER = "<!-- volta-public-seo -->";

const cleanText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const escapeHtml = (value) =>
  cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

const getApiOrigin = () =>
  cleanText(process.env.VOLTA_API_URL || process.env.REACT_APP_API_URL) || DEFAULT_API_ORIGIN;

const includesText = (source, target) => {
  const normalizedSource = normalizeForCompare(source);
  const normalizedTarget = normalizeForCompare(target);
  return Boolean(normalizedSource && normalizedTarget && normalizedSource.includes(normalizedTarget));
};

const getPartnerName = (partner, fallbackSlug) =>
  cleanText(partner?.name || partner?.partnerName) || slugToTitle(fallbackSlug) || "Tu pizzeria";

const getStoreName = (store, fallbackSlug) =>
  cleanText(store?.storeName || store?.name) || slugToTitle(fallbackSlug);

const buildAbsoluteUrl = (requestUrl, path) => {
  const url = new URL(requestUrl);
  url.pathname = `/${cleanText(path).replace(/^\/+/, "")}`;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
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

const fetchJson = async (path) => {
  const response = await fetch(`${getApiOrigin()}${path}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) return null;
  return response.json();
};

const buildPartnerSeo = ({ partner, partnerSlug, requestUrl }) => {
  const partnerName = getPartnerName(partner, partnerSlug);
  const slug = cleanText(partner?.slug || partnerSlug);
  const canonicalUrl = buildAbsoluteUrl(requestUrl, slug || "/");
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

const buildStoreSeo = ({ partner, store, partnerSlug, storeSlug, requestUrl }) => {
  const partnerName = getPartnerName(partner || store?.partner, partnerSlug);
  const displayName = buildStoreDisplayName({ partner, store, partnerSlug, storeSlug });
  const slug = [cleanText(partner?.slug || partnerSlug), cleanText(store?.slug || storeSlug)]
    .filter(Boolean)
    .join("/");
  const canonicalUrl = buildAbsoluteUrl(requestUrl, slug || "/");
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

const resolveSeo = async (request) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const [partnerSlug, secondSegment] = segments;

  if (!partnerSlug || segments.length > 2) return null;

  const lowerPartnerSlug = partnerSlug.toLowerCase();
  if (
    [
      "admin",
      "api",
      "backoffice",
      "global-manager",
      "jugar",
      "onboarding",
      "perfect-timing",
      "pos",
      "reservation",
      "review",
      "seguimiento",
      "c",
    ].includes(lowerPartnerSlug)
  ) {
    return null;
  }

  const fetchedPartner = await fetchJson(`/partners/${encodeURIComponent(partnerSlug)}`);
  const partner =
    fetchedPartner ||
    (lowerPartnerSlug === "mycrushpizza"
      ? { name: "MyCrushPizza", slug: "mycrushpizza" }
      : null);

  if (!partner) return null;

  if (!secondSegment || ["coupons", "order"].includes(secondSegment.toLowerCase())) {
    return buildPartnerSeo({ partner, partnerSlug, requestUrl: request.url });
  }

  const store = await fetchJson(
    `/stores/${encodeURIComponent(partnerSlug)}/${encodeURIComponent(secondSegment)}`
  );

  if (!store) return buildPartnerSeo({ partner, partnerSlug, requestUrl: request.url });

  return buildStoreSeo({
    partner,
    store,
    partnerSlug,
    storeSlug: secondSegment,
    requestUrl: request.url,
  });
};

const buildSeoTags = (seo) => {
  const title = escapeHtml(seo?.title || DEFAULT_TITLE);
  const description = escapeHtml(seo?.description || DEFAULT_DESCRIPTION);
  const canonicalUrl = escapeHtml(seo?.canonicalUrl || "");
  const image = escapeHtml(seo?.image || "");
  const jsonLd = JSON.stringify(seo?.structuredData || {}).replace(/</g, "\\u003c");

  return [
    SEO_TAG_MARKER,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta name="description" content="${description}" />`,
    `<meta name="application-name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    image ? `<meta property="og:image" content="${image}" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    image ? `<meta name="twitter:image" content="${image}" />` : "",
    `<script id="volta-public-business-schema" type="application/ld+json">${jsonLd}</script>`,
  ]
    .filter(Boolean)
    .join("\n");
};

const injectSeo = (html, seo) => {
  const title = escapeHtml(seo?.title || DEFAULT_TITLE);
  const withoutDescription = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, "");
  const withoutCanonical = withoutDescription.replace(/<link\s+rel="canonical"[^>]*>/gi, "");
  const withTitle = withoutCanonical.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
  return withTitle.replace("</head>", `${buildSeoTags(seo)}\n</head>`);
};

export const config = {
  matcher: "/((?!static/|favicon.ico|favicon.png|favicon.svg|manifest.json|robots.txt|asset-manifest.json).*)",
};

export default async function middleware(request) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return;
  }

  try {
    const seo = await resolveSeo(request);
    if (!seo) return;

    const indexResponse = await fetch(new URL("/index.html", request.url));
    if (!indexResponse.ok) return;

    const html = injectSeo(await indexResponse.text(), seo);
    const headers = new Headers(indexResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "s-maxage=300, stale-while-revalidate=3600");
    headers.set("x-volta-seo", "public-business");

    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers,
    });
  } catch {
    return;
  }
}
