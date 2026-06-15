import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../setupAxios";
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
  {
    key: "BANK",
    title: "Titularidad bancaria",
    description: "Certificado bancario o justificante donde aparezcan titular e IBAN.",
    required: true,
  },
  {
    key: "REPRESENTATION",
    title: "Representacion",
    description: "Poder, nombramiento o autorizacion si el firmante no figura claramente.",
    required: false,
  },
  {
    key: "HEALTH",
    title: "Licencia o autorizacion sanitaria",
    description: "Opcional en esta fase, recomendable si ya la tienes disponible.",
    required: false,
  },
];

export default function OnboardingFormPage() {
  const { token } = useParams();
  const [request, setRequest] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState({});

  const isLocked = useMemo(
    () => ["IN_REVIEW", "APPROVED", "REJECTED"].includes(request?.status),
    [request?.status]
  );

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
    setMessage("");
  };

  const updateDocuments = (documentType) => (event) => {
    setDocuments((current) => ({
      ...current,
      [documentType]: Array.from(event.target.files || []),
    }));
    setMessage("");
  };

  const submit = async (event) => {
    event.preventDefault();

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

  if (loading) {
    return <main className="onb-page"><div className="onb-shell">Cargando onboarding...</div></main>;
  }

  if (!request) {
    return <main className="onb-page"><div className="onb-shell">{message}</div></main>;
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

        <form className="onb-form" onSubmit={submit}>
          <div className="onb-section">
            <h2>Datos legales</h2>
            <label>
              <span>Tipo de titular</span>
              <select value={form.partnerType} onChange={updateField("partnerType")} required disabled={isLocked}>
                <option value="">Selecciona una opcion</option>
                <option value="AUTONOMO">Autonomo</option>
                <option value="SOCIEDAD">Sociedad</option>
              </select>
            </label>
            <label>
              <span>Razon social o nombre fiscal</span>
              <input value={form.legalName} onChange={updateField("legalName")} required disabled={isLocked} />
            </label>
            <label>
              <span>CIF / NIF / VAT</span>
              <input value={form.taxId} onChange={updateField("taxId")} required disabled={isLocked} />
            </label>
            <label>
              <span>Email comercial</span>
              <input type="email" value={form.businessEmail} onChange={updateField("businessEmail")} required disabled={isLocked} />
            </label>
            <label>
              <span>Responsable legal</span>
              <input value={form.legalRepresentative} onChange={updateField("legalRepresentative")} required disabled={isLocked} />
            </label>
            <label>
              <span>Documento responsable</span>
              <input value={form.representativeId} onChange={updateField("representativeId")} required disabled={isLocked} />
            </label>
            <label>
              <span>Cargo</span>
              <input value={form.representativeRole} onChange={updateField("representativeRole")} required disabled={isLocked} />
            </label>
            <label>
              <span>Direccion fiscal</span>
              <input value={form.fiscalAddress} onChange={updateField("fiscalAddress")} required disabled={isLocked} />
            </label>
          </div>

          <div className="onb-section">
            <h2>Negocio</h2>
            <label>
              <span>Nombre comercial</span>
              <input value={form.commercialName} onChange={updateField("commercialName")} required disabled={isLocked} />
            </label>
            <label>
              <span>Direccion del local</span>
              <input value={form.businessAddress} onChange={updateField("businessAddress")} required disabled={isLocked} />
            </label>
            <label>
              <span>Ciudad</span>
              <input value={form.city} onChange={updateField("city")} required disabled={isLocked} />
            </label>
            <label>
              <span>Codigo postal</span>
              <input value={form.postalCode} onChange={updateField("postalCode")} required disabled={isLocked} />
            </label>
            <label>
              <span>Pais</span>
              <input value={form.country} onChange={updateField("country")} required disabled={isLocked} />
            </label>
            <label>
              <span>Telefono comercial</span>
              <input value={form.businessPhone} onChange={updateField("businessPhone")} required disabled={isLocked} />
            </label>
          </div>

          <div className="onb-section">
            <h2>Cobros</h2>
            <label>
              <span>Titular de la cuenta</span>
              <input value={form.accountHolder} onChange={updateField("accountHolder")} required disabled={isLocked} />
            </label>
            <label>
              <span>IBAN</span>
              <input value={form.iban} onChange={updateField("iban")} required disabled={isLocked} placeholder="ES00 0000 0000 0000 0000 0000" />
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
              Sube solo lo necesario para validar quien firma, la empresa/autonomo y la cuenta de liquidacion.
            </p>
            {documentFields.map((field) => {
              const existingForType = existingDocumentsByType[field.key] || [];
              const selectedForType = documents[field.key] || [];
              return (
                <label key={field.key} className="onb-wide onb-fileField">
                  <span>{field.title}{field.required ? " *" : ""}</span>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    multiple
                    onChange={updateDocuments(field.key)}
                    required={field.required && !existingForType.length}
                    disabled={isLocked}
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
            <label>
              <input type="checkbox" checked={form.acceptedTerms} onChange={updateField("acceptedTerms")} required disabled={isLocked} />
              <span>Declaro que la informacion enviada es real y que estoy autorizado para representar este negocio.</span>
            </label>
            <label>
              <input type="checkbox" checked={form.acceptedCompliance} onChange={updateField("acceptedCompliance")} required disabled={isLocked} />
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
