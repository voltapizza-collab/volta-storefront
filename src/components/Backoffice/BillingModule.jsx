import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/BillingModule.css";

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const formatPercent = (value) =>
  new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

function BillingCard({ label, value, meta, tone = "" }) {
  return (
    <article className={`bi-card ${tone ? `bi-card--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {meta && <small>{meta}</small>}
    </article>
  );
}

export default function BillingModule({ partner }) {
  const partnerId = partner?.partnerId || partner?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cashoutAmount, setCashoutAmount] = useState("");

  const currency = data?.currency || "EUR";
  const policy = data?.policy || {};
  const balances = data?.balances || {};
  const invoice = data?.invoiceDraft || {};
  const instantQuote = data?.instantQuote || {};

  const customQuote = useMemo(() => {
    const amount = Number(cashoutAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const fee = Math.max(
      amount * Number(policy.instantFeeRate || 0),
      Number(policy.instantFeeMin || 0)
    );

    return {
      amount,
      fee,
      netAmount: Math.max(amount - fee, 0),
    };
  }, [cashoutAmount, policy.instantFeeMin, policy.instantFeeRate]);

  const load = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      setMessage("");
      const response = await api.get(`/api/billing/${partnerId}/summary`);
      setData(response.data || null);
      const suggested = Number(response.data?.instantQuote?.amount || 0);
      setCashoutAmount(suggested > 0 ? String(suggested.toFixed(2)) : "");
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "No se pudo cargar Billing.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const requestInvoice = async () => {
    try {
      await api.post(`/api/billing/${partnerId}/invoices/send`, {
        invoiceId: invoice.id,
      });
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Facturacion todavia no esta conectada."
      );
    }
  };

  const requestInstantCashout = async () => {
    try {
      await api.post(`/api/billing/${partnerId}/cashouts/instant`, {
        amount: Number(cashoutAmount || 0),
      });
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Cashout instantaneo todavia no esta conectado."
      );
    }
  };

  const requestStandardCashout = () => {
    setMessage(
      `Transferencia normal preparada: ${formatMoney(
        balances.standardAvailable,
        currency
      )} disponible bajo el flujo habitual T+${
        policy.standardDelayBusinessDays || 3
      } dias habiles. Falta conectar el ledger y el payout bancario.`
    );
  };

  return (
    <div className="bi-shell">
      <header className="bi-header">
        <div>
          <span>Billing</span>
          <h2>Saldo, facturas y cashout</h2>
          <p>
            Primer corte estructural. Los importes salen de ventas registradas;
            cashout real queda pendiente de Stripe Connect y ledger contable.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      {message && <div className="bi-message">{message}</div>}

      <section className="bi-grid">
        <BillingCard
          label="Saldo operativo"
          value={formatMoney(balances.operationalGross, currency)}
          meta="Ventas no canceladas registradas en Volta"
          tone="gross"
        />
        <BillingCard
          label="Saldo pagado"
          value={formatMoney(balances.paidBalance, currency)}
          meta="Base real para cashout cuando Stripe marque PAID"
        />
        <BillingCard
          label="Disponible normal"
          value={formatMoney(balances.standardAvailable, currency)}
          meta={`${policy.standardDelayBusinessDays || 3} dias habiles, sin coste extra`}
          tone="available"
        />
        <BillingCard
          label="Puente instantaneo"
          value={formatMoney(balances.instantBridgeable, currency)}
          meta={`Fee ${formatPercent(policy.instantFeeRate)} min ${formatMoney(policy.instantFeeMin, currency)}`}
          tone="instant"
        />
      </section>

      <section className="bi-cashoutLanes">
        <article className="bi-standardLane">
          <div className="bi-laneHead">
            <div>
              <span>Transferencia normal</span>
              <h3>Procedimiento habitual</h3>
            </div>
            <b>Sin coste extra</b>
          </div>

          <div className="bi-laneAmount">
            <span>Disponible por flujo normal</span>
            <strong>{formatMoney(balances.standardAvailable, currency)}</strong>
          </div>

          <ol className="bi-steps">
            <li>Volta consolida ventas pagadas y no canceladas.</li>
            <li>El saldo espera el plazo estándar de liquidacion bancaria.</li>
            <li>Se emite la orden de transferencia al IBAN configurado.</li>
            <li>La factura mensual queda asociada al periodo correspondiente.</li>
          </ol>

          <button
            className="bi-standardBtn"
            type="button"
            onClick={requestStandardCashout}
            disabled={Number(balances.standardAvailable || 0) <= 0}
          >
            Iniciar transferencia normal
          </button>
        </article>

        <article className="bi-instantLane">
          <div className="bi-instantGlow" />
          <div className="bi-laneHead bi-laneHead--instant">
            <div>
              <span>Cashout instantaneo</span>
              <h3>Turbo Cashout</h3>
            </div>
            <b>30 min aprox.</b>
          </div>

          <div className="bi-panelHead">
            <div>
              <span>Saldo puente</span>
              <h3>{formatMoney(balances.instantBridgeable, currency)}</h3>
            </div>
            <b>{policy.cashoutExecutionEnabled ? "Activo" : "Preparado"}</b>
          </div>

          <div className="bi-cashoutBox">
            <label>
              <span>Importe a retirar</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashoutAmount}
                onChange={(event) => setCashoutAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>

            <div className="bi-quote">
              <div>
                <span>Fee estimado</span>
                <strong>{formatMoney(customQuote?.fee || instantQuote.fee, currency)}</strong>
              </div>
              <div>
                <span>Neto recibido</span>
                <strong>
                  {formatMoney(customQuote?.netAmount || instantQuote.netAmount, currency)}
                </strong>
              </div>
            </div>

            <button
              className="bi-turboBtn"
              type="button"
              onClick={requestInstantCashout}
              disabled={!policy.cashoutExecutionEnabled}
            >
              Activar Turbo Cashout
            </button>
          </div>

          <div className="bi-policy">
            <div>
              <strong>Transferencia normal</strong>
              <span>Libre de coste extra, liquidacion estimada T+{policy.standardDelayBusinessDays || 3} dias habiles.</span>
            </div>
            <div>
              <strong>Cashout instantaneo</strong>
              <span>
                Coste Stripe {formatPercent(policy.stripeInstantCostRate)}, coste oportunidad {formatPercent(policy.opportunityCostRate)}, margen {formatPercent(policy.platformMarkupRate)}.
              </span>
            </div>
          </div>
        </article>
      </section>

      <div className="bi-mainGrid">
        <section className="bi-panel">
          <div className="bi-panelHead">
            <div>
              <span>Factura</span>
              <h3>Borrador mensual</h3>
            </div>
            <b>{invoice.status || "DRAFT"}</b>
          </div>

          <div className="bi-invoice">
            <div>
              <span>Periodo</span>
              <strong>
                {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
              </strong>
            </div>
            <div>
              <span>Ventas del mes</span>
              <strong>{formatMoney(invoice.grossSales, currency)}</strong>
            </div>
            <div>
              <span>Comision Volta</span>
              <strong>{formatMoney(invoice.platformFeeAmount, currency)}</strong>
            </div>
            <div>
              <span>Rate aplicado</span>
              <strong>{formatPercent(invoice.platformFeeRate)}</strong>
            </div>
          </div>

          <button
            className="bi-secondaryBtn"
            type="button"
            onClick={requestInvoice}
            disabled={!policy.invoicesEnabled}
          >
            Enviar factura
          </button>
        </section>
      </div>

      <div className="bi-mainGrid">
        <section className="bi-panel">
          <div className="bi-panelHead">
            <div>
              <span>Tiendas</span>
              <h3>Base de saldo</h3>
            </div>
          </div>
          <div className="bi-tableWrap">
            <table className="bi-table">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Ordenes</th>
                  <th>Bruto</th>
                  <th>Pagado</th>
                </tr>
              </thead>
              <tbody>
                {(data?.stores || []).map((store) => (
                  <tr key={store.storeId}>
                    <td>{store.storeName}</td>
                    <td>{store.orders}</td>
                    <td>{formatMoney(store.gross, currency)}</td>
                    <td>{formatMoney(store.paid, currency)}</td>
                  </tr>
                ))}
                {!data?.stores?.length && (
                  <tr>
                    <td colSpan="4">Sin ventas para mostrar.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bi-panel">
          <div className="bi-panelHead">
            <div>
              <span>Movimientos</span>
              <h3>Ventas recientes</h3>
            </div>
          </div>
          <div className="bi-salesList">
            {(data?.recentSales || []).map((sale) => (
              <div key={sale.id} className="bi-saleRow">
                <span>
                  <strong>{sale.code}</strong>
                  <small>{sale.storeName} · {formatDate(sale.date)}</small>
                </span>
                <b>{formatMoney(sale.total, sale.currency || currency)}</b>
                <em>{sale.status}</em>
              </div>
            ))}
            {!data?.recentSales?.length && (
              <div className="bi-empty">Sin movimientos todavia.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
