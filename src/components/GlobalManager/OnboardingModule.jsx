import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const statuses = [
  ["ALL", "Todas"],
  ["RECEIVED", "Solicitud recibida"],
  ["EMAIL_SENT", "Fase 2 enviada"],
  ["FORM_COMPLETED", "Datos recibidos"],
  ["IN_REVIEW", "Revision interna"],
  ["NEEDS_INFO", "Falta info"],
  ["APPROVED", "Aprobada"],
  ["REJECTED", "Rechazada"],
];

const reviewStatuses = statuses.filter(([value]) => value !== "ALL");

const phaseMeta = {
  RECEIVED: {
    step: "Fase 1",
    title: "Solicitud recibida",
    description: "Lead creado. Falta enviar o confirmar el correo de fase 2.",
    next: "Revisar email y reenviar enlace si hace falta.",
  },
  EMAIL_SENT: {
    step: "Fase 2",
    title: "Formulario enviado",
    description: "El partner ya tiene el enlace para subir datos y documentos.",
    next: "Esperar datos fiscales, negocio, IBAN y documentos.",
  },
  FORM_COMPLETED: {
    step: "Fase 3",
    title: "Datos recibidos",
    description: "El partner completo el formulario. Hay que revisar la informacion.",
    next: "Validar documentos y preparar revision interna.",
  },
  IN_REVIEW: {
    step: "Fase 3",
    title: "Revision interna",
    description: "Datos y documentos recibidos. Volta revisa si puede generar contrato.",
    next: "Validar datos para contrato o pedir informacion adicional.",
  },
  NEEDS_INFO: {
    step: "Accion requerida",
    title: "Falta informacion",
    description: "La solicitud necesita correccion o documentos adicionales.",
    next: "Contactar al partner con lo que falta.",
  },
  APPROVED: {
    step: "Lista",
    title: "Aprobada",
    description: "Solicitud validada para continuar con contrato o activacion.",
    next: "Generar contrato o activar partner segun el proceso.",
  },
  REJECTED: {
    step: "Cerrada",
    title: "Rechazada",
    description: "La solicitud no continua en el proceso.",
    next: "Mantener nota interna clara con el motivo.",
  },
};

const getPhase = (status) =>
  phaseMeta[status] || {
    step: "Onboarding",
    title: status || "Sin estado",
    description: "Estado de onboarding sin descripcion operativa.",
    next: "Revisar internamente.",
  };

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const fieldLabels = [
  ["partnerType", "Tipo de titular"],
  ["legalName", "Razon social"],
  ["taxId", "CIF / NIF / VAT"],
  ["legalRepresentative", "Responsable legal"],
  ["representativeId", "Documento responsable"],
  ["representativeRole", "Cargo"],
  ["fiscalAddress", "Direccion fiscal"],
  ["commercialName", "Nombre comercial"],
  ["businessAddress", "Direccion local"],
  ["city", "Ciudad"],
  ["postalCode", "Codigo postal"],
  ["country", "Pais"],
  ["businessPhone", "Telefono comercial"],
  ["businessEmail", "Email comercial"],
  ["accountHolder", "Titular cuenta"],
  ["iban", "IBAN"],
  ["operationMode", "Modelo operativo"],
];

const documentTypeLabels = {
  IDENTITY: "Identidad responsable",
  FISCAL: "Fiscal / societario",
  BANK: "Titularidad bancaria",
  REPRESENTATION: "Representacion",
  HEALTH: "Licencia sanitaria",
  OTHER: "Documento",
};

const notificationLabels = {
  SENT: "Email enviado",
  NOT_CONFIGURED: "Email no configurado",
  FAILED: "Email fallido",
};

const formalValueLabels = {
  AUTONOMO: "Autonomo",
  SOCIEDAD: "Sociedad",
  PARTNER_DELIVERY: "Reparto gestionado por el partner",
};

const formatFormalValue = (value) => formalValueLabels[value] || value || "-";

