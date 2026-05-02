import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));

export default function SmsCreditsPanel({ partnerId }) {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPackageAmount, setSelectedPackageAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  const selectedPackage = useMemo(
    () => packages.find((item) => String(item.amount) === String(selectedPackageAmount)) || packages[0],
    [packages, selectedPackageAmount]
  );

  const loadBalance = useCallback(async () => {
    if (!partnerId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/api/sms-credits/${partnerId}`);
      setBalance(data?.balance || null);
      setPackages(data?.packages || []);
      setSelectedPackageAmount((current) => current || (data?.packages?.[0] ? String(data.packages[0].amount) : "10"));
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("sms_payment");

    if (status === "success") {
      setMessage("Pago recibido. El saldo se actualiza al confirmarse el webhook de Stripe.");
      loadBalance();
    }

    if (status === "cancel") {
      setMessage("Compra cancelada. No se cargo ningun paquete.");
    }
  }, [loadBalance]);

  const buildReturnUrl = (status) => {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return status === "success"
      ? `${baseUrl}?sms_payment=success&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}?sms_payment=cancel`;
  };

  const submitRecharge = async (event) => {
    event.preventDefault();
    if (!partnerId || !selectedPackage) return;

    try {
      setPurchasing(true);
      setMessage("");
      const { data } = await api.post(`/api/sms-credits/${partnerId}/checkout-session`, {
        packageAmount: selectedPackage.amount,
        successUrl: buildReturnUrl("success"),
        cancelUrl: buildReturnUrl("cancel"),
      });

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setMessage("No se pudo abrir el pago de Stripe.");
    } catch (error) {
      console.error(error);
      const errorCode = error.response?.data?.error;
      const messages = {
        stripe_not_configured: "Stripe no esta configurado en el backend.",
        insufficient_volta_sms_inventory: "No hay suficientes mensajes disponibles para vender este paquete.",
        bad_recharge_amount: "Paquete invalido.",
      };
      setMessage(messages[errorCode] || "No se pudo iniciar la compra.");
    } finally {
      setPurchasing(false);
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
          <span>Paquete</span>
          <select value={selectedPackageAmount} onChange={(event) => setSelectedPackageAmount(event.target.value)}>
            {packages.map((item) => (
              <option key={item.amount} value={item.amount}>
                {item.amount} EUR
              </option>
            ))}
          </select>
        </label>
        <strong>{formatNumber(selectedPackage?.credits)} mensajes</strong>
        <button className="cp-primaryBtn" disabled={!partnerId || !selectedPackage || purchasing} type="submit">
          {purchasing ? "Abriendo pago..." : "Comprar"}
        </button>
      </form>

      {message && <div className="cp-smsWalletMsg">{message}</div>}
    </section>
  );
}
