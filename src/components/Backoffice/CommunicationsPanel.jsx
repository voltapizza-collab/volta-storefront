import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import { COUPON_SEGMENTS } from "../../constants/coupons";
import SmsCreditsPanel from "./Coupons/SmsCreditsPanel";
import "../../styles/CouponsModule.css";

const COMMUNICATION_SEGMENTS = COUPON_SEGMENTS.filter((segment) => /^S\d$/i.test(segment.key));

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

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
    customer.zipCode,
  ]
    .filter(Boolean)
    .join(" - ");
};

const defaultPreview = {
  recipients: 0,
  validPhones: 0,
  invalidPhones: 0,
  smsPartsPerRecipient: 1,
  estimatedCreditsRequired: 0,
  smsEncoding: "GSM-7",
  smsLength: 0,
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
    segmentStats: {
      total: 0,
      counts: {},
    },
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
          ]
            .filter(Boolean)
            .join(" ")
        );

        return haystack.includes(query);
      })
      .slice(0, 10);
  }, [customerSearch, territory.customers]);

  const linkedZipCodes = useMemo(() => {
    const selectedStores = territory.stores.filter((store) =>
      form.storeIds.some((storeId) => String(storeId) === String(store.id))
    );
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

  const allStoreIds = useMemo(() => territory.stores.map((store) => store.id), [territory.stores]);
  const allStoresSelected = useMemo(
    () =>
      allStoreIds.length > 0 &&
      allStoreIds.every((storeId) => form.storeIds.some((item) => String(item) === String(storeId))),
    [allStoreIds, form.storeIds]
  );

  const segmentStats = useMemo(() => {
    const total = Number(territory.segmentStats?.total || 0);
    const counts = territory.segmentStats?.counts || {};

    return {
      total,
      counts,
      percent: (segmentKey) => (total ? (Number(counts[segmentKey] || 0) / total) * 100 : 0),
    };
  }, [territory.segmentStats]);

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
          segmentStats: {
            total: Number(statsResponse.data?.total || 0),
            counts: statsResponse.data?.counts || {},
          },
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
    const allSegments = COMMUNICATION_SEGMENTS.map((segment) => segment.key);
    setPreview(defaultPreview);
    setForm((prev) => ({
      ...prev,
      segments: prev.segments.length === allSegments.length ? [] : allSegments,
    }));
  };

  const toggleStore = (storeId) => {
    setPreview(defaultPreview);
    setForm((prev) => {
      const isSelected = prev.storeIds.some((item) => String(item) === String(storeId));

      return {
        ...prev,
        storeIds: isSelected
          ? prev.storeIds.filter((item) => String(item) !== String(storeId))
          : [...prev.storeIds, storeId],
      };
    });
  };

  const toggleAllStores = () => {
    setPreview(defaultPreview);
    setForm((prev) => {
      const selectedIds = prev.storeIds.map((storeId) => String(storeId));
      const allSelected =
        allStoreIds.length > 0 && allStoreIds.every((storeId) => selectedIds.includes(String(storeId)));

      return {
        ...prev,
        storeIds: allSelected ? [] : allStoreIds,
      };
    });
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
        smsPartsPerRecipient: data?.smsPartsPerRecipient || 1,
        estimatedCreditsRequired: data?.estimatedCreditsRequired || 0,
        smsEncoding: data?.smsEncoding || "GSM-7",
        smsLength: data?.smsLength || 0,
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
        bad_message: "El mensaje debe tener entre 3 y 120 caracteres.",
        sms_too_long: "El SMS supera 1 part. Reduce el texto hasta que el preview marque 1 part.",
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
    <div className="cp-communicationStack">
      <SmsCreditsPanel partnerId={partnerId} />

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
                    {[customer.phone, customer.segment, customer.zipCode]
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
                className={`cp-pill cp-pill--segmentMetric ${
                  form.segments.length === COMMUNICATION_SEGMENTS.length ? "is-active" : ""
                }`}
                onClick={toggleAllSegments}
                type="button"
              >
                <span>Seleccionar todo</span>
                <strong>{segmentStats.total}</strong>
              </button>
              {COMMUNICATION_SEGMENTS.map((segment) => (
                <button
                  key={segment.key}
                  className={`cp-pill cp-pill--segmentMetric ${
                    form.segments.includes(segment.key) ? "is-active" : ""
                  }`}
                  onClick={() => toggleSegment(segment.key)}
                  type="button"
                >
                  <span>{segment.label}</span>
                  <strong>{segmentStats.counts?.[segment.key] || 0}</strong>
                  <small>{formatPercent(segmentStats.percent(segment.key))}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="cp-targetPanel">
            <div className="cp-field">
              <span>Tiendas</span>
              <div className="cp-pillRow">
                {!!territory.stores.length && (
                  <button
                    className={`cp-pill ${allStoresSelected ? "is-active" : ""}`}
                    onClick={toggleAllStores}
                    type="button"
                  >
                    {allStoresSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                  </button>
                )}
                {territory.stores.map((store) => (
                  <button
                    key={store.id}
                    className={`cp-pill ${
                      form.storeIds.some((item) => String(item) === String(store.id)) ? "is-active" : ""
                    }`}
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
          maxLength={120}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Escribe el mensaje para el cliente"
        />
      </label>
      <div className="cp-helper">
        {message.trim().length}/120 caracteres. Regla: maximo 1 part SMS.
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
        <div className="cp-kpiCard">
          <span>Partes por SMS</span>
          <strong>{preview.smsPartsPerRecipient}</strong>
        </div>
        <div className="cp-kpiCard">
          <span>Creditos estimados</span>
          <strong>{preview.estimatedCreditsRequired}</strong>
        </div>
        <div className="cp-kpiCard">
          <span>Codificacion</span>
          <strong>{preview.smsEncoding}</strong>
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
                  <td>{customer.segment || "-"}</td>
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
    </div>
  );
}
