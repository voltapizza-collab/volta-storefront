import { useCallback, useEffect, useState } from "react";
import api from "../../../setupAxios";
import { notificationFromSmsBalance } from "./notificationContent";

export const NOTIFICATIONS_REFRESH_MS = 60000;
export const notificationKey = (notice) => `${notice.id}:${notice.revision}`;
const storageKey = (partnerId) => `volta_backoffice_notices_read_v1:${partnerId}`;
const historyKey = (partnerId) => `volta_backoffice_notices_history_v1:${partnerId}`;
const memory = new Map();
function loadSaved(key, fallback = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return [...(Array.isArray(saved) ? saved : fallback), ...(memory.get(key) || [])];
  } catch { return memory.get(key) || fallback; }
}
function saveLocal(key, value) {
  try {
    const serialized = JSON.stringify(value);
    if (localStorage.getItem(key) !== serialized) localStorage.setItem(key, serialized);
    memory.delete(key);
  } catch { memory.set(key, value); /* Preserve across mounts in this session. */ }
}

function readReceipts(partnerId) {
  return [...new Set([...loadSaved(storageKey(partnerId)).filter(key => typeof key === 'string'),
    ...readHistory(partnerId).map(notificationKey)])];
}
const readHistory = partnerId => loadSaved(historyKey(partnerId)).filter(item => item && typeof item.id === 'string' && item.revision != null && !item.requiresAction);
const mergeHistory = (...groups) => [...new Map(groups.flat().map(item => [notificationKey(item), item])).values()];

// The parent keys the notification center by partner ID, isolating requests and receipts.
export default function useBackofficeNotifications(partnerId) {
  const [notifications, setNotifications] = useState([]);
  const [read, setRead] = useState(() => readReceipts(partnerId));
  const [history, setHistory] = useState(() => readHistory(partnerId));
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
      if (!event.key || event.key === storageKey(partnerId)) setRead(previous => [...new Set([...previous, ...readReceipts(partnerId)])]);
      if (!event.key || event.key === historyKey(partnerId)) setHistory(previous => mergeHistory(previous, readHistory(partnerId)));
    };
    window.addEventListener("storage", syncRead);
    return () => window.removeEventListener("storage", syncRead);
  }, [partnerId]);

  // Keep the content of read releases even after they leave the current feed.
  // Also migrate receipts written before the history view existed.
  useEffect(() => {
    const receipts = [...new Set([...readReceipts(partnerId), ...read])];
    if (receipts.length) saveLocal(storageKey(partnerId), receipts);
    setHistory(previous => {
      const next = mergeHistory(readHistory(partnerId), previous, notifications.filter(item => !item.requiresAction && receipts.includes(notificationKey(item))));
      if (JSON.stringify(next) === JSON.stringify(previous)) return previous;
      saveLocal(historyKey(partnerId), next);
      return next;
    });
  }, [notifications, read, partnerId]);

  const markRead = useCallback((notice) => {
    if (notice.requiresAction) return;
    const next = [...new Set([...readReceipts(partnerId), ...read, notificationKey(notice)])];
    const original = notifications.find(item => notificationKey(item) === notificationKey(notice)) || notice;
    const saved = mergeHistory(history, readHistory(partnerId), [original]);
    saveLocal(storageKey(partnerId), next);
    saveLocal(historyKey(partnerId), saved);
    setRead(next); setHistory(saved);
  }, [partnerId, read, history, notifications]);

  return {
    notifications, read, history, error, updatesUnavailable, loading, markRead,
    refresh: () => { setLoading(true); setRetry((value) => value + 1); },
  };
}
