import { useCallback, useEffect, useState } from "react";
import api from "../../../setupAxios";
import { notificationFromSmsBalance } from "./notificationContent";

export const NOTIFICATIONS_REFRESH_MS = 60000;
export const notificationKey = (notice) => `${notice.id}:${notice.revision}`;
const storageKey = (partnerId) => `volta_backoffice_notices_read_v1:${partnerId}`;

function readReceipts(partnerId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(partnerId)) || "[]");
    return Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : [];
  } catch { return []; }
}

// The parent keys the notification center by partner ID, isolating requests and receipts.
export default function useBackofficeNotifications(partnerId) {
  const [notifications, setNotifications] = useState([]);
  const [read, setRead] = useState(() => readReceipts(partnerId));
  const [error, setError] = useState(false);
  const [updatesUnavailable, setUpdatesUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const { data } = await api.get(`/api/backoffice-notifications/${partnerId}`, {
          signal: controller.signal,
          timeout: 15000,
        });
        if (!data?.ok || !Array.isArray(data.notifications)) throw new Error("Invalid notification feed");
        if (active) {
          setNotifications(data.notifications);
          setError(false);
          setUpdatesUnavailable(false);
        }
      } catch (feedError) {
        if (!active) return;
        // During a staggered rollout the new feed may not exist yet. The wallet
        // remains the source of truth for SMS; do not hide an exhausted balance.
        const status = feedError.response?.status;
        if ([401, 403].includes(status) || feedError.response?.data?.error === "partner_not_found") {
          setError(true);
        } else {
          try {
            const { data } = await api.get(`/api/sms-credits/${partnerId}`, {
              signal: controller.signal, timeout: 15000,
            });
            if (!data?.ok) throw new Error("Invalid wallet response");
            const sms = notificationFromSmsBalance(data.balance);
            if (active) {
              setNotifications((previous) => [
                ...(sms ? [sms] : []), ...previous.filter((notice) => notice.category !== "sms"),
              ]);
              setError(false);
              setUpdatesUnavailable(true);
            }
          } catch {
            if (active) setError(true);
          }
        }
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, NOTIFICATIONS_REFRESH_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("volta:sms-balance-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("volta:sms-balance-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [partnerId, retry]);

  useEffect(() => {
    const syncRead = (event) => {
      if (!event.key || event.key === storageKey(partnerId)) setRead(readReceipts(partnerId));
    };
    window.addEventListener("storage", syncRead);
    return () => window.removeEventListener("storage", syncRead);
  }, [partnerId]);

  const markRead = useCallback((notice) => {
    if (notice.requiresAction) return;
    setRead((previous) => {
      const next = [...new Set([...readReceipts(partnerId), ...previous, notificationKey(notice)])].slice(-500);
      try { localStorage.setItem(storageKey(partnerId), JSON.stringify(next)); } catch { /* Keep in memory. */ }
      return next;
    });
  }, [partnerId]);

  return {
    notifications, read, error, updatesUnavailable, loading, markRead,
    refresh: () => { setLoading(true); setRetry((value) => value + 1); },
  };
}
