import { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/GlobalManager.css";

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));
const formatMoney = (value, currency = "EUR") => {
  const parsed = Number(String(value || "0").replace(",", "."));
  return `${currency || "EUR"} ${Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00"}`;
};
const formatUnitPrice = (value, currency = "EUR") => {
  const parsed = Number(String(value || "0").replace(",", "."));
  return `${currency || "EUR"} ${Number.isFinite(parsed) ? parsed.toFixed(4) : "0.0000"}`;
};
const CUSTOM_PACKAGE_VALUE = "custom";
const parseAmountCents = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
};
const creditsFromAmount = (amount, sellPrice = 0.075) => {
  const cents = parseAmountCents(amount);
  const sellPriceUnits = Math.round(Number(sellPrice || 0.075) * 10000);
  if (cents == null || !sellPriceUnits) return null;
  return Math.floor((cents * 100) / sellPriceUnits);
};
const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};
const getLedgerSource = (entry) => {
  const source = entry?.meta?.source;
  if (source === "stripe_checkout") return "Stripe";
  if (source === "global_manager") return "Global Manager";
  if (source === "portal") return "Portal";
  return source || entry?.provider || "-";
};

export default function SmsCreditsModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [selectedPackageAmount, setSelectedPackageAmount] = useState("10");
  const [customPackageAmount, setCustomPackageAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPartner = useMemo(
    () => (data?.partners || []).find((partner) => String(partner.id) === String(selectedPartnerId)),
    [data, selectedPartnerId]
  );

  const packages = useMemo(() => data?.packages || [], [data]);
  const isCustomAmount = selectedPackageAmount === CUSTOM_PACKAGE_VALUE;
  const selectedPackage = useMemo(
    () => (isCustomAmount ? null : packages.find((item) => String(item.amount) === String(selectedPackageAmount)) || packages[0]),
    [isCustomAmount, packages, selectedPackageAmount]
  );
  const inventory = data?.providerInventory || {};
  const pricing = data?.pricing || {};
  const providerCostEur = pricing.providerCost || 0.062;
  const marginPerSms = pricing.marginPerSms ?? Number(pricing.sellPrice || 0) - Number(pricing.providerCost || 0);
  const customCredits = isCustomAmount ? creditsFromAmount(customPackageAmount, pricing.sellPrice) : null;
  const selectedRechargeAmount = isCustomAmount ? Number(parseAmountCents(customPackageAmount) || 0) / 100 : selectedPackage?.amount;
  const selectedRechargeCredits = isCustomAmount ? customCredits : selectedPackage?.credits;
  const canSellRecharge =
    inventory.availableToSell == null || !selectedRechargeCredits || selectedRechargeCredits <= inventory.availableToSell;
  const canSubmitRecharge = Boolean(
    selectedPartner && selectedRechargeAmount && selectedRechargeCredits && canSellRecharge
  );
  const inventoryWarning =
    inventory.availableToSell != null && inventory.availableToSell <= 0 && Number(inventory.committedMessages || 0) > 0;

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
      if (!selectedRechargeAmount || !selectedRechargeCredits) {
        setMessage("Indica un monto valido para la recarga.");
        return;
      }

      setSaving(true);
      const payload = {
        source: "global_manager",
      };

      if (isCustomAmount) {
        payload.amount = selectedRechargeAmount;
      } else {
        payload.packageAmount = selectedPackage?.amount || Number(selectedPackageAmount);
      }

      const response = await api.post(`/api/sms-credits/${selectedPartnerId}/recharge`, payload);
      setMessage(`Recarga registrada: ${formatNumber(response.data?.credits)} SMS cortos.`);
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
          <h2>Saldo de SMS cortos</h2>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </header>

      <div className="gm-smsStats">
        <article>
          <span>Bolsa Volta disponible</span>
          <strong>{inventory.availableToSell == null ? "--" : formatNumber(inventory.availableToSell)}</strong>
          <small>
            {!inventory.ok
              ? "Telnyx no disponible"
              : inventory.availableToSell == null
              ? "Inventario pendiente"
              : `${formatNumber(inventory.availableMessages)} Telnyx - ${formatNumber(inventory.committedMessages)} comprometidos / coste ${formatUnitPrice(providerCostEur, "EUR")}`}
          </small>
        </article>
        <article>
          <span>Comprometidos clientes</span>
          <strong>{formatNumber(data?.totals?.credits)}</strong>
          <small>SMS cortos pendientes de uso</small>
        </article>
        <article>
          <span>Margen por SMS corto</span>
          <strong>{formatUnitPrice(marginPerSms, "EUR")}</strong>
          <small>
            Venta {formatUnitPrice(pricing.sellPrice || 0.099, "EUR")} / coste {formatUnitPrice(pricing.providerCost || 0.062, "EUR")}
          </small>
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
          <strong>{formatNumber(pricing.messagesPer10Eur)}</strong>
          <small>SMS 1 part por 10 EUR al partner</small>
        </article>
      </div>

      {inventoryWarning && (
        <div className="gm-smsMessage">
          Inventario bloqueado: los SMS comprometidos a clientes superan el saldo real disponible en Telnyx.
        </div>
      )}

      <form className={`gm-smsRecharge ${isCustomAmount ? "is-custom" : ""}`} onSubmit={submit}>
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
                {item.amount} EUR
              </option>
            ))}
            <option value={CUSTOM_PACKAGE_VALUE}>Otro monto</option>
          </select>
        </label>
        {isCustomAmount && (
          <label className="gm-smsCustomAmount">
            <span>Monto EUR</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={customPackageAmount}
              onChange={(event) => setCustomPackageAmount(event.target.value)}
              placeholder="12.50"
            />
          </label>
        )}
        <div>
          <span>SMS cortos</span>
          <strong>{selectedRechargeCredits ? formatNumber(selectedRechargeCredits) : "-"}</strong>
        </div>
        <button type="submit" disabled={saving || !canSubmitRecharge}>
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
              <th>SMS cortos disponibles</th>
              <th>SMS cortos recargados</th>
              <th>SMS cortos consumidos</th>
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

      <section className="gm-smsTable">
        <h3>Movimientos</h3>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Partner</th>
              <th>Tipo</th>
              <th>SMS cortos</th>
              <th>Importe</th>
              <th>Origen</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            {(data?.ledger || []).map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.createdAt)}</td>
                <td>{entry.partner?.name || "-"}</td>
                <td>{entry.type}</td>
                <td>{formatNumber(entry.quantity)}</td>
                <td>{entry.amount == null ? "-" : formatMoney(entry.amount)}</td>
                <td>{getLedgerSource(entry)}</td>
                <td>{entry.reference || "-"}</td>
              </tr>
            ))}
            {!data?.ledger?.length && (
              <tr>
                <td colSpan="7">No hay movimientos todavia.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
