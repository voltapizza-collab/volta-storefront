import { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import BackofficeNotifications from "./BackofficeNotifications";
import api from "../../../setupAxios";
import { NOTIFICATIONS_REFRESH_MS } from "./useBackofficeNotifications";
import { BACKOFFICE_LANGUAGES, createBackofficeTranslator } from "../../../constants/i18n";
import { NOTIFICATION_TRANSLATIONS } from "../../../constants/notificationTranslations";
import { notificationFromSmsBalance, localizeNotification } from "./notificationContent";

jest.mock("../../../setupAxios", () => ({ get: jest.fn() }));
const sms = (remaining = 10) => ({
  id: "sms-balance", revision: remaining === 0 ? "critical" : remaining <= 10 ? "urgent" : "warning",
  severity: remaining === 0 ? "critical" : remaining <= 10 ? "urgent" : "warning", category: "sms",
  requiresAction: true, remaining, title: remaining ? `Te quedan ${remaining} mensajes` : "Te has quedado sin mensajes",
  message: "Recarga para seguir enviando mensajes.", action: { label: "Recargar ahora", target: "sms-credits" },
});
const news = { id: "release-one", revision: 1, severity: "info", category: "improvement", requiresAction: false,
  title: "Una mejora de Volta", message: "Ahora tienes avisos al entrar.", publishedAt: "2026-09-12T00:00:00Z" };
const respond = (notifications) => api.get.mockResolvedValue({ data: { ok: true, notifications } });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const tick = async () => { await act(async () => { jest.advanceTimersByTime(NOTIFICATIONS_REFRESH_MS); }); };
const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear(); api.get.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("opens centrally on entry, uses the existing SMS destination, and keeps the unresolved count", async () => {
  respond([sms(), news]);
  const onNavigate = jest.fn();
  render(<BackofficeNotifications partnerId={7} onNavigate={onNavigate} />);
  await flush();
  expect(dialog()).not.toBeNull();
  expect(within(dialog()).getByRole("heading").textContent).toBe("Te quedan 10 mensajes");
  const link = within(dialog()).getByRole("link", { name: /Recargar ahora/ });
  expect(link.getAttribute("href")).toBe("/Backoffice?section=sms-credits");
  fireEvent.click(link);
  expect(onNavigate).toHaveBeenCalledWith("sms-credits");
  expect(dialog()).toBeNull();
  expect(screen.getByRole("button", { name: "Avisos: 2 pendientes" })).not.toBeNull();
  expect(localStorage.getItem("volta_backoffice_notices_read_v1:7")).toBeNull();
});

test("dismissed operational alerts stay quiet during polling but return on the next opening", async () => {
  respond([sms()]);
  const first = render(<BackofficeNotifications partnerId={7} />); await flush();
  fireEvent.click(screen.getByRole("button", { name: "Recordármelo al volver" }));
  await tick(); expect(dialog()).toBeNull();
  first.unmount();
  render(<BackofficeNotifications partnerId={7} />); await flush();
  expect(dialog()).not.toBeNull();
});

test("unread notes survive closing; explicitly read notes stay in history and revisions reappear", async () => {
  respond([news]);
  const first = render(<BackofficeNotifications partnerId={7} />); await flush();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar avisos" }));
  first.unmount();
  const second = render(<BackofficeNotifications partnerId={7} />); await flush();
  expect(dialog()).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Marcar como leído" }));
  expect(dialog()).toBeNull(); second.unmount();
  render(<BackofficeNotifications partnerId={7} />); await flush();
  expect(dialog()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Avisos" }));
  expect(within(dialog()).getByText(/Leído/)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar avisos" }));
  respond([{ ...news, revision: 2 }]); await tick();
  expect(dialog()).not.toBeNull();
});

test("escalation interrupts again, recovery removes the alert, and a later drop can alert again", async () => {
  respond([sms(50)]);
  render(<BackofficeNotifications partnerId={7} />); await flush();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar avisos" }));
  respond([sms(10)]); await tick();
  expect(within(dialog()).getByRole("heading").textContent).toBe("Te quedan 10 mensajes");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar avisos" }));
  respond([sms(0)]); await tick();
  expect(within(dialog()).getByRole("heading").textContent).toBe("Te has quedado sin mensajes");
  respond([]); await tick(); expect(dialog()).toBeNull();
  expect(screen.getByRole("button", { name: "Avisos" })).not.toBeNull();
  respond([sms()]); await tick(); expect(dialog()).not.toBeNull();
});

test("API errors are visible, preserve the last known alert, and recover with retry", async () => {
  api.get.mockRejectedValue(new Error("offline"));
  render(<BackofficeNotifications partnerId={7} />); await flush();
  expect(dialog()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /No se pudieron comprobar/ }));
  expect(within(dialog()).getByRole("heading").textContent).toBe("No pudimos comprobar tus avisos");
  respond([sms()]); fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); await flush();
  expect(within(dialog()).getByRole("heading").textContent).toBe("Te quedan 10 mensajes");
  api.get.mockRejectedValue(new Error("offline")); await tick();
  expect(within(dialog()).getByText(/El saldo mostrado puede haber cambiado/)).not.toBeNull();
  expect(within(dialog()).getByRole("heading").textContent).toBe("Te quedan 10 mensajes");
});

