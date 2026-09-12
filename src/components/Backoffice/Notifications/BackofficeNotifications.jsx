import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBackofficeNotifications, { notificationKey } from "./useBackofficeNotifications";
import { localizeNotification } from "./notificationContent";
import { createBackofficeTranslator, normalizeBackofficeLanguage } from "../../../constants/i18n";
import "../../../styles/BackofficeNotifications.css";

const destinations = {
  "sms-credits": "/Backoffice?section=sms-credits",
  communications: "/Backoffice?section=communications",
  settings: "/Backoffice?section=settings",
  "settings-tracking": "/Backoffice?section=settings-tracking",
};

function NoticeIcon({ sms = false }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {sms ? <><path d="M7 5h18a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H14l-7 5v-5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" /><path d="M16 10v6m0 4h.01" /></>
        : <><path d="M23 10a7 7 0 0 0-14 0c0 10-4 10-4 13h22c0-3-4-3-4-13ZM13 27h6" /><path d="M16 2V1" /></>}
    </svg>
  );
}

export default function BackofficeNotifications({ partnerId, onNavigate, language = "es" }) {
  const locale = normalizeBackofficeLanguage(language);
  const t = useMemo(() => createBackofficeTranslator(locale), [locale]);
  const { notifications, read, error, updatesUnavailable, loading, markRead, refresh } = useBackofficeNotifications(partnerId);
  const [queue, setQueue] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const surfaced = useRef(new Set());
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const current = localizeNotification(queue.map((key) => notifications.find((item) => notificationKey(item) === key)).find(Boolean), locale, t);
  const open = Boolean(current) || manualOpen;
  const pendingCount = notifications.filter((item) => item.requiresAction || !read.includes(notificationKey(item))).length;

  useEffect(() => {
    const liveKeys = new Set(notifications.map(notificationKey));
    // A resolved operational alert can fire again if the balance drops in this opening.
    surfaced.current = new Set([...surfaced.current].filter((key) => liveKeys.has(key)));
    const fresh = notifications.filter((item) => !surfaced.current.has(notificationKey(item)) &&
      (item.requiresAction || !read.includes(notificationKey(item))));
    fresh.forEach((item) => surfaced.current.add(notificationKey(item)));
    setQueue((previous) => {
      const remaining = previous.filter((key) => liveKeys.has(key));
      if (!fresh.length && remaining.length === previous.length) return previous;
      const queued = new Set([...fresh.map(notificationKey), ...remaining]);
      // Preserve the server's priority when a new release arrives during an urgent alert.
      return notifications.map(notificationKey).filter((key) => queued.has(key));
    });
  }, [notifications, read]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const destination = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : triggerRef.current;
      destination?.focus();
    };
  }, [open]);

  const close = () => { setQueue([]); setManualOpen(false); };
  const advance = () => {
    if (current) markRead(current);
    setQueue((previous) => previous.filter((key) => key !== notificationKey(current)));
    setManualOpen(false);
  };
  const openAll = () => {
    setQueue(notifications.map(notificationKey));
    setManualOpen(true);
  };
  const navigate = (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    markRead(current);
    close();
    onNavigate(current.action.target);
  };
  const remainingCount = queue.filter((key) => notifications.some((item) => notificationKey(item) === key)).length;
  const keepFocusInDialog = (event) => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), a[href]")];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  };

  return (
    <>
      <button type="button" ref={triggerRef} className="bo-notices-trigger" onClick={openAll} aria-haspopup="dialog"
        aria-label={`${t("notices.title")}${pendingCount ? `: ${t("notices.pending", { count: pendingCount })}` : ""}${error ? `. ${t("notices.checkFailed")}` : ""}`}>
        <NoticeIcon />
        <span>{t("notices.title")}<small>{t(error ? "notices.checkFailed" : loading ? "notices.checking" : pendingCount ? "notices.somethingNew" : updatesUnavailable ? "notices.updatesPending" : "notices.upToDate")}</small></span>
        {(pendingCount > 0 || error) && <strong className="bo-notices-count">{error ? "!" : pendingCount}</strong>}
      </button>

      {createPortal(
        <dialog ref={dialogRef} className="bo-notices-dialog" lang={locale} aria-labelledby="bo-notice-title" aria-describedby="bo-notice-message"
          onKeyDown={keepFocusInDialog}
          onCancel={(event) => { event.preventDefault(); close(); }}>
          <div className="bo-notices-header">
            <div className="bo-notices-brand"><img src="/favicon.svg" alt="" /><span>VOLTA<small>{t("notices.tagline")}</small></span></div>
            <button className="bo-notices-close" type="button" onClick={close} aria-label={t("notices.close")}>×</button>
          </div>
          <div className="bo-notices-body">
            {(error || updatesUnavailable) && <div className="bo-notices-error" role="status">
              {error ? `${t("notices.refreshFailed")} ${notifications.length > 0 ? t("notices.staleBalance") : ""}` : t("notices.updatesUnavailable")}{" "}
              <button type="button" onClick={refresh} disabled={loading}>{t(loading ? "notices.checking" : "notices.retry")}</button>
            </div>}
            {current ? <>
              <div className="bo-notices-eyebrow"><span className={`bo-notices-dot is-${current.severity}`} />{t(["critical", "urgent", "warning", "info"].includes(current.severity) ? `notices.${current.severity}` : "notices.important")}</div>
              <div className="bo-notices-symbol"><NoticeIcon sms={current.category === "sms"} /></div>
              {current.category === "sms" && <div className="bo-notices-balance"><strong>{new Intl.NumberFormat(locale).format(current.remaining)}</strong><span>{t("notices.smsAvailable")}</span></div>}
              <h2 id="bo-notice-title">{current.title}</h2>
              <p id="bo-notice-message">{current.message}</p>
              {current.detail && <p className="bo-notices-detail">{current.detail}</p>}
              {current.publishedAt && <time className="bo-notices-date" dateTime={current.publishedAt}>
                {new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(current.publishedAt))}
                {read.includes(notificationKey(current)) && ` · ${t("notices.read")}`}
              </time>}
              <div className="bo-notices-actions">
                {destinations[current.action?.target] && <a className="bo-notices-primary" href={destinations[current.action.target]} onClick={navigate}>
                  {current.action.label}<span aria-hidden="true">↗</span>
                </a>}
                <button className={current.action ? "bo-notices-secondary" : "bo-notices-primary"} type="button" onClick={advance}>
                  {t(current.requiresAction ? "notices.remind" : read.includes(notificationKey(current)) ? "notices.continue" : "notices.markRead")}
                </button>
              </div>
            </> : <>
              <div className="bo-notices-symbol"><NoticeIcon /></div>
              <h2 id="bo-notice-title">{t(error ? "notices.errorTitle" : loading ? "notices.checkingTitle" : updatesUnavailable ? "notices.title" : "notices.upToDate")}</h2>
              <p id="bo-notice-message">{t(error ? "notices.errorMessage" : "notices.emptyMessage")}</p>
              <button className="bo-notices-primary" type="button" onClick={close}>{t("notices.back")}</button>
            </>}
          </div>
          <div className="bo-notices-footer"><span>{t(current?.requiresAction ? "notices.pendingRecharge" : "notices.footer")}</span>
            {remainingCount > 1 && <span>{t(remainingCount === 2 ? "notices.moreOne" : "notices.moreMany", { count: remainingCount - 1 })}</span>}
          </div>
        </dialog>, document.body)}
    </>
  );
}
