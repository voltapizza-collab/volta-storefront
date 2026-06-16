import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const statuses = [
  ["ALL", "Todas"],
  ["RECEIVED", "Solicitud recibida"],
  ["EMAIL_SENT", "Fase 2 enviada"],
  ["FORM_COMPLETED", "Datos recibidos"],
  ["IN_REVIEW", "Revision interna"],
  ["CONTRACT_SENT", "Contrato enviado"],
  ["ACTIVATED", "Activada"],
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
  CONTRACT_SENT: {
    step: "Fase 4",
    title: "Contrato enviado",
    description: "El contrato ya fue enviado al partner para revision y firma.",
    next: "Esperar aceptacion del contrato para activar credenciales.",
  },
  ACTIVATED: {
    step: "Activada",
    title: "Credenciales enviadas",
    description: "El contrato fue aceptado y se enviaron las credenciales iniciales de backoffice.",
    next: "Acompanar la configuracion inicial del partner.",
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

const formatContractDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const fieldLabels = [
  ["partnerType", "Tipo de titular"],
  ["legalName", "Razon social"],
  ["taxId", "CIF / NIF / NIE"],
  ["legalRepresentative", "Responsable legal"],
  ["representativeRole", "Cargo"],
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

const buildContractData = (selected, formalData) => {
  const commercialName = formalData.commercialName || selected?.businessName || "-";
  const legalName = formalData.legalName || commercialName;
  const contractDate = selected?.submittedAt || selected?.reviewedAt || selected?.createdAt;
  const address = [
    formalData.fiscalAddress || formalData.businessAddress,
    formalData.city,
    formalData.postalCode,
    formalData.country,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    contractDate: formatContractDate(contractDate),
    legalName: formatFormalValue(legalName),
    commercialName: formatFormalValue(commercialName),
    partnerType: formatFormalValue(formalData.partnerType),
    taxId: formatFormalValue(formalData.taxId),
    address: formatFormalValue(address),
    legalRepresentative: formatFormalValue(formalData.legalRepresentative),
    representativeRole: formatFormalValue(formalData.representativeRole),
    businessEmail: formatFormalValue(formalData.businessEmail || selected?.email),
    businessPhone: formatFormalValue(formalData.businessPhone || selected?.phone),
    accountHolder: formatFormalValue(formalData.accountHolder),
    iban: formatFormalValue(formalData.iban),
    operationMode: formatFormalValue(formalData.operationMode),
  };
};

export default function OnboardingModule() {
  const [requests, setRequests] = useState([]);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);
  const [statusDraft, setStatusDraft] = useState("IN_REVIEW");
  const [reviewerNote, setReviewerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingContract, setSendingContract] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [contractPreviewOpen, setContractPreviewOpen] = useState(false);

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
      if (["APPROVED", "ACTIVATED"].includes(item.status)) base.approved += 1;
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
    setContractPreviewOpen(false);
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

  const openContractPreview = () => {
    if (!selected?.formalData) {
      setMessage("Primero el partner debe completar la fase 2 con datos y documentos.");
      return;
    }

    setMessage("");
    setContractPreviewOpen(true);
  };

  const sendContract = async () => {
    if (!selected?.formalData || sendingContract) return;

    try {
      setSendingContract(true);
      setMessage("");
      const response = await api.post(`/api/onboarding/requests/${selected.id}/contract/send`);
      const updated = response.data?.request;
      setRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage("Contrato enviado al partner para firma.");
      setContractPreviewOpen(false);
    } catch (error) {
      console.error(error);
      const errorCode = error.response?.data?.error;
      setMessage(
        errorCode === "formal_data_required"
          ? "Primero el partner debe completar la fase 2."
          : "No se pudo enviar el contrato."
      );
    } finally {
      setSendingContract(false);
    }
  };

  const formalData = selected?.formalData || {};
  const supportingDocuments = Array.isArray(formalData.supportingDocuments)
    ? formalData.supportingDocuments
    : [];
  const reviewNotification = formalData.reviewNotification || null;
  const contractNotification = formalData.contractNotification || null;
  const credentialsNotification = formalData.credentialsNotification || null;
  const activation = formalData.activation || null;
  const selectedPhase = getPhase(selected?.status);
  const contract = buildContractData(selected, formalData);
  const canSendContract = Boolean(
    selected?.formalData &&
    !["ACTIVATED", "REJECTED"].includes(selected?.status)
  );

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
                  <strong>{selected.status === "ACTIVATED" ? "Contrato firmado y backoffice activado" : "Revision y envio a firma"}</strong>
                  <small>
                    {contractNotification?.emailStatus
                      ? `Correo 3: ${notificationLabels[contractNotification.emailStatus] || contractNotification.emailStatus}`
                      : "Abre el borrador con los datos recibidos. Si esta correcto, envia el correo 3 al partner."}
                  </small>
                </div>
                <button type="button" disabled={!selected.formalData} onClick={openContractPreview}>
                  Ver contrato
                </button>
                <button type="button" disabled={!canSendContract || sendingContract} onClick={sendContract}>
                  {sendingContract ? "Enviando..." : "Enviar contrato"}
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
                    {contractNotification && (
                      <div className="gmon-wide">
                        <span>Correo 3 contrato</span>
                        <strong>{notificationLabels[contractNotification.emailStatus] || contractNotification.emailStatus}</strong>
                        {contractNotification.contractUrl && (
                          <small>
                            <a href={contractNotification.contractUrl} target="_blank" rel="noreferrer">
                              Abrir enlace de firma
                            </a>
                          </small>
                        )}
                        {contractNotification.emailError && <small>{contractNotification.emailError}</small>}
                      </div>
                    )}
                    {activation && (
                      <div className="gmon-wide">
                        <span>Activacion backoffice</span>
                        <strong>{activation.partnerName} - {activation.partnerSlug}</strong>
                        <small>Usuario: {activation.username} - Contrasena: {activation.password}</small>
                      </div>
                    )}
                    {credentialsNotification && (
                      <div className="gmon-wide">
                        <span>Correo 4 credenciales</span>
                        <strong>{notificationLabels[credentialsNotification.emailStatus] || credentialsNotification.emailStatus}</strong>
                        {credentialsNotification.emailError && <small>{credentialsNotification.emailError}</small>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="gmon-empty gmon-empty--compact">
                    El partner aun no ha completado la fase 2. Cuando envie datos y documentos, apareceran aqui para preparar contrato.
                  </div>
                )}
              </div>

              {contractPreviewOpen && (
                <div className="gmon-contractOverlay" role="dialog" aria-modal="true" aria-labelledby="gmon-contract-title">
                  <div className="gmon-contractModal">
                    <div className="gmon-contractModalHead">
                      <div>
                        <span>Contrato electronico</span>
                        <h3 id="gmon-contract-title">{contract.commercialName}</h3>
                      </div>
                      <button type="button" onClick={() => setContractPreviewOpen(false)} aria-label="Cerrar contrato">
                        X
                      </button>
                    </div>

                    <div className="gmon-contractDoc">
                      <header>
                        <h2>CONTRATO DE ADHESION COMERCIAL</h2>
                      </header>

                      <section>
                        <p>
                          En fecha {contract.contractDate}, por medio de aceptacion y firma electronica, Volta Pizza
                          y el Comerciante identificado en este documento formalizan el presente contrato de adhesion
                          comercial, que se regira por las siguientes manifestaciones y clausulas.
                        </p>
                      </section>

                      <section>
                        <h4>REUNIDOS</h4>
                        <p>
                          De una parte, VOLTA PIZZA, SOCIEDAD LIMITADA, con domicilio social en CALLE IRMANS
                          VILLAR, 1, Piso 1, Puerta B, 32005, Ourense, Ourense, Galicia, Espana, representada en
                          este acto por Luigi Vincenzo Roppo Gonzalez, con NIE Z0329461Z, titular o gestora de la
                          plataforma comercial, tecnologica y operativa destinada a la promocion, recepcion, gestion
                          y seguimiento de pedidos de restauracion, en adelante, "Volta".
                        </p>
                        <p>
                          De otra parte, {contract.legalName}, {contract.partnerType}, con CIF/NIF/NIE {contract.taxId},
                          domicilio o local operativo en {contract.address}, telefono {contract.businessPhone} y correo
                          electronico {contract.businessEmail}, representada por {contract.legalRepresentative}, en
                          calidad de {contract.representativeRole}, en adelante, el "Comerciante".
                        </p>
                        <p>
                          Las partes se reconocen capacidad suficiente para contratar y obligarse. El Comerciante
                          declara que los datos anteriores son exactos, completos y han sido facilitados por el mismo
                          durante el proceso de alta.
                        </p>
                      </section>

                      <section>
                        <h4>EXPONEN</h4>
                        <p>
                          I. Que Volta dispone de una plataforma y de servicios asociados para incorporar negocios de
                          restauracion, organizar su presencia comercial, recibir pedidos y facilitar su gestion.
                        </p>
                        <p>
                          II. Que el Comerciante desarrolla una actividad de restauracion bajo el nombre comercial
                          {` ${contract.commercialName}`} y desea adherirse a las condiciones comerciales de Volta.
                        </p>
                        <p>
                          III. Que el presente documento contiene condiciones generales predispuestas por Volta para
                          una pluralidad de relaciones comerciales de la misma naturaleza, sin perjuicio de los datos
                          particulares del Comerciante y de los anexos economicos u operativos que se acepten.
                        </p>
                      </section>

                      <section>
                        <h4>CLAUSULAS</h4>
                        <h5>1. Naturaleza del contrato</h5>
                        <p>
                          Este contrato es un contrato de adhesion comercial. Su aceptacion por el Comerciante se
                          produce mediante firma electronica o por cualquier otro mecanismo de aceptacion electronica
                          habilitado por Volta que deje constancia de la identidad del firmante, fecha, documento aceptado
                          y trazabilidad de la operacion.
                        </p>
                      </section>

                      <section>
                        <h5>2. Definiciones</h5>
                        <ul>
                          <li>"Plataforma": el sitio web, aplicaciones, paneles, herramientas y canales operados por Volta para la gestion comercial y operativa.</li>
                          <li>"Comerciante": la persona fisica o juridica que se adhiere a este contrato y ofrece productos de restauracion a traves de Volta.</li>
                          <li>"Cliente": el usuario final que realiza pedidos o interactua con la oferta comercial del Comerciante.</li>
                          <li>"Pedido": solicitud de productos realizada por un Cliente y recibida por el Comerciante a traves de la Plataforma.</li>
                          <li>"Comision": importe, porcentaje, tarifa fija, coste tecnico, coste de pasarela o cargo pactado a favor de Volta por el uso de la Plataforma o servicios asociados.</li>
                          <li>"Liquidacion": calculo periodico de importes a favor del Comerciante, una vez descontadas comisiones, ajustes, devoluciones, incidencias, impuestos o costes aplicables.</li>
                        </ul>
                      </section>

                      <section>
                        <h5>3. Objeto</h5>
                        <p>
                          El objeto del contrato es regular la adhesion del Comerciante a Volta para la publicacion,
                          promocion, recepcion y gestion de pedidos de su negocio, asi como el uso de las herramientas
                          y procesos que Volta habilite para dicha relacion comercial.
                        </p>
                      </section>

                      <section>
                        <h5>4. Alta, datos y documentacion</h5>
                        <p>
                          El Comerciante se obliga a facilitar datos reales, completos y actualizados. Volta podra
                          solicitar documentacion de identidad, titularidad, representacion, actividad, cuenta bancaria
                          o cualquier otra razonablemente necesaria para validar el alta, prevenir fraude, cumplir
                          obligaciones legales o proteger la Plataforma.
                        </p>
                      </section>

                      <section>
                        <h5>5. Modelo operativo</h5>
                        <p>
                          El modelo operativo de Volta consiste en poner a disposicion del Comerciante una plataforma
                          de ventas, gestion comercial, comunicacion con clientes, creacion de ofertas, segmentacion
                          de clientes, gestion de precios, seguimiento de pedidos, acciones promocionales y herramientas
                          de administracion asociadas a su actividad de restauracion.
                        </p>
                        <p>
                          El Comerciante conserva la direccion de su negocio, la definicion final de su oferta, la
                          preparacion de los productos, la atencion de incidencias propias de su actividad y el
                          cumplimiento de las obligaciones legales, fiscales, sanitarias y laborales que le correspondan.
                        </p>
                      </section>

                      <section>
                        <h5>6. Comisiones y liquidaciones</h5>
                        <p>
                          Salvo pacto escrito distinto, el importe neto de ventas computable para liquidacion se distribuira
                          de la siguiente manera: noventa por ciento (90%) para el Comerciante, nueve por ciento (9%)
                          para Volta y uno por ciento (1%) para el embajador asociado a la pizzeria, cuando exista.
                        </p>
                        <p>
                          Esta distribucion no incluye otros cargos, consumos, descuentos, costes o servicios adicionales
                          que puedan generarse por el uso de herramientas o prestaciones complementarias, incluyendo,
                          a titulo enunciativo, descuentos aplicados desde el POS, hardware o dispositivos utilizados,
                          paquetes de mensajes, acciones Boost, promociones, servicios adicionales, ajustes, devoluciones,
                          incidencias, costes de pasarela o cualquier otro concepto aceptado o generado dentro de la
                          operativa de la Plataforma.
                        </p>
                        <p>
                          La cuenta declarada para liquidaciones es titularidad de {contract.accountHolder}, IBAN
                          {` ${contract.iban}`}. El Comerciante responde de la exactitud de estos datos y debera comunicar
                          cualquier modificacion antes de que produzca efectos.
                        </p>
                      </section>

                      <section>
                        <h5>7. Obligaciones del Comerciante</h5>
                        <p>
                          El Comerciante debera preparar los pedidos aceptados, mantener actualizada su oferta, precios,
                          horarios, disponibilidad, informacion alimentaria y alergenos, atender incidencias, cumplir la
                          normativa sanitaria, fiscal, laboral, de consumo y proteccion de datos que le resulte aplicable,
                          y no utilizar la Plataforma para fines distintos de los autorizados.
                        </p>
                      </section>

                      <section>
                        <h5>8. Obligaciones de Volta</h5>
                        <p>
                          Volta pondra a disposicion del Comerciante los medios tecnicos y comerciales razonables para
                          la gestion de su presencia en la Plataforma, sin garantizar volumen minimo de pedidos,
                          facturacion, posicionamiento, continuidad absoluta del servicio ni resultados economicos.
                        </p>
                      </section>

                      <section>
                        <h5>9. Suspension y resolucion</h5>
                        <p>
                          Volta podra suspender el alta, la publicacion, la recepcion de pedidos o las liquidaciones cuando
                          existan datos incompletos, documentacion no validada, riesgo de fraude, incumplimiento legal,
                          incidencias graves, impagos, reclamaciones relevantes o riesgo para clientes, repartidores,
                          terceros o para la Plataforma. Cualquiera de las partes podra resolver el contrato mediante
                          comunicacion escrita con treinta dias naturales de preaviso, sin perjuicio de las cantidades
                          devengadas y obligaciones pendientes.
                        </p>
                      </section>

                      <section>
                        <h5>10. Comunicaciones</h5>
                        <p>
                          Las comunicaciones contractuales y operativas se remitiran preferentemente por medios
                          electronicos. A efectos de notificaciones al Comerciante se designa el correo
                          {` ${contract.businessEmail}`}. El Comerciante debera mantenerlo operativo y actualizado.
                        </p>
                      </section>

                      <section>
                        <h5>11. Duracion</h5>
                        <p>
                          El contrato entrara en vigor desde su aceptacion electronica y tendra duracion indefinida,
                          salvo resolucion conforme a la clausula anterior o sustitucion por una nueva version aceptada
                          por el Comerciante.
                        </p>
                      </section>

                      <section>
                        <h5>12. Ley aplicable y fuero</h5>
                        <p>
                          El contrato se regira por la legislacion espanola. Las partes se someten a los juzgados y
                          tribunales de Madrid, salvo que una norma imperativa establezca otro fuero.
                        </p>
                      </section>

                      <section>
                        <h5>13. Firma electronica</h5>
                        <p>
                          La firma electronica, aceptacion por codigo, trazabilidad de envio, registro de IP, sello temporal
                          o cualquier mecanismo equivalente habilitado por Volta servira para acreditar la aceptacion del
                          documento por el Comerciante. Cada ejemplar electronico aceptado o firmado tendra valor de
                          original entre las partes.
                        </p>
                        <div className="gmon-signatureGrid">
                          <div>
                            <span>VOLTA</span>
                            <strong>Volta Pizza</strong>
                            <small>Firma electronica pendiente</small>
                          </div>
                          <div>
                            <span>COMERCIANTE</span>
                            <strong>{contract.legalName}</strong>
                            <small>{contract.legalRepresentative} - {contract.representativeRole}</small>
                            <small>{contract.businessEmail}</small>
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="gmon-contractModalActions">
                      <button type="button" onClick={() => setContractPreviewOpen(false)}>
                        Cerrar
                      </button>
                      <button
                        type="button"
                        disabled={!canSendContract || sendingContract}
                        onClick={sendContract}
                      >
                        {sendingContract ? "Enviando..." : "Enviar contrato al partner"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
