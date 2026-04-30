import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));

export default function SmsCreditsPanel({ partnerId }) {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const estimatedMessages = useMemo(() => {
    const parsedAmount = Number(String(amount).replace(",", "."));
    const sellPrice = Number(pricing?.sellPrice || 0.0008);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !sellPrice) return 0;
    return Math.floor(parsedAmount / sellPrice);
  }, [amount, pricing]);

  const loadBalance = useCallback(async () => {
    if (!partnerId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/api/sms-credits/${partnerId}`);
      setBalance(data?.balance || null);
      setPricing(data?.pricing || null);
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cargar el saldo de mensajes.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const submitRecharge = async (event) => {
    event.preventDefault();
    setMessage("");

    const parsedAmount = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMessage("Importe invalido.");
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post(`/api/sms-credits/${partnerId}/recharge`, {
        amount: parsedAmount,
        source: "offers_panel",
      });
      setBalance(data?.balance || null);
      setMessage(`Recarga registrada: ${formatNumber(data?.credits)} mensajes.`);
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo registrar la recarga.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cp-smsWallet">
      <div>
        <div className="cp-kicker">Mensajes</div>
        <h3>{loading ? "Cargando saldo..." : `${formatNumber(balance?.smsCredits)} disponibles`}</h3>
        <p>
          {formatNumber(balance?.smsConsumed)} usados · {formatNumber(balance?.smsRecharged)} recargados
        </p>
      </div>

      <form className="cp-smsRecharge" onSubmit={submitRecharge}>
        <label>
          <span>Recarga EUR</span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <strong>{formatNumber(estimatedMessages)} mensajes</strong>
        <button className="cp-primaryBtn" disabled={saving || !partnerId} type="submit">
          {saving ? "Recargando..." : "Recargar mensajes"}
        </button>
      </form>

      {message && <div className="cp-smsWalletMsg">{message}</div>}
    </section>
  );
}
