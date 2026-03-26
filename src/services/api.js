const API_URL =
  process.env.REACT_APP_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8080";

export const getStore = async (slug) => {
  console.log("Fetching store:", slug);

  const res = await fetch(`${API_URL}/stores/${slug}`);

  if (!res.ok) {
    const text = await res.text();
    console.error("API error:", text);
    throw new Error("store not found");
  }

  const data = await res.json();
  console.log("Store data:", data);

  return data;
};