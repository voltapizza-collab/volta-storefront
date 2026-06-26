import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../setupAxios";
import voltaSignature from "../assets/signatures/volta-signature.png";
import "../styles/OnboardingForm.css";

const initialForm = {
  partnerType: "",
  legalName: "",
  taxId: "",
  legalRepresentative: "",
  representativeId: "",
  representativeRole: "",
  fiscalAddress: "",
  commercialName: "",
  businessAddress: "",
  city: "",
  postalCode: "",
  country: "Espana",
  businessPhone: "",
  businessEmail: "",
  accountHolder: "",
  iban: "",
  website: "",
  numberOfStores: "",
  monthlyOrdersEstimate: "",
  currentPlatforms: "",
  notes: "",
  acceptedTerms: false,
  acceptedCompliance: false,
};

const statusCopy = {
  RECEIVED: "Solicitud recibida",
  EMAIL_SENT: "Fase 2 pendiente",
  FORM_COMPLETED: "Formulario completado",
  IN_REVIEW: "En revision",
  CONTRACT_SENT: "Contrato pendiente de firma",
  ACTIVATED: "Backoffice activado",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  NEEDS_INFO: "Falta informacion",
};

const documentFields = [
  {
    key: "IDENTITY",
    title: "Identidad del responsable",
    description: "DNI, NIE o pasaporte de la persona que firma.",
    required: true,
  },
  {
    key: "FISCAL",
    title: "Documento fiscal o societario",
    description: "Modelo 036/037, certificado censal, escritura o documento de sociedad.",
    required: true,
  },
];

const requiredFieldLabels = {
  partnerType: "Tipo de titular",
  legalName: "Razon social o nombre fiscal",
  taxId: "CIF / NIF / NIE",
  businessEmail: "Email comercial",
  legalRepresentative: "Responsable legal",
  representativeRole: "Cargo",
  commercialName: "Nombre comercial",
  businessAddress: "Direccion del local",
  city: "Ciudad",
  postalCode: "Codigo postal",
  country: "Pais",
  businessPhone: "Telefono comercial",
  accountHolder: "Titular de la cuenta",
  iban: "IBAN",
  acceptedTerms: "Declaracion de informacion real",
  acceptedCompliance: "Autorizacion de revision",
  "document:IDENTITY": "Identidad del responsable",
  "document:FISCAL": "Documento fiscal o societario",
};

const formalValueLabels = {
  AUTONOMO: "Autonomo",
  SOCIEDAD: "Sociedad",
  PARTNER_DELIVERY: "Reparto gestionado por el partner",
};

const formatFormalValue = (value) => formalValueLabels[value] || value || "-";

const buildContractPdfTitle = (contract) => {
  const base = String(contract?.commercialName || contract?.legalName || "contrato-volta")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `contrato-volta-${base || "partner"}`;
};

const downloadContractPdf = (contract) => {
  const previousTitle = document.title;
  document.title = buildContractPdfTitle(contract);
  window.print();
  window.setTimeout(() => {
    document.title = previousTitle;
  }, 800);
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const cleanIban = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();

const isLikelyIban = (value) => /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleanIban(value));

