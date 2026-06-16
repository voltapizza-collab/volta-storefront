import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import {
  createCustomerSegmentCounts,
  CUSTOMER_SEGMENTS,
  customerSegmentLabel,
  customerSegmentMeta,
  DEFAULT_CUSTOMER_SEGMENT,
  normalizeCustomerSegment,
} from "../../constants/customerSegments";
import "../../styles/CustomersModule.css";
import OfferCreatePanelCustomer from "./Coupons/OfferCreatePanelCustomer";

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
  address_1: "",
  zipCode: "",
  portal: "",
  observations: "",
};

const normalizePhone = (value = "") => value.replace(/[^\d]/g, "");

const displayESPhone = (phone = "") => {
  const raw = String(phone || "").trim();
  const match = raw.match(/^\+34(\d{9})$/);
  if (match) return match[1];
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : raw;
};

const formatCustomerName = (name = "") => {
  const normalized = String(name || "").trim().replace(/\s+/g, " ");
  return normalized ? normalized.toLocaleUpperCase("es-ES") : "-";
};

const formatMoney = (value, currency = "EUR") => {
  const amount = Number(value || 0);
  return `${currency} ${amount.toFixed(2)}`;
};

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const formatCustomerMoney = (customer, value) =>
  Number(customer?.orderCount || 0) > 0 ? formatMoney(value) : "-";

const formatDaysOff = (customer) => {
  if (!Number(customer?.orderCount || 0)) return "Sin compras";
  const daysOff = Number(customer?.daysOff ?? 0);
  if (!daysOff) return "Hoy";
  return `${daysOff} dias`;
};

const getTicketComparisonLabel = (customer) => {
  if (!Number(customer?.orderCount || 0)) return "Sin compras";
  const storeAverage = Number(customer?.storeAverageTicket || 0);
  if (!storeAverage) return "Sin media tienda";
  return customer.isAboveStoreAverage ? "Sobre media tienda" : "Bajo media tienda";
};

const getTicketComparisonIcon = (customer) => {
  if (!Number(customer?.orderCount || 0) || !Number(customer?.storeAverageTicket || 0)) return "";
  return customer.isAboveStoreAverage ? "▲" : "▼";
};

const getTicketComparisonTone = (customer) => {
  if (!getTicketComparisonIcon(customer)) return "";
  return customer.isAboveStoreAverage ? "is-up" : "is-down";
};

const formatDate = (value) => {
  if (!value) return "Sin compras";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin compras";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatLastOrderDate = (customer) => {
  if (!Number(customer?.orderCount || 0)) return "-";
  return customer?.lastOrderAt ? formatDate(customer.lastOrderAt) : "-";
};

const formatLastOrderWithCount = (customer) => {
  const orderCount = Number(customer?.orderCount || 0);
  const lastOrder = formatLastOrderDate(customer);
  return orderCount > 0 && lastOrder !== "-" ? `${lastOrder} (${orderCount})` : "-";
};

const formatCustomerAge = (customer) => {
  if (!customer?.createdAt) return "-";
  const createdDate = new Date(customer.createdAt);
  if (Number.isNaN(createdDate.getTime())) return "-";

  const days = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000));
  if (!days) return "Hoy";
  if (days === 1) return "1 dia";
  return `${days} dias`;
};

const formatCustomerCreatedAt = (customer) => (customer?.createdAt ? formatDate(customer.createdAt) : "-");

const formatFavoriteProductTitle = (product) => {
  if (!product) return "Sin ventas";
  return `${product.units || 0} uds.`;
};

const getFavoriteProduct = (customer) =>
  customer?.favoriteProduct ||
  (Array.isArray(customer?.topProducts) ? customer.topProducts[0] : null) ||
  null;

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function SegmentBadge({ value }) {
  const segment = customerSegmentMeta(value);
  return (
    <span className={`cu-badge cu-badge-${segment.tone || DEFAULT_CUSTOMER_SEGMENT}`}>
      {segment.shortLabel}
    </span>
  );
}

