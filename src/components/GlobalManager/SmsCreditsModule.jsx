import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/GlobalManager.css";

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));

export default function SmsCreditsModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPartner = useMemo(
    () => (data?.partners || []).find((partner) => String(partner.id) === String(selectedPartnerId)),
    [data, selectedPartnerId]
  );

  const estimatedMessages = useMemo(() => {
    const parsedAmount = Number(String(amount).replace(",", "."));
    const sellPrice = Number(data?.pricing?.sellPrice || 0.0008);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !sellPrice) return 0;
    return Math.floor(parsedAmount / sellPrice);
  }, [amount, data]);

  const load = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/sms-credits/global/summary");
      setData(response.data || null);
      const partners = response.data?.partners || [];
      setSelectedPartnerId((current) => current || (partners[0] ? String(partners[0].id) : ""));
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cargar creditos SMS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!selectedPartnerId) {
      setMessage("Selecciona un partner.");
      return;
    }

    try {
      setSaving(true);
      const response = await api.post(`/api/sms-credits/${selectedPartnerId}/recharge`, {
        amount: Number(String(amount).replace(",", ".")),
        source: "global_manager",
      });
      setMessage(`Recarga registrada: ${formatNumber(response.data?.credits)} mensajes.`);
      await load();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo registrar la recarga.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gm-smsModule">
      <header className="gm-moduleHeader">
        <div>
          <span>SMS credits</span>
          <h2>Saldo de mensajes</h2>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </header>

      <div className="gm-smsStats">
        <article>
          <span>Disponibles clientes</span>
          <strong>{formatNumber(data?.totals?.credits)}</strong>
        </article>
        <article>
          <span>Vendidos</span>
          <strong>{formatNumber(data?.totals?.recharged)}</strong>
        </article>
        <article>
          <span>Consumidos</span>
          <strong>{formatNumber(data?.totals?.consumed)}</strong>
        </article>
        <article>
          <span>Margen estimado</span>
          <strong>EUR {(Number(data?.estimatedMarginEur || 0)).toFixed(4)}</strong>
        </article>
      </div>

      <form className="gm-smsRecharge" onSubmit={submit}>
        <label>
          <span>Partner</span>
          <select value={selectedPartnerId} onChange={(event) => setSelectedPartnerId(event.target.value)}>
            {(data?.partners || []).map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Importe EUR</span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <div>
          <span>Mensajes</span>
          <strong>{formatNumber(estimatedMessages)}</strong>
        </div>
        <button type="submit" disabled={saving || !selectedPartner}>
          {saving ? "Registrando..." : "Registrar recarga"}
        </button>
      </form>

      {message && <div className="gm-smsMessage">{message}</div>}

      <section className="gm-smsTable">
        <h3>Partners</h3>
        <table>
          <thead>
            <tr>
              <th>Partner</th>
              <th>Disponibles</th>
              <th>Vendidos</th>
              <th>Consumidos</th>
            </tr>
          </thead>
          <tbody>
            {(data?.partners || []).map((partner) => (
              <tr key={partner.id} className={partner.isLow ? "is-low" : ""}>
                <td>{partner.name}</td>
                <td>{formatNumber(partner.smsCredits)}</td>
                <td>{formatNumber(partner.smsRecharged)}</td>
                <td>{formatNumber(partner.smsConsumed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
