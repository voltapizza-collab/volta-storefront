import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../setupAxios";
import "../styles/OnboardingForm.css";

const initialForm = {
  legalName: "",
  taxId: "",
  legalRepresentative: "",
  representativeId: "",
  representativeRole: "",
  fiscalAddress: "",
  businessAddress: "",
  city: "",
  postalCode: "",
  country: "Espana",
  businessPhone: "",
  businessEmail: "",
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
  EMAIL_SENT: "Formulario pendiente",
  FORM_COMPLETED: "Formulario completado",
  IN_REVIEW: "En revision",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  NEEDS_INFO: "Falta informacion",
};

export default function OnboardingFormPage() {
  const { token } = useParams();
  const [request, setRequest] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isClosed = useMemo(
    () => ["APPROVED", "REJECTED"].includes(request?.status),
    [request?.status]
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

  const submit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      const response = await api.post(`/api/onboarding/form/${token}`, form);
      setRequest(response.data?.request);
      setMessage("Formulario recibido. Revisaremos la informacion antes de activar el acceso.");
    } catch (error) {
      console.error(error);
      const missing = error.response?.data?.missing;
      setMessage(
        Array.isArray(missing) && missing.length
          ? "Faltan datos obligatorios para enviar la solicitud formal."
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
          <h1>Solicitud formal</h1>
          <p>
            Completa los datos legales y operativos minimos para revisar la
            entrada de {request.businessName} en Volta Pizza.
          </p>
          <strong>{statusCopy[request.status] || request.status}</strong>
        </div>

        <form className="onb-form" onSubmit={submit}>
          <div className="onb-section">
            <h2>Datos legales</h2>
            <label>
              <span>Razon social</span>
              <input value={form.legalName} onChange={updateField("legalName")} required disabled={isClosed} />
            </label>
            <label>
              <span>CIF / NIF / VAT</span>
              <input value={form.taxId} onChange={updateField("taxId")} required disabled={isClosed} />
            </label>
            <label>
              <span>Responsable legal</span>
              <input value={form.legalRepresentative} onChange={updateField("legalRepresentative")} required disabled={isClosed} />
            </label>
            <label>
              <span>Documento responsable</span>
              <input value={form.representativeId} onChange={updateField("representativeId")} required disabled={isClosed} />
            </label>
            <label>
              <span>Cargo</span>
              <input value={form.representativeRole} onChange={updateField("representativeRole")} required disabled={isClosed} />
            </label>
            <label>
              <span>Direccion fiscal</span>
              <input value={form.fiscalAddress} onChange={updateField("fiscalAddress")} required disabled={isClosed} />
            </label>
          </div>

          <div className="onb-section">
            <h2>Negocio</h2>
            <label>
              <span>Direccion del local</span>
              <input value={form.businessAddress} onChange={updateField("businessAddress")} required disabled={isClosed} />
            </label>
            <label>
              <span>Ciudad</span>
              <input value={form.city} onChange={updateField("city")} required disabled={isClosed} />
            </label>
            <label>
              <span>Codigo postal</span>
              <input value={form.postalCode} onChange={updateField("postalCode")} required disabled={isClosed} />
            </label>
            <label>
              <span>Pais</span>
              <input value={form.country} onChange={updateField("country")} required disabled={isClosed} />
            </label>
            <label>
              <span>Telefono comercial</span>
              <input value={form.businessPhone} onChange={updateField("businessPhone")} required disabled={isClosed} />
            </label>
            <label>
              <span>Email comercial</span>
              <input type="email" value={form.businessEmail} onChange={updateField("businessEmail")} required disabled={isClosed} />
            </label>
            <label>
              <span>Web o redes</span>
              <input value={form.website} onChange={updateField("website")} disabled={isClosed} />
            </label>
            <label>
              <span>Numero de locales</span>
              <input value={form.numberOfStores} onChange={updateField("numberOfStores")} disabled={isClosed} />
            </label>
            <label>
              <span>Pedidos mensuales aproximados</span>
              <input value={form.monthlyOrdersEstimate} onChange={updateField("monthlyOrdersEstimate")} disabled={isClosed} />
            </label>
            <label>
              <span>Plataformas actuales</span>
              <input value={form.currentPlatforms} onChange={updateField("currentPlatforms")} disabled={isClosed} />
            </label>
            <label className="onb-wide">
              <span>Notas</span>
              <textarea rows="4" value={form.notes} onChange={updateField("notes")} disabled={isClosed} />
            </label>
          </div>

          <div className="onb-section onb-checks">
            <label>
              <input type="checkbox" checked={form.acceptedTerms} onChange={updateField("acceptedTerms")} required disabled={isClosed} />
              <span>Declaro que la informacion enviada es real y que estoy autorizado para representar este negocio.</span>
            </label>
            <label>
              <input type="checkbox" checked={form.acceptedCompliance} onChange={updateField("acceptedCompliance")} required disabled={isClosed} />
              <span>Acepto que Volta Pizza revise estos datos antes de conceder acceso operativo.</span>
            </label>
          </div>

          {!isClosed && (
            <button type="submit" disabled={saving}>
              {saving ? "Enviando..." : "Enviar solicitud formal"}
            </button>
          )}

          {message && <div className="onb-message">{message}</div>}
        </form>
      </section>
    </main>
  );
}
