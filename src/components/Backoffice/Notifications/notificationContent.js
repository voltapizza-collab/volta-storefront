// Used only when the notifications feed is unavailable and the existing wallet responds.
export function notificationFromSmsBalance(balance) {
  if (!Number.isInteger(balance?.smsCredits)) throw new Error("SMS balance unavailable");
  const threshold = Number.isInteger(balance.smsLowBalanceThreshold) ? Math.max(10, balance.smsLowBalanceThreshold) : 50;
  if (balance.smsCredits > threshold) return null;
  const remaining = Math.max(0, balance.smsCredits);
  const severity = remaining === 0 ? "critical" : remaining <= 10 ? "urgent" : "warning";
  return {
    id: "sms-balance", revision: severity, category: "sms", severity, requiresAction: true, remaining,
    action: { target: "sms-credits" },
  };
}

export function localizeNotification(notice, language, t) {
  if (!notice) return null;
  if (notice.category === "sms" && notice.id === "sms-balance") {
    const remaining = notice.remaining;
    return {
      ...notice,
      title: t(remaining === 0 ? "notices.smsZero" : remaining === 1 ? "notices.smsOne" : "notices.smsMany", {
        count: new Intl.NumberFormat(language).format(remaining),
      }),
      message: t(remaining === 0 ? "notices.smsEmptyMessage" : remaining <= 10 ? "notices.smsUrgentMessage" : "notices.smsLowMessage"),
      detail: t("notices.smsDetail"),
      action: { ...notice.action, label: t("notices.recharge") },
    };
  }
  const translation = notice.translations?.[language] || (language !== "es" ? notice.translations?.en : null);
  return {
    ...notice,
    title: translation?.title || notice.title,
    message: translation?.message || notice.message,
    detail: translation?.detail ?? notice.detail,
    action: notice.action ? { ...notice.action, label: translation?.actionLabel || notice.action.label } : undefined,
  };
}
