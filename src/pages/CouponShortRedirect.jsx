import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../setupAxios";

const localPathFromUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return value;
  } catch {
    return value;
  }
};

export default function CouponShortRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Preparando tu cupon...");

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      const normalizedCode = String(code || "").trim().toUpperCase();
      if (!normalizedCode) {
        setMessage("Cupon no valido.");
        return;
      }

      try {
        const { data } = await api.get(`/api/coupons/resolve-link/${encodeURIComponent(normalizedCode)}`);
        if (!active) return;

        const redeemUrl = data?.redeemUrl;
        if (!redeemUrl) {
          setMessage("No encontramos el enlace de canje.");
          return;
        }

        const target = localPathFromUrl(redeemUrl);
        if (/^https?:\/\//i.test(target)) {
          window.location.assign(target);
          return;
        }

        navigate(target, { replace: true });
      } catch {
        if (active) setMessage("No pudimos abrir este cupon.");
      }
    };

    resolve();

    return () => {
      active = false;
    };
  }, [code, navigate]);

  return (
    <main className="sf-page">
      <div className="sf-loading">{message}</div>
    </main>
  );
}