const buildInvalidFormalFields = (form, documents, existingDocumentsByType) => {
  const invalid = {};
  const requireText = (field) => {
    if (!String(form[field] || "").trim()) invalid[field] = true;
  };

  [
    "partnerType",
    "legalName",
    "taxId",
    "legalRepresentative",
    "representativeRole",
    "commercialName",
    "businessAddress",
    "city",
    "postalCode",
    "country",
    "businessPhone",
    "accountHolder",
  ].forEach(requireText);

  if (!isEmail(form.businessEmail)) invalid.businessEmail = true;
  if (!isLikelyIban(form.iban)) invalid.iban = true;

  documentFields.forEach((field) => {
    if (!field.required) return;
    const existingForType = existingDocumentsByType[field.key] || [];
    const selectedForType = documents[field.key] || [];
    if (!existingForType.length && !selectedForType.length) {
      invalid[`document:${field.key}`] = true;
    }
  });

  if (!form.acceptedTerms) invalid.acceptedTerms = true;
  if (!form.acceptedCompliance) invalid.acceptedCompliance = true;

  return invalid;
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

const formatSignatureDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildContractData = (request) => {
  const formalData = request?.formalData || {};
  const commercialName = formalData.commercialName || request?.businessName || "-";
  const legalName = formalData.legalName || commercialName;
  const contractDate = request?.submittedAt || request?.reviewedAt || request?.createdAt;
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
    businessEmail: formatFormalValue(formalData.businessEmail || request?.email),
    businessPhone: formatFormalValue(formalData.businessPhone || request?.phone),
    accountHolder: formatFormalValue(formalData.accountHolder),
    iban: formatFormalValue(formalData.iban),
    operationMode: formatFormalValue(formalData.operationMode),
  };
};

