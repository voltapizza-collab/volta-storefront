import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../setupAxios";
import "../../styles/GlobalManager.css";

const POLL_MS = 10000;

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const formatNumber = (value) =>
  new Intl.NumberFormat("es-ES").format(Number(value || 0));

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

const getTypeLabel = (order) => {
  const raw = String(order?.type || order?.delivery || "").toUpperCase();
  if (raw.includes("DELIVERY") || raw.includes("COURIER")) return "Delivery";
  if (raw.includes("PICKUP")) return "Pickup";
  return raw || "-";
};

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

  const visibleStores = useMemo(() => summary?.stores || [], [summary]);

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
            <option value="all">Todas las tiendas activas</option>
            {visibleStores.map((store) => (
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
          label="Ventas"
          value={formatMoney(kpis.revenue, currency)}
          hint={summary?.periodLabel || "Periodo actual"}
          tone="revenue"
        />
        <KpiCard
          label="Ordenes"
          value={formatNumber(kpis.ordersCount)}
          hint={`Ticket medio ${formatMoney(kpis.averageTicket, currency)}`}
        />
        <KpiCard
          label="Pendientes"
          value={formatNumber(pendingTotal)}
          hint="Cola operativa actual"
          tone={pendingTotal > 0 ? "pending" : ""}
        />
        <KpiCard
          label="Clientes nuevos"
          value={formatNumber(kpis.newCustomers)}
          hint={`${formatNumber(kpis.uniqueCustomers)} clientes con compra`}
        />
        <KpiCard
          label="Tiendas activas"
          value={formatNumber(kpis.activeStores)}
          hint="Dentro del alcance"
        />
        <KpiCard
          label="Canal"
          value={`${formatNumber(kpis.deliveryOrders)} / ${formatNumber(kpis.pickupOrders)}`}
          hint="Delivery / Pickup"
        />
      </section>

      <div className="gmo-mainGrid">
        <section className="gmo-panel gmo-panel--orders">
          <div className="gmo-panelHead">
            <div>
              <span>Pending orders</span>
              <h3>Pedidos por procesar</h3>
            </div>
            <small>
              {summary?.updatedAt ? `Ultima lectura ${formatDateTime(summary.updatedAt)}` : ""}
            </small>
          </div>

          {orders.length === 0 ? (
            <div className="gmo-empty">No hay pedidos pendientes ahora.</div>
          ) : (
            <div className="gmo-tableWrap">
              <table className="gmo-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Hora</th>
                    <th>Tienda</th>
                    <th>Tipo</th>
                    <th>Items</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <button
                          type="button"
                          className="gmo-codeBtn"
                          onClick={() => setSelectedOrder(order)}
                        >
                          {order.code}
                        </button>
                      </td>
                      <td>{formatDateTime(order.date || order.createdAt)}</td>
                      <td>
                        <strong>{order.storeName || "-"}</strong>
                        <span className="gmo-cellSub">{order.partnerName || ""}</span>
                      </td>
                      <td>{getTypeLabel(order)}</td>
                      <td>
                        <OrderItems order={order} />
                      </td>
                      <td>
                        <strong>{order.customerData?.name || "-"}</strong>
                        <span className="gmo-cellSub">{order.customerData?.phone || ""}</span>
                      </td>
                      <td>{formatMoney(order.total, order.currency || currency)}</td>
                      <td>
                        <button
                          type="button"
                          className="gmo-readyBtn"
                          onClick={() => setConfirmReadyId(order.id)}
                        >
                          Ready
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="gmo-side">
          <section className="gmo-panel">
            <div className="gmo-panelHead">
              <div>
                <span>Tiendas</span>
                <h3>Rendimiento por tienda</h3>
              </div>
            </div>
            <div className="gmo-storeList">
              {visibleStores.map((store) => (
                <button
                  key={store.storeId}
                  type="button"
                  className={`gmo-storeRow ${String(store.storeId) === String(storeId) ? "active" : ""}`}
                  onClick={() => setStoreId(String(store.storeId))}
                >
                  <span>
                    <strong>{store.storeName}</strong>
                    <small>{store.partnerName}</small>
                  </span>
                  <b>{formatMoney(store.revenue, store.currency || currency)}</b>
                  <em>{store.pending} pendientes</em>
                </button>
              ))}
              {visibleStores.length === 0 && (
                <div className="gmo-empty gmo-empty--small">No hay tiendas activas.</div>
              )}
            </div>
          </section>

          <section className="gmo-panel">
            <div className="gmo-panelHead">
              <div>
                <span>Top items</span>
                <h3>Mas vendido</h3>
              </div>
            </div>
            <div className="gmo-productList">
              {(summary?.topProducts || []).map((item) => (
                <div key={item.name} className="gmo-productRow">
                  <strong>{item.name}</strong>
                  <span>{formatNumber(item.qty)} uds</span>
                </div>
              ))}
              {!summary?.topProducts?.length && (
                <div className="gmo-empty gmo-empty--small">Sin ventas en este periodo.</div>
              )}
            </div>
          </section>
        </aside>
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
  const [status, setStatus] = useState("all");
  const [storeName, setStoreName] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
    return (data?.recentSales || []).map((sale) => ({
      ...sale,
      dateValue: toDateInputValue(sale.date),
      statusLabel: sale.status || "REGISTRADO",
      storeLabel: sale.storeName || "Sin tienda",
    }));
  }, [data?.recentSales]);

  const stores = useMemo(
    () => [...new Set(movements.map((sale) => sale.storeLabel).filter(Boolean))],
    [movements]
  );

  const filteredMovements = useMemo(() => {
    return movements.filter((sale) => {
      if (status !== "all" && sale.statusLabel !== status) return false;
      if (storeName !== "all" && sale.storeLabel !== storeName) return false;
      if (fromDate && sale.dateValue < fromDate) return false;
      if (toDate && sale.dateValue > toDate) return false;
      return true;
    });
  }, [fromDate, movements, status, storeName, toDate]);

  const total = filteredMovements.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  return (
    <div className="gmo-shell">
      <header className="gm-moduleHeader">
        <div>
          <span>My Orders</span>
          <h2>Movimientos de clientes</h2>
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

        <label className="gmo-filter">
          <span>Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Todos</option>
            {[...new Set(movements.map((sale) => sale.statusLabel))].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <button
          className="gmo-clearFilters"
          type="button"
          onClick={() => {
            setStatus("all");
            setStoreName("all");
            setFromDate("");
            setToDate("");
          }}
        >
          Restablecer
        </button>
      </section>

      {message && <div className="gmo-message">{message}</div>}

      <section className="gmo-kpiGrid gmo-kpiGrid--movements">
        <KpiCard
          label="Movimientos"
          value={formatNumber(filteredMovements.length)}
          hint="Segun filtros activos"
        />
        <KpiCard
          label="Importe"
          value={formatMoney(total, currency)}
          hint="Ventas de clientes"
          tone="revenue"
        />
        <KpiCard
          label="Tiendas"
          value={formatNumber(stores.length)}
          hint="Con actividad reciente"
        />
      </section>

      <section className="gmo-panel">
        <div className="gmo-panelHead">
          <div>
            <span>Historial</span>
            <h3>Ventas y pagos de clientes</h3>
          </div>
          <small>{data?.updatedAt ? `Ultima lectura ${formatDateTime(data.updatedAt)}` : ""}</small>
        </div>

        <div className="gmo-tableWrap">
          <table className="gmo-table gmo-table--movements">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Fecha</th>
                <th>Tienda</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <strong>{sale.code}</strong>
                  </td>
                  <td>{formatDate(sale.date)}</td>
                  <td>{sale.storeLabel}</td>
                  <td>
                    <span className="gmo-statusPill">{sale.statusLabel}</span>
                  </td>
                  <td>{formatMoney(sale.total, sale.currency || currency)}</td>
                </tr>
              ))}
              {!filteredMovements.length && (
                <tr>
                  <td colSpan="5">Sin movimientos para los filtros seleccionados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
