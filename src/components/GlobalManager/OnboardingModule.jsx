import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const statuses = [
  ["ALL", "Todas"],
  ["RECEIVED", "Recibida"],
  ["EMAIL_SENT", "Email enviado"],
  ["FORM_COMPLETED", "Completada"],
  ["IN_REVIEW", "En revision"],
  ["NEEDS_INFO", "Falta info"],
  ["APPROVED", "Aprobada"],
  ["REJECTED", "Rechazada"],
];

const statusLabels = Object.fromEntries(statuses);

const reviewStatuses = statuses.filter(([value]) => value !== "ALL");

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const fieldLabels = [
  ["legalName", "Razon social"],
  ["taxId", "CIF / NIF / VAT"],
  ["legalRepresentative", "Responsable legal"],
  ["representativeId", "Documento responsable"],
  ["representativeRole", "Cargo"],
  ["fiscalAddress", "Direccion fiscal"],
  ["businessAddress", "Direccion local"],
  ["city", "Ciudad"],
  ["postalCode", "Codigo postal"],
  ["country", "Pais"],
  ["businessPhone", "Telefono comercial"],
  ["businessEmail", "Email comercial"],
  ["website", "Web o redes"],
  ["numberOfStores", "Numero de locales"],
  ["monthlyOrdersEstimate", "Pedidos mensuales"],
  ["currentPlatforms", "Plataformas actuales"],
  ["notes", "Notas"],
];

export default function OnboardingModule() {
  const [requests, setRequests] = useState([]);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);
  const [statusDraft, setStatusDraft] = useState("IN_REVIEW");
  const [reviewerNote, setReviewerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => requests.find((item) => item.id === selectedId) || requests[0] || null,
    [requests, selectedId]
  );

  const stats = useMemo(() => {
    const base = {
      total: requests.length,
      pending: 0,
      completed: 0,
      approved: 0,
    };

    requests.forEach((item) => {
      if (["RECEIVED", "EMAIL_SENT", "NEEDS_INFO"].includes(item.status)) base.pending += 1;
      if (["FORM_COMPLETED", "IN_REVIEW"].includes(item.status)) base.completed += 1;
      if (item.status === "APPROVED") base.approved += 1;
    });

    return base;
  }, [requests]);

  const loadRequests = useCallback(async (status = "ALL") => {
    try {
      setLoading(true);
      setMessage("");
      const query = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
      const response = await api.get(`/api/onboarding/requests${query}`);
      const nextRequests = response.data?.requests || [];
      setRequests(nextRequests);
      setSelectedId((current) =>
        nextRequests.some((item) => item.id === current)
          ? current
          : nextRequests[0]?.id || null
      );
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar las solicitudes de onboarding.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests("ALL");
  }, [loadRequests]);

  useEffect(() => {
    if (!selected) return;
    setStatusDraft(selected.status || "IN_REVIEW");
    setReviewerNote(selected.reviewerNote || "");
  }, [selected]);

  const changeFilter = (status) => {
    setActiveStatus(status);
    loadRequests(status);
  };

  const updateStatus = async (event) => {
    event.preventDefault();
    if (!selected) return;

    try {
      setSaving(true);
      setMessage("");
      const response = await api.patch(`/api/onboarding/requests/${selected.id}/status`, {
        status: statusDraft,
        reviewerNote,
      });
      const updated = response.data?.request;
      setRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage("Estado de onboarding actualizado.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  };

  const formalData = selected?.formalData || {};

  return (
    <div className="gmon-shell">
      <div className="gm-moduleHeader">
        <div>
          <span>Volta Global</span>
          <h2>Onboarding</h2>
        </div>
        <button type="button" onClick={() => loadRequests(activeStatus)}>
          Actualizar
        </button>
      </div>

      <div className="gmon-stats">
        <article><span>Total</span><strong>{stats.total}</strong></article>
        <article><span>Pendientes</span><strong>{stats.pending}</strong></article>
        <article><span>Completadas</span><strong>{stats.completed}</strong></article>
        <article><span>Aprobadas</span><strong>{stats.approved}</strong></article>
      </div>

      <div className="gmon-filters">
        {statuses.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeStatus === value ? "active" : ""}
            onClick={() => changeFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <div className="gmon-message">{message}</div>}

      <div className="gmon-grid">
        <section className="gmon-list">
          {loading ? (
            <div className="gmon-empty">Cargando solicitudes...</div>
          ) : requests.length === 0 ? (
            <div className="gmon-empty">No hay solicitudes en este filtro.</div>
          ) : (
            requests.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`gmon-card ${selected?.id === item.id ? "active" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <strong>{item.businessName}</strong>
                <span>{item.name} - {item.email}</span>
                <small>{statusLabels[item.status] || item.status} - {formatDate(item.createdAt)}</small>
              </button>
            ))
          )}
        </section>

        <section className="gmon-detail">
          {!selected ? (
            <div className="gmon-empty">Selecciona una solicitud.</div>
          ) : (
            <>
              <div className="gmon-detailHead">
                <div>
                  <span>{statusLabels[selected.status] || selected.status}</span>
                  <h3>{selected.businessName}</h3>
                  <p>{selected.message || "Sin mensaje inicial."}</p>
                </div>
                <a href={selected.formalUrl} target="_blank" rel="noreferrer">
                  Abrir formulario
                </a>
              </div>

              <div className="gmon-summary">
                <div><span>Contacto</span><strong>{selected.name}</strong><small>{selected.email}</small></div>
                <div><span>Telefono</span><strong>{selected.phone || "-"}</strong><small>{selected.emailStatus}</small></div>
                <div><span>Creada</span><strong>{formatDate(selected.createdAt)}</strong><small>Email: {formatDate(selected.emailSentAt)}</small></div>
                <div><span>Formal</span><strong>{formatDate(selected.submittedAt)}</strong><small>Revision: {formatDate(selected.reviewedAt)}</small></div>
              </div>

              <form className="gmon-review" onSubmit={updateStatus}>
                <label>
                  <span>Estado</span>
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                    {reviewStatuses.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Nota interna</span>
                  <textarea rows="3" value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} />
                </label>
                <button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar revision"}
                </button>
              </form>

              <div className="gmon-data">
                <h4>Solicitud formal</h4>
                {selected.formalData ? (
                  <div className="gmon-dataGrid">
                    {fieldLabels.map(([key, label]) => (
                      <div key={key} className={key === "notes" ? "gmon-wide" : ""}>
                        <span>{label}</span>
                        <strong>{formalData[key] || "-"}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="gmon-empty gmon-empty--compact">
                    El formulario formal aun no ha sido completado.
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
