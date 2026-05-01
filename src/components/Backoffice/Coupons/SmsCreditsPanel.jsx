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

  const submitRecharge = (event) => {
    event.preventDefault();
    setMessage("Pago online pendiente de activar.");
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
        <button className="cp-primaryBtn" disabled={!partnerId || !selectedPackage} type="submit">
          Solicitar paquete
        </button>
      </form>

      {message && <div className="cp-smsWalletMsg">{message}</div>}
    </section>
  );
}
