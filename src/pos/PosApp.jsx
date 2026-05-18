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

const getBoostTier = (order) => {
  const target = Number(order?.boost?.targetPosition || order?.queuePosition || 1);
  if (target <= 1) return 1;
  if (target === 2) return 2;
  return 3;
};

const getBoostSealTone = (order) => {
  const tier = getBoostTier(order);
  if (tier === 1) return "gold";
  if (tier === 2) return "silver";
  return "bronze";
};

const getBoostText = (order) => {
  if (!isBoostedOrder(order)) return "";

  const credit = Number(order?.boost?.queueCredit || 0);
  const target = Number(order?.boost?.targetPosition || 0);

  if (credit > 0 && target > 0) return `Subio ${credit} a posicion ${target}`;
  if (credit > 0) return `Subio ${credit} posicion${credit === 1 ? "" : "es"}`;
  return "Prioridad activa";
};

const CUSTOMER_SEGMENT_META = {
  S1: { label: "Potencial", tone: "s1" },
  S2: { label: "Nuevo", tone: "s2" },
  S3: { label: "Dormido", tone: "s3" },
  S4: { label: "Activo", tone: "s4" },
  S5: { label: "VIP", tone: "s5" },
};

const createTone = (ctx, { frequency, startAt, duration, volume, type = "sine" }) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
};

const orderHasBoost = (order) => Boolean(order?.boost?.active);

const WEATHER_LABELS = {
  0: "Despejado",
  1: "Mayormente claro",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla",
  51: "Llovizna ligera",
  53: "Llovizna",
  55: "Llovizna intensa",
  61: "Lluvia ligera",
  63: "Lluvia",
  65: "Lluvia intensa",
  71: "Nieve ligera",
  73: "Nieve",
  75: "Nieve intensa",
  80: "Chubascos",
  81: "Chubascos",
  82: "Chubascos fuertes",
  95: "Tormenta",
};

const REGION_BY_CITY = {
  ourense: { label: "Galicia", code: "ES-GA" },
  orense: { label: "Galicia", code: "ES-GA" },
  vigo: { label: "Galicia", code: "ES-GA" },
  pontevedra: { label: "Galicia", code: "ES-GA" },
  coruna: { label: "Galicia", code: "ES-GA" },
  "a coruna": { label: "Galicia", code: "ES-GA" },
  lugo: { label: "Galicia", code: "ES-GA" },
};

const LOCAL_DAY_EVENTS = {
  "05-17": [{ scope: "Regional", label: "Dia das Letras Galegas", regionCode: "ES-GA" }],
  "07-25": [{ scope: "Regional", label: "Dia de Galicia", regionCode: "ES-GA" }],
  "01-06": [{ scope: "Nacional", label: "Reyes" }],
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getRegionForCity = (city) => REGION_BY_CITY[normalizeKey(city)] || null;

const getLocalDateParts = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return {
    year,
    isoDate: `${year}-${month}-${day}`,
    monthDay: `${month}-${day}`,
  };
};

const normalizeWhatsAppPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 9) return `34${digits}`;
  return digits;
};

const CUSTOMER_HELP_TEMPLATES = [
  "Disculpa, para preparar bien tu pedido: esta indicacion aplica a toda la pizza o solo a una mitad?",
  "Confirmas si quieres quitar ese ingrediente de todo el pedido o solo de una pizza?",
  "Tenemos una duda de cocina con tu pedido. Nos confirmas como prefieres que lo preparemos?",
];

const CUSTOMER_HELP_EMOJIS = ["🙋", "🙋🏻‍♀️", "🙋🏻‍♂️", "🙋🏽‍♂️", "🙋🏿", "🧕"];

const pickCustomerHelpEmoji = (current = "") => {
  const pool = CUSTOMER_HELP_EMOJIS.filter((emoji) => emoji !== current);
  const source = pool.length ? pool : CUSTOMER_HELP_EMOJIS;
  return source[Math.floor(Math.random() * source.length)];
};

const getCustomerName = (order) =>
  String(order?.customerData?.name || "").trim() || "Cliente sin nombre";

const getCustomerSegment = (order) => {
  const key = String(order?.customerData?.segment || "").trim().toUpperCase();
  return CUSTOMER_SEGMENT_META[key] || { label: key || "Sin segmento", tone: "default" };
};

const isVipOrder = (order) =>
  String(order?.customerData?.segment || "").trim().toUpperCase() === "S5";

