import { useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";
import { COUPON_SEGMENTS, COUPON_TYPES } from "../../../constants/coupons";

const WEEK_DAYS = [
  { value: "lunes", label: "Lun" },
  { value: "martes", label: "Mar" },
  { value: "miercoles", label: "Mie" },
  { value: "jueves", label: "Jue" },
  { value: "viernes", label: "Vie" },
  { value: "sabado", label: "Sab" },
  { value: "domingo", label: "Dom" },
];

const timeToMinutes = (value) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export default function OfferCreatePanel({ partnerId }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sample, setSample] = useState([]);
  const [form, setForm] = useState({
    type: "RANDOM_PERCENT",
    isVisible: true,
    quantity: 25,
    percentMin: 5,
    percentMax: 15,
    percent: 10,
    amount: 5,
    minAmount: "",
    maxAmount: "",
    segments: [],
    activeFrom: "",
    expiresAt: "",
    isTemporal: false,
    daysActive: [],
    windowStart: "",
    windowEnd: "",
    notes: "",
  });

  const type = useMemo(() => form.type, [form.type]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSegment = (segment) => {
    setForm((prev) => ({
      ...prev,
      segments: prev.segments.includes(segment)
        ? prev.segments.filter((item) => item !== segment)
        : [...prev.segments, segment],
    }));
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      daysActive: prev.daysActive.includes(day)
        ? prev.daysActive.filter((item) => item !== day)
        : [...prev.daysActive, day],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSample([]);

    try {
      const payload = {
        partnerId,
        type: form.type,
        quantity: form.isVisible ? Number(form.quantity) : 1,
        usageLimit: 1,
        isVisible: form.isVisible,
        visibility: form.isVisible ? "PUBLIC" : "RESERVED",
        segments: form.segments,
        notes: form.notes,
        ...(form.minAmount ? { minAmount: Number(form.minAmount) } : {}),
        ...(type === "RANDOM_PERCENT" && {
          percentMin: Number(form.percentMin),
          percentMax: Number(form.percentMax),
        }),
        ...(type === "FIXED_PERCENT" && { percent: Number(form.percent) }),
        ...(type === "FIXED_AMOUNT" && { amount: Number(form.amount) }),
        ...(form.maxAmount ? { maxAmount: Number(form.maxAmount) } : {}),
        ...(form.activeFrom ? { activeFrom: form.activeFrom } : {}),
        ...(form.expiresAt ? { expiresAt: form.expiresAt } : {}),
        ...(form.isTemporal
          ? {
              daysActive: form.daysActive,
              windowStart: timeToMinutes(form.windowStart),
              windowEnd: timeToMinutes(form.windowEnd),
            }
          : {}),
      };

      const { data } = await api.post("/api/coupons/bulk-generate", payload);
      setMessage(
        form.isVisible
          ? `Se crearon ${data?.created || 0} cupones visibles en gallery.`
          : `Se asignaron ${data?.created || 0} cupones privados al grupo filtrado (${data?.recipients || 0} clientes).`
      );
      setSample(Array.isArray(data?.sample) ? data.sample : []);
    } catch (requestError) {
      console.error(requestError);
      setMessage(requestError.response?.data?.error || "No se pudo crear la oferta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="cp-card cp-form" onSubmit={submit}>
      <div className="cp-kicker">Create</div>
      <h3>{form.isVisible ? "Generar cupones publicos" : "Generar cupones privados"}</h3>

      <label className="cp-checkRow">
        <input
          checked={form.isVisible}
          onChange={(event) => updateForm("isVisible", event.target.checked)}
          type="checkbox"
        />
        isVisible
      </label>

      <div className="cp-helper">
        {form.isVisible
          ? "Visible: el cupón se publica en CouponGallery."
          : "No visible: el cupón se reserva y se asigna a clientes del grupo filtrado."}
      </div>

      <div className="cp-formGrid">
        <label className="cp-field">
          <span>Tipo</span>
          <select value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
            {COUPON_TYPES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {form.isVisible ? (
          <label className="cp-field">
            <span>Cantidad</span>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(event) => updateForm("quantity", event.target.value)}
            />
          </label>
        ) : (
          <div className="cp-field">
            <span>Destino privado</span>
            <div className="cp-helper">
              Se crea 1 cupón por cliente del grupo definido por segmentos y temperatura.
            </div>
          </div>
        )}

        {type === "RANDOM_PERCENT" && (
          <>
            <label className="cp-field">
              <span>% Min</span>
              <input
                type="number"
                min="1"
                max="90"
                value={form.percentMin}
                onChange={(event) => updateForm("percentMin", event.target.value)}
              />
            </label>
            <label className="cp-field">
              <span>% Max</span>
              <input
                type="number"
                min="1"
                max="90"
                value={form.percentMax}
                onChange={(event) => updateForm("percentMax", event.target.value)}
              />
            </label>
          </>
        )}

        {type === "FIXED_PERCENT" && (
          <label className="cp-field">
            <span>% Fijo</span>
            <input
              type="number"
              min="1"
              max="90"
              value={form.percent}
              onChange={(event) => updateForm("percent", event.target.value)}
            />
          </label>
        )}

        {type === "FIXED_AMOUNT" && (
          <label className="cp-field">
            <span>Importe</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
            />
          </label>
        )}

        <label className="cp-field">
          <span>Tope minimo</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.minAmount}
            onChange={(event) => updateForm("minAmount", event.target.value)}
          />
        </label>

        {(type === "RANDOM_PERCENT" || type === "FIXED_PERCENT") && (
          <label className="cp-field">
            <span>Tope maximo</span>
            <input value={form.maxAmount} onChange={(event) => updateForm("maxAmount", event.target.value)} />
          </label>
        )}

        <label className="cp-field">
          <span>Activo desde</span>
          <input
            type="datetime-local"
            value={form.activeFrom}
            onChange={(event) => updateForm("activeFrom", event.target.value)}
          />
        </label>

        <label className="cp-field">
          <span>Vence</span>
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(event) => updateForm("expiresAt", event.target.value)}
          />
        </label>
      </div>

      <div className="cp-field">
        <span>Segmentos</span>
        <div className="cp-pillRow">
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
        <div className="cp-helper">Ahora puedes mezclar segmentos S1-S5 con estado Hot/Cold.</div>
      </div>

      <label className="cp-checkRow">
        <input
          checked={form.isTemporal}
          onChange={(event) => updateForm("isTemporal", event.target.checked)}
          type="checkbox"
        />
        Limitar por dias y horas
      </label>

      {form.isTemporal && (
        <>
          <div className="cp-pillRow">
            {WEEK_DAYS.map((day) => (
              <button
                key={day.value}
                className={`cp-pill ${form.daysActive.includes(day.value) ? "is-active" : ""}`}
                onClick={() => toggleDay(day.value)}
                type="button"
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="cp-formGrid">
            <label className="cp-field">
              <span>Inicio</span>
              <input
                type="time"
                value={form.windowStart}
                onChange={(event) => updateForm("windowStart", event.target.value)}
              />
            </label>
            <label className="cp-field">
              <span>Fin</span>
              <input
                type="time"
                value={form.windowEnd}
                onChange={(event) => updateForm("windowEnd", event.target.value)}
              />
            </label>
          </div>
        </>
      )}

      <label className="cp-field">
        <span>Notas</span>
        <textarea
          rows="3"
          value={form.notes}
          onChange={(event) => updateForm("notes", event.target.value)}
        />
      </label>

      <div className="cp-actions">
        <button className="cp-primaryBtn" disabled={saving} type="submit">
          {saving ? "Generando..." : "Generar cupones"}
        </button>
      </div>

      {message && <div className="cp-feedback">{message}</div>}
      {!!sample.length && <div className="cp-sample">Ejemplos: {sample.join(", ")}</div>}
    </form>
  );
}
