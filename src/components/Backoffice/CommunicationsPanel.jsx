import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import { COUPON_SEGMENTS } from "../../constants/coupons";
import "../../styles/CouponsModule.css";

const normalizeComparableText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const postalAreaKey = (postalCode) => {
  const digits = String(postalCode || "").replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : "";
};

const selectedCustomerLabel = (customer) => {
  if (!customer) return "";
  return [
    customer.name || `Cliente #${customer.id}`,
    customer.phone,
    customer.segment,
    customer.activity,
    customer.zipCode,
  ]
    .filter(Boolean)
    .join(" - ");
};

const defaultPreview = {
  recipients: 0,
  validPhones: 0,
  invalidPhones: 0,
  sample: [],
};

export default function CommunicationsPanel({ partnerId }) {
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState(defaultPreview);
  const [customerSearch, setCustomerSearch] = useState("");
  const [territory, setTerritory] = useState({
    stores: [],
    zipCodes: [],
    customers: [],
  });
  const [form, setForm] = useState({
    audienceMode: "FILTERED",
    customerIds: [],
    segments: [],
    storeIds: [],
    zipCodes: [],
  });

  const selectedCustomer = useMemo(
    () => territory.customers.find((customer) => form.customerIds.includes(customer.id)) || null,
    [form.customerIds, territory.customers]
  );

  const customerResults = useMemo(() => {
    const query = normalizeComparableText(customerSearch);
    if (!query) return [];

    return territory.customers
      .filter((customer) => {
        const haystack = normalizeComparableText(
          [
            customer.name,
            customer.phone,
            customer.email,
            customer.address_1,
            customer.zipCode,
            customer.segment,
            customer.activity,
          ]
            .filter(Boolean)
            .join(" ")
        );

        return haystack.includes(query);
      })
      .slice(0, 10);
  }, [customerSearch, territory.customers]);

  const linkedZipCodes = useMemo(() => {
    const selectedStores = territory.stores.filter((store) => form.storeIds.includes(store.id));
    if (!selectedStores.length) return new Set();

    const linkedZips = new Set();

    selectedStores.forEach((store) => {
      const storeZip = String(store.zipCode || "").trim();
      const storeArea = postalAreaKey(storeZip);
      const storeCity = normalizeComparableText(store.city || "");

      if (storeZip) linkedZips.add(storeZip);

      territory.customers.forEach((customer) => {
        const customerZip = String(customer.zipCode || "").trim();
        const customerArea = postalAreaKey(customerZip);
        const customerAddress = normalizeComparableText(customer.address_1 || "");

        if (storeZip && customerZip === storeZip) {
          linkedZips.add(customerZip);
          return;
        }

        if (storeArea && customerArea && storeArea === customerArea) {
          linkedZips.add(customerZip);
          return;
        }

        if (storeCity && customerAddress.includes(storeCity) && customerZip) {
          linkedZips.add(customerZip);
        }
      });
    });

    return linkedZips;
  }, [form.storeIds, territory.customers, territory.stores]);

  const availableZipCodes = useMemo(() => {
    if (!form.storeIds.length) return territory.zipCodes;
    return territory.zipCodes.filter((zipCode) => linkedZipCodes.has(zipCode));
  }, [form.storeIds.length, linkedZipCodes, territory.zipCodes]);

  const payload = useMemo(
    () => ({
      partnerId,
      audienceMode: form.audienceMode,
      message,
      customerIds: form.audienceMode === "ONE" ? form.customerIds : [],
      segments: form.audienceMode === "FILTERED" ? form.segments : [],
      storeIds: form.audienceMode === "FILTERED" ? form.storeIds : [],
      zipCodes: form.audienceMode === "FILTERED" ? form.zipCodes : [],
    }),
    [form, message, partnerId]
  );

  const hasTarget = useMemo(() => {
    if (form.audienceMode === "ALL") return true;
    if (form.audienceMode === "ONE") return form.customerIds.length > 0;
    return Boolean(form.segments.length || form.storeIds.length || form.zipCodes.length);
  }, [form]);

  useEffect(() => {
    if (!partnerId) return;

    let isMounted = true;

    const loadTerritory = async () => {
      try {
        const [storesResponse, statsResponse, customersResponse] = await Promise.all([
          api.get(`/stores?partnerId=${partnerId}`),
          api.get(`/api/customers/segment-stats?partnerId=${partnerId}`),
          api.get(`/api/customers?partnerId=${partnerId}`),
        ]);

        if (!isMounted) return;

        setTerritory({
          stores: Array.isArray(storesResponse.data) ? storesResponse.data : [],
          zipCodes: Array.isArray(statsResponse.data?.zipCodes) ? statsResponse.data.zipCodes : [],
          customers: Array.isArray(customersResponse.data) ? customersResponse.data : [],
        });
      } catch (requestError) {
        console.error("Error loading communication filters", requestError);
        setFeedback("No se pudieron cargar clientes y filtros territoriales.");
      }
    };

    loadTerritory();

    return () => {
      isMounted = false;
    };
  }, [partnerId]);

  useEffect(() => {
    setForm((prev) => {
      const nextZipCodes = prev.zipCodes.filter((zipCode) => availableZipCodes.includes(zipCode));
      if (nextZipCodes.length === prev.zipCodes.length) return prev;
      return { ...prev, zipCodes: nextZipCodes };
    });
  }, [availableZipCodes]);

  const updateForm = (key, value) => {
    if (key === "audienceMode") {
      setPreview(defaultPreview);
      setFeedback("");
    }

    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "audienceMode") {
        next.customerIds = [];
        next.segments = [];
        next.storeIds = [];
        next.zipCodes = [];
      }

      return next;
    });
  };

  const toggleSegment = (segment) => {
    setPreview(defaultPreview);
    setForm((prev) => ({
      ...prev,
      segments: prev.segments.includes(segment)
        ? prev.segments.filter((item) => item !== segment)
        : [...prev.segments, segment],
    }));
  };

  const toggleAllSegments = () => {
    const allSegments = COUPON_SEGMENTS.map((segment) => segment.key);
    setPreview(defaultPreview);
    setForm((prev) => ({
      ...prev,
      segments: prev.segments.length === allSegments.length ? [] : allSegments,
    }));
  };

  const toggleStore = (storeId) => {
    setPreview(defaultPreview);
    setForm((prev) => ({
      ...prev,
      storeIds: prev.storeIds.includes(storeId)
        ? prev.storeIds.filter((item) => item !== storeId)
        : [...prev.storeIds, storeId],
    }));
  };

  const toggleAllStores = () => {
    setPreview(defaultPreview);
    setForm((prev) => ({
      ...prev,
      storeIds:
        prev.storeIds.length === territory.stores.length
          ? []
          : territory.stores.map((store) => store.id),
    }));
  };

  const toggleZipCode = (zipCode) => {
    setPreview(defaultPreview);
    setForm((prev) => ({
      ...prev,
      zipCodes: prev.zipCodes.includes(zipCode)
        ? prev.zipCodes.filter((item) => item !== zipCode)
        : [...prev.zipCodes, zipCode],
    }));
  };

  const toggleAllZipCodes = () => {
    setPreview(defaultPreview);
    setForm((prev) => ({
      ...prev,
      zipCodes:
        prev.zipCodes.length === availableZipCodes.length
          ? []
          : [...availableZipCodes],
    }));
  };

  const selectCustomer = (customer) => {
    setForm((prev) => ({
      ...prev,
      audienceMode: "ONE",
      customerIds: [customer.id],
      segments: [],
      storeIds: [],
      zipCodes: [],
    }));
    setCustomerSearch(selectedCustomerLabel(customer));
    setPreview(defaultPreview);
  };

  const loadPreview = async () => {
    setFeedback("");
    setPreviewing(true);

    try {
      const { data } = await api.post("/api/communications/sms/preview", payload);
      setPreview({
        recipients: data?.recipients || 0,
        validPhones: data?.validPhones || 0,
        invalidPhones: data?.invalidPhones || 0,
        sample: Array.isArray(data?.sample) ? data.sample : [],
      });
      if (!data?.recipients) {
        setFeedback("No hay clientes que coincidan con ese destino.");
      }
    } catch (requestError) {
      console.error(requestError);
      setFeedback(requestError.response?.data?.error || "No se pudo calcular la audiencia.");
      setPreview(defaultPreview);
    } finally {
      setPreviewing(false);
    }
  };

  const sendSms = async (event) => {
    event.preventDefault();
    setFeedback("");

    if (!hasTarget) {
      setFeedback("Selecciona un cliente, un filtro o toda la base antes de enviar.");
      return;
    }

    if (message.trim().length < 3) {
      setFeedback("Escribe el mensaje antes de enviar.");
      return;
    }

    setSaving(true);

    try {
      const { data } = await api.post("/api/communications/sms/send", payload);
      const delivery = data?.delivery || {};
      setPreview(data?.preview || defaultPreview);
      setFeedback(
        `Envio completado: ${delivery.sent || 0} enviados, ${delivery.failed || 0} fallidos${
          delivery.skipped ? `, ${delivery.skipped} omitidos` : ""
        }.`
      );
    } catch (requestError) {
      console.error(requestError);
      const errorCode = requestError.response?.data?.error;
      const errorMessages = {
        no_recipients: "No hay clientes que coincidan con ese destino.",
        no_valid_phones: "La audiencia existe, pero no tiene telefonos validos para SMS.",
        bad_store_ids: "Alguna tienda seleccionada no pertenece a este partner.",
        bad_message: "El mensaje debe tener entre 3 y 600 caracteres.",
        insufficient_sms_credits: `Saldo SMS insuficiente. Disponibles: ${
          requestError.response?.data?.balance || 0
        }. Necesarios: ${requestError.response?.data?.required || 0}.`,
      };
      setFeedback(errorMessages[errorCode] || errorCode || "No se pudo enviar el mensaje.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="cp-card cp-form" onSubmit={sendSms}>
      <div className="cp-kicker">Comunicacion</div>
      <h3>Enviar SMS a clientes</h3>
      <div className="cp-helper">
        Usa la misma segmentacion de cupones: cliente individual, segmentos, tiendas, codigos postales o toda la base.
      </div>

      <div className="cp-field">
        <span>Audiencia</span>
        <div className="cp-segmented cp-segmented--three">
          <button
            className={`cp-segmentedBtn ${form.audienceMode === "ONE" ? "is-active" : ""}`}
            onClick={() => updateForm("audienceMode", "ONE")}
            type="button"
          >
            1 cliente
          </button>
          <button
            className={`cp-segmentedBtn ${form.audienceMode === "FILTERED" ? "is-active" : ""}`}
            onClick={() => updateForm("audienceMode", "FILTERED")}
            type="button"
          >
            Segmentado
          </button>
          <button
            className={`cp-segmentedBtn ${form.audienceMode === "ALL" ? "is-active" : ""}`}
            onClick={() => updateForm("audienceMode", "ALL")}
            type="button"
          >
            Toda la base
          </button>
        </div>
      </div>

      {form.audienceMode === "ONE" && (
        <div className="cp-targetPanel">
          <label className="cp-field">
            <span>Buscar cliente</span>
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Nombre, telefono, email o codigo postal"
            />
          </label>

          {selectedCustomer && (
            <div className="cp-helper">Seleccionado: {selectedCustomerLabel(selectedCustomer)}</div>
          )}

          {!!customerResults.length && (
            <div className="cp-customerResults">
              {customerResults.map((customer) => (
                <button
                  key={customer.id}
                  className={`cp-customerOption ${
                    form.customerIds.includes(customer.id) ? "is-active" : ""
                  }`}
                  onClick={() => selectCustomer(customer)}
                  type="button"
                >
                  <strong>{customer.name || `Cliente #${customer.id}`}</strong>
                  <span>
                    {[customer.phone, customer.segment, customer.activity, customer.zipCode]
                      .filter(Boolean)
                      .join(" - ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {form.audienceMode === "FILTERED" && (
        <>
          <div className="cp-field">
            <span>Segmentos</span>
            <div className="cp-pillRow">
              <button
                className={`cp-pill ${form.segments.length === COUPON_SEGMENTS.length ? "is-active" : ""}`}
                onClick={toggleAllSegments}
                type="button"
              >
                Seleccionar todo
              </button>
              {COUPON_SEGMENTS.map((segment) => (
                <button
                  key={segment.key}
                  className={`cp-pill ${form.segments.includes(segment.key) ? "is-active" : ""}`}
                  onClick={() => toggleSegment(segment.key)}
                  type="button"
                >
                  {segment.label}
                </button>
              ))}
            </div>
            <div className="cp-helper">Puedes mezclar segmentos S1-S5 con estado Hot/Cold.</div>
          </div>

          <div className="cp-targetPanel">
            <div className="cp-field">
              <span>Tiendas</span>
              <div className="cp-pillRow">
                {!!territory.stores.length && (
                  <button
                    className={`cp-pill ${form.storeIds.length === territory.stores.length ? "is-active" : ""}`}
                    onClick={toggleAllStores}
                    type="button"
                  >
                    Seleccionar todo
                  </button>
                )}
                {territory.stores.map((store) => (
                  <button
                    key={store.id}
                    className={`cp-pill ${form.storeIds.includes(store.id) ? "is-active" : ""}`}
                    onClick={() => toggleStore(store.id)}
                    type="button"
                  >
                    {store.storeName}
                    {store.city ? ` - ${store.city}` : ""}
                    {store.zipCode ? ` - ${store.zipCode}` : ""}
                  </button>
                ))}
              </div>
              {!form.storeIds.length && !!territory.stores.length && (
                <div className="cp-helper">Sin tiendas marcadas = cualquier tienda.</div>
              )}
            </div>

            <div className="cp-field">
              <span>Codigos postales</span>
              <div className="cp-pillRow">
                {!!availableZipCodes.length && (
                  <button
                    className={`cp-pill ${form.zipCodes.length === availableZipCodes.length ? "is-active" : ""}`}
                    onClick={toggleAllZipCodes}
                    type="button"
                  >
                    Seleccionar todo
                  </button>
                )}
                {availableZipCodes.map((zipCode) => (
                  <button
                    key={zipCode}
                    className={`cp-pill ${form.zipCodes.includes(zipCode) ? "is-active" : ""} ${
                      !form.zipCodes.includes(zipCode) && linkedZipCodes.has(zipCode) ? "is-linked" : ""
                    }`}
                    onClick={() => toggleZipCode(zipCode)}
                    type="button"
                  >
                    {zipCode}
                  </button>
                ))}
              </div>
              {!form.zipCodes.length && !!availableZipCodes.length && (
                <div className="cp-helper">Sin codigos marcados = cualquier codigo postal.</div>
              )}
            </div>
          </div>
        </>
      )}

      {form.audienceMode === "ALL" && (
        <div className="cp-targetPanel">
          <strong>Toda la base de clientes no restringidos</strong>
          <div className="cp-helper">
            Este modo ignora segmentos, tiendas y codigos postales. Usa Vista previa antes de enviar.
          </div>
        </div>
      )}

      <label className="cp-field">
        <span>Mensaje</span>
        <textarea
          rows="5"
          value={message}
          maxLength={600}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Escribe el mensaje para el cliente"
        />
      </label>
      <div className="cp-helper">
        {message.trim().length}/600 caracteres. Se agregara automaticamente la marca y la instruccion STOP.
      </div>

      <div className="cp-kpiGrid cp-kpiGrid--three">
        <div className="cp-kpiCard">
          <span>Clientes</span>
          <strong>{preview.recipients}</strong>
        </div>
        <div className="cp-kpiCard">
          <span>Telefonos validos</span>
          <strong>{preview.validPhones}</strong>
        </div>
        <div className="cp-kpiCard">
          <span>Omitidos</span>
          <strong>{preview.invalidPhones}</strong>
        </div>
      </div>

      {!!preview.sample.length && (
        <div className="cp-tableWrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefono</th>
                <th>Segmento</th>
                <th>CP</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name || `Cliente #${customer.id}`}</td>
                  <td>{customer.phone || "-"}</td>
                  <td>{[customer.segment, customer.activity].filter(Boolean).join(" / ") || "-"}</td>
                  <td>{customer.zipCode || "-"}</td>
                  <td>{customer.canSend ? "OK" : "Telefono invalido"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cp-actions">
        <button
          className="cp-pill"
          disabled={previewing || !hasTarget}
          onClick={loadPreview}
          type="button"
        >
          {previewing ? "Calculando..." : "Vista previa"}
        </button>
        <button
          className="cp-primaryBtn"
          disabled={saving || !hasTarget || message.trim().length < 3 || preview.validPhones <= 0}
          type="submit"
        >
          {saving ? "Enviando..." : "Enviar SMS"}
        </button>
      </div>

      {feedback && <div className="cp-feedback">{feedback}</div>}
    </form>
  );
}
