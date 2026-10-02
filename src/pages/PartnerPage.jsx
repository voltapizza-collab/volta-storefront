import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import StoreGate from "../components/StoreGate";
import api from "../services/api";
import { buildPartnerSeo, usePublicSeo } from "../utils/seo";

export default function PartnerPage() {
  const { partnerSlug } = useParams();
  const [result, setResult] = useState(null);
  // Ignore the previous business immediately, including the render before the effect runs.
  const current = result?.slug === partnerSlug ? result : null;
  const partner = current?.partner;
  const partnerSeo = useMemo(
    () => buildPartnerSeo({ partner, partnerSlug }),
    [partner, partnerSlug]
  );
  usePublicSeo(partnerSeo);

  useEffect(() => {
    if (!partnerSlug) return;
    let cancelled = false;
    api.get(`/partners/${partnerSlug}`).then(
      (data) => {
        if (!cancelled) setResult({ slug: partnerSlug, partner: data });
      },
      () => {
        if (!cancelled) setResult({ slug: partnerSlug, error: "No se pudo cargar la pizzería." });
      }
    );
    return () => { cancelled = true; };
  }, [partnerSlug]);

  return <StoreGate partner={partner} loading={!current} error={current?.error} />;
}
