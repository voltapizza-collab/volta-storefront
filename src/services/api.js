const API_URL =
  process.env.REACT_APP_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8080";

/* =========================
   CORE REQUEST (GENÉRICO)
========================= */
const request = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error:", text);
    throw new Error(text || "API error");
  }

  return res.json();
};

/* =========================
   MÉTODOS GENÉRICOS
========================= */
const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patch: (path, body) =>
    request(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

/* =========================
   FUNCIONES EXISTENTES
========================= */
export const getStore = async (partnerSlug, storeSlug) => {
  console.log("Fetching store:", partnerSlug, storeSlug);

  const data = await api.get(
    `/stores/${partnerSlug}/${storeSlug}`
  );

  console.log("Store data:", data);

  return data;
};

export const getPartner = async (partnerSlug) => {
  const data = await api.get(`/partners/${partnerSlug}`);
  return data;
};

export default api;
