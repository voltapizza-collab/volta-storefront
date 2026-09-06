import axios from "axios";
import { isNativePos, nativeAdapter } from './pos/nativeBridge';

const getDefaultApiUrl = () => {
  if (typeof window === "undefined") return "http://localhost:8080";

  const { protocol, hostname } = window.location;
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostname);

  if (isLocalHost) return "http://localhost:8080";
  if (protocol === "https:") return "https://api.voltapizza.com";

  return `${protocol}//${hostname}:8080`;
};

const baseURL =
  process.env.REACT_APP_API_URL?.trim() || getDefaultApiUrl();

const api = axios.create({
  ...(isNativePos ? { adapter: nativeAdapter } : {}),
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
