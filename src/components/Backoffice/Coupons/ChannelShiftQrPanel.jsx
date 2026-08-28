import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";

const defaultCodeFromName = (name) =>
  String(name || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 80);

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const qrFileName = (coupon) =>
  `volta-token-qr-${String(coupon?.code || "token").toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}.png`;

const buildQrDataUrl = (value) =>
  QRCode.toDataURL(value, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 1024,
    color: {
      dark: "#140d22",
      light: "#ffffff",
    },
  });

const normalizeStoresResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.stores)) return data.stores;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export default function ChannelShiftQrPanel({ partnerId }) {
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState(null);
  const [qrModalItem, setQrModalItem] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [form, setForm] = useState({
    campaignName: "",
    code: "",
    amount: "5",
    storeIds: [],
    activeFrom: "",
    expiresAt: "",
  });

  const allStoreIds = useMemo(() => stores.map((store) => store.id), [stores]);

  const selectedStores = useMemo(
    () => stores.filter((store) => form.storeIds.some((item) => String(item) === String(store.id))),
    [form.storeIds, stores]
  );

  const allStoresSelected =
    allStoreIds.length > 0 &&
    allStoreIds.every((storeId) => form.storeIds.some((item) => String(item) === String(storeId)));

  const storeSummary = (storeList, fallbackIds = []) => {
    if (Array.isArray(storeList) && storeList.length) {
      if (stores.length && storeList.length === stores.length) return "Todas las tiendas";
      if (storeList.length === 1) return storeList[0].storeName;
      return `${storeList.length} tiendas`;
    }

    return Array.isArray(fallbackIds) && fallbackIds.length ? `${fallbackIds.length} tiendas` : "-";
  };

  const statusLabel = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "ACTIVE") return "Activo";
    if (normalized === "DISABLED") return "Detenido";
    if (normalized === "EXPIRED") return "Caducado";
    if (normalized === "USED") return "Usado";
    return normalized || "-";
  };

  const loadAll = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      setMessage("");
      const [storesResult, couponsResult] = await Promise.allSettled([
        api.get(`/api/stores?partnerId=${partnerId}`),
        api.get(`/api/coupons/channel-shift-qr?partnerId=${partnerId}`),
      ]);

      const nextStores =
        storesResult.status === "fulfilled"
          ? normalizeStoresResponse(storesResult.value.data)
          : [];
      setStores(nextStores);
      setItems(
        couponsResult.status === "fulfilled" && Array.isArray(couponsResult.value.data?.items)
          ? couponsResult.value.data.items
          : []
      );
      setForm((current) => ({
        ...current,
        storeIds: current.storeIds.length ? current.storeIds : nextStores.map((store) => store.id),
      }));

      if (storesResult.status === "rejected") {
        setMessage("No se pudieron cargar las tiendas.");
      } else if (couponsResult.status === "rejected") {
        setMessage("Las tiendas estan disponibles, pero no se pudo cargar el historial de QR.");
      }
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar los tokens QR.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateForm = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "campaignName" && !current.code) {
        next.code = defaultCodeFromName(value);
      }

      return next;
    });
  };

  const toggleStore = (storeId) => {
    setForm((current) => {
      const isSelected = current.storeIds.some((item) => String(item) === String(storeId));

      return {
        ...current,
        storeIds: isSelected
          ? current.storeIds.filter((item) => String(item) !== String(storeId))
          : [...current.storeIds, storeId],
      };
    });
  };

  const toggleAllStores = () => {
    setForm((current) => {
      const selectedIds = current.storeIds.map((item) => String(item));
      const hasEveryStore =
        allStoreIds.length > 0 && allStoreIds.every((storeId) => selectedIds.includes(String(storeId)));

      return {
        ...current,
        storeIds: hasEveryStore ? [] : allStoreIds,
      };
    });
  };

  const copyText = async (value) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setMessage("Enlace copiado.");
    } catch {
      setMessage("No se pudo copiar automaticamente.");
    }
  };

  const openQr = async (coupon) => {
    if (!coupon?.redeemUrl) {
      setMessage("Este token no tiene enlace QR disponible.");
      return;
    }

    setQrModalItem(coupon);
    setQrDataUrl("");
    setQrLoading(true);

    try {
      const dataUrl = await buildQrDataUrl(coupon.redeemUrl);
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error(error);
      setMessage("No se pudo generar el QR.");
    } finally {
      setQrLoading(false);
    }
  };

  const exportQr = async (coupon) => {
    if (!coupon?.redeemUrl) {
      setMessage("Este token no tiene enlace QR disponible.");
      return;
    }

    try {
      const dataUrl = await buildQrDataUrl(coupon.redeemUrl);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = qrFileName(coupon);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage("QR exportado como PNG.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo exportar el QR.");
    }
  };

  const stopCoupon = async (coupon) => {
    if (!coupon?.id) return;
    const confirmed = window.confirm(`Detener el token QR "${coupon.code}"? El enlace dejara de aplicar descuento.`);
    if (!confirmed) return;

    try {
      setActioningId(coupon.id);
      const { data } = await api.patch(`/api/coupons/channel-shift-qr/${coupon.id}/stop`, {
        partnerId,
      });
      const updated = data?.coupon;
      setItems((current) => current.map((item) => (item.id === coupon.id ? updated || { ...item, status: "DISABLED" } : item)));
      setMessage("Token QR detenido.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo detener el token QR.");
    } finally {
      setActioningId(null);
    }
  };

  const reactivateCoupon = async (coupon) => {
    if (!coupon?.id) return;

    try {
      setActioningId(coupon.id);
      const { data } = await api.patch(`/api/coupons/channel-shift-qr/${coupon.id}/reactivate`, {
        partnerId,
      });
      const updated = data?.coupon;
      setItems((current) => current.map((item) => (item.id === coupon.id ? updated || { ...item, status: "ACTIVE" } : item)));
      setMessage("Token QR reactivado.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo reactivar el token QR.");
    } finally {
      setActioningId(null);
    }
  };

  const askDeleteCoupon = (coupon) => {
    setDeleteCandidate(coupon);
    setDeleteConfirmCode("");
  };

  const deleteCoupon = async () => {
    if (!deleteCandidate?.id) return;

    try {
      setActioningId(deleteCandidate.id);
      await api.delete(`/api/coupons/channel-shift-qr/${deleteCandidate.id}`, {
        data: {
          partnerId,
          confirmCode: deleteConfirmCode,
        },
      });
      setItems((current) => current.filter((item) => item.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      setDeleteConfirmCode("");
      setMessage("Token QR eliminado.");
    } catch (error) {
      console.error(error);
      const errorCode = error.response?.data?.error;
      const messages = {
        bad_delete_payload: "Escribe el token exacto antes de eliminar.",
        confirm_code_mismatch: "El token escrito no coincide.",
        coupon_has_redemptions: "Este token ya tiene usos registrados. Lo detuve, pero no se elimina para conservar el historial.",
        coupon_not_found: "No encontramos este token QR.",
      };
      if (errorCode === "coupon_has_redemptions") {
        setItems((current) =>
          current.map((item) => (item.id === deleteCandidate.id ? { ...item, status: "DISABLED" } : item))
        );
        setDeleteCandidate(null);
        setDeleteConfirmCode("");
      }
      setMessage(messages[errorCode] || errorCode || "No se pudo eliminar el token QR.");
    } finally {
      setActioningId(null);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setCreated(null);

    try {
      const { data } = await api.post("/api/coupons/channel-shift-qr", {
        partnerId,
        campaignName: form.campaignName,
        code: form.code,
        amount: Number(form.amount || 0),
        storeIds: form.storeIds.map(Number),
        activeFrom: form.activeFrom || "",
        expiresAt: form.expiresAt || "",
      });

      setCreated(data?.coupon || null);
      setMessage("Token QR creado.");
      setForm((current) => ({
        ...current,
        campaignName: "",
        code: "",
      }));
      await loadAll();
    } catch (error) {
      console.error(error);
      const errorCode = error.response?.data?.error;
      const messages = {
        bad_payload: "Completa campana y selecciona al menos una tienda.",
        bad_amount: "El descuento debe ser mayor que cero.",
        bad_date_range: "La fecha de fin debe ser posterior a la fecha de inicio.",
        code_already_exists: "Ya existe un token con ese codigo.",
        store_not_found: "Alguna tienda seleccionada no pertenece a este partner.",
      };
      setMessage(messages[errorCode] || errorCode || "No se pudo crear el token QR.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="cp-card">Cargando tokens QR...</div>;
  }

  return (
    <div className="cp-promosLayout">
      <form className="cp-card cp-form" onSubmit={submit}>
        <div>
          <div className="cp-kicker">Tokens QR</div>
          <h3>Crear token QR de cambio de canal</h3>
        </div>

        <div className="cp-formGrid">
          <label className="cp-field">
            <span>Campana</span>
            <input
              value={form.campaignName}
              onChange={(event) => updateForm("campaignName", event.target.value)}
              placeholder="CAMBIO_DE_CANAL"
              required
            />
          </label>

          <label className="cp-field">
            <span>Token</span>
            <input
              value={form.code}
              onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
              placeholder="CAMBIO_DE_CANAL"
            />
          </label>
        </div>

        <div className="cp-formGrid">
          <label className="cp-field">
            <span>Descuento EUR</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
              required
            />
          </label>
        </div>

        <div className="cp-targetPanel">
          <div className="cp-kicker">Tiendas</div>
          <div className="cp-helper">
            {selectedStores.length
              ? `${selectedStores.length} de ${stores.length} tiendas seleccionadas`
              : "Selecciona al menos una tienda para este QR."}
          </div>
          <div className="cp-pillRow">
            <button
              type="button"
              className={`cp-pill ${allStoresSelected ? "is-active" : ""}`}
              onClick={toggleAllStores}
              disabled={!stores.length}
            >
              {allStoresSelected ? "Deseleccionar todo" : "Seleccionar todo"}
            </button>
            {stores.map((store) => (
              <button
                key={store.id}
                type="button"
                className={`cp-pill ${
                  form.storeIds.some((item) => String(item) === String(store.id)) ? "is-active" : ""
                }`}
                onClick={() => toggleStore(store.id)}
              >
                {store.storeName}
              </button>
            ))}
          </div>
        </div>

        <div className="cp-formGrid">
          <label className="cp-field">
            <span>Inicio</span>
            <input
              type="datetime-local"
              value={form.activeFrom}
              onChange={(event) => updateForm("activeFrom", event.target.value)}
            />
          </label>

          <label className="cp-field">
            <span>Fin</span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => updateForm("expiresAt", event.target.value)}
            />
          </label>
        </div>

        {!!selectedStores.length && (
          <div className="cp-targetPanel">
            <div className="cp-kicker">Destino</div>
            <p>
              El token quedara asignado a <strong>{storeSummary(selectedStores)}</strong>. No aparece en Coupon Gallery y queda activo solo durante su vigencia.
            </p>
          </div>
        )}

        <div className="cp-actions">
          <button className="cp-primaryBtn" type="submit" disabled={saving || !selectedStores.length}>
            {saving ? "Creando..." : "Crear token QR"}
          </button>
        </div>

        {message && <p className="cp-message">{message}</p>}

        {created?.redeemUrl && (
          <div className="cp-targetPanel">
            <div className="cp-kicker">Enlace del token</div>
            <p><strong>{created.code}</strong></p>
            <p className="cp-urlText">{created.redeemUrl}</p>
            <div className="cp-qrActionRow">
              <button type="button" className="cp-pill is-active" onClick={() => openQr(created)}>
                Ver QR
              </button>
            </div>
          </div>
        )}
      </form>

      <section className="cp-card cp-card--wide">
        <div>
          <div className="cp-kicker">Tokens</div>
          <h3>Tokens QR</h3>
        </div>

        <div className="cp-tableWrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Tienda</th>
                <th>Descuento</th>
                <th>Vigencia</th>
                <th>Usos</th>
                <th>Estado</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{storeSummary(item.targetStores, item.storeIds)}</td>
                  <td>EUR {Number(item.amount || 0).toFixed(2)}</td>
                  <td>{formatDate(item.activeFrom)} - {formatDate(item.expiresAt)}</td>
                  <td>{item.usedCount || 0} uso{Number(item.usedCount || 0) === 1 ? "" : "s"}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td>
                    <div className="cp-tableActions cp-tokenActions">
                      <button type="button" className="cp-pill is-active" onClick={() => openQr(item)}>
                        Ver QR
                      </button>
                      {item.status === "DISABLED" ? (
                        <button
                          type="button"
                          className="cp-pill"
                          disabled={actioningId === item.id}
                          onClick={() => reactivateCoupon(item)}
                        >
                          Reactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cp-pill"
                          disabled={actioningId === item.id || item.status !== "ACTIVE"}
                          onClick={() => stopCoupon(item)}
                        >
                          Detener
                        </button>
                      )}
                      <button
                        type="button"
                        className="cp-dangerBtn"
                        disabled={actioningId === item.id}
                        onClick={() => askDeleteCoupon(item)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan="7">Todavia no hay tokens QR.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {qrModalItem && (
        <div className="cp-modalOverlay" role="presentation" onClick={() => setQrModalItem(null)}>
          <div className="cp-modal cp-qrModal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="cp-qrModalHead">
              <div>
                <div className="cp-kicker">Token QR</div>
                <h3>{qrModalItem.campaignName || qrModalItem.code}</h3>
                <p>{qrModalItem.code}</p>
              </div>
              <button type="button" className="cp-pill" onClick={() => setQrModalItem(null)}>
                Cerrar
              </button>
            </div>

            <div className="cp-qrPreviewBox">
              {qrLoading && <span>Generando QR...</span>}
              {!qrLoading && qrDataUrl && (
                <img className="cp-qrPreview" src={qrDataUrl} alt={`QR ${qrModalItem.code}`} />
              )}
            </div>

            <div className="cp-qrMeta">
              <span>{storeSummary(qrModalItem.targetStores, qrModalItem.storeIds)}</span>
              <strong>EUR {Number(qrModalItem.amount || 0).toFixed(2)}</strong>
              <small>{formatDate(qrModalItem.activeFrom)} - {formatDate(qrModalItem.expiresAt)}</small>
              <code>{qrModalItem.redeemUrl}</code>
            </div>

            <div className="cp-actions">
              <button type="button" className="cp-primaryBtn" disabled={!qrDataUrl} onClick={() => exportQr(qrModalItem)}>
                Descargar PNG
              </button>
              <button type="button" className="cp-pill" onClick={() => copyText(qrModalItem.redeemUrl)}>
                Copiar enlace
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="cp-modalOverlay" role="presentation" onClick={() => setDeleteCandidate(null)}>
          <div className="cp-modal cp-form" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div>
              <div className="cp-kicker">Eliminar token QR</div>
              <h3>{deleteCandidate.code}</h3>
              <p>
                Esta accion elimina el token solo si no tiene usos registrados. Si ya fue usado, el sistema lo detendra y conservara el historial.
              </p>
            </div>

            <label className="cp-field">
              <span>Escribe el token para confirmar</span>
              <input
                value={deleteConfirmCode}
                onChange={(event) => setDeleteConfirmCode(event.target.value.toUpperCase())}
                placeholder={deleteCandidate.code}
              />
            </label>

            <div className="cp-actions">
              <button
                type="button"
                className="cp-dangerBtn"
                disabled={actioningId === deleteCandidate.id || deleteConfirmCode !== deleteCandidate.code}
                onClick={deleteCoupon}
              >
                {actioningId === deleteCandidate.id ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
              <button type="button" className="cp-pill" onClick={() => setDeleteCandidate(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
