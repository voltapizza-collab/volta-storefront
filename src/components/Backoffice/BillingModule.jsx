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

const buildCsv = (rows) => {
  const headers = ["Referencia", "Tipo", "Fecha", "Importe", "Estado"];
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  return [
    headers.map(escapeCell).join(","),
    ...rows.map((row) =>
      [
        row.reference,
        row.type,
        row.dateLabel,
        row.amountLabel,
        row.status,
      ].map(escapeCell).join(",")
    ),
  ].join("\n");
};

const exportCsv = (rows, filename) => {
  const blob = new Blob([buildCsv(rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function BillingModule({ partner }) {
  const partnerId = partner?.partnerId || partner?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cashoutAmount, setCashoutAmount] = useState("");
  const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false);

  const currency = data?.currency || "EUR";
  const policy = data?.policy || {};
  const balances = data?.balances || {};
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

  useEffect(() => {
    if (!isCashoutModalOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsCashoutModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isCashoutModalOpen]);

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
          <span>Finance</span>
          <h2>Saldo, transferencias y cashout</h2>
          <p>
            Saldo operativo, transferencias y cashout. Las facturas viven ahora
            en el submodulo Billing.
          </p>
        </div>
        <div className="bi-headerActions">
          <button
            className="bi-cashoutTrigger"
            type="button"
            onClick={() => setIsCashoutModalOpen(true)}
          >
            Turbo Cashout
          </button>
          <button type="button" onClick={load} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
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
      </section>

      {isCashoutModalOpen && (
        <div
          className="bi-modalOverlay"
          role="presentation"
          onMouseDown={() => setIsCashoutModalOpen(false)}
        >
          <article
            className="bi-instantLane bi-instantModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bi-cashout-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="bi-instantGlow" />
            <div className="bi-laneHead bi-laneHead--instant">
              <div>
                <span>Cashout instantaneo</span>
                <h3 id="bi-cashout-title">Turbo Cashout</h3>
              </div>
              <div className="bi-modalTopActions">
                <b>30 min aprox.</b>
                <button
                  type="button"
                  className="bi-modalClose"
                  aria-label="Cerrar cashout"
                  onClick={() => setIsCashoutModalOpen(false)}
                >
                  x
                </button>
              </div>
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
        </div>
      )}

      <div className="bi-mainGrid bi-mainGrid--single">
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

      </div>
    </div>
  );
}

export function FinanceBillingModule({ partner }) {
  const partnerId = partner?.partnerId || partner?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState("all");

  const currency = data?.currency || "EUR";
  const balances = data?.balances || {};
  const invoice = useMemo(() => data?.invoiceDraft || {}, [data?.invoiceDraft]);

  const load = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      setMessage("");
      const response = await api.get(`/api/billing/${partnerId}/summary`);
      setData(response.data || null);
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

  const rows = useMemo(() => {
    const invoiceDate = invoice.periodEnd || invoice.periodStart || new Date().toISOString();
    const invoiceReference = invoice.id || `VOLTA-${partnerId || "PARTNER"}-${formatDate(invoiceDate)}`;
    const invoiceRows = [
      {
        id: `invoice-${invoiceReference}`,
        category: "invoices",
        reference: invoiceReference,
        type: "Factura mensual Volta",
        date: invoiceDate,
        dateLabel: formatDate(invoiceDate),
        amount: Number(invoice.platformFeeAmount || 0),
        amountLabel: formatMoney(invoice.platformFeeAmount, currency),
        status: invoice.status || "DRAFT",
      },
    ];

    const receivedRows = (data?.recentSales || []).map((sale) => ({
      id: `sale-${sale.id}`,
      category: "received",
      reference: sale.code || sale.id,
      type: `Pago recibido${sale.storeName ? ` - ${sale.storeName}` : ""}`,
      date: sale.date,
      dateLabel: formatDate(sale.date),
      amount: Number(sale.total || 0),
      amountLabel: formatMoney(sale.total, sale.currency || currency),
      status: sale.status || "REGISTRADO",
    }));

    const payoutRows = [
      {
        id: "payout-standard",
        category: "paid",
        reference: `PAYOUT-NORMAL-${partnerId || "PARTNER"}`,
        type: "Payout normal disponible",
        date: new Date().toISOString(),
        dateLabel: formatDate(new Date().toISOString()),
        amount: Number(balances.standardAvailable || 0),
        amountLabel: formatMoney(balances.standardAvailable, currency),
        status: "PREPARADO",
      },
      {
        id: "payout-instant",
        category: "paid",
        reference: `PAYOUT-TURBO-${partnerId || "PARTNER"}`,
        type: "Turbo Cashout disponible",
        date: new Date().toISOString(),
        dateLabel: formatDate(new Date().toISOString()),
        amount: Number(balances.instantBridgeable || 0),
        amountLabel: formatMoney(balances.instantBridgeable, currency),
        status: "PREPARADO",
      },
    ].filter((row) => row.amount > 0);

    return [...invoiceRows, ...receivedRows, ...payoutRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [balances.instantBridgeable, balances.standardAvailable, currency, data?.recentSales, invoice, partnerId]);

  const filteredRows = rows.filter((row) => view === "all" || row.category === view);
  const periodLabel = `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`;

  const requestInvoice = async () => {
    try {
      await api.post(`/api/billing/${partnerId}/invoices/send`, {
        invoiceId: invoice.id,
      });
      setMessage("Factura enviada o preparada para envio.");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Facturacion todavia no esta conectada."
      );
    }
  };

  return (
    <div className="bi-shell bi-ledgerShell">
      <header className="bi-ledgerHeader">
        <div>
          <h2>Facturas</h2>
          <p>
            Consulta facturas, pagos recibidos y pagos realizados. Filtra la
            tabla o exporta resumenes en CSV.
          </p>
        </div>
        <button
          className="bi-ledgerExport"
          type="button"
          onClick={() => exportCsv(filteredRows, "volta-finance-resumen.csv")}
          disabled={!filteredRows.length}
        >
          CSV en lote
        </button>
      </header>

      {message && <div className="bi-message">{message}</div>}

      <div className="bi-ledgerFilters">
        <button type="button">{partner?.partnerName || "Establecimiento"}</button>
        <button type="button">{periodLabel}</button>
        <button
          className={view === "all" ? "is-active" : ""}
          type="button"
          onClick={() => setView("all")}
        >
          Todo
        </button>
        <button
          className={view === "invoices" ? "is-active" : ""}
          type="button"
          onClick={() => setView("invoices")}
        >
          Facturas
        </button>
        <button
          className={view === "received" ? "is-active" : ""}
          type="button"
          onClick={() => setView("received")}
        >
          Recibidos
        </button>
        <button
          className={view === "paid" ? "is-active" : ""}
          type="button"
          onClick={() => setView("paid")}
        >
          Realizados
        </button>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <section className="bi-ledgerStats">
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
      </section>

      <section className="bi-ledgerTableWrap">
        <table className="bi-ledgerTable">
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Importe</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{row.reference}</td>
                <td>{row.type}</td>
                <td>{row.dateLabel}</td>
                <td>{row.amountLabel}</td>
                <td>{row.status}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => exportCsv([row], `${row.reference}.csv`)}
                  >
                    Exportar
                  </button>
                </td>
              </tr>
            ))}
            {!filteredRows.length && (
              <tr>
                <td colSpan="6">Sin registros para este filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <button
        className="bi-secondaryBtn bi-ledgerInvoiceBtn"
        type="button"
        onClick={requestInvoice}
        disabled={!data?.policy?.invoicesEnabled}
      >
        Enviar factura mensual
      </button>
    </div>
  );
}