function ContractDocument({ contract, request }) {
  const activation = request?.formalData?.activation || null;
  const signature = request?.formalData?.contractSignature || null;
  const isSigned = request?.status === "ACTIVATED" && signature?.acceptedAt;

  return (
    <article className="onb-contractDoc">
      <header>
        <h2>CONTRATO DE ADHESION COMERCIAL</h2>
        {isSigned && <strong>Documento firmado electronicamente</strong>}
      </header>

      <section>
        <p>
          En fecha {contract.contractDate}, por medio de aceptacion y firma electronica,
          Volta Pizza y el Comerciante identificado en este documento formalizan el
          presente contrato de adhesion comercial, que se regira por las siguientes
          manifestaciones y clausulas.
        </p>
      </section>

      <section>
        <h4>REUNIDOS</h4>
        <p>
          De una parte, VOLTA PIZZA, S.L.U., con NIF B88818414 y domicilio social en CALLE
          IRMANS VILLAR, NUM 1, PLANTA 1, PUERTA B, 32005 OURENSE (OURENSE), Espana,
          representada en este acto por Luigi Vincenzo Roppo Gonzalez, con NIE Z0329461Z,
          titular o gestora de la plataforma comercial, tecnologica y operativa destinada a
          la promocion, recepcion, gestion y seguimiento de pedidos de restauracion, en
          adelante, "Volta".
        </p>
        <p>
          De otra parte, {contract.legalName}, {contract.partnerType}, con
          CIF/NIF/NIE {contract.taxId}, domicilio o local operativo en {contract.address},
          telefono {contract.businessPhone} y correo electronico {contract.businessEmail},
          representada por {contract.legalRepresentative}, en calidad de
          {` ${contract.representativeRole}`}, en adelante, el "Comerciante".
        </p>
        <p>
          Las partes se reconocen capacidad suficiente para contratar y obligarse. El
          Comerciante declara que los datos anteriores son exactos, completos y han sido
          facilitados por el mismo durante el proceso de alta.
        </p>
      </section>

      <section>
        <h4>EXPONEN</h4>
        <p>
          I. Que Volta dispone de una plataforma y de servicios asociados para incorporar
          negocios de restauracion, organizar su presencia comercial, recibir pedidos y
          facilitar su gestion.
        </p>
        <p>
          II. Que el Comerciante desarrolla una actividad de restauracion bajo el nombre
          comercial {contract.commercialName} y desea adherirse a las condiciones comerciales
          de Volta.
        </p>
        <p>
          III. Que el presente documento contiene condiciones generales predispuestas por
          Volta para una pluralidad de relaciones comerciales de la misma naturaleza, sin
          perjuicio de los datos particulares del Comerciante y de los anexos economicos u
          operativos que se acepten.
        </p>
      </section>

      <section>
        <h4>CLAUSULAS</h4>
        <h5>1. Naturaleza del contrato</h5>
        <p>
          Este contrato es un contrato de adhesion comercial. Su aceptacion por el Comerciante
          se produce mediante firma electronica o por cualquier otro mecanismo de aceptacion
          electronica habilitado por Volta que deje constancia de la identidad del firmante,
          fecha, documento aceptado y trazabilidad de la operacion.
        </p>
      </section>

      <section>
        <h5>2. Definiciones</h5>
        <ul>
          <li>"Plataforma": el sitio web, aplicaciones, paneles, herramientas y canales operados por Volta para la gestion comercial y operativa.</li>
          <li>"Ruta de Acceso StoreGate": enlace, URL, boton, codigo QR o punto de entrada digital que Volta entregue o habilite para que los Clientes accedan al motor de ventas del Comerciante dentro de la Plataforma.</li>
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
          El contrato regula la adhesion del Comerciante a Volta para la publicacion,
          promocion, recepcion y gestion de pedidos de su negocio, asi como el uso de las
          herramientas y procesos que Volta habilite para dicha relacion comercial.
        </p>
      </section>

      <section>
        <h5>4. Alta, datos y documentacion</h5>
        <p>
          El Comerciante se obliga a facilitar datos reales, completos y actualizados. Volta
          podra solicitar documentacion de identidad, titularidad, representacion, actividad,
          cuenta bancaria o cualquier otra razonablemente necesaria para validar el alta,
          prevenir fraude, cumplir obligaciones legales o proteger la Plataforma.
        </p>
      </section>

      <section>
        <h5>5. Modelo operativo</h5>
        <p>
          El modelo operativo de Volta consiste en poner a disposicion del Comerciante una
          plataforma de ventas, gestion comercial, comunicacion con clientes, creacion de
          ofertas, segmentacion de clientes, gestion de precios, seguimiento de pedidos,
          acciones promocionales y herramientas de administracion asociadas a su actividad
          de restauracion.
        </p>
        <p>
          Cuando Volta entregue o habilite una Ruta de Acceso StoreGate, dicha entrega
          consistira en facilitar al Comerciante un acceso operativo al motor de ventas
          dentro de la Plataforma. Salvo pacto escrito especifico, esta entrega no implica
          que Volta deba integrar, instalar, insertar o conectar botones, enlaces, iframes,
          scripts u otros elementos en paginas web, redes sociales, aplicaciones, perfiles,
          marketplaces o canales digitales del Comerciante o de terceros.
        </p>
        <p>
          El Comerciante conserva la direccion de su negocio, la definicion final de su
          oferta, la preparacion de los productos, la atencion de incidencias propias de su
          actividad y el cumplimiento de las obligaciones legales, fiscales, sanitarias y
          laborales que le correspondan.
        </p>
      </section>

      <section>
        <h5>6. Comisiones y liquidaciones</h5>
        <p>
          Salvo pacto escrito distinto, el importe neto de ventas computable para liquidacion
          se distribuira de la siguiente manera: noventa por ciento (90%) para el Comerciante,
          nueve por ciento (9%) para Volta y uno por ciento (1%) para el embajador asociado a
          la pizzeria, cuando exista.
        </p>
        <p>
          Esta distribucion no incluye otros cargos, consumos, descuentos, costes o servicios
          adicionales que puedan generarse por el uso de herramientas o prestaciones
          complementarias, incluyendo, a titulo enunciativo, hardware o dispositivos
          utilizados, paquetes de mensajes, acciones Boost, promociones, servicios
          adicionales, ajustes, devoluciones, incidencias, costes de pasarela o cualquier
          otro concepto aceptado o generado dentro de la operativa de la Plataforma.
        </p>
        <p>
          La cuenta declarada para liquidaciones es titularidad de {contract.accountHolder},
          IBAN {contract.iban}. El Comerciante responde de la exactitud de estos datos y
          debera comunicar cualquier modificacion antes de que produzca efectos.
        </p>
      </section>

      <section>
        <h5>7. Obligaciones del Comerciante</h5>
        <p>
          El Comerciante debera preparar los pedidos aceptados, mantener actualizada su
          oferta, precios, horarios, disponibilidad, informacion alimentaria y alergenos,
          atender incidencias, cumplir la normativa sanitaria, fiscal, laboral, de consumo y
          proteccion de datos que le resulte aplicable, y no utilizar la Plataforma para fines
          distintos de los autorizados.
        </p>
        <p>
          El Comerciante sera responsable de difundir, publicar y mantener visible la Ruta
          de Acceso StoreGate en sus canales propios o autorizados, incluyendo su pagina
          web, redes sociales, perfiles digitales, codigos QR, materiales comerciales o
          comunicaciones con clientes, cuando desee dirigir trafico al motor de ventas
          habilitado por Volta. La falta de difusion por parte del Comerciante no
          constituira incumplimiento de Volta ni generara derecho a reclamar volumen
          minimo de pedidos o resultados economicos.
        </p>
      </section>

      <section>
        <h5>8. Obligaciones de Volta</h5>
        <p>
          Volta pondra a disposicion del Comerciante los medios tecnicos y comerciales
          razonables para la gestion de su presencia en la Plataforma, sin garantizar volumen
          minimo de pedidos, facturacion, posicionamiento, continuidad absoluta del servicio
          ni resultados economicos.
        </p>
        <p>
          Respecto de la Ruta de Acceso StoreGate, la obligacion de Volta se limitara a
          habilitar o comunicar al Comerciante una ruta funcional de acceso a la Plataforma,
          salvo que las partes acuerden expresamente por escrito servicios adicionales de
          integracion, desarrollo, publicacion, marketing o gestion de canales externos.
        </p>
      </section>

      <section>
        <h5>9. Suspension y resolucion</h5>
        <p>
          Volta podra suspender el alta, la publicacion, la recepcion de pedidos o las
          liquidaciones cuando existan datos incompletos, documentacion no validada, riesgo de
          fraude, incumplimiento legal, incidencias graves, impagos, reclamaciones relevantes
          o riesgo para clientes, repartidores, terceros o para la Plataforma. Cualquiera de
          las partes podra resolver el contrato mediante comunicacion escrita con treinta dias
          naturales de preaviso, sin perjuicio de las cantidades devengadas y obligaciones
          pendientes.
        </p>
      </section>

      <section>
        <h5>10. Comunicaciones</h5>
        <p>
          Las comunicaciones contractuales y operativas se remitiran preferentemente por medios
          electronicos. A efectos de notificaciones al Comerciante se designan el correo
          {` ${contract.businessEmail}`} y el telefono {contract.businessPhone} como
          elementos de contacto. El Comerciante se compromete a mantenerlos activos,
          operativos y actualizados.
        </p>
      </section>

      <section>
        <h5>11. Duracion</h5>
        <p>
          El contrato entrara en vigor desde su aceptacion electronica y tendra duracion
          indefinida, salvo resolucion conforme a la clausula anterior o sustitucion por una
          nueva version aceptada por el Comerciante.
        </p>
      </section>

      <section>
        <h5>12. Ley aplicable y fuero</h5>
        <p>
          El contrato se regira por la legislacion espanola. Las partes se someten a los
          juzgados y tribunales de Madrid, salvo que una norma imperativa establezca otro
          fuero.
        </p>
      </section>

      <section>
        <h5>13. Firma electronica</h5>
        <p>
          La firma electronica, aceptacion por codigo, trazabilidad de envio, registro de IP,
          sello temporal o cualquier mecanismo equivalente habilitado por Volta servira para
          acreditar la aceptacion del documento por el Comerciante. Cada ejemplar electronico
          aceptado o firmado tendra valor de original entre las partes.
        </p>
      </section>

      <section className="onb-signatureGrid">
        <div>
          <span>VOLTA</span>
          <img className="onb-voltaSignature" src={voltaSignature} alt="Firma de Volta Pizza" />
          <strong>Volta Pizza</strong>
          <small>Luigi Vincenzo Roppo Gonzalez</small>
          <small>Firma incorporada por Volta</small>
        </div>
        <div>
          <span>COMERCIANTE</span>
          <strong>{contract.legalName}</strong>
          <small>{contract.legalRepresentative} - {contract.representativeRole}</small>
          <small>{contract.businessEmail}</small>
          {isSigned && <small>Firmado: {formatSignatureDate(signature.acceptedAt)}</small>}
        </div>
      </section>

      {isSigned && (
        <section className="onb-signedSeal">
          <span>Sello de firma electronica</span>
          <strong>Contrato aceptado y firmado electronicamente</strong>
          <small>Fecha de firma: {formatSignatureDate(signature.acceptedAt)}</small>
          {signature.acceptedFrom && <small>Origen: {signature.acceptedFrom}</small>}
        </section>
      )}

      {activation && (
        <div className="onb-activationBox">
          <span>Backoffice activado</span>
          <strong>{activation.partnerName}</strong>
          <small>Usuario: {activation.username} - Contrasena: {activation.password}</small>
        </div>
      )}
    </article>
  );
}

