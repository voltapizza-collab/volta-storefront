const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export const getStore = async (slug) => {
  const res = await fetch(`${API_URL}/stores/${slug}`);
  if (!res.ok) throw new Error("store not found");
  return res.json();
};