export default function OnboardingModule() {
  const [requests, setRequests] = useState([]);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);
  const [statusDraft, setStatusDraft] = useState("IN_REVIEW");
  const [reviewerNote, setReviewerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => requests.find((item) => item.id === selectedId) || requests[0] || null,
    [requests, selectedId]
  );

  const stats = useMemo(() => {
    const base = {
      total: requests.length,
      awaitingPartner: 0,
      inReview: 0,
      needsInfo: 0,
      approved: 0,
    };

    requests.forEach((item) => {
      if (["RECEIVED", "EMAIL_SENT"].includes(item.status)) base.awaitingPartner += 1;
      if (["FORM_COMPLETED", "IN_REVIEW"].includes(item.status)) base.inReview += 1;
      if (item.status === "NEEDS_INFO") base.needsInfo += 1;
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

  const selectRequest = (id) => {
    setSelectedId(id);
  };

  const handleCardKeyDown = (id) => (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectRequest(id);
  };

  const deleteRequest = async (event, item) => {
    event.stopPropagation();

    const confirmed = window.confirm(
      `Eliminar la solicitud de ${item.businessName}? Esta accion no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      setMessage("");
      await api.delete(`/api/onboarding/requests/${item.id}`);

      setRequests((current) => {
        const nextRequests = current.filter((request) => request.id !== item.id);
        setSelectedId((currentSelectedId) =>
          currentSelectedId === item.id ? nextRequests[0]?.id || null : currentSelectedId
        );
        return nextRequests;
      });
      setMessage("Solicitud eliminada.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo eliminar la solicitud.");
    } finally {
      setDeletingId(null);
    }
  };

  const startContractEmission = () => {
    if (!selected?.formalData) {
      setMessage("Primero el partner debe completar la fase 2 con datos y documentos.");
      return;
    }

    setMessage("Emision de contrato preparada. Falta definir el contenido del segundo correo antes de enviarlo.");
  };

  const formalData = selected?.formalData || {};
  const supportingDocuments = Array.isArray(formalData.supportingDocuments)
    ? formalData.supportingDocuments
    : [];
  const reviewNotification = formalData.reviewNotification || null;
  const selectedPhase = getPhase(selected?.status);

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
        <article><span>Esperando partner</span><strong>{stats.awaitingPartner}</strong></article>
        <article><span>En revision</span><strong>{stats.inReview}</strong></article>
        <article><span>Falta info</span><strong>{stats.needsInfo}</strong></article>
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
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={`gmon-card ${selected?.id === item.id ? "active" : ""}`}
                onClick={() => selectRequest(item.id)}
                onKeyDown={handleCardKeyDown(item.id)}
              >
                <div className="gmon-cardText">
                  <strong>{item.businessName}</strong>
                  <span>{item.name} - {item.email}</span>
                  <small>{getPhase(item.status).step} - {getPhase(item.status).title} - {formatDate(item.createdAt)}</small>
                </div>
                <button
                  type="button"
                  className="gmon-deleteRequest"
                  aria-label={`Eliminar solicitud de ${item.businessName}`}
                  title="Eliminar solicitud"
                  disabled={deletingId === item.id}
                  onClick={(event) => deleteRequest(event, item)}
                >
                  X
                </button>
              </div>
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
                  <span>{selectedPhase.step}</span>
                  <h3>{selected.businessName}</h3>
                  <p>{selectedPhase.description}</p>
                </div>
                <a href={selected.formalUrl} target="_blank" rel="noreferrer">
                  Abrir fase 2
                </a>
              </div>

              <div className="gmon-contractActions">
                <div>
                  <span>Contrato</span>
                  <strong>Emision manual despues de verificar fase 2</strong>
                  <small>Este boton enviara el contrato cuando definamos el correo y la plantilla final.</small>
                </div>
                <button type="button" disabled={!selected.formalData} onClick={startContractEmission}>
                  Emitir contrato
                </button>
              </div>

              <div className="gmon-phaseBox">
                <div>
                  <span>Estado operativo</span>
                  <strong>{selectedPhase.title}</strong>
                </div>
                <p>{selectedPhase.next}</p>
              </div>

              <div className="gmon-summary">
                <div><span>Contacto</span><strong>{selected.name}</strong><small>{selected.email}</small></div>
                <div><span>Telefono</span><strong>{selected.phone || "-"}</strong><small>{notificationLabels[selected.emailStatus] || selected.emailStatus}</small></div>
                <div><span>Solicitud</span><strong>{formatDate(selected.createdAt)}</strong><small>Email fase 2: {formatDate(selected.emailSentAt)}</small></div>
                <div>
                  <span>Datos fase 2</span>
                  <strong>{formatDate(selected.submittedAt)}</strong>
                  <small>
                    Revision interna: {formatDate(selected.reviewedAt)}
                    {reviewNotification ? ` - ${notificationLabels[reviewNotification.emailStatus] || reviewNotification.emailStatus}` : ""}
                  </small>
                </div>
              </div>

              <form className="gmon-review" onSubmit={updateStatus}>
                <label>
                  <span>Cambiar fase</span>
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                    {reviewStatuses.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Nota interna para el equipo</span>
                  <textarea rows="3" value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} placeholder="Ej: falta certificado bancario, CIF ilegible o responsable no coincide." />
                </label>
                <button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar fase"}
                </button>
              </form>

              <div className="gmon-data">
                <h4>Datos para contrato y activacion</h4>
                {selected.formalData ? (
                  <div className="gmon-dataGrid">
                    {fieldLabels.map(([key, label]) => (
                      <div key={key} className={key === "notes" ? "gmon-wide" : ""}>
                        <span>{label}</span>
                        <strong>{formatFormalValue(formalData[key])}</strong>
                      </div>
                    ))}
                    <div className="gmon-wide">
                      <span>Documentacion</span>
                      {supportingDocuments.length ? (
                        <div className="gmon-docLinks">
                          {supportingDocuments.map((document) => (
                            <a
                              key={document.publicId || document.url || document.name}
                              href={document.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {documentTypeLabels[document.type] || document.label || "Documento"} - {document.name || "Archivo"}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <strong>-</strong>
                      )}
                    </div>
                    {reviewNotification && (
                      <div className="gmon-wide">
                        <span>Notificacion de revision</span>
                        <strong>{notificationLabels[reviewNotification.emailStatus] || reviewNotification.emailStatus}</strong>
                        {reviewNotification.emailError && <small>{reviewNotification.emailError}</small>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="gmon-empty gmon-empty--compact">
                    El partner aun no ha completado la fase 2. Cuando envie datos y documentos, apareceran aqui para preparar contrato.
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
