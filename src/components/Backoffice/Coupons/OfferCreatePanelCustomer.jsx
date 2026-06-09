import { useMemo, useState } from "react";
import api from "../../../setupAxios";

const TYPE_LABELS = {
  RANDOM_PERCENT: "Random (%)",
  FIXED_PERCENT: "% fijo",
  FIXED_AMOUNT: "€ fijo",
};

const pad2 = (value) => String(value).padStart(2, "0");

const toDatetimeLocalValue = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const defaultExpiresAt = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(date);
};

export default function OfferCreatePanelCustomer({ partnerId, customer, onDone, onClose }) {
  const [form, setForm] = useState({
    type: "RANDOM_PERCENT",
    percentMin: 5,
    percentMax: 15,
    percent: 10,
    amount: 5,
    minAmount: "",
    maxAmount: "",
    expiresAt: defaultExpiresAt(),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isRandom = useMemo(() => form.type === "RANDOM_PERCENT", [form.type]);
  const isFixedPercent = useMemo(() => form.type === "FIXED_PERCENT", [form.type]);
  const isFixedAmount = useMemo(() => form.type === "FIXED_AMOUNT", [form.type]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!partnerId) return "Partner inválido.";
    if (!customer?.id) return "Cliente inválido.";
    if (!form.expiresAt) return "Debes indicar fecha/hora de caducidad.";
    const expiresAt = new Date(form.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) return "Fecha de caducidad invalida.";
    if (expiresAt <= new Date()) return "La caducidad debe ser futura.";

    if (isRandom) {
      const min = Number(form.percentMin);
      const max = Number(form.percentMax);
      if (min < 1 || max > 90 || max < min) return "Rango % inválido.";
    }

    if (isFixedPercent) {
      const percent = Number(form.percent);
      if (percent < 1 || percent > 90) return "% fijo inválido.";
    }

    if (isFixedAmount) {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) return "Importe fijo inválido.";
    }

    if (form.minAmount !== "") {
      const minAmount = Number(form.minAmount);
      if (!Number.isFinite(minAmount) || minAmount < 0) return "Tope mínimo inválido.";
    }

    if ((isRandom || isFixedPercent) && form.maxAmount !== "") {
      const maxAmount = Number(form.maxAmount);
      if (!Number.isFinite(maxAmount) || maxAmount <= 0) return "Tope máximo inválido.";
    }

    return null;
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    const error = validate();
    if (error) {
      setMessage(error);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        partnerId,
        customerId: customer.id,
        type: form.type,
        expiresAt: form.expiresAt,
        ...(isRandom && {
          percentMin: Number(form.percentMin),
          percentMax: Number(form.percentMax),
        }),
        ...(isFixedPercent && {
          percent: Number(form.percent),
        }),
        ...(isFixedAmount && {
          amount: Number(form.amount),
        }),
        ...(form.minAmount !== "" ? { minAmount: Number(form.minAmount) } : {}),
        ...(form.maxAmount !== "" ? { maxAmount: Number(form.maxAmount) } : {}),
      };

      const { data } = await api.post("/api/coupons/push-customer", payload);
      const delivery = data?.delivery;
      const deliveryError =
        delivery?.error && typeof delivery.error === "object"
          ? delivery.error.detail || delivery.error.title
          : delivery?.error;
      const deliveryText = delivery?.sent
        ? " SMS enviado."
        : ` SMS no enviado${deliveryError ? `: ${deliveryError}` : "."}`;
      setMessage(`Cupon ${data?.coupon?.code || ""} creado.${deliveryText}`);
      if (delivery?.sent) {
        window.setTimeout(() => {
          onDone?.();
        }, 1200);
      }
    } catch (requestError) {
      console.error(requestError);
      const errorCode = requestError.response?.data?.error;
      const errorMessages = {
        invalid_recipient_phone: "El telefono del cliente no es valido para SMS. Corrige el numero antes de crear el boost.",
        insufficient_sms_credits: `Saldo de SMS insuficiente. Disponibles: ${requestError.response?.data?.balance || 0}.`,
      };
      setMessage(errorMessages[errorCode] || errorCode || "No se pudo crear el cupón.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cu-modalBack" onMouseDown={onClose}>
      <div className="cu-modalCard" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cu-modalHead">
          <div>
            <div className="cu-kicker">Boost</div>
            <h3>Crear cupón individual</h3>
          </div>

          <button className="cu-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </div>

        <div className="cu-boostMeta">
          <strong>{customer?.name || "Cliente sin nombre"}</strong>
          <span>{customer?.phone || customer?.address_1 || `#${customer?.id}`}</span>
        </div>

        <form className="cu-formGrid" onSubmit={submit}>
          <label className="cu-field">
            <span>Tipo de cupón</span>
            <select
              className="cu-select"
              value={form.type}
              onChange={(event) => updateForm("type", event.target.value)}
            >
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="cu-field">
            <span>Vence</span>
            <input
              type="datetime-local"
              required
              value={form.expiresAt}
              onChange={(event) => updateForm("expiresAt", event.target.value)}
            />
          </label>

          {isRandom && (
            <>
              <label className="cu-field">
                <span>% Min</span>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={form.percentMin}
                  onChange={(event) => updateForm("percentMin", event.target.value)}
                />
              </label>

              <label className="cu-field">
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

          {isFixedPercent && (
            <label className="cu-field">
              <span>% fijo</span>
              <input
                type="number"
                min="1"
                max="90"
                value={form.percent}
                onChange={(event) => updateForm("percent", event.target.value)}
              />
            </label>
          )}

          {isFixedAmount && (
            <label className="cu-field">
              <span>€ fijo</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
              />
            </label>
          )}

          <label className="cu-field">
            <span>Tope mínimo</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.minAmount}
              onChange={(event) => updateForm("minAmount", event.target.value)}
            />
          </label>

          {(isRandom || isFixedPercent) && (
            <label className="cu-field">
              <span>Tope máximo</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maxAmount}
                onChange={(event) => updateForm("maxAmount", event.target.value)}
              />
            </label>
          )}

          <div className="cu-modalActions cu-field-wide">
            <span className="cu-boostHint">El cupon se enviara por SMS al crear el boost.</span>
            <div className="cu-actionsRight">
              <button className="cu-btn cu-btn-ghost" onClick={onClose} type="button">
                Cancel
              </button>
              <button className="cu-btn cu-btn-primary" disabled={saving} type="submit">
                {saving ? "Enviando..." : "Crear y enviar"}
              </button>
            </div>
          </div>
        </form>

        {message && <div className="cu-error cu-boostFeedback">{message}</div>}
      </div>
    </div>
  );
}