export default function OnboardingFormPage() {
  const { token } = useParams();
  const fieldRefs = useRef({});
  const [request, setRequest] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingContract, setSigningContract] = useState(false);
  const [acceptedContract, setAcceptedContract] = useState(false);
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState({});
  const [invalidFields, setInvalidFields] = useState({});

  const isLocked = useMemo(
    () => ["IN_REVIEW", "CONTRACT_SENT", "ACTIVATED", "APPROVED", "REJECTED"].includes(request?.status),
    [request?.status]
  );

  const shouldShowContract = useMemo(() => {
    if (!request?.formalData) return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("contract") === "1" ||
      ["CONTRACT_SENT", "ACTIVATED"].includes(request.status)
    );
  }, [request]);

  const canSignContract = request?.status === "CONTRACT_SENT";

  const existingDocuments = useMemo(
    () => request?.formalData?.supportingDocuments || [],
    [request?.formalData?.supportingDocuments]
  );

  const existingDocumentsByType = useMemo(
    () =>
      existingDocuments.reduce((grouped, document) => {
        const key = document?.type || "OTHER";
        grouped[key] = [...(grouped[key] || []), document];
        return grouped;
      }, {}),
    [existingDocuments]
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setMessage("");
        const response = await api.get(`/api/onboarding/form/${token}`);
        const nextRequest = response.data?.request;
        setRequest(nextRequest);
        setForm({
          ...initialForm,
          businessEmail: nextRequest?.email || "",
          businessPhone: nextRequest?.phone || "",
          ...(nextRequest?.formalData || {}),
        });
        setDocuments({});
      } catch (error) {
        console.error(error);
        setMessage("No pudimos abrir esta solicitud de onboarding.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const updateField = (field) => (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setInvalidFields((current) => {
      if (!current[field]) return current;
      const { [field]: _removed, ...next } = current;
      return next;
    });
    setMessage("");
  };

  const updateDocuments = (documentType) => (event) => {
    setDocuments((current) => ({
      ...current,
      [documentType]: Array.from(event.target.files || []),
    }));
    setInvalidFields((current) => {
      const field = `document:${documentType}`;
      if (!current[field]) return current;
      const { [field]: _removed, ...next } = current;
      return next;
    });
    setMessage("");
  };

  const fieldProps = (field) => ({
    ref: (node) => {
      if (node) fieldRefs.current[field] = node;
    },
    "aria-invalid": Boolean(invalidFields[field]),
  });

  const fieldClassName = (field, extraClass = "") =>
    [extraClass, invalidFields[field] ? "is-invalidField" : ""]
      .filter(Boolean)
      .join(" ");

  const showInvalidFields = (nextInvalid) => {
    setInvalidFields({});
    window.requestAnimationFrame(() => {
      setInvalidFields(nextInvalid);
      const firstInvalidField = Object.keys(nextInvalid)[0];
      const firstInvalidNode = fieldRefs.current[firstInvalidField];
      firstInvalidNode?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      firstInvalidNode?.focus?.({ preventScroll: true });
    });
  };

  const submit = async (event) => {
    event.preventDefault();

    const nextInvalid = buildInvalidFormalFields(form, documents, existingDocumentsByType);
    const invalidKeys = Object.keys(nextInvalid);

    if (invalidKeys.length) {
      showInvalidFields(nextInvalid);
      const firstLabel = requiredFieldLabels[invalidKeys[0]] || "un campo obligatorio";
      setMessage(`Revisa ${firstLabel}. Hay datos obligatorios pendientes o con formato invalido.`);
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, value == null ? "" : String(value));
      });
      documentFields.forEach(({ key }) => {
        (documents[key] || []).forEach((file) => {
          payload.append("documents", file);
          payload.append("documentTypes", key);
        });
      });

      const response = await api.post(`/api/onboarding/form/${token}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRequest(response.data?.request);
      setDocuments({});
      setMessage("Informacion recibida. Tu onboarding ya esta en proceso de revision.");
    } catch (error) {
      console.error(error);
      const missing = error.response?.data?.missing;
      const errorCode = error.response?.data?.error;
      setMessage(
        Array.isArray(missing) && missing.length
          ? "Faltan datos obligatorios o documentos requeridos para validar el alta."
          : errorCode === "document_upload_not_configured"
            ? "No pudimos subir los documentos porque el almacenamiento no esta configurado."
            : "No pudimos guardar la solicitud formal."
      );
    } finally {
      setSaving(false);
    }
  };

  const signContract = async (event) => {
    event.preventDefault();

    if (!acceptedContract) {
      setMessage("Debes aceptar el contrato para continuar.");
      return;
    }

    try {
      setSigningContract(true);
      setMessage("");
      const response = await api.post(`/api/onboarding/form/${token}/sign-contract`, {
        acceptedContract: true,
      });
      setRequest(response.data?.request);
      setMessage("Contrato aceptado. Hemos enviado tus credenciales iniciales por email.");
    } catch (error) {
      console.error(error);
      setMessage("No pudimos completar la firma del contrato. Contacta con Volta Pizza.");
    } finally {
      setSigningContract(false);
    }
  };

  if (loading) {
    return <main className="onb-page"><div className="onb-shell">Cargando onboarding...</div></main>;
  }

  if (!request) {
    return <main className="onb-page"><div className="onb-shell">{message}</div></main>;
  }

  const contract = buildContractData(request);

  if (shouldShowContract) {
    return (
      <main className="onb-page onb-page--contract">
        <section className="onb-shell">
          <div className="onb-header onb-header--contract">
            <span>Volta Pizza Onboarding</span>
            <h1>Contrato de adhesion comercial</h1>
            <p>
              Revisa el contrato completo de {request.businessName}. Para continuar
              con la activacion del backoffice debes confirmar la aceptacion y firmarlo
              electronicamente.
            </p>
            <strong>{statusCopy[request.status] || request.status}</strong>
          </div>

          <section className="onb-contractPanel">
            <div className="onb-contractHead">
              <div>
                <span>Firma electronica</span>
                <h2>{contract.commercialName}</h2>
              </div>
              <div className="onb-contractHeadActions">
                <button type="button" onClick={() => downloadContractPdf(contract)}>
                  Descargar PDF
                </button>
                <strong>{statusCopy[request.status] || request.status}</strong>
              </div>
            </div>

            <ContractDocument contract={contract} request={request} />

            {canSignContract && (
              <form className="onb-signForm" onSubmit={signContract}>
                <label>
                  <input
                    type="checkbox"
                    checked={acceptedContract}
                    onChange={(event) => setAcceptedContract(event.target.checked)}
                  />
                  <span>
                    He revisado integramente el contrato, acepto sus condiciones y lo firmo
                    electronicamente en senal de conformidad, declarando que tengo facultades
                    suficientes para representar al Comerciante.
                  </span>
                </label>
                <button type="submit" disabled={signingContract || !acceptedContract}>
                  {signingContract ? "Firmando..." : "Firmar contrato y activar backoffice"}
                </button>
              </form>
            )}

            {request.status === "ACTIVATED" && (
              <div className="onb-message">
                Contrato firmado. Hemos enviado el ultimo correo con las credenciales
                iniciales de backoffice.
              </div>
            )}

            {!canSignContract && request.status !== "ACTIVATED" && (
              <div className="onb-message">
                Este contrato aun no esta habilitado para firma. Espera el correo de Volta
                Pizza o contacta con el equipo.
              </div>
            )}

            {message && <div className="onb-message">{message}</div>}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="onb-page">
      <section className="onb-shell">
        <div className="onb-header">
          <span>Volta Pizza Onboarding</span>
          <h1>Fase 2</h1>
          <p>
            Completa los datos que usaremos para revisar tu alta, preparar el contrato
            y activar {request.businessName} en Volta Pizza.
          </p>
          <strong>{statusCopy[request.status] || request.status}</strong>
        </div>

        <form className="onb-form" onSubmit={submit} noValidate>
          <div className="onb-section">
            <h2>Datos legales</h2>
            <label className={fieldClassName("partnerType")}>
              <span>Tipo de titular</span>
              <select value={form.partnerType} onChange={updateField("partnerType")} required disabled={isLocked} {...fieldProps("partnerType")}>
                <option value="">Selecciona una opcion</option>
                <option value="AUTONOMO">Autonomo</option>
                <option value="SOCIEDAD">Sociedad</option>
              </select>
            </label>
            <label className={fieldClassName("legalName")}>
              <span>Razon social o nombre fiscal</span>
              <input value={form.legalName} onChange={updateField("legalName")} required disabled={isLocked} {...fieldProps("legalName")} />
            </label>
            <label className={fieldClassName("taxId")}>
              <span>CIF / NIF / NIE</span>
              <input value={form.taxId} onChange={updateField("taxId")} required disabled={isLocked} {...fieldProps("taxId")} />
            </label>
            <label className={fieldClassName("businessEmail")}>
              <span>Email comercial</span>
              <input type="email" value={form.businessEmail} onChange={updateField("businessEmail")} required disabled={isLocked} {...fieldProps("businessEmail")} />
            </label>
            <label className={fieldClassName("legalRepresentative")}>
              <span>Responsable legal</span>
              <input value={form.legalRepresentative} onChange={updateField("legalRepresentative")} required disabled={isLocked} {...fieldProps("legalRepresentative")} />
            </label>
            <label className={fieldClassName("representativeRole")}>
              <span>Cargo</span>
              <input value={form.representativeRole} onChange={updateField("representativeRole")} required disabled={isLocked} {...fieldProps("representativeRole")} />
            </label>
          </div>

          <div className="onb-section">
            <h2>Negocio</h2>
            <label className={fieldClassName("commercialName")}>
              <span>Nombre comercial</span>
              <input value={form.commercialName} onChange={updateField("commercialName")} required disabled={isLocked} {...fieldProps("commercialName")} />
            </label>
            <label className={fieldClassName("businessAddress")}>
              <span>Direccion del local</span>
              <input value={form.businessAddress} onChange={updateField("businessAddress")} required disabled={isLocked} {...fieldProps("businessAddress")} />
            </label>
            <label className={fieldClassName("city")}>
              <span>Ciudad</span>
              <input value={form.city} onChange={updateField("city")} required disabled={isLocked} {...fieldProps("city")} />
            </label>
            <label className={fieldClassName("postalCode")}>
              <span>Codigo postal</span>
              <input value={form.postalCode} onChange={updateField("postalCode")} required disabled={isLocked} {...fieldProps("postalCode")} />
            </label>
            <label className={fieldClassName("country")}>
              <span>Pais</span>
              <input value={form.country} onChange={updateField("country")} required disabled={isLocked} {...fieldProps("country")} />
            </label>
            <label className={fieldClassName("businessPhone")}>
              <span>Telefono comercial</span>
              <input value={form.businessPhone} onChange={updateField("businessPhone")} required disabled={isLocked} {...fieldProps("businessPhone")} />
            </label>
          </div>

          <div className="onb-section">
            <h2>Cobros</h2>
            <label className={fieldClassName("accountHolder")}>
              <span>Titular de la cuenta</span>
              <input value={form.accountHolder} onChange={updateField("accountHolder")} required disabled={isLocked} {...fieldProps("accountHolder")} />
            </label>
            <label className={fieldClassName("iban")}>
              <span>IBAN</span>
              <input value={form.iban} onChange={updateField("iban")} required disabled={isLocked} placeholder="ES00 0000 0000 0000 0000 0000" {...fieldProps("iban")} />
            </label>
            <div className="onb-wide onb-staticNotice">
              <span>Reparto</span>
              <strong>El reparto lo gestiona el partner.</strong>
              <small>Volta no presta servicios logisticos. Estos datos se reflejaran en el contrato.</small>
            </div>
          </div>

          <div className="onb-section">
            <h2>Documentacion basica</h2>
            <p className="onb-sectionIntro">
              Sube solo lo necesario para validar quien firma y la empresa/autonomo.
            </p>
            {documentFields.map((field) => {
              const existingForType = existingDocumentsByType[field.key] || [];
              const selectedForType = documents[field.key] || [];
              const invalidField = `document:${field.key}`;
              return (
                <label key={field.key} className={fieldClassName(invalidField, "onb-wide onb-fileField")}>
                  <span>{field.title}{field.required ? " *" : ""}</span>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    multiple
                    onChange={updateDocuments(field.key)}
                    required={field.required && !existingForType.length}
                    disabled={isLocked}
                    {...fieldProps(invalidField)}
                  />
                  <small>{field.description} PDF, JPG o PNG. Maximo 8 MB por archivo.</small>
                  {(existingForType.length > 0 || selectedForType.length > 0) && (
                    <div className="onb-docList">
                      {existingForType.map((document) => (
                        <span key={document.publicId || document.name}>{document.name}</span>
                      ))}
                      {selectedForType.map((document) => (
                        <span key={`${field.key}-${document.name}-${document.size}`}>{document.name}</span>
                      ))}
                    </div>
                  )}
                </label>
              );
            })}
          </div>

          <div className="onb-section onb-checks">
            <label className={fieldClassName("acceptedTerms")}>
              <input type="checkbox" checked={form.acceptedTerms} onChange={updateField("acceptedTerms")} required disabled={isLocked} {...fieldProps("acceptedTerms")} />
              <span>Declaro que la informacion enviada es real y que estoy autorizado para representar este negocio.</span>
            </label>
            <label className={fieldClassName("acceptedCompliance")}>
              <input type="checkbox" checked={form.acceptedCompliance} onChange={updateField("acceptedCompliance")} required disabled={isLocked} {...fieldProps("acceptedCompliance")} />
              <span>Acepto que Volta Pizza revise estos datos para preparar el contrato y continuar el proceso de activacion.</span>
            </label>
          </div>

          {!isLocked && (
            <button type="submit" disabled={saving}>
              {saving ? "Enviando..." : "Enviar a revision"}
            </button>
          )}

          {message && <div className="onb-message">{message}</div>}
        </form>
      </section>
    </main>
  );
}
