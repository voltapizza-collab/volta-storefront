import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../setupAxios";
import { mockPrinter } from "./printers/mockPrinter";
import "../styles/PosApp.css";

const POS_SESSION_KEY = "volta_pos_virtual_session";
const POLL_MS = 10000;
const STALE_AFTER_MS = 25_000;
const OFFLINE_AFTER_MS = 60_000;

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const formatTime = (value) => {
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

const lineQty = (item) => {
  const qty = Number(item?.quantity ?? item?.qty ?? item?.cantidad ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const getOrderType = (order) => {
  const raw = [order?.delivery, order?.type]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase())
    .join(" ");
  if (raw.includes("DELIVERY") || raw.includes("COURIER")) return "Delivery";
  if (raw.includes("PICKUP")) return "Pickup";
  if (raw.includes("LOCAL")) return "Local";
  return String(order?.type || order?.delivery || "-");
};

const getOrderContext = (order) => {
  const type = getOrderType(order);
  const customer = order?.customerData || {};
  const address = customer.address_1 || order?.address_1 || "";
  const name = customer.name || "";

  if (type === "Delivery" && address) return address;
  if (name) return name;
  return type;
};

const isBoostedOrder = (order) => Boolean(order?.boost?.active);

const getBoostText = (order) => {
  if (!isBoostedOrder(order)) return "";

  const credit = Number(order?.boost?.queueCredit || 0);
  const target = Number(order?.boost?.targetPosition || 0);

  if (credit > 0 && target > 0) return `Subio ${credit} a posicion ${target}`;
  if (credit > 0) return `Subio ${credit} posicion${credit === 1 ? "" : "es"}`;
  return "Prioridad activa";
};

const formatElapsed = (value) => {
  if (!value) return "nunca";
  const diff = Math.max(Date.now() - new Date(value).getTime(), 0);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  return `hace ${Math.floor(seconds / 60)}m`;
};

function OrderItems({ order }) {
  const products = asArray(order?.products);

  if (!products.length) {
    return <span className="pos-muted">Sin items</span>;
  }

  return (
    <div className="pos-items">
      {products.map((item, index) => {
        const size = item?.size || item?.selectedSize || "";
        const extras = asArray(item?.extras)
          .map((extra) => extra?.label || extra?.name || extra?.code || extra)
          .filter(Boolean);

        return (
          <div key={`${order.id}-${index}`} className="pos-itemLine">
            <strong>
              {lineName(item)}
              {size ? ` ${size}` : ""} x{lineQty(item)}
            </strong>
            {extras.length > 0 && <small>+ {extras.join(", ")}</small>}
          </div>
        );
      })}
    </div>
  );
}

function PosLogin({ partners, stores, loading, onStart }) {
  const [partnerId, setPartnerId] = useState("");
  const [storeId, setStoreId] = useState("");
  const filteredStores = stores.filter(
    (store) => !partnerId || String(store.partnerId) === String(partnerId)
  );

  useEffect(() => {
    if (!partnerId && partners[0]?.id) {
      setPartnerId(String(partners[0].id));
    }
  }, [partnerId, partners]);

  useEffect(() => {
    if (!filteredStores.length) {
      setStoreId("");
      return;
    }

    if (!filteredStores.some((store) => String(store.id) === String(storeId))) {
      setStoreId(String(filteredStores[0].id));
    }
  }, [filteredStores, storeId]);

  const selectedPartner = partners.find((partner) => String(partner.id) === String(partnerId));
  const selectedStore = stores.find((store) => String(store.id) === String(storeId));

  return (
    <main className="pos-loginScreen">
      <section className="pos-loginPanel">
        <span className="pos-kicker">Volta POS Virtual</span>
        <h1>Emparejar dispositivo</h1>
        <p>
          Esta pantalla simula el terminal Android. Luego se empaqueta como APK y se conecta a
          SUNMI o Bluetooth.
        </p>

        <label>
          Partner
          <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name || partner.slug || `Partner ${partner.id}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tienda
          <select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            {filteredStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.storeName || store.name || `Store ${store.id}`}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={loading || !selectedPartner || !selectedStore}
          onClick={() =>
            onStart({
              partnerId: selectedPartner.id,
              partnerName: selectedPartner.name || selectedPartner.slug || "Partner",
              storeId: selectedStore.id,
              storeName: selectedStore.storeName || selectedStore.name || "Store",
              deviceName: "Volta POS Virtual",
              pairedAt: new Date().toISOString(),
            })
          }
        >
          Iniciar POS
        </button>
      </section>
    </main>
  );
}

function TicketPreview({ order }) {
  if (!order) {
    return (
      <div className="pos-ticketPreview pos-ticketPreview--empty">
        Selecciona un pedido para ver el ticket.
      </div>
    );
  }

  return (
    <div className="pos-ticketPreview">
      <div className="pos-ticketBrand">VOLTA POS</div>
      <div className="pos-ticketCode">{order.code}</div>
      <div className="pos-ticketMeta">
        <span>{order.storeName || "-"}</span>
        <span>{formatTime(order.date || order.createdAt)}</span>
      </div>
      <div className="pos-ticketBlock">
        <span>Operacion</span>
        <strong>{getOrderType(order)}</strong>
      </div>
      {isBoostedOrder(order) && (
        <div className="pos-ticketBlock pos-ticketBlock--boost">
          <span>Boost priority</span>
          <strong>{getBoostText(order)}</strong>
          {order.boost?.amount > 0 && (
            <small>
              Boost pagado: {formatMoney(order.boost.amount, order.currency || "EUR")}
            </small>
          )}
        </div>
      )}
      <div className="pos-ticketBlock">
        <span>Cliente</span>
        <strong>{order.customerData?.name || "-"}</strong>
        <small>{order.customerData?.phone || ""}</small>
      </div>
      {order.customerData?.address_1 && (
        <div className="pos-ticketBlock">
          <span>Direccion</span>
          <strong>{order.customerData.address_1}</strong>
        </div>
      )}
      <div className="pos-ticketItems">
        <OrderItems order={order} />
      </div>
      {order.notes && (
        <div className="pos-ticketBlock">
          <span>Notas</span>
          <strong>{order.notes}</strong>
        </div>
      )}
      <div className="pos-ticketTotal">
        <span>Total</span>
        <strong>{formatMoney(order.total, order.currency || "EUR")}</strong>
      </div>
    </div>
  );
}

function PosInventory({ session }) {
  const [ingredients, setIngredients] = useState([]);
  const [openCategory, setOpenCategory] = useState("");
  const [view, setView] = useState("inventory");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState("");

  const loadIngredients = useCallback(async () => {
    if (!session?.storeId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/stores/${session.storeId}/ingredients`, {
        params: { scope: "menu" },
      });
      const items = Array.isArray(response.data) ? response.data : [];
      setIngredients(items);

      const firstCategory = items
        .map((item) => String(item.category || "OTROS").toUpperCase().trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))[0];

      setOpenCategory((current) => current || firstCategory || "");
      setMessage("");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cargar inventario.");
    } finally {
      setLoading(false);
    }
  }, [session?.storeId]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  const categories = useMemo(() => {
    const grouped = new Map();

    ingredients.forEach((ingredient) => {
      const category = String(ingredient.category || "OTROS").toUpperCase().trim();
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(ingredient);
    });

    return [...grouped.entries()]
      .sort((left, right) => left[0].localeCompare(right[0], "es", { sensitivity: "base" }))
      .map(([category, items]) => ({
        category,
        items,
        activeCount: items.filter((item) => item.exists && item.active).length,
      }));
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return ingredients;

    return ingredients.filter((ingredient) =>
      [
        ingredient.name,
        ingredient.category,
        ingredient.status,
        ...(ingredient.affectedProductNames || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [ingredients, search]);

  const toggleIngredient = async (ingredient) => {
    if (!session?.storeId || savingId) return;

    const nextActive = !(ingredient.exists && ingredient.active);

    try {
      setSavingId(ingredient.id);
      await api.patch(`/stores/${session.storeId}/ingredients/${ingredient.id}`, {
        active: nextActive,
      });
      setIngredients((current) =>
        current.map((item) =>
          item.id === ingredient.id
            ? {
                ...item,
                exists: true,
                active: nextActive,
              }
            : item
        )
      );
      setMessage("");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cambiar el ingrediente.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="pos-inventoryPane">
      <div className="pos-sectionHead">
        <div>
          <span>Inventory</span>
          <h2>Ingredientes del menu</h2>
          <small>{session.storeName}</small>
        </div>
        <div className="pos-invHeadActions">
          {view === "inventory" && (
            <button
              type="button"
              className="pos-invSearchBtn"
              onClick={() => {
                setView("search");
                setSearch("");
              }}
              aria-label="Buscar ingrediente"
              title="Buscar ingrediente"
            >
              <span aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={loadIngredients} disabled={loading}>
            {loading ? "..." : "Sync"}
          </button>
        </div>
      </div>

      {message && <div className="pos-inlineAlert">{message}</div>}

      {view === "search" && (
        <div className="pos-invSearchView">
          <div className="pos-invSearchBar">
            <button type="button" onClick={() => setView("inventory")}>
              Volver
            </button>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar ingrediente..."
              autoFocus
            />
          </div>

          <div className="pos-invItems pos-invItems--search">
            {filteredIngredients.map((ingredient) => {
              const active = ingredient.exists && ingredient.active;

              return (
                <div
                  key={ingredient.id}
                  className={`pos-invItem ${active ? "is-active" : "is-inactive"}`}
                >
                  <span>
                    {String(ingredient.name || "").toUpperCase()}
                    <small>
                      {ingredient.affectedProducts || 0} producto
                      {(ingredient.affectedProducts || 0) === 1 ? "" : "s"}
                    </small>
                  </span>
                  <button
                    type="button"
                    className={`pos-invToggle ${active ? "on" : "off"}`}
                    onClick={() => toggleIngredient(ingredient)}
                    disabled={savingId === ingredient.id}
                  >
                    {active ? "ACTIVE" : "OFF"}
                  </button>
                </div>
              );
            })}

            {!loading && filteredIngredients.length === 0 && (
              <div className="pos-emptySmall">No encontramos ese ingrediente.</div>
            )}
          </div>
        </div>
      )}

      {view === "inventory" && (
        <div className="pos-inventoryList">
          {categories.map(({ category, items, activeCount }) => {
            const isOpen = openCategory === category;

            return (
              <div key={category} className="pos-invCategory">
                <button
                  type="button"
                  className="pos-invCategoryBtn"
                  onClick={() => setOpenCategory(isOpen ? "" : category)}
                >
                  <span>{category}</span>
                  <strong>{activeCount}/{items.length}</strong>
                </button>

                {isOpen && (
                  <div className="pos-invItems">
                    {items.map((ingredient) => {
                      const active = ingredient.exists && ingredient.active;

                      return (
                        <div
                          key={ingredient.id}
                          className={`pos-invItem ${active ? "is-active" : "is-inactive"}`}
                        >
                          <span>
                            {String(ingredient.name || "").toUpperCase()}
                            <small>
                              {ingredient.affectedProducts || 0} producto
                              {(ingredient.affectedProducts || 0) === 1 ? "" : "s"}
                            </small>
                          </span>
                          <button
                            type="button"
                            className={`pos-invToggle ${active ? "on" : "off"}`}
                            onClick={() => toggleIngredient(ingredient)}
                            disabled={savingId === ingredient.id}
                          >
                            {active ? "ACTIVE" : "OFF"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && categories.length === 0 && (
            <div className="pos-emptySmall">No hay ingredientes configurados.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default function PosApp() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(POS_SESSION_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [partners, setPartners] = useState([]);
  const [stores, setStores] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activePanel, setActivePanel] = useState("orders");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [storeActive, setStoreActive] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [reservations, setReservations] = useState([]);
  const [reservationsOpen, setReservationsOpen] = useState(false);
  const [activeReservationId, setActiveReservationId] = useState(null);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [presence, setPresence] = useState({
    activeVisitors: 0,
    cartVisitors: 0,
    checkoutVisitors: 0,
    browsingVisitors: 0,
  });
  const [syncHealth, setSyncHealth] = useState({
    lastAttemptAt: null,
    lastOkAt: null,
    serverTime: null,
    error: "",
    consecutiveFailures: 0,
  });
  const [clockTick, setClockTick] = useState(Date.now());
  const seenIdsRef = useRef(new Set());

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const printerStatus = mockPrinter.getStatus();
  const printerTone = printerStatus.realConnected
    ? "ok"
    : printerStatus.virtualReady
    ? "virtual"
    : "fail";
  const printerLabel = printerStatus.realConnected
    ? "Print OK"
    : printerStatus.virtualReady
    ? "Print virtual"
    : "Print fail";
  const activeReservation =
    reservations.find((reservation) => reservation.id === activeReservationId) || null;
  const lastOkAgeMs = syncHealth.lastOkAt
    ? clockTick - new Date(syncHealth.lastOkAt).getTime()
    : Infinity;
  const trustState = !syncHealth.lastOkAt
    ? "checking"
    : lastOkAgeMs > OFFLINE_AFTER_MS || syncHealth.consecutiveFailures > 0
    ? "offline"
    : lastOkAgeMs > STALE_AFTER_MS
    ? "stale"
    : "online";
  const hasVisitors = Number(presence.activeVisitors || 0) > 0;
  const showVisitorAlert = orders.length === 0 && trustState === "online" && hasVisitors;
  const shellClassName = [
    "pos-shell",
    `pos-shell--${trustState}`,
    showVisitorAlert ? "pos-shell--visitors" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const trustLabel =
    trustState === "online"
      ? "Online"
      : trustState === "stale"
      ? "Tardando"
      : trustState === "checking"
      ? "Conectando"
      : "Sin conexion";

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSetup = async () => {
      try {
        setLoadingSetup(true);
        const [partnersResponse, storesResponse] = await Promise.all([
          api.get("/partners"),
          api.get("/api/stores"),
        ]);
        setPartners(Array.isArray(partnersResponse.data) ? partnersResponse.data : []);
        setStores(Array.isArray(storesResponse.data) ? storesResponse.data : []);
      } catch (error) {
        console.error(error);
        setMessage("No se pudo cargar la configuracion del POS.");
      } finally {
        setLoadingSetup(false);
      }
    };

    loadSetup();
  }, []);

  const loadOrders = useCallback(async () => {
    if (!session?.partnerId || !session?.storeId) return;

    try {
      setLoadingOrders(true);
      const lastAttemptAt = new Date().toISOString();
      setSyncHealth((current) => ({
        ...current,
        lastAttemptAt,
      }));

      const [ordersResponse, presenceResponse] = await Promise.all([
        api.get("/api/myorders/pending", {
          params: {
            partnerId: session.partnerId,
            storeId: session.storeId,
          },
        }),
        api.get(`/api/presence/stores/${session.storeId}/status`, {
          params: {
            partnerId: session.partnerId,
          },
        }).catch(() => null),
      ]);
      const items = Array.isArray(ordersResponse.data?.items) ? ordersResponse.data.items : [];
      const previousSeen = seenIdsRef.current;
      const incoming = items.filter((item) => !previousSeen.has(item.id));

      if (previousSeen.size > 0 && incoming.length > 0) {
        setMessage(`${incoming.length} pedido(s) nuevo(s) en ${session.storeName}.`);
      }

      if (presenceResponse?.data?.presence) {
        setPresence(presenceResponse.data.presence);
      }

      const lastOkAt = new Date().toISOString();
      setSyncHealth({
        lastAttemptAt,
        lastOkAt,
        serverTime: ordersResponse.data?.updatedAt || lastOkAt,
        error: "",
        consecutiveFailures: 0,
      });
      seenIdsRef.current = new Set(items.map((item) => item.id));
      setOrders(items);
      setSelectedOrderId((current) =>
        current && items.some((item) => item.id === current) ? current : null
      );
    } catch (error) {
      console.error(error);
      setSyncHealth((current) => ({
        ...current,
        error: error.response?.data?.error || "No se pudo leer el servidor.",
        consecutiveFailures: current.consecutiveFailures + 1,
      }));
      setMessage(error.response?.data?.error || "No se pudo leer la cola del POS.");
    } finally {
      setLoadingOrders(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;

    seenIdsRef.current = new Set();
    loadOrders();
    const timer = window.setInterval(loadOrders, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadOrders, session]);

  useEffect(() => {
    if (!session?.storeId) return;

    api
      .get(`/api/stores/${session.storeId}`)
      .then((response) => setStoreActive(Boolean(response.data?.active)))
      .catch((error) => {
        console.error(error);
        setMessage("No se pudo leer si la tienda esta abierta.");
      });
  }, [session?.storeId]);

  const loadReservations = useCallback(async () => {
    if (!session?.storeId) return;

    try {
      setLoadingReservations(true);
      const response = await api.get(`/api/reservations/today/${session.storeId}`);
      const items = Array.isArray(response.data) ? response.data : [];
      setReservations(items);
      setActiveReservationId((current) =>
        current && items.some((item) => item.id === current) ? current : null
      );
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar las reservas de hoy.");
    } finally {
      setLoadingReservations(false);
    }
  }, [session?.storeId]);

  useEffect(() => {
    if (!session?.storeId) return;
    loadReservations();
  }, [loadReservations, session?.storeId]);

  const startSession = (nextSession) => {
    localStorage.setItem(POS_SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setMessage("POS virtual emparejado.");
  };

  const logoutSession = () => {
    localStorage.removeItem(POS_SESSION_KEY);
    setSession(null);
    setOrders([]);
    setSelectedOrderId(null);
    setSyncHealth({
      lastAttemptAt: null,
      lastOkAt: null,
      serverTime: null,
      error: "",
      consecutiveFailures: 0,
    });
    setMessage("");
  };

  const toggleStore = async () => {
    if (!session?.storeId || savingStore) return;

    const nextActive = !storeActive;

    try {
      setSavingStore(true);
      await api.patch(`/api/stores/${session.storeId}/active`, {
        active: nextActive,
      });
      setStoreActive(nextActive);
      setMessage(nextActive ? "Tienda abierta para pedidos." : "Tienda cerrada manualmente.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cambiar el estado de la tienda.");
    } finally {
      setSavingStore(false);
    }
  };

  const printOrder = async (order) => {
    if (!order) return;

    try {
      const job = await mockPrinter.printOrder(order);
      setMessage(`Ticket ${job.code || job.orderId} enviado a impresora virtual.`);
    } catch (error) {
      console.error(error);
      setMessage("No se pudo imprimir el ticket virtual.");
    }
  };

  const markReady = async (order) => {
    if (!order) return;

    try {
      await api.patch(`/api/myorders/${order.id}/ready`);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSelectedOrderId(null);
      setMessage(`Pedido ${order.code || order.id} marcado como listo.`);
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo marcar como listo.");
    }
  };

  const completeReservation = async () => {
    if (!activeReservationId) return;

    try {
      await api.patch(`/api/reservations/${activeReservationId}/complete`);
      setReservations((current) => current.filter((item) => item.id !== activeReservationId));
      setActiveReservationId(null);
      setMessage("Reserva completada.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo completar la reserva.");
    }
  };

  if (!session) {
    return (
      <PosLogin
        partners={partners}
        stores={stores}
        loading={loadingSetup}
        onStart={startSession}
      />
    );
  }

  return (
    <main className={shellClassName}>
      <header className="pos-topbar">
        <div className="pos-storeIdentity">
          <span className="pos-kicker">Volta POS Virtual</span>
          <h1>{session.storeName}</h1>
          <small>{session.partnerName}</small>
        </div>

        <div className="app-toggle pos-storeToggle">
          <span className="app-toggle-label">
            {storeActive ? "Store open" : "Store closed"}
          </span>
          <button
            type="button"
            onClick={toggleStore}
            aria-pressed={storeActive}
            disabled={savingStore}
            className={`app-toggle-btn ${storeActive ? "on" : "off"}`}
          >
            <span className="app-toggle-knob" />
          </button>
        </div>

        <div className="pos-topMetrics">
          <div className="pos-topActions">
            <button
              type="button"
              className="pos-menuBtn"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Menu POS"
              title="Menu"
            >
              Menu
            </button>

            <button
              type="button"
              className="pos-logoutPill"
              onClick={logoutSession}
            >
              Logout
            </button>
          </div>

          <div className="pos-topChip pos-topChip--queue" title="Pedidos pendientes">
            <span className="pos-chipIcon pos-chipIcon--queue" aria-hidden="true">
              <span />
              <span />
            </span>
            <strong>{orders.length}</strong>
          </div>

          <div
            className={`pos-topChip pos-topChip--visitors ${hasVisitors ? "is-active" : ""}`}
            title="Visitantes activos en la tienda"
          >
            <span className="pos-chipIcon pos-chipIcon--visitor" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <strong>{presence.activeVisitors || 0}</strong>
          </div>

          <button
            type="button"
            className={`pos-topChip pos-syncChip pos-syncChip--${trustState} ${loadingOrders ? "is-syncing" : ""}`}
            onClick={loadOrders}
            disabled={loadingOrders}
            title={`Estado: ${trustLabel}. Ultima revision OK: ${formatElapsed(syncHealth.lastOkAt)}`}
          >
            <span className="pos-signalDot" />
            <span className="pos-chipText">Sync</span>
          </button>

        </div>

        {menuOpen && (
          <div className="pos-menuPanel">
            <button
              type="button"
              onClick={() => {
                setMessage("Ordenes del dia: modulo en preparacion.");
                setMenuOpen(false);
              }}
            >
              Ordenes del dia
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage("Ventas de hoy: modulo en preparacion.");
                setMenuOpen(false);
              }}
            >
              Ventas de hoy
            </button>
          </div>
        )}
      </header>

      {message && (
        <button type="button" className="pos-message" onClick={() => setMessage("")}>
          {message}
        </button>
      )}

      <nav className="pos-modeTabs" aria-label="POS section">
        <button
          type="button"
          className={activePanel === "orders" ? "active" : ""}
          onClick={() => setActivePanel("orders")}
        >
          Orders
        </button>
        <button
          type="button"
          className={activePanel === "inventory" ? "active" : ""}
          onClick={() => setActivePanel("inventory")}
        >
          Inventory
        </button>
      </nav>

      {trustState === "offline" && (
        <section className="pos-trustAlert">
          <strong>POS sin lectura reciente del servidor</strong>
          <span>
            No confies en una pantalla vacia. Ultima revision correcta:{" "}
            {syncHealth.lastOkAt ? formatTime(syncHealth.lastOkAt) : "nunca"}.
          </span>
        </section>
      )}

      {trustState === "stale" && (
        <section className="pos-trustAlert pos-trustAlert--stale">
          <strong>Revision tardando mas de lo normal</strong>
          <span>El POS sigue intentando confirmar la cola con el servidor.</span>
        </section>
      )}

      {activePanel === "orders" && (
      <div className={`pos-workspace ${selectedOrder ? "pos-workspace--ticket" : "pos-workspace--queue"}`}>
        <section className="pos-ordersPane">
          {selectedOrder ? (
            <div className="pos-ticketFocus">
              <div className="pos-sectionHead">
                <div>
                  <span>Ticket</span>
                  <h2>{selectedOrder.code || "Pedido"}</h2>
                </div>
                <button type="button" onClick={() => setSelectedOrderId(null)}>
                  Cola
                </button>
              </div>

              <TicketPreview order={selectedOrder} />

              <div className="pos-actionGrid pos-actionGrid--ticket">
                <button type="button" onClick={() => printOrder(selectedOrder)}>
                  Imprimir
                </button>
                <button type="button" onClick={() => markReady(selectedOrder)}>
                  Ready
                </button>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <>
              <div className="pos-sectionHead">
                <div>
                  <span>Pedidos pendientes</span>
                  <h2>Operacion de cocina</h2>
                </div>
              </div>
            <div className={`pos-empty ${showVisitorAlert ? "pos-empty--visitors" : ""}`}>
              {!showVisitorAlert && (
                <div className="pos-chill">
                  <span>🐒</span>
                  <strong>Chill For Now ;)</strong>
                </div>
              )}
              <strong>
                {showVisitorAlert
                  ? `${presence.activeVisitors} visitante(s) en tienda`
                  : "Sin pedidos pendientes"}
              </strong>
              <span>
                {showVisitorAlert
                  ? `${presence.checkoutVisitors || 0} en checkout · ${presence.cartVisitors || 0} con carrito`
                  : trustState === "online"
                  ? "Cola confirmada con el servidor."
                  : "Esperando una lectura confiable del servidor."}
              </span>
              <small>Ultima revision OK: {formatElapsed(syncHealth.lastOkAt)}</small>
            </div>
            </>
          ) : (
            <div className="pos-queueStage">
              <div className="pos-sectionHead">
                <div>
                  <span>Pedidos pendientes</span>
                  <h2>Operacion de cocina</h2>
                </div>
                <strong className="pos-queueCount">{orders.length}</strong>
              </div>

              <div className="pos-orderList" aria-label="Cola de pedidos">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className={`pos-orderCard ${isBoostedOrder(order) ? "is-boosted" : ""}`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    {isBoostedOrder(order) && (
                      <div className="pos-boostBadge">BOOST</div>
                    )}
                    <div className="pos-orderMain">
                      <strong>{order.code}</strong>
                      <span>{getOrderType(order)}</span>
                    </div>
                    <div className="pos-orderMeta">
                      <span>{formatTime(order.date || order.createdAt)}</span>
                      <b>{formatMoney(order.total, order.currency || "EUR")}</b>
                    </div>
                    <div className="pos-orderContext">{getOrderContext(order)}</div>
                    {isBoostedOrder(order) && (
                      <div className="pos-orderBoost">{getBoostText(order)}</div>
                    )}
                    <OrderItems order={order} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      )}

      {activePanel === "inventory" && (
        <main className="store-pos-panel pos-storePanel">
          <PosInventory session={session} />
        </main>
      )}

      {reservationsOpen && (
        <div className="pos-modalBack" onClick={() => setReservationsOpen(false)}>
          <section className="pos-reservationModal" onClick={(event) => event.stopPropagation()}>
            <div className="pos-sectionHead">
              <div>
                <span>Calendario</span>
                <h2>Reservas de hoy</h2>
              </div>
              <button type="button" onClick={() => setReservationsOpen(false)}>
                Cerrar
              </button>
            </div>

            {loadingReservations && (
              <div className="pos-emptySmall">Cargando reservas...</div>
            )}

            {!loadingReservations && reservations.length === 0 && (
              <div className="pos-emptySmall">No hay reservas para hoy.</div>
            )}

            {!loadingReservations && reservations.length > 0 && (
              <div className="pos-reservationList">
                {reservations.map((reservation) => (
                  <button
                    key={reservation.id}
                    type="button"
                    className={`pos-reservationRow ${
                      activeReservationId === reservation.id ? "active" : ""
                    }`}
                    onClick={() => setActiveReservationId(reservation.id)}
                  >
                    <strong>{reservation.reservationTime}</strong>
                    <span>{reservation.customerName}</span>
                    <small>
                      {reservation.partySize} pers. - {reservation.customerPhone || "-"}
                    </small>
                  </button>
                ))}
              </div>
            )}

            <div className="pos-actionGrid">
              <button type="button" onClick={loadReservations} disabled={loadingReservations}>
                Sync
              </button>
              <button
                type="button"
                onClick={completeReservation}
                disabled={!activeReservation}
              >
                Complete
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="pos-footer">
        <span>© {new Date().getFullYear()} voltaPizza · POS v01</span>
        <div className={`pos-printInline ${printerTone}`}>
          <span />
          {printerLabel}
          <small>{printerStatus.realConnected ? printerStatus.label : "sin impresora real"}</small>
        </div>
      </footer>
      <button
        type="button"
        className={`pos-reservationsFab ${reservations.length > 0 ? "active" : ""}`}
        onClick={() => {
          setReservationsOpen(true);
          loadReservations();
        }}
        title="Reservas de hoy"
      >
        <span aria-hidden="true">📅</span>
        {reservations.length > 0 && <strong>{reservations.length}</strong>}
      </button>
    </main>
  );
}
