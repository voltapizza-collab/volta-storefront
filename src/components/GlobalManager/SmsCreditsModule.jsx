import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/GlobalManager.css";

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));
const formatMoney = (value, currency = "EUR") => {
  const parsed = Number(String(value || "0").replace(",", "."));
  return `${currency || "EUR"} ${Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00"}`;
};

export default function SmsCreditsModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [selectedPackageAmount, setSelectedPackageAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPartner = useMemo(
    () => (data?.partners || []).find((partner) => String(partner.id) === String(selectedPartnerId)),
    [data, selectedPartnerId]
  );

  const packages = useMemo(() => data?.packages || [], [data]);
  const selectedPackage = useMemo(
    () => packages.find((item) => String(item.amount) === String(selectedPackageAmount)) || packages[0],
    [packages, selectedPackageAmount]
  );
  const inventory = data?.providerInventory || {};
  const canSellSelectedPackage =
    inventory.availableToSell == null || !selectedPackage || selectedPackage.credits <= inventory.availableToSell;

  const load = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/sms-credits/global/summary");
      setData(response.data || null);
      const partners = response.data?.partners || [];
      const nextPackages = response.data?.packages || [];
      setSelectedPartnerId((current) => current || (partners[0] ? String(partners[0].id) : ""));
      setSelectedPackageAmount((current) => current || (nextPackages[0] ? String(nextPackages[0].amount) : "10"));
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
        packageAmount: selectedPackage?.amount || Number(selectedPackageAmount),
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
          <span>Bolsa Volta Telnyx</span>
          <strong>{inventory.ok ? formatNumber(inventory.availableMessages) : "--"}</strong>
          <small>{inventory.ok ? formatMoney(inventory.availableCredit, inventory.currency) : "Telnyx no disponible"}</small>
        </article>
        <article>
          <span>Libres para vender</span>
          <strong>{inventory.availableToSell == null ? "--" : formatNumber(inventory.availableToSell)}</strong>
          <small>Coste {Number(data?.pricing?.providerCost || 0.0004).toFixed(4)} EUR</small>
        </article>
        <article>
          <span>Comprometidos clientes</span>
          <strong>{formatNumber(data?.totals?.credits)}</strong>
          <small>Saldo pendiente de uso</small>
        </article>
        <article>
          <span>Margen por mensaje</span>
          <strong>EUR {(Number(data?.pricing?.sellPrice || 0) - Number(data?.pricing?.providerCost || 0)).toFixed(4)}</strong>
          <small>Venta {Number(data?.pricing?.sellPrice || 0.0008).toFixed(4)} EUR</small>
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
        <article>
          <span>Paquete base</span>
          <strong>{formatNumber(data?.pricing?.messagesPer10Eur)}</strong>
          <small>10 EUR</small>
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
          <span>Paquete</span>
          <select value={selectedPackageAmount} onChange={(event) => setSelectedPackageAmount(event.target.value)}>
            {packages.map((item) => (
              <option key={item.amount} value={item.amount} disabled={inventory.availableToSell != null && item.credits > inventory.availableToSell}>
                {item.amount} EUR - {formatNumber(item.credits)} mensajes
              </option>
            ))}
          </select>
        </label>
        <div>
          <span>Mensajes</span>
          <strong>{formatNumber(selectedPackage?.credits)}</strong>
        </div>
        <button type="submit" disabled={saving || !selectedPartner || !selectedPackage || !canSellSelectedPackage}>
          {saving ? "Asignando..." : "Asignar paquete"}
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
