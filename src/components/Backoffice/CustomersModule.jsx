import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/CustomersModule.css";
// import CustomerIncentiveModal from "../CustomerIncentiveModal";

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
  address_1: "",
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

function SegmentBadge({ value }) {
  return <span className={`cu-badge cu-badge-${String(value || "s1").toLowerCase()}`}>{value || "S1"}</span>;
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
              onChange={(event) =>
                setForm((prev) => ({ ...prev, address_1: event.target.value }))
              }
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
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    counts: { S1: 0, S2: 0, S3: 0, S4: 0 },
    active: { restricted: 0, unrestricted: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [segmentFilter, setSegmentFilter] = useState(null);
const [incentiveCustomer, setIncentiveCustomer] = useState(null);
  const loadStats = useCallback(async () => {
    if (!partnerId) return;
    const response = await api.get(`/api/customers/segment-stats?partnerId=${partnerId}`);
    setStats(response.data || {
      total: 0,
      counts: { S1: 0, S2: 0, S3: 0, S4: 0 },
      active: { restricted: 0, unrestricted: 0 },
    });
  }, [partnerId]);

  const loadRows = useCallback(
    async (phoneDigits = "") => {
      if (!partnerId) return;

      const params = new URLSearchParams({
        partnerId: String(partnerId),
        take: phoneDigits ? "50" : "50",
      });

      if (segmentFilter) {
        params.set("segment", segmentFilter);
      }

      if (phoneDigits) {
        params.set("q", phoneDigits);
      }

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
        await Promise.all([loadRows(""), loadStats()]);
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
        await loadRows(normalizePhone(query));
      } catch (requestError) {
        console.error("CUSTOMERS SEARCH ERROR:", requestError);
        setError("No pudimos filtrar customers.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadRows, partnerId, query, segmentFilter]);

  const orderedSegments = useMemo(() => ["S1", "S2", "S3", "S4"], []);

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

      await Promise.all([loadRows(normalizePhone(query)), loadStats()]);
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
      await Promise.all([loadRows(normalizePhone(query)), loadStats()]);
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

      await Promise.all([loadRows(normalizePhone(query)), loadStats()]);
    } catch (requestError) {
      console.error("TOGGLE RESTRICT ERROR:", requestError);
      setError("No pudimos cambiar el estado del customer.");
    }
  };

  const resegment = async () => {
    try {
      setSaving(true);
      await api.post("/api/customers/resegment", { partnerId });
      await Promise.all([loadRows(normalizePhone(query)), loadStats()]);
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
            <p>
              Bloque del transplante CRM dentro del backoffice del partner.
            </p>
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

        <div className="cu-statsGrid">
          {orderedSegments.map((segment) => (
            <article
                key={segment}
                className={`cu-statCard ${segmentFilter === segment ? "active" : ""}`}
                onClick={() => {
                  setSegmentFilter((prev) => (prev === segment ? null : segment));
                }}
              >
              <span>{segment}</span>
              <strong>{stats.counts?.[segment] || 0}</strong>
            </article>
          ))}

          <article
              className={`cu-statCard cu-statCard-total ${!segmentFilter ? "active" : ""}`}
              onClick={() => {
                setSegmentFilter(null);
              }}
            >
            <span>Total</span>
            <strong>{stats.total || 0}</strong>
            <small>
              Active: {stats.active?.unrestricted || 0} · Restricted: {stats.active?.restricted || 0}
            </small>
          </article>
        </div>

        <div className="cu-toolbar">
          <input
            className="cu-search"
            value={query}
            onChange={(event) => setQuery(normalizePhone(event.target.value))}
            placeholder="Search by phone"
          />
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
                  <td>{customer.code || "—"}</td>
                  <td>
                    <div className="cu-nameCell">
                      <strong>{customer.name || "—"}</strong>
                      <span>{customer.address_1 || "Sin direccion"}</span>
                    </div>
                  </td>
                  <td>{customer.phone ? displayESPhone(customer.phone) : "—"}</td>
                  <td>
                    <SegmentBadge value={customer.segment} />
                  </td>
                  <td>
                    <span
                      className={`cu-pill ${
                        (customer.daysOff ?? 0) > 15 ? "cold" : "hot"
                      }`}
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
                          onClick={() => setIncentiveCustomer(customer)}
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
                  <td colSpan="6">
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
      {/* {incentiveCustomer && (
  <CustomerIncentiveModal
    customer={incentiveCustomer}
    onClose={() => setIncentiveCustomer(null)}
  />
)} */}
    </section>
  );
}