function SortableHeader({ label, sortKey, sortConfig, onSort }) {
  const active = sortConfig.key === sortKey;
  return (
    <button
      className={`cu-sortBtn ${active ? "is-active" : ""}`}
      onClick={() => onSort(sortKey)}
      type="button"
      aria-label={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      <em>{active ? (sortConfig.direction === "asc" ? "ASC" : "DESC") : "SORT"}</em>
    </button>
  );
}

function CustomerInsightModal({ customer, onClose, onEdit, onBoost }) {
  if (!customer) return null;

  const stats = [
    {
      label: "Ticket promedio",
      value: formatCustomerMoney(customer, customer.averageTicket),
      meta: getTicketComparisonLabel(customer),
    },
    {
      label: "Ultimo ticket",
      value: formatCustomerMoney(customer, customer.lastTicket),
      meta: formatLastOrderWithCount(customer),
    },
    {
      label: "Valor acumulado",
      value: formatCustomerMoney(customer, customer.lifetimeValue),
      meta: customerSegmentLabel(customer.segment),
    },
    {
      label: "Dias sin pedir",
      value: formatDaysOff(customer),
      meta: formatLastOrderWithCount(customer),
    },
  ];

  return (
    <div className="cu-modalBack" onMouseDown={onClose}>
      <div className="cu-modalCard cu-profileCard" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cu-modalHead">
          <div>
            <div className="cu-kicker">Perfil de cliente</div>
            <h3>{formatCustomerName(customer.name)}</h3>
            <p className="cu-profileSub">
              {customer.phone ? displayESPhone(customer.phone) : "Sin telefono"} - {customer.zipCode || "Sin CP"}
            </p>
          </div>

          <button className="cu-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </div>

        <div className="cu-profileStatus">
          <SegmentBadge value={customer.segment} />
          <span>{formatDaysOff(customer)}</span>
          <StatusBadge restricted={customer.isRestricted} />
        </div>

        <div className="cu-profileMetrics">
          {stats.map((item) => (
            <article key={item.label} className="cu-profileMetric">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.meta}</small>
            </article>
          ))}
        </div>

        <div className="cu-profileInfo">
          <div>
            <span>Direccion</span>
            <strong>{customer.address_1 || "Sin direccion registrada"}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{customer.email || "Sin email"}</strong>
          </div>
          {customer.observations && (
            <div>
              <span>Observaciones</span>
              <strong>{customer.observations}</strong>
            </div>
          )}
        </div>

        <div className="cu-modalActions">
          <button className="cu-btn cu-btn-ghost" onClick={onClose} type="button">
            Cerrar
          </button>
          <div className="cu-actionsRight">
            <button className="cu-btn cu-btn-ghost" onClick={() => onEdit(customer)} type="button">
              Editar
            </button>
            <button className="cu-btn cu-btn-primary" onClick={() => onBoost(customer)} type="button">
              Crear boost
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ restricted }) {
  return (
    <span className={`cu-badge ${restricted ? "cu-badge-restricted" : "cu-badge-active"}`}>
      {restricted ? "Restricted" : "Active"}
    </span>
  );
}

