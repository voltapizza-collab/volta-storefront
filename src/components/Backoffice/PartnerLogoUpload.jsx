import { useEffect, useRef, useState } from "react";
import api from "../../setupAxios";
import "../../styles/PartnerLogoUpload.css";

export default function PartnerLogoUpload({ partnerId, partner, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const uploading = useRef(false);
  useEffect(() => () => { request.current++; }, []);

  const selectFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading.current) return;
    setError(""); setNotice("");
    if (file.size > 8 * 1024 * 1024) { setError("El logo debe pesar como máximo 8 MB."); return; }
    const version = ++request.current;
    const body = new FormData();
    body.append("logo", file);
    body.append("removeBackground", "true");
    uploading.current = true;
    setBusy(true);
    try {
      // setupAxios defaults to JSON; override it so Axios sends the file as multipart.
      const { data } = await api.post(`/partners/by-id/${partnerId}/logo`, body,
        { headers: { "Content-Type": "multipart/form-data" } });
      if (version !== request.current) return;
      onSaved(data);
      setNotice(data.brandLogoProcessing === "needs_review"
        ? "Logo guardado. Conservamos el fondo porque no pudimos separarlo con seguridad."
        : "Logo actualizado.");
    } catch (err) {
      if (version === request.current) setError(err.response?.data?.error || "No pudimos guardar el logo. Tu logo anterior se conserva; vuelve a subir el archivo.");
    } finally {
      if (version === request.current) { uploading.current = false; setBusy(false); }
    }
  };

  return <section className="bo-logoEditor" aria-label="Logo de la pizzería" aria-busy={busy}>
    <div className="bo-logoEditorImage">
      {partner?.brandLogoUrl ? <img src={partner.brandLogoUrl} alt={partner.name || "Logo actual"} /> : <span>Sin logo</span>}
    </div>
    <label className="bo-settingsMiniCta bo-settingsMiniCta--file" aria-disabled={busy}>
      Subir logo
      <input className="bo-logoFileInput" aria-label="Subir logo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={selectFile} />
    </label>
    <p className="bo-logoUploadHint">JPG, PNG o WebP · hasta 8 MB. El fondo se quita automáticamente cuando es posible.</p>
    {(busy || notice) && <p role="status" className="bo-logoUploadHint">{busy ? "Preparando y guardando logo…" : notice}</p>}
    {error && <p role="alert" className="bo-logoError">{error}</p>}
  </section>;
}
