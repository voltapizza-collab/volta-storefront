import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";
import { COUPON_SEGMENTS, COUPON_TYPES } from "../../../constants/coupons";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const WEEK_DAYS = [
  { value: "lunes", label: "Lun" },
  { value: "martes", label: "Mar" },
  { value: "miercoles", label: "Mie" },
  { value: "jueves", label: "Jue" },
  { value: "viernes", label: "Vie" },
  { value: "sabado", label: "Sab" },
  { value: "domingo", label: "Dom" },
];

const timeToMinutes = (value) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const normalizeComparableText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const postalAreaKey = (postalCode) => {
  const digits = String(postalCode || "").replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : "";
};

const defaultSurpriseMidAmount = (minValue, maxValue) => {
  const minCents = Math.round(Number(minValue || 0) * 100);
  const maxCents = Math.round(Number(maxValue || 0) * 100);
  if (!Number.isFinite(minCents) || !Number.isFinite(maxCents) || minCents <= 0 || maxCents <= 0) {
    return "";
  }

  const halfMax = Math.floor(maxCents / 2);
  const midCents = halfMax > minCents && halfMax < maxCents
    ? halfMax
    : Math.floor((minCents + maxCents) / 2);

  return (midCents / 100).toFixed(2);
};

const formatGalleryType = (type = "") => {
  const labels = {
    DELIVERY_FREE: "Delivery Free",
    FIXED_AMOUNT: "Importe fijo",
    SURPRISE_AMOUNT: "Cupon sorpresa",
    FIXED_PERCENT: "Porcentaje fijo",
    RANDOM_PERCENT: "Porcentaje random",
  };

  return labels[String(type || "").toUpperCase()] || String(type || "Cupon").replaceAll("_", " ");
};

const formatPoolScope = (pool) => {
  const stores = pool?.territory?.storeIds || [];
  const zipCodes = pool?.territory?.zipCodes || [];
  if (!stores.length && !zipCodes.length) return "Todas las tiendas y codigos postales";

  return [
    stores.length ? `${stores.length} tienda${stores.length === 1 ? "" : "s"}` : "",
    zipCodes.length ? `${zipCodes.length} CP` : "",
  ].filter(Boolean).join(" - ");
};

const galleryPoolId = (pool) => `${pool.type}:${pool.key}:${pool.gameId || ""}`;

function SortableGalleryPool({ id, children }) {
  const {
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "is-dragging" : ""} {...attributes}>
      {children(listeners)}
    </div>
  );
}

