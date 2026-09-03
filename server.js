const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const BUILD_DIR = path.join(__dirname, "build");
const INDEX_PATH = path.join(BUILD_DIR, "index.html");
const DEFAULT_API_ORIGIN = "https://api.voltapizza.com";
const DEFAULT_TITLE = "Pide pizza online";
const DEFAULT_DESCRIPTION =
  "Pide pizza online en tu pizzeria local. Elige recogida o delivery y completa tu pedido en linea.";
const SITE_NAME = "Volta Pizza";
const HOST_REDIRECTS = {
  "mycrushpizza.com": "https://voltapizza.com/mycrushpizza",
  "www.mycrushpizza.com": "https://voltapizza.com/mycrushpizza",
  "juego.mycrushpizza.com": "https://voltapizza.com/mycrushpizza/coupons",
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

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

const includesText = (source, target) => {
  const normalizedSource = normalizeForCompare(source);
  const normalizedTarget = normalizeForCompare(target);
  return Boolean(normalizedSource && normalizedTarget && normalizedSource.includes(normalizedTarget));
};

const getPartnerPrimaryCity = (partner) => {
  const stores = Array.isArray(partner?.stores) ? partner.stores : [];
  const cities = [
    ...new Set(
      stores
        .filter((store) => store?.active !== false)
        .map((store) => cleanText(store?.city))
        .filter(Boolean)
    ),
  ];

  return cities.length === 1 ? cities[0] : "";
};

const getApiOrigin = () =>
  cleanText(process.env.VOLTA_API_URL || process.env.REACT_APP_API_URL) || DEFAULT_API_ORIGIN;

const getPartnerName = (partner, fallbackSlug) =>
  cleanText(partner?.name || partner?.partnerName) || slugToTitle(fallbackSlug) || "Tu pizzeria";

const getStoreName = (store, fallbackSlug) =>
  cleanText(store?.storeName || store?.name) || slugToTitle(fallbackSlug);

const buildRequestUrl = (req) => {
  const host = cleanText(req.headers["x-forwarded-host"] || req.headers.host) || "voltapizza.com";
  const proto = cleanText(req.headers["x-forwarded-proto"]) || "https";
  return `${proto}://${host}${req.url || "/"}`;
};

const buildAbsoluteUrl = (requestUrl, targetPath) => {
  const url = new URL(requestUrl);
  url.pathname = `/${cleanText(targetPath).replace(/^\/+/, "")}`;
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

const fetchJson = async (apiPath) => {
  const response = await fetch(`${getApiOrigin()}${apiPath}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) return null;
  return response.json();
};

const buildPartnerSeo = ({ partner, partnerSlug, requestUrl }) => {
  const partnerName = getPartnerName(partner, partnerSlug);
  const city = getPartnerPrimaryCity(partner);
  const displayName = city && !includesText(partnerName, city) ? `${partnerName} en ${city}` : partnerName;
  const slug = cleanText(partner?.slug || partnerSlug);
  const canonicalUrl = buildAbsoluteUrl(requestUrl, slug || "/");
  const title = `${partnerName} | Tienda oficial${city ? ` en ${city}` : ""}`;
  const description = `La pizzeria ${displayName}: carta online, pizzas, ofertas, recogida y delivery directo desde su tienda oficial.`;
  const image = cleanText(partner?.brandLogoUrl);

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
      servesCuisine: "Pizza",
      potentialAction: {
        "@type": "OrderAction",
        target: canonicalUrl,
        name: `Pide pizza en ${displayName}`,
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
  const title = `${displayName} | Tienda oficial`;
  const city = cleanText(store?.city);
  const storeName = getStoreName(store, storeSlug);
  const deliveryText =
    store?.deliveryEnabled === false
      ? "Haz tu pedido para recoger."
      : store?.pickupEnabled === false
        ? "Haz tu pedido a domicilio."
        : "Elige recogida o delivery.";
  const description = city
    ? `La pizzeria ${displayName}: carta online, pizzas y ofertas en ${city}. ${deliveryText}`
    : `La pizzeria ${displayName}: carta online, pizzas y ofertas. ${deliveryText}`;
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

const resolveSeo = async (req) => {
  const requestUrl = buildRequestUrl(req);
  const url = new URL(requestUrl);
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
    return buildPartnerSeo({ partner, partnerSlug, requestUrl });
  }

  const store = await fetchJson(
    `/stores/${encodeURIComponent(partnerSlug)}/${encodeURIComponent(secondSegment)}`
  );

  if (!store) return buildPartnerSeo({ partner, partnerSlug, requestUrl });

  return buildStoreSeo({
    partner,
    store,
    partnerSlug,
    storeSlug: secondSegment,
    requestUrl,
  });
};

const buildSeoTags = (seo) => {
  const title = escapeHtml(seo?.title || DEFAULT_TITLE);
  const description = escapeHtml(seo?.description || DEFAULT_DESCRIPTION);
  const canonicalUrl = escapeHtml(seo?.canonicalUrl || "");
  const image = escapeHtml(seo?.image || "");
  const jsonLd = JSON.stringify(seo?.structuredData || {}).replace(/</g, "\\u003c");

  return [
    "<!-- volta-public-seo -->",
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

const send = (res, statusCode, body, headers = {}) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const getStaticPath = (urlPathname) => {
  const decodedPath = decodeURIComponent(urlPathname);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(BUILD_DIR, normalizedPath);
  const relativePath = path.relative(BUILD_DIR, fullPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return fullPath;
};

const serveStaticFile = (req, res, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const cacheControl = filePath.includes(`${path.sep}static${path.sep}`)
    ? "public, max-age=31536000, immutable"
    : "public, max-age=300";

  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": cacheControl,
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
};

const serveIndex = async (req, res) => {
  if (!fs.existsSync(INDEX_PATH)) {
    send(res, 500, "Storefront build not found. Run npm run build before starting the server.", {
      "content-type": "text/plain; charset=utf-8",
    });
    return;
  }

  const baseHtml = fs.readFileSync(INDEX_PATH, "utf8");
  let seo = null;

  try {
    seo = await resolveSeo(req);
  } catch (error) {
    console.warn("[storefront-seo] Failed to resolve public SEO:", error?.message || error);
  }

  const html = seo ? injectSeo(baseHtml, seo) : baseHtml;
  send(res, 200, req.method === "HEAD" ? "" : html, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": seo ? "s-maxage=300, stale-while-revalidate=3600" : "public, max-age=300",
    ...(seo ? { "x-volta-seo": "public-business" } : {}),
  });
};

const server = http.createServer(async (req, res) => {
  const host = cleanText(req.headers.host).split(":")[0].toLowerCase();
  const redirectTarget = HOST_REDIRECTS[host];

  if (redirectTarget) {
    const sourceUrl = new URL(buildRequestUrl(req));
    res.writeHead(301, {
      location: `${redirectTarget}${sourceUrl.search}${sourceUrl.hash}`,
    });
    res.end();
    return;
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    send(res, 405, "Method Not Allowed", {
      allow: "GET, HEAD",
      "content-type": "text/plain; charset=utf-8",
    });
    return;
  }

  const requestUrl = new URL(buildRequestUrl(req));
  const staticPath = getStaticPath(requestUrl.pathname);

  if (staticPath && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    serveStaticFile(req, res, staticPath);
    return;
  }

  await serveIndex(req, res);
});

server.listen(PORT, () => {
  console.log(`Volta storefront running on port ${PORT}`);
});