test("a new release cannot displace an unresolved urgent alert; advancing reaches the release", async () => {
  respond([sms()]);
  render(<BackofficeNotifications partnerId={7} />); await flush();
  respond([sms(), news]); await tick();
  expect(within(dialog()).getByRole("heading").textContent).toBe("Te quedan 10 mensajes");
  fireEvent.click(screen.getByRole("button", { name: "Recordármelo al volver" }));
  expect(within(dialog()).getByRole("heading").textContent).toBe("Una mejora de Volta");
  fireEvent.click(screen.getByRole("button", { name: "Marcar como leído" }));
  expect(dialog()).toBeNull();
  expect(screen.getByRole("button", { name: "Avisos: 1 pendientes" })).not.toBeNull();
});

test("partner changes isolate receipts and ignore stale responses after unmount", async () => {
  let resolveOld;
  api.get.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<BackofficeNotifications key={7} partnerId={7} />);
  respond([news]);
  view.rerender(<BackofficeNotifications key={8} partnerId={8} />); await flush();
  fireEvent.click(screen.getByRole("button", { name: "Marcar como leído" }));
  await act(async () => { resolveOld({ data: { ok: true, notifications: [sms()] } }); });
  expect(dialog()).toBeNull();
  expect(localStorage.getItem("volta_backoffice_notices_read_v1:7")).toBeNull();
  expect(JSON.parse(localStorage.getItem("volta_backoffice_notices_read_v1:8"))).toEqual(["release-one:1"]);
  view.rerender(<BackofficeNotifications key={7} partnerId={7} />); await flush();
  expect(dialog()).not.toBeNull();
});

test("visibility, focus and credit events refresh; polling pauses in hidden tabs and stops after unmount", async () => {
  respond([]);
  const view = render(<BackofficeNotifications partnerId={7} />); await flush();
  expect(api.get).toHaveBeenCalledTimes(1);
  const visibility = jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await tick(); expect(api.get).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange")); await flush();
  fireEvent(window, new Event("focus")); await flush();
  fireEvent(window, new Event("volta:sms-balance-changed")); await flush();
  expect(api.get).toHaveBeenCalledTimes(4);
  view.unmount(); await tick();
  fireEvent(window, new Event("focus"));
  expect(api.get).toHaveBeenCalledTimes(4);
});

test("strict effects, blocked storage and Escape keep the backoffice usable", async () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  respond([news]);
  render(<StrictMode><BackofficeNotifications partnerId={7} /></StrictMode>); await flush();
  expect(dialog()).not.toBeNull();
  fireEvent(dialog(), new Event("cancel", { cancelable: true }));
  expect(dialog()).toBeNull();
  expect(document.body.style.overflow).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Avisos: 1 pendientes" }));
  fireEvent.click(screen.getByRole("button", { name: "Marcar como leído" }));
  await tick(); expect(dialog()).toBeNull();
});

test("all selector languages translate the whole notification UI and SMS singular/plural", () => {
  const keys = Object.keys(NOTIFICATION_TRANSLATIONS.es).sort();
  for (const { code } of BACKOFFICE_LANGUAGES) {
    expect(Object.keys(NOTIFICATION_TRANSLATIONS[code]).sort()).toEqual(keys);
    const t = createBackofficeTranslator(code);
    expect(localizeNotification(sms(1), code, t).title).toBe(t("notices.smsOne"));
    expect(localizeNotification(sms(10), code, t).title).toBe(t("notices.smsMany", { count: 10 }));
    expect(localizeNotification(sms(0), code, t).title).toBe(t("notices.smsZero"));
    expect(t("notices.moreMany", { count: 3 })).toContain("3");
    expect(t("notices.moreMany", { count: 3 })).not.toContain("{count}");
  }
});

test("changing the selected language translates live without refetching, dismissing, or resetting read state", async () => {
  respond([sms(0)]);
  const view = render(<BackofficeNotifications partnerId={7} language="en" />); await flush();
  expect(screen.getByRole("button", { name: "Notifications: 1 pending" })).not.toBeNull();
  expect(within(dialog()).getByRole("heading").textContent).toBe("You've run out of messages");
  expect(within(dialog()).getByRole("link", { name: /Top up now/ })).not.toBeNull();
  expect(dialog().getAttribute("lang")).toBe("en");
  for (const { code } of BACKOFFICE_LANGUAGES) {
    view.rerender(<BackofficeNotifications partnerId={7} language={code} />);
    expect(within(dialog()).getByRole("heading").textContent).toBe(createBackofficeTranslator(code)("notices.smsZero"));
    expect(dialog().getAttribute("lang")).toBe(code);
  }
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Fechar notificações" }));
  view.rerender(<BackofficeNotifications partnerId={7} language="en" />);
  expect(dialog()).toBeNull();
});

