import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusLabel = (partner) => (partner.active ? "Activo" : "Restringido");

const getPrimaryStorePath = (partner) => {
  const store = partner.stores?.[0];
  if (!partner.slug) return "";
  return store?.slug ? `/${partner.slug}/${store.slug}` : `/${partner.slug}`;
};

export default function PartnersModule() {
  const [data, setData] = useState({ partners: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [resettingCredentialId, setResettingCredentialId] = useState(null);
  const [generatedCredential, setGeneratedCredential] = useState(null);

  const loadPartners = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const response = await api.get("/partners/global/summary");
      const payload = response.data || {};
      const partners = Array.isArray(payload.partners) ? payload.partners : [];
      setData({
        partners,
        totals: payload.totals || {},
      });
      setExpandedId((current) =>
        partners.some((partner) => partner.id === current) ? current : partners[0]?.id || null
      );
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cargar el resumen de partners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const filteredPartners = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (data.partners || []).filter((partner) => {
      if (statusFilter === "ACTIVE" && !partner.active) return false;
      if (statusFilter === "RESTRICTED" && partner.active) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        partner.name,
        partner.slug,
        partner.country,
        ...(partner.stores || []).map((store) => store.storeName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data.partners, search, statusFilter]);

  const togglePartnerAccess = async (partner) => {
    const nextActive = !partner.active;
    const confirmed = nextActive
      ? true
      : window.confirm(
          `Restringir ${partner.name}? El partner no podra entrar al backoffice ni al POS.`
        );

    if (!confirmed) return;

    try {
      setSavingId(partner.id);
      setMessage("");
      await api.patch(`/partners/by-id/${partner.id}/active`, { active: nextActive });
      await loadPartners();
      setMessage(nextActive ? "Partner reactivado." : "Partner restringido.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo actualizar el acceso del partner.");
    } finally {
      setSavingId(null);
    }
  };

  const deletePartner = async (partner) => {
    const confirmed = window.confirm(
      `Eliminar ${partner.name}? Solo se eliminara si no tiene tiendas, clientes, productos ni pedidos.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(partner.id);
      setMessage("");
      await api.delete(`/partners/by-id/${partner.id}`);
      await loadPartners();
      setMessage("Partner eliminado.");
    } catch (error) {
      console.error(error);
      const counts = error.response?.data?.counts;
      setMessage(
        counts
          ? `No se puede eliminar: tiene ${formatNumber(counts.stores)} tiendas, ${formatNumber(counts.customers)} clientes y ${formatNumber(counts.sales)} pedidos. Usa restriccion si quieres bloquearlo.`
          : "No se pudo eliminar el partner."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const regeneratePosPin = async (partner, store) => {
    const confirmed = window.confirm(
      `Regenerar PIN POS para ${store.storeName}? El PIN anterior dejara de funcionar.`
    );
    if (!confirmed) return;

    try {
      setResettingCredentialId(store.id);
      setMessage("");
      const response = await api.post(`/stores/${store.id}/pos-credentials/regenerate`);
      const credential = response.data?.posCredentials || {};
      setGeneratedCredential({
        storeName: store.storeName,
        username: credential.username || partner.name,
        pin: credential.pin || "",
      });
      await loadPartners();
      setMessage("PIN POS regenerado. Copialo ahora: solo se muestra una vez.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo regenerar el PIN POS de la tienda.");
    } finally {
      setResettingCredentialId(null);
    }
  };

  const openPartner = (partner) => {
    const path = getPrimaryStorePath(partner);
    if (!path) return;
    window.open(path, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="gmp-shell">
      <header className="gm-moduleHeader">
        <div>
          <span>Volta Global</span>
          <h2>Partners</h2>
        </div>
        <button type="button" onClick={loadPartners} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </header>

      <section className="gmp-stats">
        <article>
          <span>Partners</span>
          <strong>{formatNumber(data.totals?.partners)}</strong>
        </article>
        <article>
          <span>Activos</span>
          <strong>{formatNumber(data.totals?.active)}</strong>
        </article>
        <article>
          <span>Restringidos</span>
          <strong>{formatNumber(data.totals?.restricted)}</strong>
        </article>
        <article>
          <span>Tiendas</span>
          <strong>{formatNumber(data.totals?.stores)}</strong>
        </article>
        <article>
          <span>Clientes</span>
          <strong>{formatNumber(data.totals?.customers)}</strong>
        </article>
        <article>
          <span>Ventas 30d</span>
          <strong>{formatMoney(data.totals?.revenue30)}</strong>
        </article>
      </section>

      <section className="gmp-toolbar">
        <label>
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, slug o tienda"
          />
        </label>
        <div className="gmp-filterGroup" aria-label="Filtro de estado">
          <button
            type="button"
            className={statusFilter === "ALL" ? "active" : ""}
            onClick={() => setStatusFilter("ALL")}
          >
            Todos
          </button>
          <button
            type="button"
            className={statusFilter === "ACTIVE" ? "active" : ""}
            onClick={() => setStatusFilter("ACTIVE")}
          >
            Activos
          </button>
          <button
            type="button"
            className={statusFilter === "RESTRICTED" ? "active" : ""}
            onClick={() => setStatusFilter("RESTRICTED")}
          >
            Restringidos
          </button>
        </div>
      </section>

      {message && <div className="gmp-message">{message}</div>}

      {generatedCredential?.pin ? (
        <section className="gmp-posCredentialNotice">
          <div>
            <span>Credencial POS generada</span>
            <strong>{generatedCredential.storeName}</strong>
          </div>
          <div>
            <span>Usuario</span>
            <strong>{generatedCredential.username}</strong>
          </div>
          <div>
            <span>PIN</span>
            <strong>{generatedCredential.pin}</strong>
          </div>
          <button type="button" onClick={() => setGeneratedCredential(null)}>
            Ocultar
          </button>
        </section>
      ) : null}

      <section className="gmp-tableWrap">
        <table className="gmp-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Estado</th>
              <th>Tiendas</th>
              <th>Clientes</th>
              <th>Pedidos</th>
              <th>Ventas 30d</th>
              <th>Ultimo pedido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8">Cargando partners...</td>
              </tr>
            ) : filteredPartners.length === 0 ? (
              <tr>
                <td colSpan="8">No hay partners para este filtro.</td>
              </tr>
            ) : (
              filteredPartners.map((partner) => {
                const isExpanded = expandedId === partner.id;
                const metrics = partner.metrics || {};

                return (
                  <Fragment key={partner.id}>
                    <tr className={!partner.active ? "is-restricted" : ""}>
                      <td>
                        <button
                          className="gmp-partnerName"
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : partner.id)}
                        >
                          <strong>{partner.name}</strong>
                          <span>{partner.slug}</span>
                        </button>
                      </td>
                      <td>
                        <span className={`gmp-status ${partner.active ? "is-active" : "is-restricted"}`}>
                          {getStatusLabel(partner)}
                        </span>
                      </td>
                      <td>
                        <strong>{formatNumber(metrics.stores)}</strong>
                        <small>{formatNumber(metrics.acceptingStores)} operativas</small>
                      </td>
                      <td>
                        <strong>{formatNumber(metrics.customers)}</strong>
                        <small>{formatNumber(metrics.restrictedCustomers)} restringidos</small>
                      </td>
                      <td>
                        <strong>{formatNumber(metrics.orders)}</strong>
                        <small>{formatNumber(metrics.orders30)} en 30d</small>
                      </td>
                      <td>{formatMoney(metrics.revenue30, partner.currency)}</td>
                      <td>{formatDate(metrics.lastOrderAt)}</td>
                      <td>
                        <div className="gmp-actions">
                          <button type="button" onClick={() => openPartner(partner)}>
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePartnerAccess(partner)}
                            disabled={savingId === partner.id}
                          >
                            {savingId === partner.id
                              ? "Guardando..."
                              : partner.active
                              ? "Restringir"
                              : "Activar"}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => deletePartner(partner)}
                            disabled={deletingId === partner.id || !partner.canDelete}
                            title={
                              partner.canDelete
                                ? "Eliminar partner"
                                : "No se puede eliminar con tiendas, clientes, productos o pedidos"
                            }
                          >
                            {deletingId === partner.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${partner.id}-detail`} className="gmp-detailRow">
                        <td colSpan="8">
                          <div className="gmp-detail">
                            <div>
                              <span>Alta</span>
                              <strong>{formatDate(partner.createdAt)}</strong>
                            </div>
                            <div>
                              <span>Productos</span>
                              <strong>{formatNumber(metrics.products)}</strong>
                            </div>
                            <div>
                              <span>Historico ventas</span>
                              <strong>{formatMoney(metrics.revenue, partner.currency)}</strong>
                            </div>
                            <div>
                              <span>SMS disponibles</span>
                              <strong>{formatNumber(partner.smsCredits)}</strong>
                            </div>
                            <div className="gmp-storeList">
                              <span>Tiendas</span>
                              {(partner.stores || []).length ? (
                                partner.stores.map((store) => (
                                  <small key={store.id} className="gmp-storeCredentialRow">
                                    {store.storeName}
                                    {store.city ? ` - ${store.city}` : ""}
                                    {" · "}
                                    {store.active ? "activa" : "inactiva"}
                                    {store.acceptingOrders ? " · acepta pedidos" : " · cerrada online"}
                                    {" · POS "}
                                    {store.posCredentialsConfigured ? "configurado" : "sin PIN"}
                                    <button
                                      type="button"
                                      onClick={() => regeneratePosPin(partner, store)}
                                      disabled={resettingCredentialId === store.id}
                                    >
                                      {resettingCredentialId === store.id ? "Generando..." : "Regenerar PIN"}
                                    </button>
                                  </small>
                                ))
                              ) : (
                                <small>Sin tiendas registradas.</small>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
