import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../setupAxios";
import {
  customerSegmentMeta,
  customerSegmentLabel,
  normalizeCustomerSegment,
} from "../../constants/customerSegments";
import "../../styles/GlobalManager.css";

const POLL_MS = 10000;

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const formatNumber = (value) =>
  new Intl.NumberFormat("es-ES").format(Number(value || 0));

const VOLTA_HEAT_COLORS = {
  empty: "#fff5eb",
  low: "#ffe0bd",
  high: "#ff5a00",
};

const hexToRgb = (hex) => {
  const value = String(hex || "").replace("#", "");
  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const mixHex = (from, to, amount) => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const ratio = Math.max(0, Math.min(1, amount));
  const channel = (left, right) => Math.round(left + (right - left) * ratio);
  return `rgb(${channel(start.r, end.r)}, ${channel(start.g, end.g)}, ${channel(start.b, end.b)})`;
};

const getVoltaHeatColor = (heat) => {
  if (!heat) return VOLTA_HEAT_COLORS.empty;
  return mixHex(VOLTA_HEAT_COLORS.low, VOLTA_HEAT_COLORS.high, heat);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDate = (value) => {
  if (!value) return "-";
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const parseIsoDateParts = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const toCalendarColumn = (weekday) => {
  const normalized = Number(weekday);
  if (!Number.isInteger(normalized) || normalized < 0 || normalized > 6) return null;
  return normalized === 0 ? 7 : normalized;
};

const formatCalendarMonth = (year, month) =>
  new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

const buildTramoMonths = (days) => {
  const grouped = new Map();

  days.forEach((day) => {
    const parts = parseIsoDateParts(day.date);
    if (!parts) return;

    const key = `${parts.year}-${String(parts.month).padStart(2, "0")}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: formatCalendarMonth(parts.year, parts.month),
        year: parts.year,
        month: parts.month,
        days: [],
      });
    }

    const fallbackWeekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    grouped.get(key).days.push({
      ...day,
      dayNumber: parts.day,
      calendarColumn: toCalendarColumn(day.weekday) || toCalendarColumn(fallbackWeekday),
    });
  });

  return [...grouped.values()].map((month) => {
    const sortedDays = month.days.sort((left, right) => left.dayNumber - right.dayNumber);

    return {
      ...month,
      days: sortedDays,
    };
  });
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const parseMaybeJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const asArray = (value) => {
  const first = parseMaybeJson(value, []);
  const second = parseMaybeJson(first, []);
  return Array.isArray(second) ? second : [];
};

const asObject = (value) => {
  const parsed = parseMaybeJson(value, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const normalizeSearchText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatCustomerName = (name = "") => {
  const normalized = String(name || "").trim().replace(/\s+/g, " ");
  return normalized ? normalized.toLocaleUpperCase("es-ES") : "SIN CLIENTE";
};

const formatCustomerNameWithCount = (name = "", orderCount = 0) => {
  const formattedName = formatCustomerName(name);
  const count = Number(orderCount || 0);
  return count > 0 ? `${formattedName} (${count})` : formattedName;
};

const formatCustomerSegment = (value) => {
  const segment = normalizeCustomerSegment(value);
  return segment ? customerSegmentLabel(segment) : "";
};

const getCustomerSegmentTone = (value) => {
  const segment = normalizeCustomerSegment(value);
  return segment ? customerSegmentMeta(segment).tone : "";
};

const lineQty = (item) => {
  const qty = Number(item?.quantity ?? item?.qty ?? item?.cantidad ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const lineName = (item) => {
  if (item?.leftName && item?.rightName) {
    return `${item.leftName} / ${item.rightName}`;
  }

  return String(
    item?.name ||
      item?.pizzaName ||
      item?.title ||
      (item?.pizzaId ? `Producto #${item.pizzaId}` : "Producto")
  ).trim();
};

const lineSize = (item) => String(item?.size || item?.selectedSize || "").trim();

function OrderItems({ order }) {
  const products = asArray(order?.products);

  if (!products.length) {
    return <span className="gmo-muted">Sin items</span>;
  }

  return (
    <div className="gmo-items">
      {products.map((item, index) => {
        const size = lineSize(item);
        const extras = asArray(item?.extras)
          .map((extra) => extra?.label || extra?.name || extra?.code || extra)
          .filter(Boolean);

        return (
          <div key={`${order.id}-${index}`} className="gmo-itemLine">
            <strong>
              {lineName(item)}
              {size ? ` ${size}` : ""} x{lineQty(item)}
            </strong>
            {extras.length > 0 && <span>+ {extras.join(", ")}</span>}
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, hint, tone }) {
  return (
    <article className={`gmo-kpiCard ${tone ? `gmo-kpiCard--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

function CalendarIndicators({ indicators, currency }) {
  const expectedToday = indicators?.expectedToday;
  const topDays = indicators?.topUpcomingDays || [];
  const weights = expectedToday?.weights || {};
  const bestDay = topDays[0];
  const weekdayRankings = indicators?.rankings?.weekdays || [];
  const monthdayRankings = indicators?.rankings?.monthdays || [];
  const tramoMonths = buildTramoMonths((indicators?.upcomingDays || []).slice(0, 14));
  const topUpcomingDates = new Set(topDays.slice(0, 3).map((day) => day.date).filter(Boolean));

  return (
    <section className="gmo-calendarGrid">
      <article className="gmo-calendarCard gmo-calendarCard--expected">
        <div className="gmo-calendarHead">
          <div>
            <span>Expected day</span>
            <h3>Venta esperada del dia</h3>
          </div>
        </div>
        <strong className="gmo-calendarValue">
          {formatMoney(expectedToday?.expectedRevenue, currency)}
        </strong>
        <p>{`${expectedToday?.weekdayLabel || "-"} dia ${expectedToday?.dayOfMonth || "-"}`}</p>
        <div className="gmo-calendarAverages">
          <div>
            <span>Prom. dia semana</span>
            <strong>{formatMoney(expectedToday?.weekdayAverage, currency)}</strong>
            <small>{formatNumber(expectedToday?.weekdaySamples)} dias</small>
          </div>
          <div>
            <span>Prom. dia mes</span>
            <strong>{formatMoney(expectedToday?.monthdayAverage, currency)}</strong>
            <small>{formatNumber(expectedToday?.monthdaySamples)} dias</small>
          </div>
        </div>
        <div className="gmo-calendarMeta">
          <span>Semana {formatNumber(weights.weekdayPct)}%</span>
          <span>Dia mes {formatNumber(weights.monthdayPct)}%</span>
          <span>
            {weights.stronger === "monthday"
              ? "Manda dia mes"
              : weights.stronger === "weekday"
              ? "Manda semana"
              : "Fuerza pareja"}
          </span>
        </div>
      </article>

      <article className="gmo-calendarCard">
        <div className="gmo-calendarHead">
          <div>
            <span>Tramos</span>
            <h3>Calendario de cruces</h3>
          </div>
          <b>{bestDay ? formatMoney(bestDay.expectedRevenue, currency) : "-"}</b>
        </div>
        <p>
          {bestDay
            ? `Mejor cruce proximo: ${formatDate(bestDay.date)} - ${bestDay.weekdayLabel} dia ${bestDay.dayOfMonth}`
            : "Sin dias proyectados por ahora."}
        </p>
        <div className="gmo-tramoRanks">
          <span>
            Top semana:{" "}
            <strong>{weekdayRankings.slice(0, 3).map((row) => row.label).join(", ") || "-"}</strong>
          </span>
          <span>
            Top dia mes:{" "}
            <strong>{monthdayRankings.slice(0, 3).map((row) => row.key).join(", ") || "-"}</strong>
          </span>
        </div>
        <div className="gmo-tramoCalendar">
          {tramoMonths.map((month) => (
            <div key={month.key} className="gmo-monthCalendar">
              <h4>{month.label}</h4>
              <div className="gmo-weekdays">
                {["L", "M", "X", "J", "V", "S", "D"].map((label) => (
                  <span key={`${month.key}-${label}`}>{label}</span>
                ))}
              </div>
              <div className="gmo-monthGrid">
                {month.days.map((day) => {
                  const isTopUpcoming = topUpcomingDates.has(day.date);

                  return (
                    <div
                      key={day.date}
                      className={`gmo-dayCell gmo-dayCell--${day.tramoLevel || "normal"} ${
                        isTopUpcoming ? "gmo-dayCell--topUpcoming" : ""
                      }`}
                      style={day.calendarColumn ? { gridColumn: day.calendarColumn } : undefined}
                      title={`${formatDate(day.date)} - ${day.tramoReason || "Potencial normal"}`}
                    >
                      <strong>{day.dayNumber}</strong>
                      {day.isTopWeekday && day.isTopMonthday && <span>Cruce</span>}
                      {isTopUpcoming && !(day.isTopWeekday && day.isTopMonthday) && <span>Top</span>}
                      <small>{formatMoney(day.expectedRevenue, currency)}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!tramoMonths.length && <div className="gmo-empty gmo-empty--small">Sin ventas registradas.</div>}
        </div>
      </article>
    </section>
  );
}

function TrafficHeatmap({ heatmap, currency, updatedAt }) {
  const days = heatmap?.days || [];
  const rows = heatmap?.rows || [];
  const current = heatmap?.current || {};

  return (
    <section className="gmo-panel gmo-heatmapPanel">
      <div className="gmo-panelHead gmo-heatmapHead">
        <div>
          <span>Horario de trabajo</span>
          <h3>Productos por dia y hora</h3>
        </div>
        <small>{updatedAt ? `Ultima lectura ${formatDateTime(updatedAt)}` : ""}</small>
      </div>

      <div className="gmo-heatmapLegend" aria-label="Leyenda de intensidad">
        <span>Menos</span>
        <i className="gmo-heatLegend gmo-heatLegend--low" />
        <i className="gmo-heatLegend gmo-heatLegend--mid" />
        <i className="gmo-heatLegend gmo-heatLegend--high" />
        <span>Mas productos</span>
      </div>

      {rows.length && days.length ? (
        <div className="gmo-heatmapScroll">
          <div
            className="gmo-heatmapGrid"
            style={{
              "--gmo-heatmap-columns": `54px repeat(${days.length}, minmax(78px, 1fr))`,
            }}
          >
            <div className="gmo-heatmapCorner">Hora</div>
            {days.map((day) => (
              <div key={day.weekday} className="gmo-heatmapDayHead">
                <strong>{day.label}</strong>
                <span>{formatNumber(day.products ?? day.orders)} prod</span>
              </div>
            ))}

            {rows.map((row) => (
              <div key={row.hour} className="gmo-heatmapRow">
                <div className="gmo-heatmapHour">{row.label}</div>
                {row.cells.map((cell) => {
                  const isCurrent =
                    current?.weekday === cell.weekday && current?.hour === cell.hour;
                  const productCount = cell.products ?? cell.orders;
                  const isOpen = cell.isOpen !== false;
                  const visualHeat = isOpen && productCount
                    ? Math.max(0.2, Number(cell.intensity || 0))
                    : 0;
                  const heatColor = getVoltaHeatColor(visualHeat);
                  const tooltipValue = formatNumber(productCount);

                  return (
                    <div
                      key={`${cell.weekday}-${cell.hour}`}
                      className={`gmo-heatCell ${!isOpen ? "is-closed" : ""} ${
                        cell.isPeak ? "is-peak" : ""
                      } ${
                        isCurrent ? "is-current" : ""
                      }`}
                      style={{
                        "--heat": visualHeat.toFixed(2),
                        "--heat-color": heatColor,
                      }}
                      data-tooltip={isOpen ? tooltipValue : undefined}
                      title={isOpen ? tooltipValue : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="gmo-empty">Aun no hay historial suficiente para pintar productos por hora.</div>
      )}
    </section>
  );
}

export default function MyOrdersModule({ partner = null }) {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState("today");
  const [storeId, setStoreId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmReadyId, setConfirmReadyId] = useState(null);
  const seenIdsRef = useRef(new Set());

  const selectedStoreParam = storeId === "all" ? "" : storeId;
  const partnerScopeId = partner?.partnerId || partner?.id || "";
  const currency = summary?.currency || "EUR";

  const loadPending = useCallback(async () => {
    const params = {};
    if (partnerScopeId) params.partnerId = partnerScopeId;
    if (selectedStoreParam) params.storeId = selectedStoreParam;

    const response = await api.get("/api/myorders/pending", { params });
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    const previousSeen = seenIdsRef.current;
    const incoming = items.filter((item) => !previousSeen.has(item.id));

    if (previousSeen.size > 0 && incoming.length > 0) {
      setMessage(`${incoming.length} pedido(s) nuevo(s) recibido(s).`);
    }

    seenIdsRef.current = new Set(items.map((item) => item.id));
    setOrders(items);
  }, [partnerScopeId, selectedStoreParam]);

  const loadSummary = useCallback(async () => {
    const params = { period };
    if (partnerScopeId) params.partnerId = partnerScopeId;
    if (selectedStoreParam) params.storeId = selectedStoreParam;

    const response = await api.get("/api/myorders/summary", { params });
    setSummary(response.data || null);
  }, [partnerScopeId, period, selectedStoreParam]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      await Promise.all([loadPending(), loadSummary()]);
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo cargar MyOrders.");
    } finally {
      setLoading(false);
    }
  }, [loadPending, loadSummary]);

  useEffect(() => {
    seenIdsRef.current = new Set();
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadAll();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [loadAll]);

  const selectableStores = useMemo(
    () => summary?.availableStores || summary?.stores || [],
    [summary]
  );

  const readyOrder = async () => {
    if (!confirmReadyId) return;

    try {
      await api.patch(`/api/myorders/${confirmReadyId}/ready`);
      setOrders((current) => current.filter((order) => order.id !== confirmReadyId));
      setSelectedOrder((current) => (current?.id === confirmReadyId ? null : current));
      setConfirmReadyId(null);
      setMessage("Pedido marcado como listo.");
      await loadSummary();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo marcar como listo.");
    }
  };

  const kpis = summary?.kpis || {};
  const pendingTotal = kpis.pendingCount ?? orders.length;

  return (
    <div className="gmo-shell">
      <header className="gm-moduleHeader">
        <div>
          <span>My Orders</span>
          <h2>{partner?.partnerName ? `Ordenes de ${partner.partnerName}` : "Panel global de ordenes"}</h2>
        </div>
        <button type="button" onClick={loadAll} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      <section className="gmo-toolbar">
        <div className="gmo-segmented" aria-label="Periodo">
          <button
            type="button"
            className={period === "today" ? "active" : ""}
            onClick={() => setPeriod("today")}
          >
            Hoy
          </button>
          <button
            type="button"
            className={period === "week" ? "active" : ""}
            onClick={() => setPeriod("week")}
          >
            Semana
          </button>
        </div>

        <label className="gmo-filter">
          <span>Tienda</span>
          <select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            <option value="all">Todas las tiendas</option>
            {selectableStores.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {store.partnerName ? `${store.partnerName} - ` : ""}
                {store.storeName}
              </option>
            ))}
          </select>
        </label>

        <div className="gmo-liveBadge">
          <span className={pendingTotal > 0 ? "is-hot" : ""} />
          {pendingTotal > 0 ? `${pendingTotal} pendientes` : "Sin cola"}
        </div>
      </section>

      {message && <div className="gmo-message">{message}</div>}

      <section className="gmo-kpiGrid">
        <KpiCard
          label="Ventas periodo"
          value={formatMoney(kpis.revenue, currency)}
          hint={summary?.periodLabel || "Total cobrado"}
          tone="revenue"
        />
        <KpiCard
          label="Pedidos periodo"
          value={formatNumber(kpis.ordersCount)}
          hint={`Ticket medio ${formatMoney(kpis.averageTicket, currency)}`}
        />
        <KpiCard
          label="Cola pendiente"
          value={formatNumber(pendingTotal)}
          hint="Por preparar ahora"
          tone={pendingTotal > 0 ? "pending" : ""}
        />
        <KpiCard
          label="Clientes nuevos"
          value={formatNumber(kpis.newCustomers)}
          hint={`${formatNumber(kpis.uniqueCustomers)} compradores`}
        />
        <KpiCard
          label="Tiendas activas"
          value={formatNumber(kpis.activeStores)}
          hint="Dentro del alcance"
        />
        <KpiCard
          label="Delivery / Pickup"
          value={`${formatNumber(kpis.deliveryOrders)} / ${formatNumber(kpis.pickupOrders)}`}
          hint="Pedidos por canal"
        />
      </section>

      <CalendarIndicators indicators={summary?.calendarIndicators} currency={currency} />

      <div className="gmo-mainGrid">
        <TrafficHeatmap
          heatmap={summary?.trafficHeatmap}
          currency={currency}
          updatedAt={summary?.updatedAt}
        />
      </div>

      {selectedOrder && (
        <div className="gmo-modalBack" onMouseDown={() => setSelectedOrder(null)}>
          <div className="gmo-modalCard" onMouseDown={(event) => event.stopPropagation()}>
            <header className="gmo-modalHead">
              <div>
                <span>Pedido</span>
                <h3>{selectedOrder.code}</h3>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)}>
                x
              </button>
            </header>

            <div className="gmo-ticket">
              <div className="gmo-ticketLine">
                <span>Tienda</span>
                <strong>{selectedOrder.storeName}</strong>
              </div>
              {selectedOrder.boost?.active && (
                <div className="gmo-ticketLine gmo-ticketLine--boost">
                  <span>Boots</span>
                  <strong>
                    Prioridad #{selectedOrder.queuePosition || selectedOrder.boost.targetPosition || 1}
                    {" - "}
                    {formatMoney(selectedOrder.boost.amount, selectedOrder.currency || currency)}
                  </strong>
                </div>
              )}
              <div className="gmo-ticketLine">
                <span>Cliente</span>
                <strong>{selectedOrder.customerData?.name || "-"}</strong>
              </div>
              <div className="gmo-ticketLine">
                <span>Telefono</span>
                <strong>{selectedOrder.customerData?.phone || "-"}</strong>
              </div>
              {selectedOrder.customerData?.address_1 && (
                <div className="gmo-ticketLine gmo-ticketLine--block">
                  <span>Direccion</span>
                  <strong>{selectedOrder.customerData.address_1}</strong>
                </div>
              )}
              <div className="gmo-ticketItems">
                <OrderItems order={selectedOrder} />
              </div>
              {selectedOrder.notes && (
                <div className="gmo-ticketLine gmo-ticketLine--block">
                  <span>Notas</span>
                  <strong>{selectedOrder.notes}</strong>
                </div>
              )}
              <div className="gmo-ticketTotal">
                <span>Total</span>
                <strong>{formatMoney(selectedOrder.total, selectedOrder.currency || currency)}</strong>
              </div>
            </div>

            <footer className="gmo-modalActions">
              <button type="button" onClick={() => window.print()}>
                Print
              </button>
              <button type="button" onClick={() => setConfirmReadyId(selectedOrder.id)}>
                Ready
              </button>
            </footer>
          </div>
        </div>
      )}

      {confirmReadyId && (
        <div className="gmo-modalBack" onMouseDown={() => setConfirmReadyId(null)}>
          <div className="gmo-confirmCard" onMouseDown={(event) => event.stopPropagation()}>
            <h3>Confirmar pedido listo</h3>
            <p>Esto saca la orden de la cola global de pendientes.</p>
            <div className="gmo-modalActions">
              <button type="button" onClick={readyOrder}>
                Si, marcar listo
              </button>
              <button type="button" onClick={() => setConfirmReadyId(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrdersMovementsModule({ partner = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [storeName, setStoreName] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedMovement, setSelectedMovement] = useState(null);

  const partnerId = partner?.partnerId || partner?.id;
  const currency = data?.currency || "EUR";

  const load = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      setMessage("");
      const response = await api.get(`/api/billing/${partnerId}/summary`);
      setData(response.data || null);
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo cargar movimientos.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const movements = useMemo(() => {
    return (data?.recentSales || []).filter((sale) => sale.status === "PAID").map((sale) => {
      const customerData = asObject(sale.customerData);

      return {
        ...sale,
        customerData,
        dateValue: toDateInputValue(sale.date),
        statusLabel: sale.status || "REGISTRADO",
        storeLabel: sale.storeName || "Sin tienda",
        partnerLabel: sale.partnerName || data?.partner?.name || "Sin partner",
        customerLabel: sale.customerName || customerData.name || "Sin cliente",
        customerDisplayLabel: formatCustomerNameWithCount(
          sale.customerName || customerData.name || "Sin cliente",
          customerData.orderCount
        ),
        customerSegmentLabel: formatCustomerSegment(customerData.segment),
        customerSegmentTone: getCustomerSegmentTone(customerData.segment),
      };
    });
  }, [data?.partner?.name, data?.recentSales]);

  const stores = useMemo(
    () => [...new Set(movements.map((sale) => sale.storeLabel).filter(Boolean))],
    [movements]
  );

  const filteredMovements = useMemo(() => {
    const search = normalizeSearchText(customerQuery);

    return movements.filter((sale) => {
      if (storeName !== "all" && sale.storeLabel !== storeName) return false;
      if (fromDate && sale.dateValue < fromDate) return false;
      if (toDate && sale.dateValue > toDate) return false;
      if (search) {
        const searchableText = normalizeSearchText(
          [
            sale.customerLabel,
            sale.customerDisplayLabel,
            sale.customerData?.phone,
            sale.customerData?.email,
            sale.customerData?.code,
            sale.code,
          ]
            .filter(Boolean)
            .join(" ")
        );
        if (!searchableText.includes(search)) return false;
      }
      return true;
    });
  }, [customerQuery, fromDate, movements, storeName, toDate]);

  return (
    <div className="gmo-shell">
      <header className="gm-moduleHeader">
        <div>
          <span>My Orders</span>
          <h2>Movimientos</h2>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      <section className="gmo-movementToolbar">
        <label className="gmo-filter">
          <span>Desde</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>

        <label className="gmo-filter">
          <span>Hasta</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>

        <label className="gmo-filter">
          <span>Cliente</span>
          <input
            type="search"
            value={customerQuery}
            onChange={(event) => setCustomerQuery(event.target.value)}
            placeholder="Nombre, telefono o codigo"
          />
        </label>

        <label className="gmo-filter">
          <span>Tienda</span>
          <select value={storeName} onChange={(event) => setStoreName(event.target.value)}>
            <option value="all">Todas las tiendas</option>
            {stores.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button
          className="gmo-clearFilters"
          type="button"
          onClick={() => {
            setCustomerQuery("");
            setStoreName("all");
            setFromDate("");
            setToDate("");
          }}
        >
          Restablecer
        </button>
      </section>

      {message && <div className="gmo-message">{message}</div>}

      <section className="gmo-panel">
        <div className="gmo-panelHead">
          <div>
            <h3>Movimientos</h3>
          </div>
          <small>{data?.updatedAt ? `Ultima lectura ${formatDateTime(data.updatedAt)}` : ""}</small>
        </div>

        <div className="gmo-tableWrap gmo-tableWrap--sticky gmo-tableWrap--movements">
          <table className="gmo-table gmo-table--movements">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Partner</th>
                <th>Tienda</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <strong>{sale.code}</strong>
                  </td>
                  <td>
                    <strong title={sale.customerLabel}>{sale.customerDisplayLabel}</strong>
                    {sale.customerData?.phone && (
                      <span className="gmo-cellSub">{sale.customerData.phone}</span>
                    )}
                  </td>
                  <td>{formatDate(sale.date)}</td>
                  <td>{sale.partnerLabel}</td>
                  <td>{sale.storeLabel}</td>
                  <td>
                    <span className="gmo-statusPill">{sale.statusLabel}</span>
                  </td>
                  <td>{formatMoney(sale.total, sale.currency || currency)}</td>
                  <td>
                    <button
                      className="gmo-codeBtn"
                      type="button"
                      onClick={() => setSelectedMovement(sale)}
                    >
                      Ver ticket
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredMovements.length && (
                <tr>
                  <td colSpan="8">Sin movimientos para los filtros seleccionados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedMovement && (
        <div className="gmo-modalBack" onMouseDown={() => setSelectedMovement(null)}>
          <div className="gmo-modalCard" onMouseDown={(event) => event.stopPropagation()}>
            <header className="gmo-modalHead">
              <div>
                <span>Ticket</span>
                <h3>{selectedMovement.code}</h3>
              </div>
              <button type="button" onClick={() => setSelectedMovement(null)}>
                x
              </button>
            </header>

            <div className="gmo-ticket">
              <div className="gmo-ticketLine">
                <span>Cliente</span>
                <strong>{selectedMovement.customerDisplayLabel}</strong>
              </div>
              <div className="gmo-ticketLine">
                <span>Telefono</span>
                <strong>{selectedMovement.customerData?.phone || "-"}</strong>
              </div>
              <div className="gmo-ticketLine">
                <span>Segmento</span>
                <strong>
                  {selectedMovement.customerSegmentLabel ? (
                    <span
                      className={`gmo-segmentPill ${
                        selectedMovement.customerSegmentTone
                          ? `gmo-segmentPill--${selectedMovement.customerSegmentTone}`
                          : ""
                      }`}
                    >
                      {selectedMovement.customerSegmentLabel}
                    </span>
                  ) : (
                    "-"
                  )}
                </strong>
              </div>
              <div className="gmo-ticketLine">
                <span>Partner</span>
                <strong>{selectedMovement.partnerLabel}</strong>
              </div>
              <div className="gmo-ticketLine">
                <span>Tienda</span>
                <strong>{selectedMovement.storeLabel}</strong>
              </div>
              <div className="gmo-ticketLine">
                <span>Fecha</span>
                <strong>{formatDate(selectedMovement.date)}</strong>
              </div>
              <div className="gmo-ticketLine">
                <span>Estado</span>
                <strong>{selectedMovement.statusLabel}</strong>
              </div>
              {selectedMovement.customerData?.address_1 && (
                <div className="gmo-ticketLine gmo-ticketLine--block">
                  <span>Direccion</span>
                  <strong>{selectedMovement.customerData.address_1}</strong>
                </div>
              )}
              <div className="gmo-ticketItems">
                <OrderItems order={selectedMovement} />
              </div>
              {selectedMovement.notes && (
                <div className="gmo-ticketLine gmo-ticketLine--block">
                  <span>Notas</span>
                  <strong>{selectedMovement.notes}</strong>
                </div>
              )}
              <div className="gmo-ticketTotal">
                <span>Total</span>
                <strong>
                  {formatMoney(selectedMovement.total, selectedMovement.currency || currency)}
                </strong>
              </div>
            </div>

            <footer className="gmo-modalActions">
              <button type="button" onClick={() => window.print()}>
                Print
              </button>
              <button type="button" onClick={() => setSelectedMovement(null)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