export default function OfferCreatePanel({ partnerId }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sample, setSample] = useState([]);
  const [galleryPools, setGalleryPools] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryDeleting, setGalleryDeleting] = useState("");
  const [galleryOrdering, setGalleryOrdering] = useState(false);
  const [territory, setTerritory] = useState({
    stores: [],
    zipCodes: [],
    customers: [],
    games: [],
  });
  const [form, setForm] = useState({
    type: "RANDOM_PERCENT",
    visibility: "PUBLIC",
    quantity: 25,
    percentMin: 5,
    percentMax: 15,
    percent: 10,
    amount: 5,
    surpriseMinAmount: 0.99,
    surpriseMidAmount: 4.99,
    surpriseMaxAmount: 9.99,
    maxAmount: "",
    segments: [],
    storeIds: [],
    zipCodes: [],
    activeFrom: "",
    expiresAt: "",
    isTemporal: false,
    daysActive: [],
    windowStart: "",
    windowEnd: "",
    gameId: "",
  });

  const type = useMemo(() => form.type, [form.type]);
  const isPublic = useMemo(() => form.visibility === "PUBLIC", [form.visibility]);
  const isSurpriseAmount = useMemo(() => type === "SURPRISE_AMOUNT", [type]);
  const isDeliveryFree = useMemo(() => type === "DELIVERY_FREE", [type]);
  const linkedZipCodes = useMemo(
    () => {
      const selectedStores = territory.stores.filter((store) =>
        form.storeIds.some((storeId) => String(storeId) === String(store.id))
      );
      if (!selectedStores.length) return new Set();

      const linkedZips = new Set();

      selectedStores.forEach((store) => {
        const storeZip = String(store.zipCode || "").trim();
        const storeArea = postalAreaKey(storeZip);
        const storeCity = normalizeComparableText(store.city || "");

        if (storeZip) {
          linkedZips.add(storeZip);
        }

        territory.customers.forEach((customer) => {
          const customerZip = String(customer.zipCode || "").trim();
          const customerArea = postalAreaKey(customerZip);
          const customerAddress = normalizeComparableText(customer.address_1 || "");

          if (storeZip && customerZip === storeZip) {
            linkedZips.add(customerZip);
            return;
          }

          if (storeArea && customerArea && storeArea === customerArea) {
            linkedZips.add(customerZip);
            return;
          }

          if (storeCity && customerAddress.includes(storeCity) && customerZip) {
            linkedZips.add(customerZip);
          }
        });
      });

      return linkedZips;
    },
    [form.storeIds, territory.customers, territory.stores]
  );
  const availableZipCodes = useMemo(() => {
    if (!form.storeIds.length) return territory.zipCodes;
    return territory.zipCodes.filter((zipCode) => linkedZipCodes.has(zipCode));
  }, [form.storeIds.length, linkedZipCodes, territory.zipCodes]);
  const allStoreIds = useMemo(() => territory.stores.map((store) => store.id), [territory.stores]);
  const allStoresSelected = useMemo(
    () =>
      allStoreIds.length > 0 &&
      allStoreIds.every((storeId) => form.storeIds.some((item) => String(item) === String(storeId))),
    [allStoreIds, form.storeIds]
  );
  const galleryPoolIds = useMemo(() => galleryPools.map(galleryPoolId), [galleryPools]);

  const loadGalleryPools = useCallback(async () => {
    if (!partnerId) return;

    try {
      setGalleryLoading(true);
      const { data } = await api.get(`/api/coupons/gallery-pools?partnerId=${partnerId}`);
      setGalleryPools(Array.isArray(data?.cards) ? data.cards : []);
    } catch (requestError) {
      console.error("Error loading gallery coupon pools", requestError);
    } finally {
      setGalleryLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (!partnerId) return;

    let isMounted = true;

    const loadTerritory = async () => {
      try {
        const [storesResponse, statsResponse, customersResponse, gamesResponse] = await Promise.all([
          api.get(`/stores?partnerId=${partnerId}`),
          api.get(`/api/customers/segment-stats?partnerId=${partnerId}`),
          api.get(`/api/customers?partnerId=${partnerId}`),
          api.get(`/api/coupons/games?partnerId=${partnerId}`).catch(() => ({ data: { games: [] } })),
        ]);

        if (!isMounted) return;

        setTerritory({
          stores: Array.isArray(storesResponse.data) ? storesResponse.data : [],
          zipCodes: Array.isArray(statsResponse.data?.zipCodes) ? statsResponse.data.zipCodes : [],
          customers: Array.isArray(customersResponse.data) ? customersResponse.data : [],
          games: Array.isArray(gamesResponse.data?.games) ? gamesResponse.data.games : [],
        });
      } catch (requestError) {
        console.error("Error loading coupon territory filters", requestError);
      }
    };

    loadTerritory();
    loadGalleryPools();

    return () => {
      isMounted = false;
    };
  }, [loadGalleryPools, partnerId]);

  const updateForm = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "visibility" && value === "PUBLIC") {
        next.segments = [];
      }

      if (key === "surpriseMinAmount" || key === "surpriseMaxAmount") {
        const previousDefaultMid = defaultSurpriseMidAmount(prev.surpriseMinAmount, prev.surpriseMaxAmount);
        if (String(prev.surpriseMidAmount) === String(previousDefaultMid)) {
          next.surpriseMidAmount = defaultSurpriseMidAmount(next.surpriseMinAmount, next.surpriseMaxAmount);
        }
      }

      return next;
    });
  };

  const toggleSegment = (segment) => {
    setForm((prev) => ({
      ...prev,
      segments: prev.segments.includes(segment)
        ? prev.segments.filter((item) => item !== segment)
        : [...prev.segments, segment],
    }));
  };

  const toggleAllSegments = () => {
    const allSegments = COUPON_SEGMENTS.map((segment) => segment.key);
    setForm((prev) => ({
      ...prev,
      segments: prev.segments.length === allSegments.length ? [] : allSegments,
    }));
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      daysActive: prev.daysActive.includes(day)
        ? prev.daysActive.filter((item) => item !== day)
        : [...prev.daysActive, day],
    }));
  };

  const toggleStore = (storeId) => {
    setForm((prev) => {
      const isSelected = prev.storeIds.some((item) => String(item) === String(storeId));

      return {
        ...prev,
        storeIds: isSelected
          ? prev.storeIds.filter((item) => String(item) !== String(storeId))
          : [...prev.storeIds, storeId],
      };
    });
  };

  const toggleAllStores = () => {
    setForm((prev) => {
      const selectedIds = prev.storeIds.map((storeId) => String(storeId));
      const allSelected =
        allStoreIds.length > 0 && allStoreIds.every((storeId) => selectedIds.includes(String(storeId)));

      return {
        ...prev,
        storeIds: allSelected ? [] : allStoreIds,
      };
    });
  };

  const toggleZipCode = (zipCode) => {
    setForm((prev) => ({
      ...prev,
      zipCodes: prev.zipCodes.includes(zipCode)
        ? prev.zipCodes.filter((item) => item !== zipCode)
        : [...prev.zipCodes, zipCode],
    }));
  };

  const toggleAllZipCodes = () => {
    setForm((prev) => ({
      ...prev,
      zipCodes:
        prev.zipCodes.length === availableZipCodes.length
          ? []
          : [...availableZipCodes],
    }));
  };

  useEffect(() => {
    setForm((prev) => {
      const nextZipCodes = prev.zipCodes.filter((zipCode) => availableZipCodes.includes(zipCode));
      if (nextZipCodes.length === prev.zipCodes.length) return prev;
      return { ...prev, zipCodes: nextZipCodes };
    });
  }, [availableZipCodes]);

  const persistGalleryOrder = async (nextPools) => {
    if (!partnerId) return;

    try {
      setGalleryOrdering(true);
      await api.put("/api/coupons/gallery-pools/order", {
        partnerId,
        items: nextPools.map((pool, index) => ({
          type: pool.type,
          key: pool.key,
          gameId: pool.gameId || null,
          galleryOrder: index,
        })),
      });
    } catch (requestError) {
      console.error("Error saving gallery coupon order", requestError);
      setMessage("No se pudo guardar el orden de CouponGallery.");
      await loadGalleryPools();
    } finally {
      setGalleryOrdering(false);
    }
  };

  const handleGalleryDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = galleryPoolIds.indexOf(active.id);
    const newIndex = galleryPoolIds.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextPools = arrayMove(galleryPools, oldIndex, newIndex);
    setGalleryPools(nextPools);
    await persistGalleryOrder(nextPools);
  };

  const deleteGalleryPool = async (pool) => {
    if (!pool?.type || !pool?.key) return;
    const confirmed = window.confirm(`Eliminar de CouponGallery el pool "${pool.title}"?`);
    if (!confirmed) return;

    const params = new URLSearchParams({
      partnerId: String(partnerId),
      type: pool.type,
      key: pool.key,
    });

    if (pool.gameId) params.set("gameId", String(pool.gameId));

    try {
      setGalleryDeleting(`${pool.type}:${pool.key}:${pool.gameId || ""}`);
      setMessage("");
      const { data } = await api.delete(`/api/coupons/gallery-pools?${params.toString()}`);
      setMessage(`Pool retirado de CouponGallery. Cupones afectados: ${data?.removed || 0}.`);
      await loadGalleryPools();
    } catch (requestError) {
      console.error(requestError);
      setMessage("No se pudo retirar ese pool de CouponGallery.");
    } finally {
      setGalleryDeleting("");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSample([]);

    try {
      if (!isPublic && !form.segments.length && !form.storeIds.length && !form.zipCodes.length) {
        setMessage("Selecciona al menos un segmento, una tienda o un codigo postal para el envio privado.");
        return;
      }

      const payload = {
        partnerId,
        type: form.type,
        quantity: isPublic ? Number(form.quantity) : 1,
        usageLimit: 1,
        isVisible: isPublic,
        visibility: form.visibility,
        segments: isPublic ? [] : form.segments,
        storeIds: form.storeIds,
        zipCodes: form.zipCodes,
        ...(type === "RANDOM_PERCENT" && {
          percentMin: Number(form.percentMin),
          percentMax: Number(form.percentMax),
        }),
        ...(type === "FIXED_PERCENT" && { percent: Number(form.percent) }),
        ...(type === "FIXED_AMOUNT" && { amount: Number(form.amount) }),
        ...(type === "SURPRISE_AMOUNT" && {
          surpriseMinAmount: Number(form.surpriseMinAmount),
          surpriseMidAmount: Number(form.surpriseMidAmount),
          surpriseMaxAmount: Number(form.surpriseMaxAmount),
        }),
        ...((type === "RANDOM_PERCENT" || type === "FIXED_PERCENT") && form.maxAmount
          ? { maxAmount: Number(form.maxAmount) }
          : {}),
        ...(form.activeFrom ? { activeFrom: form.activeFrom } : {}),
        ...(form.expiresAt ? { expiresAt: form.expiresAt } : {}),
        ...(form.isTemporal
          ? {
              daysActive: form.daysActive,
              windowStart: timeToMinutes(form.windowStart),
              windowEnd: timeToMinutes(form.windowEnd),
            }
          : {}),
        ...(form.gameId
          ? {
              gameId: Number(form.gameId),
              acquisition: "GAME",
              channel: "GAME",
              campaign: "GAME_REWARD",
            }
          : {}),
      };

      const { data } = await api.post("/api/coupons/bulk-generate", payload);
      const distribution = data?.surpriseDistribution;
      const distributionText =
        type === "SURPRISE_AMOUNT" && distribution
          ? ` Distribucion: ${distribution.min || 0} minimo, ${distribution.mid || 0} medio, ${distribution.max || 0} maximo.`
          : "";
      const delivery = data?.delivery;
      const firstDeliveryError = Array.isArray(delivery?.errors) ? delivery.errors[0] : null;
      const deliveryErrorText =
        firstDeliveryError && (firstDeliveryError.detail || firstDeliveryError.title)
          ? ` Error: ${firstDeliveryError.detail || firstDeliveryError.title}.`
          : "";
      const deliveryText =
        !isPublic && delivery
          ? ` SMS: ${delivery.sent || 0} enviados, ${delivery.failed || 0} fallidos${
              delivery.skipped ? `, ${delivery.skipped} omitidos` : ""
            }.${deliveryErrorText}`
          : "";
      setMessage(
        isPublic
          ? `Se crearon ${data?.created || 0} cupones visibles en gallery.${distributionText}${
              isDeliveryFree ? " Tipo: Delivery Free." : ""
            }`
          : `Se asignaron ${data?.created || 0} cupones privados al grupo filtrado (${data?.recipients || 0} clientes).${distributionText}${deliveryText}`
      );
      setSample(Array.isArray(data?.sample) ? data.sample : []);
      await loadGalleryPools();
    } catch (requestError) {
      console.error(requestError);
      const errorCode = requestError.response?.data?.error;
      const errorMessages = {
        no_recipients: "No hay clientes que coincidan con ese destino privado. Prueba seleccionando otro segmento, tienda o codigo postal.",
        bad_store_ids: "Alguna tienda seleccionada no pertenece a este partner.",
        public_coupons_cannot_have_segments: "Los cupones publicos no pueden tener segmentos privados.",
        insufficient_sms_credits: `Saldo de SMS cortos insuficiente. Disponibles: ${
          requestError.response?.data?.balance || 0
        }. Necesarios: ${requestError.response?.data?.required || 0}. Recarga SMS cortos para enviar cupones privados.`,
      };
      setMessage(errorMessages[errorCode] || errorCode || "No se pudo crear la oferta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <form className="cp-card cp-form" onSubmit={submit}>
      <div className="cp-kicker">Create</div>
      <h3>{isPublic ? "Generar cupones publicos" : "Generar cupones privados"}</h3>

      <div className="cp-field">
        <span>Audiencia</span>
        <div className="cp-segmented">
          <button
            className={`cp-segmentedBtn ${isPublic ? "is-active" : ""}`}
            onClick={() => updateForm("visibility", "PUBLIC")}
            type="button"
          >
            Publico
          </button>
          <button
            className={`cp-segmentedBtn ${!isPublic ? "is-active" : ""}`}
            onClick={() => updateForm("visibility", "RESERVED")}
            type="button"
          >
            Privado
          </button>
        </div>
      </div>

      <div className="cp-helper">
        {isPublic
          ? "Publico: se publica en CouponGallery para todos los clientes dentro de la capa territorial."
          : "Privado: se asigna a clientes del grupo filtrado y queda reservado para envio directo."}
      </div>

      <div className="cp-formGrid">
        <label className="cp-field">
          <span>Tipo</span>
          <select value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
            {COUPON_TYPES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {isPublic ? (
          <label className="cp-field">
            <span>Cantidad</span>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(event) => updateForm("quantity", event.target.value)}
            />
          </label>
        ) : (
          <div className="cp-field">
            <span>Destino privado</span>
            <div className="cp-helper">
              Se crea 1 cupón por cliente del grupo definido por segmentos y temperatura.
            </div>
            <div className="cp-helper">
              Si no marcas tiendas ni codigos postales, se enviara al grupo completo que cumpla ese filtro.
            </div>
          </div>
        )}

        {isDeliveryFree && (
          <div className="cp-info">
            Este cupon elimina el costo del envio cuando el cliente lo aplica en un pedido delivery.
          </div>
        )}

        {type === "RANDOM_PERCENT" && (
          <>
            <label className="cp-field">
              <span>% Min</span>
              <input
                type="number"
                min="1"
                max="90"
                value={form.percentMin}
                onChange={(event) => updateForm("percentMin", event.target.value)}
              />
            </label>
            <label className="cp-field">
              <span>% Max</span>
              <input
                type="number"
                min="1"
                max="90"
                value={form.percentMax}
                onChange={(event) => updateForm("percentMax", event.target.value)}
              />
            </label>
          </>
        )}

        {type === "FIXED_PERCENT" && (
          <label className="cp-field">
            <span>% Fijo</span>
            <input
              type="number"
              min="1"
              max="90"
              value={form.percent}
              onChange={(event) => updateForm("percent", event.target.value)}
            />
          </label>
        )}

        {type === "FIXED_AMOUNT" && (
          <label className="cp-field">
            <span>Importe</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
            />
          </label>
        )}

        {isSurpriseAmount && (
          <>
            <label className="cp-field">
              <span>Valor minimo</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.surpriseMinAmount}
                onChange={(event) => updateForm("surpriseMinAmount", event.target.value)}
              />
            </label>
            <label className="cp-field">
              <span>Valor medio</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.surpriseMidAmount}
                onChange={(event) => updateForm("surpriseMidAmount", event.target.value)}
              />
            </label>
            <label className="cp-field">
              <span>Valor maximo</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.surpriseMaxAmount}
                onChange={(event) => updateForm("surpriseMaxAmount", event.target.value)}
              />
            </label>
            <div className="cp-helper">
              Distribucion: 75% valor minimo, 15% valor medio, 10% valor maximo. Desde 10 cupones se garantiza 1 maximo.
            </div>
          </>
        )}

        {(type === "RANDOM_PERCENT" || type === "FIXED_PERCENT") && (
          <label className="cp-field">
            <span>Tope maximo</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.maxAmount}
              onChange={(event) => updateForm("maxAmount", event.target.value)}
            />
          </label>
        )}

        <label className="cp-field">
          <span>Activo desde</span>
          <input
            type="datetime-local"
            value={form.activeFrom}
            onChange={(event) => updateForm("activeFrom", event.target.value)}
          />
        </label>

        <label className="cp-field">
          <span>Vence</span>
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(event) => updateForm("expiresAt", event.target.value)}
          />
        </label>
      </div>

      {!isPublic && (
        <div className="cp-field">
          <span>Segmentos</span>
          <div className="cp-pillRow">
            <button
              className={`cp-pill ${form.segments.length === COUPON_SEGMENTS.length ? "is-active" : ""}`}
              onClick={toggleAllSegments}
              type="button"
            >
              Seleccionar todo
            </button>
            {COUPON_SEGMENTS.map((segment) => (
              <button
                key={segment.key}
                className={`cp-pill ${form.segments.includes(segment.key) ? "is-active" : ""}`}
                onClick={() => toggleSegment(segment.key)}
                type="button"
              >
                {segment.label}
              </button>
            ))}
          </div>
          <div className="cp-helper">Puedes mezclar segmentos S1-S5 con estado Hot/Cold.</div>
        </div>
      )}

      <div className="cp-targetPanel">
        <div className="cp-field">
          <span>Capa territorial</span>
          <div className="cp-helper">
            {isPublic
              ? "El cupon publico se muestra en CouponGallery para todos los clientes dentro de las tiendas o codigos postales marcados."
              : "Combina segmentos con una o varias tiendas y con uno o varios codigos postales para cruzar el territorio con precision."}
          </div>
        </div>

        <div className="cp-field">
          <span>Tiendas</span>
          <div className="cp-pillRow">
            {!!territory.stores.length && (
              <button
                className={`cp-pill ${allStoresSelected ? "is-active" : ""}`}
                onClick={toggleAllStores}
                type="button"
              >
                {allStoresSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
            )}
            {territory.stores.map((store) => (
              <button
                key={store.id}
                className={`cp-pill ${
                  form.storeIds.some((item) => String(item) === String(store.id)) ? "is-active" : ""
                }`}
                onClick={() => toggleStore(store.id)}
                type="button"
              >
                {store.storeName}
                {store.city ? ` - ${store.city}` : ""}
                {store.zipCode ? ` - ${store.zipCode}` : ""}
              </button>
            ))}
          </div>
          {!form.storeIds.length && !!territory.stores.length && (
            <div className="cp-helper">Sin tiendas marcadas = todas las tiendas.</div>
          )}
          {!territory.stores.length && <div className="cp-helper">No hay tiendas cargadas para este partner.</div>}
        </div>

        <div className="cp-field">
          <span>Codigos postales</span>
          <div className="cp-pillRow">
            {!!availableZipCodes.length && (
              <button
                className={`cp-pill ${form.zipCodes.length === availableZipCodes.length ? "is-active" : ""}`}
                onClick={toggleAllZipCodes}
                type="button"
              >
                Seleccionar todo
              </button>
            )}
            {availableZipCodes.map((zipCode) => (
              <button
                key={zipCode}
                className={`cp-pill ${form.zipCodes.includes(zipCode) ? "is-active" : ""} ${
                  !form.zipCodes.includes(zipCode) && linkedZipCodes.has(zipCode) ? "is-linked" : ""
                }`}
                onClick={() => toggleZipCode(zipCode)}
                type="button"
              >
                {zipCode}
              </button>
            ))}
          </div>
          {!form.zipCodes.length && !!availableZipCodes.length && (
            <div className="cp-helper">Sin codigos postales marcados = todos los codigos postales.</div>
          )}
          {!!form.storeIds.length && !!linkedZipCodes.size && (
            <div className="cp-helper">Los codigos resaltados vienen asociados a las tiendas marcadas.</div>
          )}
          {!territory.zipCodes.length && (
            <div className="cp-helper">Todavia no hay codigos postales detectados en la base de clientes.</div>
          )}
        </div>
      </div>

      <label className="cp-checkRow">
        <input
          checked={form.isTemporal}
          onChange={(event) => updateForm("isTemporal", event.target.checked)}
          type="checkbox"
        />
        Limitar por dias y horas
      </label>

      {form.isTemporal && (
        <>
          <div className="cp-pillRow">
            {WEEK_DAYS.map((day) => (
              <button
                key={day.value}
                className={`cp-pill ${form.daysActive.includes(day.value) ? "is-active" : ""}`}
                onClick={() => toggleDay(day.value)}
                type="button"
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="cp-formGrid">
            <label className="cp-field">
              <span>Inicio</span>
              <input
                type="time"
                value={form.windowStart}
                onChange={(event) => updateForm("windowStart", event.target.value)}
              />
            </label>
            <label className="cp-field">
              <span>Fin</span>
              <input
                type="time"
                value={form.windowEnd}
                onChange={(event) => updateForm("windowEnd", event.target.value)}
              />
            </label>
          </div>
        </>
      )}

      <div className="cp-gameNest">
        <label className="cp-checkRow">
          <input
            checked={Boolean(form.gameId)}
            onChange={(event) => updateForm("gameId", event.target.checked ? territory.games[0]?.id || "" : "")}
            type="checkbox"
            disabled={!territory.games.length}
          />
          Anidar videojuego
        </label>

        <div className="cp-helper">
          Si seleccionas un juego, este cupon queda como premio dorado: se vera en Coupon Gallery como PLAY & WIN y se entregara al ganar el minijuego.
        </div>

        {territory.games.length ? (
          <label className="cp-field">
            <span>Juego asociado</span>
            <select
              value={form.gameId}
              onChange={(event) => updateForm("gameId", event.target.value)}
            >
              <option value="">Sin videojuego</option>
              {territory.games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="cp-helper">Todavia no hay minijuegos activos configurados para este partner.</div>
        )}
      </div>

      <div className="cp-actions">
        <button className="cp-primaryBtn" disabled={saving} type="submit">
          {saving ? "Generando..." : "Generar cupones"}
        </button>
      </div>

      {message && <div className="cp-feedback">{message}</div>}
      {!!sample.length && <div className="cp-sample">Ejemplos: {sample.join(", ")}</div>}
    </form>

    <section className="cp-card cp-galleryManager">
      <div className="cp-galleryManagerHead">
        <div>
          <div className="cp-kicker">CouponGallery</div>
          <h3>Cupones publicados</h3>
          <p>Retira pools activos de la galeria cuando necesites recrearlos desde cero.</p>
        </div>
        <button
          type="button"
          className="cp-pill"
          onClick={loadGalleryPools}
          disabled={galleryLoading}
        >
          {galleryLoading || galleryOrdering ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="cp-galleryPoolList">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleGalleryDragEnd}>
          <SortableContext items={galleryPoolIds} strategy={verticalListSortingStrategy}>
            {galleryPools.map((pool) => {
              const deleteKey = galleryPoolId(pool);
              return (
                <SortableGalleryPool key={deleteKey} id={deleteKey}>
                  {(listeners) => (
                    <article className="cp-galleryPoolRow">
                      <button
                        type="button"
                        className="cp-galleryDragHandle"
                        aria-label={`Mover ${pool.title}`}
                        disabled={galleryOrdering}
                        {...listeners}
                      >
                        <span />
                        <span />
                        <span />
                      </button>
                      <div className="cp-galleryPoolMain">
                        <strong>{pool.title}</strong>
                        <span>{formatGalleryType(pool.type)} - {formatPoolScope(pool)}</span>
                        <small>Codigo muestra: {pool.sampleCode || "sin codigo"}</small>
                      </div>
                      <div className="cp-galleryPoolMeta">
                        <b>{pool.remaining == null ? "Sin limite" : pool.remaining}</b>
                        <span>disponibles</span>
                      </div>
                      <button
                        type="button"
                        className="cp-dangerBtn"
                        onClick={() => deleteGalleryPool(pool)}
                        disabled={galleryDeleting === deleteKey || galleryOrdering}
                      >
                        {galleryDeleting === deleteKey ? "Retirando..." : "Eliminar"}
                      </button>
                    </article>
                  )}
                </SortableGalleryPool>
              );
            })}
          </SortableContext>
        </DndContext>

        {!galleryLoading && !galleryPools.length && (
          <div className="cp-empty">No hay cupones publicos activos en CouponGallery.</div>
        )}
      </div>
    </section>
    </>
  );
}
