import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../setupAxios";
import { ClaimModal } from "../components/CouponGallery/CouponGallery";
import PartnerLogo from "../components/PartnerLogo";

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

const claimConfirmation = ({ delivery = {}, recovered }) => {
  if (['failed', 'skipped'].includes(delivery.status)) return {
    title: 'No se pudo enviar el SMS',
    text: 'Tu beneficio está guardado. Contacta con la pizzería para revisar el envío.',
  };
  if (delivery.sent && (delivery.sentNow === false || (delivery.sentNow == null && recovered))) return {
    title: delivery.status === 'delivered' ? 'Ya te enviamos tu envío gratis' : 'Tu envío gratis ya está solicitado',
    text: delivery.status === 'delivered'
      ? 'Busca el SMS de VOLTAPIZZA y usa tu cupón antes de que caduque. Esta campaña permite un solo beneficio por teléfono, aunque ya lo hayas gastado. No hemos enviado otro SMS. Si no lo encuentras, contacta con la pizzería.'
      : 'El SMS de tu solicitud anterior sigue en proceso de entrega. Esta campaña permite un solo beneficio por teléfono. No hemos enviado otro SMS. Si no lo recibes, contacta con la pizzería.',
  };
  if (delivery.status === 'delivered') return {
    title: 'Revisa tus mensajes',
    text: 'El proveedor confirmó la entrega de tu SMS. Busca el mensaje de VOLTAPIZZA y guarda el cupón para usarlo dentro de su validez.',
  };
  if (delivery.sent) return {
    title: 'SMS en camino',
    text: 'Hemos enviado tu solicitud al servicio de SMS. Cuando llegue el mensaje de VOLTAPIZZA, guarda el cupón para tu próximo pedido. Si no lo recibes, contacta con la pizzería.',
  };
  return {
    title: 'Solicitud registrada',
    text: 'Todavía no tenemos confirmación del envío del SMS. No necesitas repetir la solicitud. Si no lo recibes, contacta con la pizzería.',
  };
};

export default function CouponShortRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Preparando tu cupon...");
  const [campaign, setCampaign] = useState(null);
  const [claimOpen, setClaimOpen] = useState(true);
  const [claimResult, setClaimResult] = useState(null);

  useEffect(() => {
    let active = true;
    setCampaign(null);
    setClaimResult(null);
    setClaimOpen(true);
    setMessage("Preparando tu cupon...");

    const resolve = async () => {
      const normalizedCode = String(code || "").trim().toUpperCase();
      if (!normalizedCode) {
        setMessage("Cupon no valido.");
        return;
      }

      try {
        const { data } = await api.get(`/api/coupons/resolve-link/${encodeURIComponent(normalizedCode)}`);
        if (!active) return;
        if (data?.mode === "claim" && data.campaign) {
          setCampaign(data.campaign);
          return;
        }

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

  const confirmation = claimResult ? claimConfirmation(claimResult) : null;
  if (campaign) return (
    <main className="cg-stateShell cg-qrClaimShell">
      <div className="cg-stateCard cg-qrClaimIntro">
        <PartnerLogo src={campaign.logoUrl} name={campaign.partnerName} />
        <p>{campaign.partnerName}</p>
        <h1>Envío gratis para tu próximo pedido</h1>
        {claimResult ? <div role="status" aria-live="polite">
          <h2>{confirmation.title}</h2>
          <p>{confirmation.text}</p>
        </div> : campaign.available ? <>
          <p>Recibe tu cupón por SMS y guárdalo para tu próxima compra.</p>
          <button className="cg-primaryBtn" onClick={() => setClaimOpen(true)}>Recibir mi cupón por SMS</button>
        </> : <p>Esta campaña ya no admite nuevas solicitudes. Los cupones recibidos por SMS mantienen su validez.</p>}
      </div>
      {claimOpen && campaign.available && !claimResult && <ClaimModal campaign={campaign} onClaimed={setClaimResult} onClose={() => setClaimOpen(false)} />}
    </main>
  );

  return (
    <main className="sf-page">
      <div className="sf-loading">{message}</div>
    </main>
  );
}
