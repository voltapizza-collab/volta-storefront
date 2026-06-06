import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/ReviewsModule.css";

const emptyAnalytics = {
  summary: {
    totalRequests: 0,
    sentMessages: 0,
    usedMessages: 0,
    receivedVotes: 0,
    likes: 0,
    dislikes: 0,
    pendingMessages: 0,
    failedMessages: 0,
    skippedMessages: 0,
    responseRate: 0,
    likeRate: 0,
    lastLikeAt: null,
  },
  stores: [],
  topProducts: [],
  productsToReview: [],
  likePeople: [],
  recentVotes: [],
  lastLike: null,
};

const dateFilterOptions = [
  { key: "today", label: "Hoy", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "15d", label: "15 dias", days: 15 },
  { key: "month", label: "Ultimo mes", days: 30 },
  { key: "custom", label: "Fecha", days: null },
];

const numberFormatter = new Intl.NumberFormat("es-ES");

const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
};

const formatPhone = (value = "") => {
  const raw = String(value || "").trim();
  const match = raw.match(/^\+34(\d{9})$/);
  if (match) return match[1];
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : raw || "-";
};

const padDatePart = (value) => String(value).padStart(2, "0");

const toDateInputValue = (date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const getDateRange = (filterKey, customDate) => {
  const today = new Date();
  const filter = dateFilterOptions.find((item) => item.key === filterKey) || dateFilterOptions[3];

  if (filter.key === "custom") {
    const selected = customDate ? new Date(`${customDate}T00:00:00`) : today;
    if (Number.isNaN(selected.getTime())) {
      return { from: startOfDay(today), to: endOfDay(today), label: "Fecha" };
    }
    return { from: startOfDay(selected), to: endOfDay(selected), label: formatDate(selected) };
  }

  const from = startOfDay(today);
  from.setDate(from.getDate() - ((filter.days || 1) - 1));
  return { from, to: endOfDay(today), label: filter.label };
};

export default function ReviewsModule({ partner }) {
  const partnerId = partner?.partnerId;
  const [storeId, setStoreId] = useState("");
  const [dateFilter, setDateFilter] = useState("month");
  const [customDate, setCustomDate] = useState(() => toDateInputValue(new Date()));
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const summary = analytics.summary || emptyAnalytics.summary;
  const dateRange = useMemo(() => getDateRange(dateFilter, customDate), [customDate, dateFilter]);

  const loadAnalytics = useCallback(async () => {
    if (!partnerId) return;

    const params = new URLSearchParams({ partnerId: String(partnerId) });
    if (storeId) params.set("storeId", storeId);
    params.set("from", dateRange.from.toISOString());
    params.set("to", dateRange.to.toISOString());

    const { data } = await api.get(`/api/product-reviews/analytics/summary?${params.toString()}`);
    const nextAnalytics = data || emptyAnalytics;
    setAnalytics(nextAnalytics);
    if (!storeId && Array.isArray(nextAnalytics.stores)) {
      setStores(nextAnalytics.stores);
    }
  }, [dateRange, partnerId, storeId]);

  useEffect(() => {
    if (!partnerId) return;

    const bootstrap = async () => {
      try {
        setLoading(true);
        setError("");
        await loadAnalytics();
      } catch (requestError) {
        console.error("REVIEWS MODULE ERROR:", requestError);
        setError("No pudimos cargar reviews.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [loadAnalytics, partnerId]);

  const refreshAnalytics = async () => {
    try {
      setLoading(true);
      setError("");
      await loadAnalytics();
    } catch (requestError) {
      console.error("REVIEWS MODULE REFRESH ERROR:", requestError);
      setError("No pudimos actualizar reviews.");
    } finally {
      setLoading(false);
    }
  };

  const dislikeRate = Number(summary.receivedVotes || 0)
    ? 100 - Number(summary.likeRate || 0)
    : 0;

  const kpis = useMemo(
    () => [
      {
        label: "Mensajes enviados",
        value: summary.sentMessages,
        meta: `${formatPercent(summary.responseRate)} respuesta`,
        tone: "rv-kpi-gold",
      },
      {
        label: "Reacciones recibidas",
        value: summary.receivedVotes,
        meta: `${formatNumber(summary.likes)} likes / ${formatNumber(summary.dislikes)} dislikes`,
        tone: "rv-kpi-blue",
      },
      {
        label: "Likes",
        value: summary.likes,
        meta: `${formatPercent(summary.likeRate)} positivos`,
        tone: "rv-kpi-green",
      },
      {
        label: "Dislikes",
        value: summary.dislikes,
        meta: `${formatPercent(dislikeRate)} negativos`,
        tone: "rv-kpi-rose",
      },
    ],
    [dislikeRate, summary]
  );

  const selectedStoreName = useMemo(() => {
    if (!storeId) return "Todas las tiendas";
    return stores.find((store) => String(store.id) === String(storeId))?.storeName || "Tienda";
  }, [storeId, stores]);
  const selectedScope = `${selectedStoreName} - ${dateRange.label}`;

  return (
    <section className="rv-shell">
      <div className="rv-panel">
        <div className="rv-head">
          <div>
            <div className="rv-kicker">Stores</div>
            <h2>Reviews</h2>
            <p>{selectedScope}</p>
          </div>

          <div className="rv-headActions">
            <select
              className="rv-select"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                  {store.city ? ` - ${store.city}` : ""}
                </option>
              ))}
            </select>
            <div className="rv-dateFilters" aria-label="Filtro de reviews">
              {dateFilterOptions.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`rv-dateBtn ${dateFilter === filter.key ? "is-active" : ""}`}
                  onClick={() => setDateFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
              {dateFilter === "custom" && (
                <input
                  className="rv-dateInput"
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                />
              )}
            </div>
            <button className="rv-btn" type="button" onClick={refreshAnalytics} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </div>

        {error && <div className="rv-error">{error}</div>}

        <div className="rv-kpiGrid">
          {kpis.map((item) => (
            <article key={item.label} className={`rv-kpi ${item.tone}`}>
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
              <small>{item.meta}</small>
            </article>
          ))}
        </div>

        <div className="rv-spotlightGrid">
          <article className="rv-scorePanel">
            <div className="rv-scoreHead">
              <span>Sentimiento</span>
              <strong>{formatPercent(summary.likeRate)}</strong>
            </div>
            <div className="rv-meter" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, Number(summary.likeRate || 0)))}%` }} />
            </div>
            <div className="rv-scoreSplit">
              <span>{formatNumber(summary.likes)} likes</span>
              <span>{formatNumber(summary.dislikes)} dislikes</span>
            </div>
          </article>

          <article className="rv-lastLike">
            <span>Ultimo like</span>
            <strong>{analytics.lastLike?.customerName || "Sin likes todavia"}</strong>
            <small>
              {analytics.lastLike
                ? `${analytics.lastLike.productName} - ${formatDateTime(analytics.lastLike.createdAt)}`
                : "-"}
            </small>
          </article>

          <article className="rv-scorePanel">
            <div className="rv-scoreHead">
              <span>Uso de mensajes</span>
              <strong>{formatPercent(summary.responseRate)}</strong>
            </div>
            <div className="rv-meter rv-meter-response" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, Number(summary.responseRate || 0)))}%` }} />
            </div>
            <div className="rv-scoreSplit">
              <span>{formatNumber(summary.usedMessages)} usados</span>
              <span>{formatNumber(summary.sentMessages)} enviados</span>
            </div>
          </article>
        </div>

        <div className="rv-contentGrid">
          <article className="rv-card rv-card-large">
            <div className="rv-cardHead">
              <span>Personas con likes</span>
              <strong>{formatNumber(analytics.likePeople?.length)}</strong>
            </div>
            <div className="rv-list">
              {(analytics.likePeople || []).map((person) => (
                <div className="rv-personRow" key={`${person.customerId || person.phone || person.name}-${person.lastLikeAt}`}>
                  <div>
                    <strong>{person.name || "Cliente sin nombre"}</strong>
                    <span>{formatPhone(person.phone)}</span>
                  </div>
                  <div>
                    <b>{formatNumber(person.likes)}</b>
                    <small>{formatDateTime(person.lastLikeAt)}</small>
                  </div>
                </div>
              ))}
              {!loading && !analytics.likePeople?.length && (
                <div className="rv-empty">Sin likes registrados.</div>
              )}
            </div>
          </article>

          <div className="rv-cardStack">
            <article className="rv-card">
              <div className="rv-cardHead">
                <span>Pizzas mejor valoradas</span>
                <strong>{formatNumber(analytics.topProducts?.length)}</strong>
              </div>
              <div className="rv-productList">
                {(analytics.topProducts || []).map((product, index) => (
                  <div className="rv-productRow" key={`${product.productId || "custom"}-${product.productName}`}>
                    <em className="rv-rankBadge">{index + 1}</em>
                    <div>
                      <strong>{product.productName}</strong>
                      <span>{formatNumber(product.total)} reacciones</span>
                    </div>
                    <b>{formatPercent(product.approval)}</b>
                  </div>
                ))}
                {!loading && !analytics.topProducts?.length && (
                  <div className="rv-empty">Sin productos valorados.</div>
                )}
              </div>
            </article>

            <article className="rv-card">
              <div className="rv-cardHead">
                <span>Pizzas a revisar</span>
                <strong>{formatNumber(analytics.productsToReview?.length)}</strong>
              </div>
              <div className="rv-productList">
                {(analytics.productsToReview || []).map((product) => (
                  <div className="rv-productRow rv-productRow-alert" key={`${product.productId || "custom"}-${product.productName}`}>
                    <div>
                      <strong>{product.productName}</strong>
                      <span>{formatNumber(product.dislikes)} dislikes de {formatNumber(product.total)}</span>
                    </div>
                    <b>{formatPercent(product.approval)}</b>
                  </div>
                ))}
                {!loading && !analytics.productsToReview?.length && (
                  <div className="rv-empty">Sin pizzas con dislikes.</div>
                )}
              </div>
            </article>
          </div>
        </div>

        <div className="rv-contentGrid rv-contentGrid-bottom">
          <article className="rv-card">
            <div className="rv-cardHead">
              <span>Tiendas</span>
              <strong>{formatNumber((analytics.stores || []).filter((store) => store.total > 0).length)}</strong>
            </div>
            <div className="rv-storeList">
              {(analytics.stores || []).slice(0, 10).map((store) => (
                <div className="rv-storeRow" key={store.id}>
                  <div>
                    <strong>{store.storeName}</strong>
                    <span>{store.city || "Sin ciudad"}</span>
                  </div>
                  <div className="rv-storeNumbers">
                    <b>{formatPercent(store.approval)}</b>
                    <small>{formatNumber(store.total)} votos</small>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rv-card rv-card-large">
            <div className="rv-cardHead">
              <span>Actividad reciente</span>
              <strong>{formatNumber(analytics.recentVotes?.length)}</strong>
            </div>
            <div className="rv-activityList">
              {(analytics.recentVotes || []).map((vote) => (
                <div className="rv-activityRow" key={vote.id}>
                  <span className={`rv-voteBadge ${vote.vote === "LIKE" ? "is-like" : "is-dislike"}`}>
                    {vote.vote === "LIKE" ? "Like" : "Dislike"}
                  </span>
                  <div>
                    <strong>{vote.productName}</strong>
                    <small>
                      {vote.customerName} - {vote.storeName || "Tienda"} - {formatDateTime(vote.createdAt)}
                    </small>
                  </div>
                </div>
              ))}
              {!loading && !analytics.recentVotes?.length && (
                <div className="rv-empty">Sin actividad reciente.</div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