const getCustomerTags = (order) => {
  const customer = order?.customerData || {};
  const count = Number(customer.orderCount || 0);
  const segment = String(customer.segment || "").trim().toUpperCase();
  const activity = String(customer.activity || "").trim().toUpperCase();
  const tags = [];

  if (customer.isRestricted) tags.push("Revisar");
  if (segment === "S5") tags.push("VIP");
  if (count <= 1 || segment === "S1" || segment === "S2") tags.push("Cliente nuevo");
  if (count >= 3) tags.push(`${count} pedidos`);
  if (activity === "HOT") tags.push("Reciente");
  if (activity === "COLD") tags.push("Dormido");

  return [...new Set(tags)].slice(0, 3);
};

const getCustomerAddress = (order) =>
  String(order?.customerData?.address_1 || order?.address_1 || "").trim();

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
      {isVipOrder(order) && (
        <div className="pos-ticketBlock pos-ticketBlock--vip">
          <span>Prioridad VIP</span>
          <strong>Cliente VIP despues de Boost</strong>
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
  const [customerHelpOpen, setCustomerHelpOpen] = useState(false);
  const [customerHelpOrderId, setCustomerHelpOrderId] = useState("");
  const [customerHelpText, setCustomerHelpText] = useState("");
  const [customerHelpEmoji, setCustomerHelpEmoji] = useState(() => pickCustomerHelpEmoji());
  const [storeMeta, setStoreMeta] = useState(null);
  const [dayInfo, setDayInfo] = useState({
    loading: false,
    items: [],
  });
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
  const boostStateRef = useRef(new Map());
  const audioCtxRef = useRef(null);
  const alertSoundRef = useRef(null);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );
  const customerHelpOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(customerHelpOrderId)) || null,
    [customerHelpOrderId, orders]
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
  const showModeTabs = activePanel !== "orders" || Boolean(selectedOrder) || orders.length > 0;
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
  const idleClockTime = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(clockTick)),
    [clockTick]
  );
  const idleClockDate = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date(clockTick)),
    [clockTick]
  );
  const cityRegion = useMemo(
    () => getRegionForCity(storeMeta?.city || session?.storeCity || ""),
    [session?.storeCity, storeMeta?.city]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCustomerHelpEmoji((current) => pickCustomerHelpEmoji(current));
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }

    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    const unlockAudio = () => getAudioContext();

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [getAudioContext]);

  const playNewOrderSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.01;
    createTone(ctx, { frequency: 740, startAt: now, duration: 0.13, volume: 0.075 });
    createTone(ctx, { frequency: 930, startAt: now + 0.14, duration: 0.15, volume: 0.06 });
  }, [getAudioContext]);

  const playBoostSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.01;
    createTone(ctx, { frequency: 880, startAt: now, duration: 0.11, volume: 0.08, type: "triangle" });
    createTone(ctx, { frequency: 1175, startAt: now + 0.11, duration: 0.13, volume: 0.08, type: "triangle" });
    createTone(ctx, { frequency: 1480, startAt: now + 0.24, duration: 0.18, volume: 0.065, type: "triangle" });
  }, [getAudioContext]);

  const playAlertPulse = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.01;
    createTone(ctx, { frequency: 560, startAt: now, duration: 0.18, volume: 0.032 });
    createTone(ctx, { frequency: 660, startAt: now + 0.2, duration: 0.2, volume: 0.026 });
  }, [getAudioContext]);

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
      const previousBoostState = boostStateRef.current;
      const incoming = items.filter((item) => !previousSeen.has(item.id));
      const incomingBoosted = incoming.filter(orderHasBoost);
      const newlyBoosted = items.filter(
        (item) =>
          previousSeen.has(item.id) &&
          orderHasBoost(item) &&
          !previousBoostState.get(item.id)
      );

      if (previousSeen.size > 0 && incoming.length > 0) {
        setMessage(`${incoming.length} pedido(s) nuevo(s) en ${session.storeName}.`);
      }

      if (previousSeen.size > 0) {
        if (incomingBoosted.length > 0 || newlyBoosted.length > 0) {
          playBoostSound();
        } else if (incoming.length > 0) {
          playNewOrderSound();
        }
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
      boostStateRef.current = new Map(items.map((item) => [item.id, orderHasBoost(item)]));
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
  }, [playBoostSound, playNewOrderSound, session]);

  useEffect(() => {
    if (!session) return undefined;

    seenIdsRef.current = new Set();
    boostStateRef.current = new Map();
    loadOrders();
    const timer = window.setInterval(loadOrders, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadOrders, session]);

  useEffect(() => {
    if (!showVisitorAlert) {
      if (alertSoundRef.current) {
        window.clearInterval(alertSoundRef.current);
        alertSoundRef.current = null;
      }
      return undefined;
    }

    playAlertPulse();
    alertSoundRef.current = window.setInterval(playAlertPulse, 2200);

    return () => {
      if (alertSoundRef.current) {
        window.clearInterval(alertSoundRef.current);
        alertSoundRef.current = null;
      }
    };
  }, [playAlertPulse, showVisitorAlert]);

  useEffect(() => {
    if (!session?.storeId) return;

    api
      .get(`/api/stores/${session.storeId}`)
      .then((response) => {
        const store = response?.data || response;
        setStoreMeta(store || null);
        setStoreActive(store?.active !== false);
      })
      .catch((error) => {
        console.error(error);
        setMessage("No se pudo leer si la tienda esta abierta.");
      });
  }, [session?.storeId]);

  useEffect(() => {
    if (!session?.storeId) return undefined;

    let cancelled = false;

    const resolveCoordinates = async (store) => {
      const lat = Number(store?.latitude);
      const lon = Number(store?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };

      const city = String(store?.city || session?.storeName || "").trim();
      if (!city) return null;

      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json&countryCode=ES`
      );
      if (!response.ok) return null;

      const data = await response.json();
      const place = Array.isArray(data?.results) ? data.results[0] : null;
      const placeLat = Number(place?.latitude);
      const placeLon = Number(place?.longitude);
      return Number.isFinite(placeLat) && Number.isFinite(placeLon)
        ? { lat: placeLat, lon: placeLon }
        : null;
    };

    const loadDayInfo = async () => {
      const store = storeMeta || {};
      const city = String(store.city || session.storeName || "").trim();
      const region = getRegionForCity(city);
      const { year, isoDate, monthDay } = getLocalDateParts();
      const nextItems = [];

      setDayInfo((current) => ({ ...current, loading: true }));

      try {
        const coords = await resolveCoordinates(store);
        if (coords && !cancelled) {
          const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code&timezone=auto`
          );
          if (weatherResponse.ok) {
            const weather = await weatherResponse.json();
            const temp = Number(weather?.current?.temperature_2m);
            const code = Number(weather?.current?.weather_code);
            if (Number.isFinite(temp)) {
              nextItems.push({
                key: "weather",
                label: "Clima",
                value: `${Math.round(temp)}°C · ${WEATHER_LABELS[code] || "Ahora"}`,
              });
            }
          }
        }
      } catch (error) {
        console.warn("[pos.dayInfo.weather]", error?.message || error);
      }

      try {
        const holidaysResponse = await fetch(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/ES`
        );
        if (holidaysResponse.ok) {
          const holidays = await holidaysResponse.json();
          const todaysHolidays = Array.isArray(holidays)
            ? holidays.filter((holiday) => {
                if (holiday?.date !== isoDate) return false;
                if (!Array.isArray(holiday.counties) || holiday.counties.length === 0) {
                  return true;
                }
                return region?.code ? holiday.counties.includes(region.code) : false;
              })
            : [];

          if (todaysHolidays.length) {
            nextItems.push({
              key: "holiday",
              label: region?.label ? `Festivo ${region.label}` : "Festivo",
              value: todaysHolidays.map((holiday) => holiday.localName || holiday.name).join(" · "),
            });
          }
        }
      } catch (error) {
        console.warn("[pos.dayInfo.holidays]", error?.message || error);
      }

      const localEvents = (LOCAL_DAY_EVENTS[monthDay] || []).filter(
        (event) => !event.regionCode || event.regionCode === region?.code
      );
      localEvents.forEach((event, index) => {
        nextItems.push({
          key: `event-${index}`,
          label: event.scope,
          value: event.label,
        });
      });

      if (!nextItems.some((item) => item.key === "holiday" || item.key.startsWith("event-"))) {
        nextItems.push({
          key: "no-event",
          label: city || region?.label ? "Local" : "Info",
          value: city
            ? `${city}${region?.label ? ` · ${region.label}` : ""} · sin festivo cargado hoy`
            : "Sin evento cargado hoy",
        });
      }

      if (!cancelled) {
        setDayInfo({
          loading: false,
          items: nextItems.slice(0, 4),
        });
      }
    };

    loadDayInfo();
    const timer = window.setInterval(loadDayInfo, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.storeId, session?.storeName, storeMeta]);

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

  useEffect(() => {
    if (!customerHelpOpen) return;

    const fallbackOrder = selectedOrder || orders[0] || null;
    if (fallbackOrder && !orders.some((order) => String(order.id) === String(customerHelpOrderId))) {
      setCustomerHelpOrderId(String(fallbackOrder.id));
    }

    if (!customerHelpText.trim()) {
      setCustomerHelpText(CUSTOMER_HELP_TEMPLATES[0]);
    }
  }, [customerHelpOpen, customerHelpOrderId, customerHelpText, orders, selectedOrder]);

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

  const sendCustomerHelpQuestion = () => {
    if (!customerHelpOrder) {
      setMessage("Selecciona un pedido para consultar al cliente.");
      return;
    }

    const phone = normalizeWhatsAppPhone(customerHelpOrder.customerData?.phone);
    if (!phone) {
      setMessage("Ese pedido no tiene telefono para consultar al cliente.");
      return;
    }

    const question = customerHelpText.trim();
    if (!question) {
      setMessage("Escribe la duda antes de contactar al cliente.");
      return;
    }

    const text = [
      `Hola ${getCustomerName(customerHelpOrder)}, somos ${session.storeName}.`,
      `Tenemos una duda sobre tu pedido ${customerHelpOrder.code || customerHelpOrder.id}:`,
      question,
    ].join("\n\n");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

    window.open(url, "_blank", "noopener,noreferrer");
    setCustomerHelpOpen(false);
    setMessage(`Consulta preparada para ${customerHelpOrder.code || customerHelpOrder.id}.`);
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

      {showModeTabs && (
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
      )}

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
      <div
        className={`pos-workspace ${
          selectedOrder
            ? "pos-workspace--ticket"
            : showVisitorAlert
            ? "pos-workspace--visitorAlert"
            : "pos-workspace--queue"
        }`}
      >
        <section className={`pos-ordersPane ${showVisitorAlert ? "pos-ordersPane--visitorAlert" : ""}`}>
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
              {!showVisitorAlert && (
                <div className="pos-sectionHead">
                  <div>
                    <span>Pedidos pendientes</span>
                    <h2>Operacion de cocina</h2>
                  </div>
                </div>
              )}
            <div className={`pos-empty ${showVisitorAlert ? "pos-empty--visitors" : ""}`}>
              {showVisitorAlert ? (
                <div className="pos-visitorSignal" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div className="pos-chill">
                  <span>🐒</span>
                  <strong>Chill For Now ;)</strong>
                </div>
              )}
              {!showVisitorAlert && (
                <>
                  <strong>Sin pedidos pendientes</strong>
                  <span>
                    {trustState === "online"
                      ? "Cola confirmada con el servidor."
                      : "Esperando una lectura confiable del servidor."}
                  </span>
                  <small>Ultima revision OK: {formatElapsed(syncHealth.lastOkAt)}</small>
                </>
              )}
            </div>
            {!showVisitorAlert && (
              <section className="pos-idleClockCard" aria-label="Reloj digital">
                <strong>{idleClockTime}</strong>
                <small>{idleClockDate}</small>
                <div className="pos-dayInfoGrid" aria-label="Informacion relevante del dia">
                  {dayInfo.loading && dayInfo.items.length === 0 ? (
                    <span className="pos-dayInfoChip">
                      <em>Info</em>
                      <b>Cargando datos del dia</b>
                    </span>
                  ) : (
                    dayInfo.items.map((item) => (
                      <span key={item.key} className="pos-dayInfoChip">
                        <em>{item.label}</em>
                        <b>{item.value}</b>
                      </span>
                    ))
                  )}
                  {!dayInfo.loading && dayInfo.items.length === 0 && (
                    <span className="pos-dayInfoChip">
                      <em>{cityRegion?.label || "Info"}</em>
                      <b>Sin datos externos ahora</b>
                    </span>
                  )}
                </div>
              </section>
            )}
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
                {orders.map((order) => {
                  const segment = getCustomerSegment(order);
                  const tags = getCustomerTags(order);
                  const address = getCustomerAddress(order);
                  const boosted = isBoostedOrder(order);
                  const vip = isVipOrder(order);

                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`pos-orderCard ${boosted ? "is-boosted" : ""} ${
                        vip ? "is-vip" : ""
                      }`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      {boosted && (
                        <div className={`pos-boostSeal pos-boostSeal--${getBoostSealTone(order)}`}>
                          <span>BOOTS</span>
                        </div>
                      )}

                      <div className="pos-orderIdRow">
                        <div>
                          <span>Pedido</span>
                          <strong>{order.code}</strong>
                        </div>
                        <em>#{order.queuePosition || "-"}</em>
                      </div>

                      <div className="pos-orderCustomerCard">
                        <div className="pos-orderCustomerTop">
                          <div>
                            <span>Cliente</span>
                            <strong>{getCustomerName(order)}</strong>
                          </div>
                          <b className={`pos-segmentBadge pos-segmentBadge--${segment.tone}`}>
                            {segment.label}
                          </b>
                        </div>

                        {tags.length > 0 && (
                          <div className="pos-orderTags">
                            {tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        )}

                        <div className="pos-orderContact">
                          <span>{order.customerData?.phone || "Sin telefono"}</span>
                          {order.customerData?.code && <span>{order.customerData.code}</span>}
                        </div>

                        <div className="pos-orderAddress">
                          {address || getOrderContext(order) || "Sin direccion"}
                        </div>
                      </div>

                      <div className="pos-orderSummary">
                        <span>{getOrderType(order)}</span>
                        <span>{formatTime(order.date || order.createdAt)}</span>
                        <b>{formatMoney(order.total, order.currency || "EUR")}</b>
                      </div>

                      {!boosted && vip && (
                        <div className="pos-vipPriorityBadge">VIP prioridad despues de Boost</div>
                      )}

                      {boosted && (
                        <div className="pos-orderBoost">{getBoostText(order)}</div>
                      )}

                      <div className="pos-orderItemsTitle">Pidio</div>
                      <OrderItems order={order} />
                    </button>
                  );
                })}
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

      {customerHelpOpen && (
        <div className="pos-modalBack" onClick={() => setCustomerHelpOpen(false)}>
          <section
            className="pos-reservationModal pos-customerHelpModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pos-sectionHead">
              <div>
                <span>Consulta al cliente</span>
                <h2>Duda de cocina</h2>
              </div>
              <button type="button" onClick={() => setCustomerHelpOpen(false)}>
                Cerrar
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="pos-emptySmall">
                No hay pedidos pendientes para consultar.
              </div>
            ) : (
              <div className="pos-customerHelpForm">
                <label>
                  <span>Pedido</span>
                  <select
                    value={customerHelpOrderId}
                    onChange={(event) => setCustomerHelpOrderId(event.target.value)}
                  >
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.code || `Pedido ${order.id}`} - {getCustomerName(order)}
                      </option>
                    ))}
                  </select>
                </label>

                {customerHelpOrder && (
                  <div className="pos-customerHelpTarget">
                    <strong>{getCustomerName(customerHelpOrder)}</strong>
                    <span>{customerHelpOrder.customerData?.phone || "Sin telefono"}</span>
                    {customerHelpOrder.notes && <small>{customerHelpOrder.notes}</small>}
                  </div>
                )}

                <div className="pos-customerHelpTemplates">
                  {CUSTOMER_HELP_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setCustomerHelpText(template)}
                    >
                      {template}
                    </button>
                  ))}
                </div>

                <label>
                  <span>Mensaje</span>
                  <textarea
                    value={customerHelpText}
                    onChange={(event) => setCustomerHelpText(event.target.value)}
                    rows={4}
                    placeholder="Escribe aqui la duda exacta para el cliente..."
                  />
                </label>
              </div>
            )}

            <div className="pos-actionGrid">
              <button type="button" onClick={() => setCustomerHelpOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendCustomerHelpQuestion}
                disabled={!customerHelpOrder || !customerHelpText.trim()}
              >
                Abrir WhatsApp
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
      {!showVisitorAlert && (
        <>
      <button
        type="button"
        className={`pos-customerHelpFab ${selectedOrder ? "active" : ""}`}
        onClick={() => setCustomerHelpOpen(true)}
        title="Consultar al cliente por una duda del pedido"
      >
        <span aria-hidden="true">{customerHelpEmoji}</span>
        <strong>?</strong>
      </button>
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
        </>
      )}
    </main>
  );
}