function CustomerModal({ initial, loading, onClose, onSubmit, onDelete }) {
  const [form, setForm] = useState(emptyCustomer);
  const favoriteProduct = getFavoriteProduct(initial);
  const insightRows = [
    {
      label: "Ticket prom.",
      value: formatCustomerMoney(initial, initial?.averageTicket),
      meta: getTicketComparisonIcon(initial),
      tone: getTicketComparisonTone(initial),
    },
    {
      label: "Ultima compra",
      value: formatLastOrderWithCount(initial),
      meta: formatDaysOff(initial),
    },
    {
      label: "Pizza mas comprada",
      value: favoriteProduct?.name || "-",
      meta: formatFavoriteProductTitle(favoriteProduct),
    },
    {
      label: "Antiguedad",
      value: formatCustomerAge(initial),
      meta: formatCustomerCreatedAt(initial),
    },
  ];

  useEffect(() => {
    setForm({
      name: initial?.name || "",
      phone: displayESPhone(initial?.phone || ""),
      email: initial?.email || "",
      address_1: initial?.address_1 || "",
      zipCode: initial?.zipCode || "",
      portal: initial?.portal || "",
      observations: initial?.observations || "",
    });
  }, [initial]);

  return (
    <div className="cu-modalBack" onMouseDown={onClose}>
      <div className="cu-modalCard" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cu-modalHead">
          <div>
            <div className="cu-kicker">Customers</div>
            <h3>{initial?.id ? "Edit customer" : "Add customer"}</h3>
          </div>

          <button className="cu-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </div>

        <form
          className="cu-formGrid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          {initial?.id && (
            <div className="cu-editInsights cu-field-wide">
              {insightRows.map((item) => (
                <article key={item.label} className="cu-editInsight">
                  <span>{item.label}</span>
                  <strong>
                    {item.value}
                    {item.tone && <em className={`cu-ticketArrow ${item.tone}`}>{item.meta}</em>}
                  </strong>
                  {!item.tone && <small>{item.meta}</small>}
                </article>
              ))}
            </div>
          )}

          <label className="cu-field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <label className="cu-field">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: normalizePhone(event.target.value) }))
              }
            />
          </label>

          <label className="cu-field">
            <span>Email</span>
            <input
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>

          <label className="cu-field">
            <span>Address</span>
            <input
              value={form.address_1}
              onChange={(event) => setForm((prev) => ({ ...prev, address_1: event.target.value }))}
            />
          </label>

          <label className="cu-field">
            <span>Zip code</span>
            <input
              value={form.zipCode}
              onChange={(event) => setForm((prev) => ({ ...prev, zipCode: event.target.value }))}
            />
          </label>

          <label className="cu-field">
            <span>Portal</span>
            <input
              value={form.portal}
              onChange={(event) => setForm((prev) => ({ ...prev, portal: event.target.value }))}
            />
          </label>

          <label className="cu-field cu-field-wide">
            <span>Observations</span>
            <textarea
              rows="4"
              value={form.observations}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, observations: event.target.value }))
              }
            />
          </label>

          <div className="cu-modalActions cu-field-wide">
            {initial?.id ? (
              <button
                className="cu-btn cu-btn-danger"
                onClick={onDelete}
                type="button"
                disabled={loading}
              >
                Delete
              </button>
            ) : (
              <span />
            )}

            <div className="cu-actionsRight">
              <button className="cu-btn cu-btn-ghost" onClick={onClose} type="button">
                Cancel
              </button>
              <button className="cu-btn cu-btn-primary" type="submit" disabled={loading}>
                {initial?.id ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersModule({ partner }) {
  const partnerId = partner?.partnerId;
  const partnerSlug = partner?.partnerSlug;
  const [countryQuery, setCountryQuery] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [zipQuery, setZipQuery] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [territory, setTerritory] = useState({
    countries: [],
    stores: [],
  });
  const [stats, setStats] = useState({
    total: 0,
    counts: createCustomerSegmentCounts(),
    active: { restricted: 0, unrestricted: 0 },
    zipCodes: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [boosting, setBoosting] = useState(null);
  const [segmentFilter, setSegmentFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "desc" });

  const loadStats = useCallback(async () => {
    if (!partnerId) return;
    const response = await api.get(`/api/customers/segment-stats?partnerId=${partnerId}`);
    setStats(
      response.data || {
        total: 0,
        counts: createCustomerSegmentCounts(),
        active: { restricted: 0, unrestricted: 0 },
        zipCodes: [],
      }
    );
  }, [partnerId]);

  const loadTerritory = useCallback(async () => {
    if (!partnerId) return;

    const [storesResponse, partnerResponse] = await Promise.all([
      api.get(`/stores?partnerId=${partnerId}`),
      partnerSlug ? api.get(`/partners/${partnerSlug}`) : Promise.resolve({ data: null }),
    ]);

    const partnerCountry = String(partnerResponse.data?.country || "").trim();

    setTerritory({
      countries: partnerCountry ? [partnerCountry] : [],
      stores: Array.isArray(storesResponse.data) ? storesResponse.data : [],
    });

  }, [partnerId, partnerSlug]);

  const activeCountry = useMemo(() => {
    if (countryQuery) return countryQuery;
    if (!storeQuery) return "";
    return territory.countries[0] || "";
  }, [countryQuery, storeQuery, territory.countries]);

  const loadRows = useCallback(
    async (countryValue = "", storeValue = "", zipDigits = "", searchText = "") => {
      if (!partnerId) return;

      const params = new URLSearchParams({
        partnerId: String(partnerId),
        take: "all",
      });

      if (countryValue) params.set("country", countryValue);
      if (storeValue) params.set("storeId", storeValue);
      if (segmentFilter) params.set("segment", segmentFilter);
      if (searchText.trim()) params.set("q", searchText.trim());
      if (zipDigits) params.set("zip", zipDigits);

      const response = await api.get(`/api/customers/admin?${params.toString()}`);
      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
    },
    [partnerId, segmentFilter]
  );

  useEffect(() => {
    if (!partnerId) return;

    const bootstrap = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadTerritory(), loadStats()]);
      } catch (requestError) {
        console.error("CUSTOMERS MODULE BOOTSTRAP ERROR:", requestError);
        setError("No pudimos cargar customers.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [loadStats, loadTerritory, partnerId]);

  useEffect(() => {
    if (!partnerId) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        await loadRows(activeCountry, storeQuery, zipQuery, query);
      } catch (requestError) {
        console.error("CUSTOMERS SEARCH ERROR:", requestError);
        setError("No pudimos filtrar customers.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeCountry, loadRows, partnerId, query, storeQuery, zipQuery]);

  const orderedSegments = useMemo(() => CUSTOMER_SEGMENTS, []);
  const hasActiveFilters = Boolean(segmentFilter || countryQuery || storeQuery || query || zipQuery);
  const hasActiveTableControls = Boolean(hasActiveFilters || sortConfig.key);
  const visibleStats = useMemo(() => {
    if (!hasActiveFilters) return stats;

    const counts = createCustomerSegmentCounts();
    let restricted = 0;

    rows.forEach((customer) => {
      const segment = normalizeCustomerSegment(customer?.segment);
      if (segment && Object.prototype.hasOwnProperty.call(counts, segment)) {
        counts[segment] += 1;
      }
      if (customer?.isRestricted) restricted += 1;
    });

    const zipCodes = [...new Set(
      rows
        .map((customer) => customer?.zipCode || customer?.address_1?.match(/\b(\d{5})\b/)?.[1] || null)
        .filter(Boolean)
    )].sort((left, right) => String(left).localeCompare(String(right)));

    return {
      total: rows.length,
      counts,
      active: {
        restricted,
        unrestricted: Math.max(rows.length - restricted, 0),
      },
      zipCodes,
    };
  }, [hasActiveFilters, rows, stats]);

  const getSegmentPercent = (segmentKey) => {
    const total = Number(stats.total || 0);
    if (!total) return 0;
    return (Number(stats.counts?.[segmentKey] || 0) / total) * 100;
  };

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  useEffect(() => {
    if (!zipQuery) return;
    if (visibleStats.zipCodes?.includes(zipQuery)) return;
    setZipQuery("");
  }, [visibleStats.zipCodes, zipQuery]);

  useEffect(() => {
    if (!storeQuery) return;
    if (countryQuery) return;
    if (!territory.countries.length) return;
    setCountryQuery(territory.countries[0]);
  }, [countryQuery, storeQuery, territory.countries]);

  const saveCustomer = async (payload) => {
    try {
      setSaving(true);
      setError("");

      const finalPayload = {
        partnerId,
        ...payload,
      };

      if (editing?.id) {
        await api.patch(`/api/customers/${editing.id}`, finalPayload);
      } else {
        await api.post("/api/customers", finalPayload);
      }

      await Promise.all([loadRows(activeCountry, storeQuery, zipQuery, query), loadStats()]);
      setShowModal(false);
      setEditing(null);
    } catch (requestError) {
      console.error("SAVE CUSTOMER ERROR:", requestError);
      setError(requestError.response?.data?.error || "No pudimos guardar el customer.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async () => {
    if (!editing?.id) return;
    if (!window.confirm("Delete customer?")) return;

    try {
      setSaving(true);
      await api.delete(`/api/customers/${editing.id}`);
      await Promise.all([loadRows(activeCountry, storeQuery, zipQuery, query), loadStats()]);
      setShowModal(false);
      setEditing(null);
    } catch (requestError) {
      console.error("DELETE CUSTOMER ERROR:", requestError);
      setError("No pudimos eliminar el customer.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRestricted = async (customer) => {
    try {
      const next = !customer.isRestricted;
      const reason = next ? window.prompt("Reason for restriction (optional):") || "" : "";

      await api.patch(`/api/customers/${customer.id}/restrict`, {
        isRestricted: next,
        reason,
      });

      await Promise.all([loadRows(activeCountry, storeQuery, zipQuery, query), loadStats()]);
    } catch (requestError) {
      console.error("TOGGLE RESTRICT ERROR:", requestError);
      setError("No pudimos cambiar el estado del customer.");
    }
  };

  const resegment = async () => {
    try {
      setSaving(true);
      await api.post("/api/customers/resegment", { partnerId });
      await Promise.all([loadRows(activeCountry, storeQuery, zipQuery, query), loadStats()]);
    } catch (requestError) {
      console.error("RESEGMENT ERROR:", requestError);
      setError("No pudimos recalcular segmentos.");
    } finally {
      setSaving(false);
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows;

    const direction = sortConfig.direction === "asc" ? 1 : -1;
    const getNumericSortValue = (customer) => {
      if (!Number(customer?.orderCount || 0)) return null;
      if (sortConfig.key === "averageTicket") return Number(customer?.averageTicket || 0);
      if (sortConfig.key === "lastOrderAt") {
        const time = customer?.lastOrderAt ? new Date(customer.lastOrderAt).getTime() : NaN;
        return Number.isFinite(time) ? time : null;
      }
      return null;
    };

    return rows
      .map((customer, index) => ({ customer, index }))
      .sort((left, right) => {
        if (sortConfig.key === "favoriteProduct") {
          const leftProduct = getFavoriteProduct(left.customer);
          const rightProduct = getFavoriteProduct(right.customer);
          const leftMissing = !leftProduct?.name;
          const rightMissing = !rightProduct?.name;

          if (leftMissing || rightMissing) {
            if (leftMissing && rightMissing) return left.index - right.index;
            return leftMissing ? 1 : -1;
          }

          const unitsDiff = Number(leftProduct.units || 0) - Number(rightProduct.units || 0);
          if (unitsDiff) return unitsDiff * direction;

          const nameDiff = String(leftProduct.name || "").localeCompare(String(rightProduct.name || ""), "es", {
            sensitivity: "base",
          });
          if (nameDiff) return nameDiff * direction;
          return left.index - right.index;
        }

        const leftValue = getNumericSortValue(left.customer);
        const rightValue = getNumericSortValue(right.customer);
        const leftMissing = leftValue == null;
        const rightMissing = rightValue == null;

        if (leftMissing || rightMissing) {
          if (leftMissing && rightMissing) return left.index - right.index;
          return leftMissing ? 1 : -1;
        }

        const valueDiff = leftValue - rightValue;
        if (valueDiff) return valueDiff * direction;
        return left.index - right.index;
      })
      .map((item) => item.customer);
  }, [rows, sortConfig]);

  const exportRows = () => {
    const headers = [
      "code",
      "name",
      "phone",
      "email",
      "segment",
      "zipCode",
      "daysOff",
      "orderCount",
      "averageTicket",
      "lifetimeValue",
      "storeAverageTicket",
      "ticketVsStoreAverage",
      "lastTicket",
      "lastOrderAt",
      "address",
    ];
    const lines = [
      headers.join(","),
      ...sortedRows.map((customer) =>
        [
          customer.code,
          customer.name,
          displayESPhone(customer.phone || ""),
          customer.email,
          customerSegmentLabel(customer.segment),
          customer.zipCode,
          customer.daysOff,
          customer.orderCount,
          Number(customer.orderCount || 0) > 0 ? Number(customer.averageTicket || 0).toFixed(2) : "",
          Number(customer.orderCount || 0) > 0 ? Number(customer.lifetimeValue || 0).toFixed(2) : "",
          Number(customer.storeAverageTicket || 0) > 0 ? Number(customer.storeAverageTicket || 0).toFixed(2) : "",
          getTicketComparisonLabel(customer),
          Number(customer.orderCount || 0) > 0 ? Number(customer.lastTicket || 0).toFixed(2) : "",
          formatLastOrderDate(customer),
          customer.address_1,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-segment-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="cu-shell">
      <div className="cu-panel">
        <div className="cu-head">
          <div>
            <div className="cu-kicker">Customers</div>
            <h2>Gestion de clientes</h2>
            <p>Bloque del transplante CRM dentro del backoffice del partner.</p>
          </div>

          <div className="cu-headActions">
            <button className="cu-btn cu-btn-ghost" onClick={resegment} type="button" disabled={saving}>
              Actualizar segmentos
            </button>
            <button
              className="cu-btn cu-btn-ghost"
              onClick={exportRows}
              type="button"
            disabled={!rows.length}
            >
              Exportar lista
            </button>
            <button
              className="cu-btn cu-btn-primary"
              onClick={() => {
                setEditing(null);
                setShowModal(true);
              }}
              type="button"
            >
              + Add customer
            </button>
          </div>
        </div>

        <div className="cu-overview">
          <div className="cu-statsBlock">
            <div className="cu-blockLabel">Segmentos</div>
            <div className="cu-statsGrid cu-statsGrid-segments">
              {orderedSegments.map((segment) => (
                <article
                  key={segment.key}
                  className="cu-statCard cu-statCard-segment cu-statCard-static"
                >
                  <span>{segment.shortLabel}</span>
                  <div className="cu-statValue">
                    <strong>{stats.counts?.[segment.key] || 0}</strong>
                    <em>{formatPercent(getSegmentPercent(segment.key))}</em>
                  </div>
                  <small>{segment.description}</small>
                </article>
              ))}

              <article className="cu-statCard cu-statCard-total cu-statCard-static">
                <span>Total</span>
                <div className="cu-statValue">
                  <strong>{stats.total || 0}</strong>
                  <em>{stats.total ? "100%" : "0%"}</em>
                </div>
                <small>
                  Active: {stats.active?.unrestricted || 0} - Restricted:{" "}
                  {stats.active?.restricted || 0}
                </small>
              </article>
            </div>
          </div>
        </div>

        <div className="cu-toolbar">
          <select className="cu-search" value={activeCountry} onChange={(event) => setCountryQuery(event.target.value)}>
            <option value="">Pais</option>
            {territory.countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          <select className="cu-search" value={storeQuery} onChange={(event) => setStoreQuery(event.target.value)}>
            <option value="">Tienda</option>
            {territory.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.storeName}
                {store.city ? ` - ${store.city}` : ""}
              </option>
            ))}
          </select>
          <select className="cu-search" value={zipQuery} onChange={(event) => setZipQuery(event.target.value)}>
            <option value="">Zip code</option>
            {visibleStats.zipCodes?.map((zipCode) => (
              <option key={zipCode} value={zipCode}>
                {zipCode}
              </option>
            ))}
          </select>
          <input
            className="cu-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar nombre, telefono, CP, direccion..."
          />
        </div>

        <div className="cu-filterBar">
          <div className="cu-filterGroup">
            <span className="cu-filterTitle">Segmento</span>
            {orderedSegments.map((segment) => (
              <button
                key={segment.key}
                className={`cu-filterChip ${segmentFilter === segment.key ? "active" : ""}`}
                onClick={() => setSegmentFilter((prev) => (prev === segment.key ? null : segment.key))}
                type="button"
              >
                <span>{segment.shortLabel}</span>
                <strong>{visibleStats.counts?.[segment.key] || 0}</strong>
              </button>
            ))}
          </div>

          {hasActiveTableControls && (
            <button
              className="cu-filterReset"
              onClick={() => {
                setSegmentFilter(null);
                setCountryQuery("");
                setStoreQuery("");
                setQuery("");
                setZipQuery("");
                setSortConfig({ key: null, direction: "desc" });
              }}
              type="button"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {error && <div className="cu-error">{error}</div>}

        <div className="cu-tableWrap">
          <table className="cu-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Segment</th>
                <th>
                  <SortableHeader
                    label="Ticket prom."
                    sortKey="averageTicket"
                    sortConfig={sortConfig}
                    onSort={toggleSort}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Ultima compra"
                    sortKey="lastOrderAt"
                    sortConfig={sortConfig}
                    onSort={toggleSort}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Pizza mas comprada"
                    sortKey="favoriteProduct"
                    sortConfig={sortConfig}
                    onSort={toggleSort}
                  />
                </th>
                <th className="actions">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((customer) => {
                const favoriteProduct = getFavoriteProduct(customer);

                return (
                  <tr key={customer.id}>
                    <td>{customer.code || "-"}</td>
                    <td>
                      <div className="cu-nameCell">
                        <strong title={customer.name || ""}>{formatCustomerName(customer.name)}</strong>
                      </div>
                    </td>
                    <td>{customer.phone ? displayESPhone(customer.phone) : "-"}</td>
                    <td>
                      <SegmentBadge value={customer.segment} />
                    </td>
                    <td>
                      <div className="cu-moneyCell cu-ticketCell">
                        <strong>{formatCustomerMoney(customer, customer.averageTicket)}</strong>
                        {getTicketComparisonIcon(customer) && (
                          <span className={`cu-ticketArrow ${getTicketComparisonTone(customer)}`}>
                            {getTicketComparisonIcon(customer)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="cu-moneyCell">
                        <strong title={formatDaysOff(customer)}>{formatLastOrderWithCount(customer)}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="cu-favoritePizzaCell">
                        <strong title={formatFavoriteProductTitle(favoriteProduct)}>
                          {favoriteProduct?.name || "-"}
                        </strong>
                        {favoriteProduct && <span>{formatFavoriteProductTitle(favoriteProduct)}</span>}
                      </div>
                    </td>
                    <td className="actions">
                      <div className="cu-rowActions">
                      <button
                        className="cu-inlineBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(customer);
                          setShowModal(true);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="cu-inlineBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setBoosting(customer);
                        }}
                        type="button"
                      >
                        Boost
                      </button>
                      <button
                        className="cu-inlineBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRestricted(customer);
                        }}
                        type="button"
                      >
                        {customer.isRestricted ? "Unrest" : "Restrict"}
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && sortedRows.length === 0 && (
                <tr>
                  <td colSpan="8">
                    <div className="cu-empty">No customers yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <CustomerModal
          initial={editing}
          loading={saving}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSubmit={saveCustomer}
          onDelete={deleteCustomer}
        />
      )}

      {profileCustomer && (
        <CustomerInsightModal
          customer={profileCustomer}
          onClose={() => setProfileCustomer(null)}
          onEdit={(customer) => {
            setProfileCustomer(null);
            setEditing(customer);
            setShowModal(true);
          }}
          onBoost={(customer) => {
            setProfileCustomer(null);
            setBoosting(customer);
          }}
        />
      )}

      {boosting && (
        <OfferCreatePanelCustomer
          partnerId={partnerId}
          customer={boosting}
          onClose={() => setBoosting(null)}
          onDone={async () => {
            setBoosting(null);
            await Promise.all([loadRows(activeCountry, storeQuery, zipQuery, query), loadStats()]);
          }}
        />
      )}
    </section>
  );
}