test("release text, action labels and dates use translations while read receipts keep the same ID", async () => {
  const localized = { ...news, action: { target: "settings", label: "Ver ajustes" }, translations: {
    en: { title: "A Volta improvement", message: "Updates when you sign in.", detail: "All in one place.", actionLabel: "View settings" },
    fr: { title: "Une nouveauté Volta", message: "Les nouveautés à la connexion.", detail: "Tout au même endroit.", actionLabel: "Voir les réglages" },
  } };
  respond([localized]);
  const view = render(<BackofficeNotifications partnerId={7} language="en" />); await flush();
  expect(within(dialog()).getByRole("heading").textContent).toBe("A Volta improvement");
  expect(within(dialog()).getByRole("link", { name: /View settings/ })).not.toBeNull();
  expect(within(dialog()).getByText(/September/)).not.toBeNull();
  view.rerender(<BackofficeNotifications partnerId={7} language="fr" />);
  expect(within(dialog()).getByRole("heading").textContent).toBe("Une nouveauté Volta");
  expect(within(dialog()).getByText(/septembre/)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Marquer comme lu" }));
  view.rerender(<BackofficeNotifications partnerId={7} language="en" />);
  expect(dialog()).toBeNull();
  expect(JSON.parse(localStorage.getItem("volta_backoffice_notices_read_v1:7"))).toEqual(["release-one:1"]);
});

test("a missing feed still shows the live exhausted SMS balance and recovers when the feed returns", async () => {
  api.get.mockImplementation((url) => url.includes("backoffice-notifications")
    ? Promise.reject({ response: { status: 404, data: "Cannot GET /api/backoffice-notifications/7" } })
    : Promise.resolve({ data: { ok: true, balance: { smsCredits: 0, smsLowBalanceThreshold: 50 } } }));
  render(<BackofficeNotifications partnerId={7} language="en" />); await flush();
  expect(within(dialog()).getByRole("heading").textContent).toBe("You've run out of messages");
  expect(within(dialog()).getByRole("link", { name: /Top up now/ })).not.toBeNull();
  expect(within(dialog()).getByText(/Balance updated/)).not.toBeNull();
  expect(api.get).toHaveBeenCalledWith("/api/sms-credits/7", expect.any(Object));
  expect(screen.getByRole("button", { name: "Notifications: 1 pending" })).not.toBeNull();
  api.get.mockImplementation((url) => url.includes("backoffice-notifications")
    ? Promise.reject({ response: { status: 404 } })
    : Promise.resolve({ data: { ok: true, balance: { smsCredits: 150, smsLowBalanceThreshold: 50 } } }));
  await tick(); expect(dialog()).toBeNull();
  expect(screen.queryByText("You're up to date")).toBeNull();
  respond([news]); await tick();
  expect(within(dialog()).getByRole("heading").textContent).toBe(news.title);
  expect(within(dialog()).queryByText(/temporarily unavailable/)).toBeNull();
});

test("wallet fallback does not fabricate zero credits or bypass authentication/partner errors", async () => {
  api.get.mockImplementation((url) => url.includes("backoffice-notifications")
    ? Promise.reject({ response: { status: 404 } })
    : Promise.resolve({ data: { ok: true, balance: { smsCredits: null } } }));
  const view = render(<BackofficeNotifications partnerId={7} language="en" />); await flush();
  expect(dialog()).toBeNull();
  expect(screen.getByRole("button", { name: /Could not check notifications/ })).not.toBeNull();
  view.unmount();
  for (const response of [{ status: 401 }, { status: 403 }, { status: 404, data: { error: "partner_not_found" } }]) {
    api.get.mockReset().mockRejectedValue({ response });
    const instance = render(<BackofficeNotifications partnerId={8} />); await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
    instance.unmount();
  }
});

test("wallet fallback honors the same warning and urgent boundaries as the backend", () => {
  for (const [smsCredits, revision] of [[51, undefined], [50, "warning"], [11, "warning"], [10, "urgent"], [0, "critical"]]) {
    expect(notificationFromSmsBalance({ smsCredits, smsLowBalanceThreshold: 50 })?.revision).toBe(revision);
  }
  expect(notificationFromSmsBalance({ smsCredits: 10, smsLowBalanceThreshold: 0 }).revision).toBe("urgent");
  expect(notificationFromSmsBalance({ smsCredits: 75, smsLowBalanceThreshold: 80 }).revision).toBe("warning");
  expect(() => notificationFromSmsBalance({})).toThrow();
});
