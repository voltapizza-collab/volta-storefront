import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/CustomersModule.css";
import OfferCreatePanelCustomer from "./Coupons/OfferCreatePanelCustomer";

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
  address_1: "",
  portal: "",
  observations: "",
};

const normalizePhone = (value = "") => value.replace(/[^\d]/g, "");

const temperatureCards = [
  { key: "HOT", label: "Hot", description: "Ultimos 15 dias", countKey: "hot", tone: "hot" },
  { key: "COLD", label: "Cold", description: "Mas de 15 dias", countKey: "cold", tone: "cold" },
];

const segmentCards = [
  { key: "S1", shortLabel: "Potencial", description: "0 compras" },
  { key: "S2", shortLabel: "Nuevo", description: "1 compra" },
  { key: "S3", shortLabel: "Dormido", description: "Bajo su media" },
  { key: "S4", shortLabel: "Activo", description: "En linea con su media" },
  { key: "S5", shortLabel: "VIP", description: "Supera objetivo +15%" },
];

const displayESPhone = (phone = "") => {
  const raw = String(phone || "").trim();
  const match = raw.match(/^\+34(\d{9})$/);
  if (match) return match[1];
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : raw;
};

function SegmentBadge({ value }) {
  const segment = segmentCards.find((item) => item.key === value) || segmentCards[0];
  return (
    <span className={`cu-badge cu-badge-${String(segment.key || "s1").toLowerCase()}`}>
      {segment.shortLabel}
    </span>
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

  useEffect(() => {
    setForm({
      name: initial?.name || "",
      phone: displayESPhone(initial?.phone || ""),
      email: initial?.email || "",
      address_1: initial?.address_1 || "",
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
  const [query, setQuery] = useState("");
  const [zipQuery, setZipQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    counts: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 },
    active: { restricted: 0, unrestricted: 0 },
    temperature: { cold: 0, hot: 0 },
    zipCodes: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [boosting, setBoosting] = useState(null);
  const [segmentFilter, setSegmentFilter] = useState(null);
  const [temperatureFilter, setTemperatureFilter] = useState(null);

  const loadStats = useCallback(async () => {
    if (!partnerId) return;
    const response = await api.get(`/api/customers/segment-stats?partnerId=${partnerId}`);
    setStats(
      response.data || {
        total: 0,
        counts: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 },
        active: { restricted: 0, unrestricted: 0 },
        temperature: { cold: 0, hot: 0 },
        zipCodes: [],
      }
    );
  }, [partnerId]);

  const loadRows = useCallback(
    async (phoneDigits = "", zipDigits = "") => {
      if (!partnerId) return;

      const params = new URLSearchParams({
        partnerId: String(partnerId),
        take: "50",
      });

      if (segmentFilter) params.set("segment", segmentFilter);
      if (temperatureFilter) params.set("temperature", temperatureFilter);
      if (phoneDigits) params.set("q", phoneDigits);
      if (zipDigits) params.set("zip", zipDigits);

      const response = await api.get(`/api/customers/admin?${params.toString()}`);
      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
    },
    [partnerId, segmentFilter, temperatureFilter]
  );

  useEffect(() => {
    if (!partnerId) return;

    const bootstrap = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadRows("", ""), loadStats()]);
      } catch (requestError) {
        console.error("CUSTOMERS MODULE BOOTSTRAP ERROR:", requestError);
        setError("No pudimos cargar customers.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [loadRows, loadStats, partnerId]);

  useEffect(() => {
    if (!partnerId) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        await loadRows(normalizePhone(query), zipQuery);
      } catch (requestError) {
        console.error("CUSTOMERS SEARCH ERROR:", requestError);
        setError("No pudimos filtrar customers.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadRows, partnerId, query, zipQuery]);

  const orderedSegments = useMemo(() => segmentCards, []);
  const hasActiveFilters = Boolean(segmentFilter || temperatureFilter || query || zipQuery);

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

      await Promise.all([loadRows(normalizePhone(query), zipQuery), loadStats()]);
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
      await Promise.all([loadRows(normalizePhone(query), zipQuery), loadStats()]);
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

      await Promise.all([loadRows(normalizePhone(query), zipQuery), loadStats()]);
    } catch (requestError) {
      console.error("TOGGLE RESTRICT ERROR:", requestError);
      setError("No pudimos cambiar el estado del customer.");
    }
  };

  const resegment = async () => {
    try {
      setSaving(true);
      await api.post("/api/customers/resegment", { partnerId });
      await Promise.all([loadRows(normalizePhone(query), zipQuery), loadStats()]);
    } catch (requestError) {
      console.error("RESEGMENT ERROR:", requestError);
      setError("No pudimos recalcular segmentos.");
    } finally {
      setSaving(false);
    }
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
                  className={`cu-statCard cu-statCard-segment ${
                    segmentFilter === segment.key ? "active" : ""
                  }`}
                  onClick={() => setSegmentFilter((prev) => (prev === segment.key ? null : segment.key))}
                >
                  <span>{segment.shortLabel}</span>
                  <strong>{stats.counts?.[segment.key] || 0}</strong>
                  <small>{segment.description}</small>
                </article>
              ))}
            </div>
          </div>

          <div className="cu-statsBlock">
            <div className="cu-blockLabel">Temperatura</div>
            <div className="cu-statsGrid cu-statsGrid-temperature">
              {temperatureCards.map((item) => (
                <article
                  key={item.key}
                  className={`cu-statCard cu-statCard-temperature cu-statCard-temperature-${item.tone} ${
                    temperatureFilter === item.key ? "active" : ""
                  }`}
                  onClick={() => setTemperatureFilter((prev) => (prev === item.key ? null : item.key))}
                >
                  <span>{item.label}</span>
                  <strong>{stats.temperature?.[item.countKey] || 0}</strong>
                  <small>{item.description}</small>
                </article>
              ))}

              <article
                className={`cu-statCard cu-statCard-total ${!segmentFilter && !temperatureFilter ? "active" : ""}`}
                onClick={() => {
                  setSegmentFilter(null);
                  setTemperatureFilter(null);
                }}
              >
                <span>Total</span>
                <strong>{stats.total || 0}</strong>
                <small>
                  Active: {stats.active?.unrestricted || 0} · Restricted: {stats.active?.restricted || 0}
                </small>
              </article>
            </div>
          </div>
        </div>

        <div className="cu-toolbar">
          <input
            className="cu-search"
            value={query}
            onChange={(event) => setQuery(normalizePhone(event.target.value))}
            placeholder="Search by phone"
          />
          <select
            className="cu-search"
            value={zipQuery}
            onChange={(event) => setZipQuery(event.target.value)}
          >
            <option value="">All zip codes</option>
            {stats.zipCodes?.map((zipCode) => (
              <option key={zipCode} value={zipCode}>
                {zipCode}
              </option>
            ))}
          </select>
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
                <strong>{stats.counts?.[segment.key] || 0}</strong>
              </button>
            ))}
          </div>

          <div className="cu-filterGroup">
            <span className="cu-filterTitle">Temperatura</span>
            {temperatureCards.map((item) => (
              <button
                key={item.key}
                className={`cu-filterChip cu-filterChip-${item.tone} ${
                  temperatureFilter === item.key ? "active" : ""
                }`}
                onClick={() => setTemperatureFilter((prev) => (prev === item.key ? null : item.key))}
                type="button"
              >
                <span>{item.label}</span>
                <strong>{stats.temperature?.[item.countKey] || 0}</strong>
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              className="cu-filterReset"
              onClick={() => {
                setSegmentFilter(null);
                setTemperatureFilter(null);
                setQuery("");
                setZipQuery("");
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
                <th>Days Off</th>
                <th>Status</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.code || "-"}</td>
                  <td>
                    <div className="cu-nameCell">
                      <strong>{customer.name || "-"}</strong>
                      <span>{customer.address_1 || "Sin direccion"}</span>
                    </div>
                  </td>
                  <td>{customer.phone ? displayESPhone(customer.phone) : "-"}</td>
                  <td>
                    <SegmentBadge value={customer.segment} />
                  </td>
                  <td>
                    <span
                      className={`cu-pill ${(customer.daysOff ?? 0) > 15 ? "cold" : "hot"}`}
                      title={`${customer.daysOff ?? 0} days without orders`}
                    >
                      {(customer.daysOff ?? 0) > 15 ? "COLD" : "HOT"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge restricted={customer.isRestricted} />
                  </td>
                  <td className="actions">
                    <div className="cu-rowActions">
                      <button
                        className="cu-inlineBtn"
                        onClick={() => {
                          setEditing(customer);
                          setShowModal(true);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="cu-inlineBtn"
                        onClick={() => setBoosting(customer)}
                        type="button"
                      >
                        Boost
                      </button>
                      <button
                        className="cu-inlineBtn"
                        onClick={() => toggleRestricted(customer)}
                        type="button"
                      >
                        {customer.isRestricted ? "Unrest" : "Restrict"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="7">
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

      {boosting && (
        <OfferCreatePanelCustomer
          partnerId={partnerId}
          customer={boosting}
          onClose={() => setBoosting(null)}
          onDone={async () => {
            setBoosting(null);
            await Promise.all([loadRows(normalizePhone(query), zipQuery), loadStats()]);
          }}
        />
      )}
    </section>
  );
}
