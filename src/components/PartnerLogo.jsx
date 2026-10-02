import { useState } from "react";
import "../styles/PartnerLogo.css";

// The surrounding page keeps the business name visible when its image is unavailable.
export default function PartnerLogo({ src, name, className = "", fallback = null }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const imageSrc = typeof src === "string" ? src.trim() : "";

  if (!imageSrc || failedSrc === imageSrc) return fallback;

  return (
    <img
      className={`sf-partnerLogo ${className}`.trim()}
      src={imageSrc}
      alt={name || "Logo"}
      onError={() => setFailedSrc(imageSrc)}
    />
  );
}
