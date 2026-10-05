import axios from "axios";
import { isNativePos, nativeAdapter } from './pos/nativeBridge';
import { getCurrentSession, forgetSession } from './auth/webSession';

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

if (!isNativePos) {
  api.interceptors.request.use(config => {
    const session = getCurrentSession();
    const isOwnApi = new URL(config.url, config.baseURL).origin === new URL(baseURL).origin;
    if (isOwnApi && session && !config.headers.Authorization) config.headers.Authorization = `Bearer ${session.sessionToken}`;
    return config;
  });
  api.interceptors.response.use(response => response, error => {
    const session = getCurrentSession();
    if (error.response?.status === 401 && session && error.config?.headers?.Authorization === `Bearer ${session.sessionToken}` &&
        !/login|password/.test(error.config?.url || '')) {
      forgetSession(session);
      window.dispatchEvent(new Event('volta-session-expired'));
    }
    return Promise.reject(error);
  });
}

export default api;
