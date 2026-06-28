import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../setupAxios";
import OfferCreatePanelCustomer from "../components/Backoffice/Coupons/OfferCreatePanelCustomer";
import {
  CUSTOMER_SEGMENTS,
  customerSegmentLabel,
  customerSegmentMeta,
  DEFAULT_CUSTOMER_SEGMENT,
  normalizeCustomerSegment,
} from "../constants/customerSegments";
import "../styles/StoreCreator.css";

const emptyStore = {
  storeName: "",
  address: "",
  latitude: "",
  longitude: "",
  city: "",
  zipCode: "",
  email: "",
  tlf: "",
  acceptsReservations: false,
  reservationCapacity: "",
};

const toStoreCoordinate = (value) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasUsableStoreCoordinates = (store) => {
  const latitude = toStoreCoordinate(store?.latitude);
  const longitude = toStoreCoordinate(store?.longitude);
  return (
    latitude != null &&
    longitude != null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_KEY || "";
const GOOGLE_SCRIPT_ID = "volta-google-maps-script";

const loadGoogleMaps = (apiKey) =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window unavailable"));
      return;
    }

    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });

const segmentCards = CUSTOMER_SEGMENTS;

const customerTimeFilters = [
  { key: "today", labelKey: "time.today", days: 1 },
  { key: "7d", labelKey: "time.7d", days: 7 },
  { key: "30d", labelKey: "time.30d", days: 30 },
  { key: "all", labelKey: "time.all", days: null },
];

const STORE_LOCALES = new Set(["en", "es", "it", "fr", "pt"]);

const normalizeStoreLocale = (value) => {
  const locale = String(value || "").trim().toLowerCase().slice(0, 2);
  return STORE_LOCALES.has(locale) ? locale : "en";
};

const STORE_COPY = {
  en: {
    "title.stores": "Stores",
    "title.locations": "Locations",
    "subtitle.stores": "Partner store list and operational tools.",
    "subtitle.locations": "Map, customers, and filters to analyze the territory.",
    "state.loadingModule": "Loading module...",
    "error.loadModule": "We could not load the stores module.",
    "error.filterStores": "We could not filter this partner's stores.",
    "feedback.selectPartner": "Select a partner before saving the store.",
    "feedback.storeUpdated": "Store updated.",
    "feedback.storeCreated": "Store created.",
    "feedback.storeCreatedWithPin": "Store created. Copy the POS PIN now: it is shown only once.",
    "feedback.saveStoreError": "We could not save the store.",
    "feedback.statusError": "We could not change the store status.",
    "feedback.pinRegenerated": "POS PIN regenerated. Copy it now: it is shown only once.",
    "feedback.pinNew": "A new recoverable POS PIN was generated for this store.",
    "feedback.pinError": "We could not regenerate the store POS PIN.",
    "feedback.pinLoadError": "We could not load the POS PIN.",
    "feedback.storeDeleted": "Store deleted.",
    "feedback.deleteStoreError": "We could not delete the store.",
    "confirm.deleteStore": "Delete store?",
    "confirm.regeneratePin": "Regenerate POS PIN for {name}? The previous PIN will stop working.",
    "action.addStore": "Add store",
    "action.delete": "Delete",
    "action.edit": "Edit",
    "action.cancel": "Cancel",
    "action.close": "Close",
    "action.saveStore": "Save store",
    "action.completeCoordinates": "Complete coordinates",
    "action.generatePin": "Generate PIN",
    "action.regeneratePin": "Regenerate PIN",
    "action.generating": "Generating...",
    "action.showCustomers": "Show customers",
    "action.hideCustomers": "Hide customers",
    "section.storesList": "Stores list",
    "table.del": "Del",
    "table.edit": "Edit",
    "table.name": "Name",
    "table.city": "City",
    "table.address": "Address",
    "table.status": "Status",
    "table.menu": "Menu",
    "table.report": "Report",
    "table.hours": "Hours",
    "table.reservations": "Reservations",
    "state.noStores": "There are no stores for this partner yet.",
    "status.active": "Active",
    "status.inactive": "Inactive",
    "status.coords": "Set coords",
    "status.changeTitle": "Change operational status",
    "status.coordsTitle": "Complete latitude and longitude before activating",
    "pin.none": "No PIN",
    "locations.title": "Store locations",
    "locations.meta": "{count} visible customers - segment and territory filters",
    "locations.allStores": "All stores",
    "locations.allPostalCodes": "All postal codes",
    "locations.noCustomers": "No customers match this filter",
    "locations.noCustomersPostal": "No customers match this filter in {code}.",
    "locations.signupFilter": "Signups",
    "locations.visible": "Visible",
    "time.today": "Today",
    "time.7d": "7 days",
    "time.30d": "30 days",
    "time.all": "Historical",
    "coordinates.eyebrow": "Pending setup",
    "coordinates.title": "Store coordinates missing",
    "coordinates.body": "To consider {name} active, the store needs latitude and longitude. Complete those fields in the store profile and activate it again.",
    "coordinates.latitude": "Latitude",
    "coordinates.longitude": "Longitude",
    "coordinates.pending": "pending",
    "pos.user": "User",
    "pos.loading": "Loading...",
    "pos.querying": "Checking this store's POS PIN.",
    "pos.regenerated": "This PIN was just generated because the store had an old non-recoverable credential.",
    "pos.current": "This is the current POS PIN for this store.",
    "pos.configured": "The POS PIN is configured.",
    "pos.missing": "This store does not have a POS PIN configured yet.",
    "form.addTitle": "Add store",
    "form.editTitle": "Edit store",
    "form.storeName": "Store name",
    "form.address": "Address",
    "form.latitude": "Latitude",
    "form.longitude": "Longitude",
    "form.city": "City",
    "form.zipCode": "Zip code",
    "form.email": "Email",
    "form.phone": "Phone",
    "form.acceptReservations": "Accept reservations",
    "form.reservationCapacity": "Reservation capacity (people)",
    "menu.title": "Store catalog - {name}",
    "menu.loadError": "We could not load this store's menu availability.",
    "menu.updateError": "We could not update this pizza availability.",
    "menu.state": "Status",
    "menu.saving": "Saving...",
    "menu.hidden": "Hidden",
    "menu.available": "Available",
    "menu.blocked": "Blocked",
    "hours.title": "Hours - {name}",
    "hours.loadError": "We could not load the opening hours.",
    "hours.applyAll": "Apply to all days",
    "hours.addBlock": "+ Add block",
    "hours.empty": "No blocks yet.",
    "hours.open": "Opens",
    "hours.close": "Closes",
    "hours.deleteBlock": "Delete block",
    "hours.saveClose": "Save and close",
    "day.Monday": "Monday",
    "day.Tuesday": "Tuesday",
    "day.Wednesday": "Wednesday",
    "day.Thursday": "Thursday",
    "day.Friday": "Friday",
    "day.Saturday": "Saturday",
    "day.Sunday": "Sunday",
    "reservations.title": "Reservations",
    "reservations.backendMissing": "The reservations backend is not available in Volta yet.",
    "reservations.updateError": "We could not update the reservation.",
    "reservations.date": "Date",
    "reservations.time": "Time",
    "reservations.customer": "Customer",
    "reservations.phone": "Phone",
    "reservations.people": "People",
    "reservations.actions": "Actions",
    "reservations.complete": "Complete",
    "reservations.closed": "Closed",
    "reservation.pending": "Pending",
    "reservation.confirmed": "Confirmed",
    "reservation.completed": "Completed",
    "reservation.canceled": "Canceled",
    "report.title": "Report - {name}",
    "report.loadError": "We could not load this store report.",
    "report.loading": "Loading report...",
    "report.totalSales": "Total sales",
    "report.orders": "Orders",
    "report.nonCanceled": "Non-canceled orders",
    "report.averageTicket": "Average ticket",
    "report.averageOrderValue": "Average value per order",
    "report.bestHour": "Best hour",
    "report.bestDay": "Best day",
    "report.noData": "No data",
    "report.topChannel": "Top channel",
    "report.lastSale": "Last sale",
    "report.currentPulse": "Current store pulse",
    "report.ordersCount": "{count} orders",
    "customer.defaultName": "Customer",
    "customer.noPhone": "No phone",
    "customer.noPostalCode": "No postal code",
    "customer.noOrders": "No purchases",
    "customer.noStoreAverage": "No store average",
    "customer.aboveAverage": "Above store average",
    "customer.belowAverage": "Below store average",
    "customer.averageTicket": "Average ticket",
    "customer.lastTicket": "Last ticket",
    "customer.lifetimeValue": "Lifetime value",
    "customer.daysWithoutOrdering": "Days without ordering",
    "customer.ordersCount": "{count} orders",
    "customer.address": "Address",
    "customer.noAddress": "No registered address",
    "customer.noEmail": "No email",
    "customer.notes": "Notes",
    "customer.createBoost": "Create boost",
  },
  es: {
    "title.stores": "Tiendas",
    "title.locations": "Ubicaciones",
    "subtitle.stores": "Lista de tiendas y funciones operativas del partner.",
    "subtitle.locations": "Mapa, clientes y filtros para analizar el territorio.",
    "state.loadingModule": "Cargando modulo...",
    "error.loadModule": "No pudimos cargar el modulo de tiendas.",
    "error.filterStores": "No pudimos filtrar las tiendas del partner.",
    "feedback.selectPartner": "Selecciona un partner antes de guardar la tienda.",
    "feedback.storeUpdated": "Tienda actualizada.",
    "feedback.storeCreated": "Tienda creada.",
    "feedback.storeCreatedWithPin": "Tienda creada. Copia el PIN POS ahora: solo se muestra una vez.",
    "feedback.saveStoreError": "No pudimos guardar la tienda.",
    "feedback.statusError": "No pudimos cambiar el estado de la tienda.",
    "feedback.pinRegenerated": "PIN POS regenerado. Copialo ahora: solo se muestra una vez.",
    "feedback.pinNew": "Se genero un nuevo PIN POS recuperable para esta tienda.",
    "feedback.pinError": "No pudimos regenerar el PIN POS de la tienda.",
    "feedback.pinLoadError": "No pudimos cargar el PIN POS.",
    "feedback.storeDeleted": "Tienda eliminada.",
    "feedback.deleteStoreError": "No pudimos eliminar la tienda.",
    "confirm.deleteStore": "Eliminar tienda?",
    "confirm.regeneratePin": "Regenerar PIN POS para {name}? El PIN anterior dejara de funcionar.",
    "action.addStore": "Anadir tienda",
    "action.delete": "Eliminar",
    "action.edit": "Editar",
    "action.cancel": "Cancelar",
    "action.close": "Cerrar",
    "action.saveStore": "Guardar tienda",
    "action.completeCoordinates": "Completar coordenadas",
    "action.generatePin": "Generar PIN",
    "action.regeneratePin": "Regenerar PIN",
    "action.generating": "Generando...",
    "action.showCustomers": "Mostrar clientes",
    "action.hideCustomers": "Ocultar clientes",
    "section.storesList": "Lista de tiendas",
    "table.del": "Del",
    "table.edit": "Edit",
    "table.name": "Nombre",
    "table.city": "Ciudad",
    "table.address": "Direccion",
    "table.status": "Estado",
    "table.menu": "Menu",
    "table.report": "Reporte",
    "table.hours": "Horarios",
    "table.reservations": "Reservas",
    "state.noStores": "No hay tiendas para este partner todavia.",
    "status.active": "Activa",
    "status.inactive": "Inactiva",
    "status.coords": "Config coords",
    "status.changeTitle": "Cambiar estado operativo",
    "status.coordsTitle": "Completa latitud y longitud antes de activar",
    "pin.none": "Sin PIN",
    "locations.title": "Ubicaciones de tiendas",
    "locations.meta": "{count} clientes visibles - filtros de segmento y territorio",
    "locations.allStores": "Todas las tiendas",
    "locations.allPostalCodes": "Todos los codigos postales",
    "locations.noCustomers": "No hay clientes para este filtro",
    "locations.noCustomersPostal": "No hay clientes para este filtro en {code}.",
    "locations.signupFilter": "Altas",
    "locations.visible": "Visibles",
    "time.today": "Hoy",
    "time.7d": "7 dias",
    "time.30d": "30 dias",
    "time.all": "Historico",
    "coordinates.eyebrow": "Configuracion pendiente",
    "coordinates.title": "Faltan coordenadas de la tienda",
    "coordinates.body": "Para considerar activa la tienda {name}, necesitamos que tenga configuradas latitud y longitud. Completa esos campos en la ficha de la tienda y luego vuelve a activarla.",
    "coordinates.latitude": "Latitud",
    "coordinates.longitude": "Longitud",
    "coordinates.pending": "pendiente",
    "pos.user": "Usuario",
    "pos.loading": "Cargando...",
    "pos.querying": "Consultando el PIN POS de la tienda.",
    "pos.regenerated": "Este PIN acaba de generarse porque la tienda tenia una credencial antigua no recuperable.",
    "pos.current": "Este es el PIN POS actual de la tienda.",
    "pos.configured": "El PIN POS esta configurado.",
    "pos.missing": "Esta tienda todavia no tiene PIN POS configurado.",
    "form.addTitle": "Anadir tienda",
    "form.editTitle": "Editar tienda",
    "form.storeName": "Nombre de tienda",
    "form.address": "Direccion",
    "form.latitude": "Latitud",
    "form.longitude": "Longitud",
    "form.city": "Ciudad",
    "form.zipCode": "Codigo postal",
    "form.email": "Email",
    "form.phone": "Telefono",
    "form.acceptReservations": "Aceptar reservas",
    "form.reservationCapacity": "Capacidad de reservas (personas)",
    "menu.title": "Catalogo de tienda - {name}",
    "menu.loadError": "No pudimos cargar la disponibilidad del menu de esta tienda.",
    "menu.updateError": "No pudimos actualizar la disponibilidad de esta pizza.",
    "menu.state": "Estado",
    "menu.saving": "Guardando...",
    "menu.hidden": "Oculta",
    "menu.available": "Disponible",
    "menu.blocked": "Bloqueada",
    "hours.title": "Horario - {name}",
    "hours.loadError": "No pudimos cargar los horarios.",
    "hours.applyAll": "Aplicar a todos los dias",
    "hours.addBlock": "+ Anadir bloque",
    "hours.empty": "Sin bloques todavia.",
    "hours.open": "Abre",
    "hours.close": "Cierra",
    "hours.deleteBlock": "Eliminar bloque",
    "hours.saveClose": "Guardar y cerrar",
    "day.Monday": "Lunes",
    "day.Tuesday": "Martes",
    "day.Wednesday": "Miercoles",
    "day.Thursday": "Jueves",
    "day.Friday": "Viernes",
    "day.Saturday": "Sabado",
    "day.Sunday": "Domingo",
    "reservations.title": "Reservas",
    "reservations.backendMissing": "El backend de reservas aun no esta disponible en Volta.",
    "reservations.updateError": "No pudimos actualizar la reserva.",
    "reservations.date": "Fecha",
    "reservations.time": "Hora",
    "reservations.customer": "Cliente",
    "reservations.phone": "Telefono",
    "reservations.people": "Personas",
    "reservations.actions": "Acciones",
    "reservations.complete": "Completar",
    "reservations.closed": "Cerrada",
    "reservation.pending": "Pendiente",
    "reservation.confirmed": "Confirmada",
    "reservation.completed": "Completada",
    "reservation.canceled": "Cancelada",
    "report.title": "Reporte - {name}",
    "report.loadError": "No pudimos cargar el reporte de esta tienda.",
    "report.loading": "Cargando reporte...",
    "report.totalSales": "Ventas totales",
    "report.orders": "Pedidos",
    "report.nonCanceled": "Ordenes no canceladas",
    "report.averageTicket": "Ticket promedio",
    "report.averageOrderValue": "Valor medio por pedido",
    "report.bestHour": "Hora mas vendida",
    "report.bestDay": "Dia mas vendido",
    "report.noData": "Sin dato",
    "report.topChannel": "Canal top",
    "report.lastSale": "Ultima venta",
    "report.currentPulse": "Pulso actual de la tienda",
    "report.ordersCount": "{count} pedidos",
    "customer.defaultName": "Cliente",
    "customer.noPhone": "Sin telefono",
    "customer.noPostalCode": "Sin CP",
    "customer.noOrders": "Sin compras",
    "customer.noStoreAverage": "Sin media tienda",
    "customer.aboveAverage": "Sobre media tienda",
    "customer.belowAverage": "Bajo media tienda",
    "customer.averageTicket": "Ticket promedio",
    "customer.lastTicket": "Ultimo ticket",
    "customer.lifetimeValue": "Valor acumulado",
    "customer.daysWithoutOrdering": "Dias sin pedir",
    "customer.ordersCount": "{count} pedidos",
    "customer.address": "Direccion",
    "customer.noAddress": "Sin direccion registrada",
    "customer.noEmail": "Sin email",
    "customer.notes": "Observaciones",
    "customer.createBoost": "Crear boost",
  },
};

const translateStore = (locale, key, values = {}) => {
  const dictionary = STORE_COPY[locale] || STORE_COPY.en;
  const template = dictionary[key] || STORE_COPY.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    values[name] == null ? "" : String(values[name])
  );
};

const segmentMetaByKey = segmentCards.reduce((acc, segment) => {
  acc[segment.key] = segment;
  return acc;
}, {});

const extractPostalCode = (value) => {
  const match = String(value || "").match(/\b(\d{5})\b/);
  return match ? match[1] : null;
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

const toCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasUsableCoordinates = (lat, lng) =>
  lat != null && lng != null && !(Number(lat) === 0 && Number(lng) === 0);

const formatMoney = (value, currency = "EUR") => {
  const amount = Number(value || 0);
  return `${currency} ${amount.toFixed(2)}`;
};

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isCustomerInTimeFilter = (customer, filterKey) => {
  const filter = customerTimeFilters.find((item) => item.key === filterKey);
  if (!filter || filter.key === "all") return true;

  const createdAt = new Date(customer?.createdAt || "");
  if (Number.isNaN(createdAt.getTime())) return false;

  const from = startOfToday();
  from.setDate(from.getDate() - (filter.days - 1));
  return createdAt >= from;
};

const formatCustomerMoney = (customer, value) =>
  Number(customer?.orderCount || 0) > 0 ? formatMoney(value) : "-";

const getTicketComparisonLabel = (customer) => {
  if (!Number(customer?.orderCount || 0)) return "Sin compras";
  const storeAverage = Number(customer?.storeAverageTicket || 0);
  if (!storeAverage) return "Sin media tienda";
  return customer.isAboveStoreAverage ? "Sobre media tienda" : "Bajo media tienda";
};

const formatDateTime = (value) => {
  if (!value) return "Sin compras";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin compras";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const svgToDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const getCustomerSegmentKey = (customer) => {
  const key = normalizeCustomerSegment(customer?.segment, DEFAULT_CUSTOMER_SEGMENT);
  return segmentMetaByKey[key] ? key : DEFAULT_CUSTOMER_SEGMENT;
};

const getCustomerSegmentMeta = (customer) =>
  segmentMetaByKey[getCustomerSegmentKey(customer)] || customerSegmentMeta(customer?.segment);

const createStorePinIcon = (google, active) => ({
  url: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">
      <path d="M17 1C8.16 1 1 8.16 1 17c0 12.2 16 28 16 28s16-15.8 16-28C33 8.16 25.84 1 17 1z"
        fill="${active ? "#e23b2f" : "#6f8fb4"}"
        stroke="white"
        stroke-width="2"/>
      <circle cx="17" cy="17" r="6.2" fill="white"/>
    </svg>
  `),
  scaledSize: new google.maps.Size(34, 46),
  anchor: new google.maps.Point(17, 42),
});

const createCustomerPinIcon = (google, customer, isSelected) => {
  const segment = getCustomerSegmentMeta(customer);
  const markerColor = segment.color;
  const size = isSelected ? 25 : 19;
  const strokeWidth = isSelected ? 4 : 3;

  return {
    url: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14.2" fill="white" opacity="0.96"/>
        <circle cx="16" cy="16" r="11.8" fill="${markerColor}" stroke="white" stroke-width="${strokeWidth}"/>
        <circle cx="16" cy="16" r="3.6" fill="white"/>
      </svg>
    `),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
};

function MenuAvailabilityModal({ store, onClose, t }) {
  const [rows, setRows] = useState([]);
  const [openCat, setOpenCat] = useState(null);
  const [error, setError] = useState("");
  const [savingPizzaId, setSavingPizzaId] = useState(null);

  const loadRows = useCallback(async () => {
    const response = await api.get(`/api/stock/${store.id}`);
    setRows(Array.isArray(response.data) ? response.data : []);
  }, [store?.id]);

  useEffect(() => {
    if (!store?.id) return;

    loadRows()
      .then(() => {
        setError("");
      })
      .catch((requestError) => {
        console.error("MENU AVAILABILITY LOAD ERROR:", requestError);
        setRows([]);
        setError(t("menu.loadError"));
      });
  }, [loadRows, store?.id]);

  const togglePizzaAvailability = async (row) => {
    try {
      setSavingPizzaId(row.pizzaId);
      await api.patch(`/api/stock/${store.id}/${row.pizzaId}/active`, {
        active: !row.active,
      });
      await loadRows();
      setError("");
    } catch (requestError) {
      console.error("PIZZA AVAILABILITY ERROR:", requestError);
      setError(t("menu.updateError"));
    } finally {
      setSavingPizzaId(null);
    }
  };

  const grouped = useMemo(() => {
    const map = {};

    rows.forEach((row) => {
      const category = row?.pizza?.category || "-";
      if (!map[category]) {
        map[category] = [];
      }
      map[category].push(row);
    });

    return map;
  }, [rows]);

  return (
    <div className="sc-modalBack" onMouseDown={onClose}>
      <div className="sc-modalBox sc-modalBox--wide" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sc-modalHead">
          <h3>{t("menu.title", { name: store.storeName })}</h3>
          <button className="sc-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="sc-modalBody">
          {error ? (
            <div className="sc-emptyState">{error}</div>
          ) : (
            Object.entries(grouped).map(([category, list]) => (
              <div key={category} className="sc-stockSection">
                <button
                  className="sc-stockSectionHead"
                  onClick={() => setOpenCat((current) => (current === category ? null : category))}
                  type="button"
                >
                  {openCat === category ? "v" : ">"}
                  {" "}
                  {category}
                  {" "}
                  ·
                  {" "}
                  {list.filter((row) => row.active).length}/{list.length}
                </button>

                {openCat === category && (
                  <table className="store-table sc-stockTable">
                    <thead>
                      <tr>
                        <th>Pizza</th>
                        <th className="right">{t("menu.state")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row) => (
                        <tr key={row.pizzaId}>
                          <td className="sc-pizzaNameCell">
                            <div className="sc-pizzaNameBlock sc-pizzaNameBlock--withThumb">
                              <span className="sc-pizzaThumb" aria-hidden={!row.pizza?.image}>
                                {row.pizza?.image ? (
                                  <img src={row.pizza.image} alt="" />
                                ) : (
                                  <span>
                                    {String(row.pizza?.name || "?").trim().slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                              </span>
                              <strong>{row.pizza?.name}</strong>
                            </div>
                          </td>
                          <td className="right">
                            <button
                              className={`sc-inlineStatusBadge sc-inlineStatusBadge--button ${
                                row.active && row.available
                                  ? "is-active"
                                  : row.active
                                    ? "is-blocked"
                                    : "is-inactive"
                              }`}
                              onClick={() => togglePizzaAvailability(row)}
                              type="button"
                              disabled={savingPizzaId === row.pizzaId}
                              title={
                                row.active && !row.available && row.blockers?.length
                                  ? row.blockers.map((blocker) => blocker.label).join(" | ")
                                  : undefined
                              }
                            >
                              {savingPizzaId === row.pizzaId
                                ? t("menu.saving")
                                : !row.active
                                  ? t("menu.hidden")
                                  : row.available
                                  ? t("menu.available")
                                  : t("menu.blocked")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>

        <footer className="sc-modalFooter">
          <button className="sc-btn ghost" onClick={onClose} type="button">
            {t("action.close")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function StoreHoursModal({ store, onClose, t }) {
  const [rows, setRows] = useState([]);
  const [localRows, setLocalRows] = useState([]);
  const [appliedAllDays, setAppliedAllDays] = useState(false);
  const [error, setError] = useState("");

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const dayMap = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 0,
  };

  const hours = [...Array(24)].map((_, index) => index);
  const minutes = [0, 15, 30, 45];

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/store-hours/${store.id}`);
      const safeRows = Array.isArray(data) ? data : [];
      setRows(safeRows);
      setLocalRows(safeRows);
      setError("");
    } catch (requestError) {
      console.error("STORE HOURS LOAD ERROR:", requestError);
      setRows([]);
      setLocalRows([]);
      setError(t("hours.loadError"));
    }
  }, [store?.id]);

  useEffect(() => {
    if (!store?.id) return;
    load();
  }, [load, store?.id]);

  const updateLocal = (id, field, value) => {
    setLocalRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const slotsByDay = days.reduce((accumulator, day) => {
    accumulator[day] = [];
    return accumulator;
  }, {});

  localRows.forEach((row) => {
    const name = Object.keys(dayMap).find((key) => dayMap[key] === row.dayOfWeek);
    if (name) {
      slotsByDay[name].push(row);
    }
  });

  const addSlot = (day) => {
    const newSlot = {
      id: `tmp-${Date.now()}-${Math.random()}`,
      storeId: store.id,
      dayOfWeek: dayMap[day],
      openTime: 1140,
      closeTime: 1380,
      isNew: true,
    };

    setLocalRows((previous) => [...previous, newSlot]);
  };

  const removeSlot = (id) => {
    setLocalRows((previous) => previous.filter((row) => row.id !== id));
  };

  const applyAllDays = () => {
    const monday = dayMap.Monday;
    const mondaySlots = localRows.filter((row) => row.dayOfWeek === monday);

    if (!mondaySlots.length) return;

    const newRows = [];

    Object.values(dayMap).forEach((day) => {
      if (day === monday) return;

      mondaySlots.forEach((slot) => {
        newRows.push({
          ...slot,
          id: `tmp-${Date.now()}-${Math.random()}`,
          dayOfWeek: day,
          isNew: true,
        });
      });
    });

    setLocalRows((previous) => [
      ...previous.filter((row) => row.dayOfWeek === monday),
      ...newRows,
    ]);

    setAppliedAllDays(true);
  };

  const save = async () => {
    const originalIds = rows.map((row) => row.id);
    const currentIds = localRows
      .filter((row) => !String(row.id).startsWith("tmp"))
      .map((row) => row.id);
    const deleted = originalIds.filter((id) => !currentIds.includes(id));

    for (const id of deleted) {
      await api.delete(`/api/store-hours/${id}`);
    }

    for (const row of localRows) {
      if (String(row.id).startsWith("tmp")) {
        await api.post("/api/store-hours", {
          storeId: store.id,
          dayOfWeek: row.dayOfWeek,
          openTime: row.openTime,
          closeTime: row.closeTime,
        });
      }
    }

    for (const row of localRows) {
      if (!String(row.id).startsWith("tmp")) {
        await api.patch(`/api/store-hours/${row.id}`, {
          openTime: row.openTime,
          closeTime: row.closeTime,
        });
      }
    }

    await load();
  };

  return (
    <div className="sc-modalBack" onMouseDown={onClose}>
      <div className="sc-modalBox sc-modalBox--wide" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sc-modalHead">
          <h3>{t("hours.title", { name: store.storeName })}</h3>
          <button className="sc-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="sc-modalToolbar">
          <button
            className={`sc-btn ghost ${appliedAllDays ? "sc-btn-active" : ""}`}
            onClick={applyAllDays}
            type="button"
          >
            {t("hours.applyAll")}
          </button>
        </div>

        <div className="sc-modalBody">
          {error ? (
            <div className="sc-emptyState">{error}</div>
          ) : (
            <div className="sc-hoursGrid">
            {days.map((day) => (
              <section key={day} className="sc-hoursDay">
                <div className="sc-hoursDayHead">
                  <strong>{t(`day.${day}`)}</strong>
                  <button className="table-btn edit" onClick={() => addSlot(day)} type="button">
                    {t("hours.addBlock")}
                  </button>
                </div>

                {slotsByDay[day].length === 0 && (
                  <div className="sc-hoursEmpty">{t("hours.empty")}</div>
                )}

                {slotsByDay[day].map((slot) => {
                  const openH = Math.floor(slot.openTime / 60);
                  const openM = slot.openTime % 60;
                  const closeH = Math.floor(slot.closeTime / 60);
                  const closeM = slot.closeTime % 60;

                  return (
                    <div key={slot.id} className="sc-hoursRow">
                      <div className="sc-hoursTimeGroup">
                        <span className="sc-hoursTimeLabel">{t("hours.open")}</span>
                        <div className="sc-hoursTimeControls">
                          <select
                            value={openH}
                            onChange={(event) =>
                              updateLocal(
                                slot.id,
                                "openTime",
                                Number(event.target.value) * 60 + openM
                              )
                            }
                          >
                            {hours.map((hour) => (
                              <option key={hour} value={hour}>
                                {String(hour).padStart(2, "0")}
                              </option>
                            ))}
                          </select>

                          <span>:</span>

                          <select
                            value={openM}
                            onChange={(event) =>
                              updateLocal(
                                slot.id,
                                "openTime",
                                openH * 60 + Number(event.target.value)
                              )
                            }
                          >
                            {minutes.map((minute) => (
                              <option key={minute} value={minute}>
                                {String(minute).padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <span className="sc-hoursArrow">→</span>

                      <div className="sc-hoursTimeGroup">
                        <span className="sc-hoursTimeLabel">{t("hours.close")}</span>
                        <div className="sc-hoursTimeControls">
                          <select
                            value={closeH}
                            onChange={(event) =>
                              updateLocal(
                                slot.id,
                                "closeTime",
                                Number(event.target.value) * 60 + closeM
                              )
                            }
                          >
                            {hours.map((hour) => (
                              <option key={hour} value={hour}>
                                {String(hour).padStart(2, "0")}
                              </option>
                            ))}
                          </select>

                          <span>:</span>

                          <select
                            value={closeM}
                            onChange={(event) =>
                              updateLocal(
                                slot.id,
                                "closeTime",
                                closeH * 60 + Number(event.target.value)
                              )
                            }
                          >
                            {minutes.map((minute) => (
                              <option key={minute} value={minute}>
                                {String(minute).padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        className="table-btn table-btn-icon danger"
                        onClick={() => removeSlot(slot.id)}
                        type="button"
                        aria-label={t("hours.deleteBlock")}
                      >
                        x
                      </button>
                    </div>
                  );
                })}
              </section>
            ))}
            </div>
          )}
        </div>

        <footer className="sc-modalFooter">
          <button className="sc-btn ghost" onClick={onClose} type="button">
            {t("action.cancel")}
          </button>
          <button
            className="sc-btn primary"
            onClick={async () => {
              await save();
              onClose();
            }}
            type="button"
          >
            {t("hours.saveClose")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ReservationsModal({ store, onClose, t }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!store?.id) return;

    api
      .get(`/api/reservations/store/${store.id}`)
      .then((response) => {
        setRows(Array.isArray(response.data) ? response.data : []);
        setError("");
      })
      .catch((requestError) => {
        console.error("RESERVATIONS LOAD ERROR:", requestError);
        setRows([]);
        setError(t("reservations.backendMissing"));
      });
  }, [store?.id]);

  const patchReservationStatus = async (id, status) => {
    try {
      await api.patch(`/api/reservations/${id}/${status}`);
      setRows((previous) =>
        previous.map((row) => (row.id === id ? { ...row, status } : row))
      );
    } catch (requestError) {
      console.error("RESERVATION STATUS ERROR:", requestError);
      setError(t("reservations.updateError"));
    }
  };

  const reservationStatusLabel = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending") return t("reservation.pending");
    if (normalized === "confirmed") return t("reservation.confirmed");
    if (normalized === "complete" || normalized === "completed") return t("reservation.completed");
    if (normalized === "cancel" || normalized === "canceled" || normalized === "cancelled") return t("reservation.canceled");
    return status || "-";
  };

  return (
    <div className="sc-modalBack" onMouseDown={onClose}>
      <div className="sc-modalBox sc-modalBox--wide sc-reservationsModal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sc-modalHead">
          <div>
            <span className="sc-modalEyebrow">{t("reservations.title")}</span>
            <h3>{store.storeName}</h3>
          </div>
          <button className="sc-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="sc-modalBody">
          {error ? (
            <div className="sc-emptyState">{error}</div>
          ) : (
            <div className="sc-reservationsTableWrap">
              <table className="store-table sc-reservationsTable">
                <thead>
                  <tr>
                    <th>{t("reservations.date")}</th>
                    <th>{t("reservations.time")}</th>
                    <th>{t("reservations.customer")}</th>
                    <th>{t("reservations.phone")}</th>
                    <th>{t("reservations.people")}</th>
                    <th>{t("menu.state")}</th>
                    <th className="actions">{t("reservations.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((left, right) => {
                      const order = {
                        pending: 0,
                        confirmed: 1,
                        completed: 2,
                        canceled: 3,
                        cancelled: 3,
                      };

                      const statusDiff =
                        (order[String(left.status || "").toLowerCase()] ?? 9) -
                        (order[String(right.status || "").toLowerCase()] ?? 9);

                      if (statusDiff !== 0) return statusDiff;

                      const leftDate = new Date(`${left.reservationDate}T${left.reservationTime}`);
                      const rightDate = new Date(`${right.reservationDate}T${right.reservationTime}`);
                      return leftDate - rightDate;
                    })
                    .map((row) => {
                      const normalizedStatus = String(row.status || "").toLowerCase();
                      const formattedDate = row.reservationDate
                        ? new Date(row.reservationDate).toLocaleDateString("es-ES")
                        : "-";

                      return (
                        <tr key={row.id}>
                          <td>{formattedDate}</td>
                          <td>{row.reservationTime}</td>
                          <td>{row.customerName}</td>
                          <td>{row.customerPhone}</td>
                          <td>{row.partySize}</td>
                          <td>
                            <span className={`sc-reservationStatus is-${normalizedStatus || "unknown"}`}>
                              {reservationStatusLabel(row.status)}
                            </span>
                          </td>
                          <td className="actions">
                            <div className="sc-reservationActions">
                              {normalizedStatus === "pending" || normalizedStatus === "confirmed" ? (
                                <>
                                  <button
                                    className="table-btn complete"
                                    onClick={() => patchReservationStatus(row.id, "complete")}
                                    type="button"
                                  >
                                    {t("reservations.complete")}
                                  </button>
                                  <button
                                    className="table-btn danger"
                                    onClick={() => patchReservationStatus(row.id, "cancel")}
                                    type="button"
                                  >
                                    {t("action.cancel")}
                                  </button>
                                </>
                              ) : (
                                <button className="table-btn" disabled type="button">
                                  {t("reservations.closed")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="sc-modalFooter">
          <button className="sc-btn ghost" onClick={onClose} type="button">
            {t("action.close")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function StoreReportModal({ store, onClose, t }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!store?.id) return;

    api
      .get(`/api/stores/${store.id}/report`)
      .then((response) => {
        setReport(response.data || null);
        setError("");
      })
      .catch((requestError) => {
        console.error("STORE REPORT LOAD ERROR:", requestError);
        setReport(null);
        setError(t("report.loadError"));
      });
  }, [store?.id]);

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    const currency = report?.currency || "EUR";
    return `${currency} ${amount.toFixed(2)}`;
  };

  const cards = report
    ? [
        {
          label: t("report.totalSales"),
          value: formatMoney(report.kpis?.totalSales),
          meta: report.periodLabel,
        },
        {
          label: t("report.orders"),
          value: String(report.kpis?.ordersCount || 0),
          meta: t("report.nonCanceled"),
        },
        {
          label: t("report.averageTicket"),
          value: formatMoney(report.kpis?.averageTicket),
          meta: t("report.averageOrderValue"),
        },
        {
          label: t("report.bestHour"),
          value: report.kpis?.bestHour || t("report.noData"),
          meta: t("report.ordersCount", { count: report.kpis?.bestHourOrders || 0 }),
        },
        {
          label: t("report.bestDay"),
          value: report.kpis?.bestDay || t("report.noData"),
          meta: formatMoney(report.kpis?.bestDaySales),
        },
      ]
    : [];

  return (
    <div className="sc-modalBack" onMouseDown={onClose}>
      <div className="sc-modalBox sc-modalBox--wide" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sc-modalHead">
          <h3>{t("report.title", { name: store.storeName })}</h3>
          <button className="sc-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="sc-modalBody">
          {error ? (
            <div className="sc-emptyState">{error}</div>
          ) : !report ? (
            <div className="sc-emptyState">{t("report.loading")}</div>
          ) : (
            <div className="sc-reportWrap">
              <div className="sc-reportGrid">
                {cards.map((card) => (
                  <article key={card.label} className="sc-reportCard">
                    <span className="sc-reportLabel">{card.label}</span>
                    <strong className="sc-reportValue">{card.value}</strong>
                    <span className="sc-reportMeta">{card.meta}</span>
                  </article>
                ))}
              </div>

              <div className="sc-reportFooter">
                <div className="sc-reportFootCard">
                  <span className="sc-reportLabel">{t("report.topChannel")}</span>
                  <strong className="sc-reportValue sc-reportValue--small">
                    {report.kpis?.topChannel || t("report.noData")}
                  </strong>
                  <span className="sc-reportMeta">
                    {t("report.ordersCount", { count: report.kpis?.topChannelCount || 0 })}
                  </span>
                </div>

                <div className="sc-reportFootCard">
                  <span className="sc-reportLabel">{t("report.lastSale")}</span>
                  <strong className="sc-reportValue sc-reportValue--small">
                    {report.lastSaleAt
                      ? new Date(report.lastSaleAt).toLocaleString("es-ES")
                      : t("report.noData")}
                  </strong>
                  <span className="sc-reportMeta">{t("report.currentPulse")}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="sc-modalFooter">
          <button className="sc-btn ghost" onClick={onClose} type="button">
            {t("action.close")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CustomerProfileModal({ customer, onClose, onBoostCustomer, t }) {
  if (!customer) return null;

  const daysOff = Number(customer.daysOff || 0);
  const segment = getCustomerSegmentMeta(customer);
  const getComparisonLabel = () => {
    if (!Number(customer?.orderCount || 0)) return t("customer.noOrders");
    const storeAverage = Number(customer?.storeAverageTicket || 0);
    if (!storeAverage) return t("customer.noStoreAverage");
    return customer.isAboveStoreAverage
      ? t("customer.aboveAverage")
      : t("customer.belowAverage");
  };
  const formatCustomerDateTime = (value) => {
    if (!value) return t("customer.noOrders");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("customer.noOrders");
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const daysOffLabel =
    Number(customer?.orderCount || 0) > 0 ? String(daysOff) : t("customer.noOrders");
  const profileStats = [
    {
      label: t("customer.averageTicket"),
      value: formatCustomerMoney(customer, customer.averageTicket),
      meta: getComparisonLabel(),
    },
    {
      label: t("customer.lastTicket"),
      value: formatCustomerMoney(customer, customer.lastTicket),
      meta: formatCustomerDateTime(customer.lastOrderAt),
    },
    {
      label: t("customer.lifetimeValue"),
      value: formatCustomerMoney(customer, customer.lifetimeValue),
      meta: t("customer.ordersCount", { count: customer.orderCount || 0 }),
    },
    {
      label: t("customer.daysWithoutOrdering"),
      value: daysOffLabel,
      meta: formatCustomerDateTime(customer.lastOrderAt),
    },
  ];

  return (
    <div className="sc-modalBack" onMouseDown={onClose}>
      <div
        className="sc-modalBox sc-customerProfileModal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sc-modalHead">
          <div>
            <h3 className="sc-modalTitle">{customer.name || t("customer.defaultName")}</h3>
            <p className="sc-customerProfileSub">
              {customer.phone || t("customer.noPhone")} - {customer.postalCode || customer.zipCode || t("customer.noPostalCode")}
            </p>
          </div>
          <button className="sc-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="sc-modalBody">
          <div className="sc-customerProfileStatus">
            <span
              className="sc-customerProfileBadge"
              style={{ background: segment.color, color: "#ffffff" }}
            >
              {segment.shortLabel}
            </span>
            <span>{customerSegmentLabel(customer.segment)}</span>
            <span>{getComparisonLabel()}</span>
          </div>

          <div className="sc-customerProfileGrid">
            {profileStats.map((item) => (
              <article key={item.label} className="sc-customerProfileMetric">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.meta}</small>
              </article>
            ))}
          </div>

          <div className="sc-customerProfileInfo">
            <div>
              <span>{t("customer.address")}</span>
              <strong>{customer.address_1 || t("customer.noAddress")}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{customer.email || t("customer.noEmail")}</strong>
            </div>
            {customer.observations && (
              <div>
                <span>{t("customer.notes")}</span>
                <strong>{customer.observations}</strong>
              </div>
            )}
          </div>
        </div>

        <footer className="sc-modalFooter">
          <button className="sc-btn ghost" onClick={onClose} type="button">
            {t("action.close")}
          </button>
          <button
            className="sc-btn primary"
            onClick={() => onBoostCustomer?.(customer)}
            type="button"
          >
            {t("customer.createBoost")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function MapPanel({
  stores,
  customers,
  showCustomers,
  customerPostalCode,
  selectedStoreId,
  selectedCustomerId,
  onSelectStore,
  onSelectCustomer,
  t,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const geocodingRef = useRef(new Set());
  const [postalCoordinates, setPostalCoordinates] = useState({});
  const storeMarkers = useMemo(
    () =>
      stores
        .map((store) => ({
          ...store,
          latitude: toCoordinate(store.latitude),
          longitude: toCoordinate(store.longitude),
        }))
        .filter((store) => store.latitude != null && store.longitude != null),
    [stores]
  );

  const center = useMemo(() => {
    if (!storeMarkers.length) {
      return { lat: 40.4168, lng: -3.7038 };
    }

    if (String(selectedStoreId) === "all") {
      const sum = storeMarkers.reduce(
        (acc, store) => ({
          lat: acc.lat + store.latitude,
          lng: acc.lng + store.longitude,
        }),
        { lat: 0, lng: 0 }
      );

      return {
        lat: sum.lat / storeMarkers.length,
        lng: sum.lng / storeMarkers.length,
      };
    }

    const selectedStore = storeMarkers.find((store) => String(store.id) === String(selectedStoreId));
    const focusStore = selectedStore || storeMarkers[0];
    return focusStore
      ? { lat: focusStore.latitude, lng: focusStore.longitude }
      : { lat: 40.4168, lng: -3.7038 };
  }, [selectedStoreId, storeMarkers]);

  const customerMarkers = useMemo(
    () =>
      customers
        .map((customer) => {
          const lat = toCoordinate(customer.lat);
          const lng = toCoordinate(customer.lng);
          const territoryLat = toCoordinate(customer.territoryLat);
          const territoryLng = toCoordinate(customer.territoryLng);
          const useCustomerCoordinates = hasUsableCoordinates(lat, lng);
          const useTerritoryCoordinates = hasUsableCoordinates(territoryLat, territoryLng);
          const postalCoordinate = postalCoordinates[String(customer.postalCode || "")] || null;

          return {
            ...customer,
            lat: useCustomerCoordinates
              ? lat
              : useTerritoryCoordinates
                ? territoryLat
                : postalCoordinate?.lat,
            lng: useCustomerCoordinates
              ? lng
              : useTerritoryCoordinates
                ? territoryLng
                : postalCoordinate?.lng,
          };
        })
        .filter((customer) => hasUsableCoordinates(customer.lat, customer.lng)),
    [customers, postalCoordinates]
  );

  useEffect(() => {
    if (!GOOGLE_KEY || !showCustomers) return undefined;

    const missingPostalCodes = [
      ...new Set(
        customers
          .filter((customer) => {
            const lat = toCoordinate(customer.lat);
            const lng = toCoordinate(customer.lng);
            const territoryLat = toCoordinate(customer.territoryLat);
            const territoryLng = toCoordinate(customer.territoryLng);
            const postalCode = String(customer.postalCode || "").trim();

            return (
              postalCode &&
              postalCode !== t("customer.noPostalCode") &&
              !hasUsableCoordinates(lat, lng) &&
              !hasUsableCoordinates(territoryLat, territoryLng) &&
              !postalCoordinates[postalCode] &&
              !geocodingRef.current.has(postalCode)
            );
          })
          .map((customer) => String(customer.postalCode || "").trim())
      ),
    ];

    if (!missingPostalCodes.length) return undefined;

    let cancelled = false;

    loadGoogleMaps(GOOGLE_KEY)
      .then((google) => {
        if (cancelled) return;

        const geocoder = new google.maps.Geocoder();
        missingPostalCodes.forEach((postalCode) => {
          geocodingRef.current.add(postalCode);
          geocoder.geocode(
            {
              address: `${postalCode}, Spain`,
              componentRestrictions: { country: "ES" },
            },
            (results, status) => {
              if (cancelled || status !== "OK") return;

              const location = results?.[0]?.geometry?.location;
              const lat = typeof location?.lat === "function" ? location.lat() : null;
              const lng = typeof location?.lng === "function" ? location.lng() : null;

              if (!hasUsableCoordinates(lat, lng)) return;

              setPostalCoordinates((current) => ({
                ...current,
                [postalCode]: { lat, lng },
              }));
            }
          );
        });
      })
      .catch((error) => {
        console.error("POSTAL GEOCODE LOAD ERROR:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [customers, postalCoordinates, showCustomers, t]);

  useEffect(() => {
    if (!mapRef.current || String(selectedStoreId) === "all") return;

    const selectedStore = storeMarkers.find((store) => String(store.id) === String(selectedStoreId));
    if (!selectedStore) return;

    mapRef.current.panTo({ lat: selectedStore.latitude, lng: selectedStore.longitude });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom?.() || 13, 14));
  }, [selectedStoreId, storeMarkers]);

  useEffect(() => {
    if (!mapRef.current || !selectedCustomerId) return;

    const selectedCustomer = customerMarkers.find(
      (customer) => String(customer.id) === String(selectedCustomerId)
    );

    if (!selectedCustomer) return;

    mapRef.current.panTo({ lat: selectedCustomer.lat, lng: selectedCustomer.lng });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom?.() || 13, 15));
  }, [customerMarkers, selectedCustomerId]);

  useEffect(() => {
    if (!GOOGLE_KEY || !mapNodeRef.current) return undefined;

    let cancelled = false;

    loadGoogleMaps(GOOGLE_KEY)
      .then((google) => {
        if (cancelled || !mapNodeRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapNodeRef.current, {
            center,
            zoom: 12,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: "greedy",
          });
        } else {
          mapRef.current.setCenter(center);
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        storeMarkers.forEach((store) => {
          const marker = new google.maps.Marker({
            map: mapRef.current,
            position: { lat: store.latitude, lng: store.longitude },
            icon: createStorePinIcon(google, store.active),
            title: store.storeName,
            zIndex:
              String(selectedStoreId) !== "all" && String(store.id) === String(selectedStoreId)
                ? 40
                : 30,
          });

          marker.addListener("click", () => {
            onSelectStore?.(store.id);
          });

          markersRef.current.push(marker);
        });

        if (showCustomers) {
          customerMarkers.forEach((customer) => {
            const isSelected = String(customer.id) === String(selectedCustomerId);
            const segment = getCustomerSegmentMeta(customer);
            const marker = new google.maps.Marker({
              map: mapRef.current,
              position: { lat: customer.lat, lng: customer.lng },
              icon: createCustomerPinIcon(google, customer, isSelected),
              title: `${customer.name || "Cliente"} - ${segment.shortLabel}`,
              zIndex: isSelected ? 60 : 20,
            });

            marker.addListener("click", () => {
              if (mapRef.current) {
                mapRef.current.panTo({ lat: customer.lat, lng: customer.lng });
              }
              onSelectCustomer?.(customer.id);
            });

            markersRef.current.push(marker);
          });
        }

        const bounds = new google.maps.LatLngBounds();
        let hasBounds = false;

        if (String(selectedStoreId) === "all") {
          storeMarkers.forEach((store) => {
            bounds.extend({ lat: store.latitude, lng: store.longitude });
            hasBounds = true;
          });
        } else {
          const selectedStore = storeMarkers.find((store) => String(store.id) === String(selectedStoreId));
          if (selectedStore) {
            bounds.extend({ lat: selectedStore.latitude, lng: selectedStore.longitude });
            hasBounds = true;
          }
        }

        if (showCustomers) {
          customerMarkers.forEach((customer) => {
            bounds.extend({ lat: customer.lat, lng: customer.lng });
            hasBounds = true;
          });
        }

        if (hasBounds) {
          const selectedStore = storeMarkers.find((store) => String(store.id) === String(selectedStoreId));
          const selectedCustomer = customerMarkers.find(
            (customer) => String(customer.id) === String(selectedCustomerId)
          );

          if (selectedCustomer) {
            mapRef.current.panTo({ lat: selectedCustomer.lat, lng: selectedCustomer.lng });
            mapRef.current.setZoom(15);
          } else if (selectedStore) {
            mapRef.current.panTo({ lat: selectedStore.latitude, lng: selectedStore.longitude });
            mapRef.current.setZoom(showCustomers && customerMarkers.length > 0 ? 14 : 15);
          } else if (String(selectedStoreId) === "all" || (showCustomers && customerMarkers.length > 0)) {
            mapRef.current.fitBounds(bounds, 48);
          } else {
            mapRef.current.setCenter(center);
            mapRef.current.setZoom(13);
          }
        }

        console.debug("[StoresMap]", {
          selectedStoreId,
          stores: storeMarkers.length,
          customers: customerMarkers.length,
          showCustomers,
          customerPostalCode,
          center,
        });
      })
      .catch((error) => {
        console.error("GOOGLE MAPS LOAD ERROR:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    center,
    customerMarkers,
    customerPostalCode,
    onSelectStore,
    onSelectCustomer,
    selectedCustomerId,
    selectedStoreId,
    showCustomers,
    storeMarkers,
  ]);

  return (
    <div className="sc-mapPanel">
      <div className="sc-mapEmbedShell">
        {GOOGLE_KEY ? (
          <div ref={mapNodeRef} className="sc-mapCanvas" />
        ) : (
          <iframe
            className="sc-mapEmbed"
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              `${center.lat},${center.lng}`
            )}&z=13&output=embed`}
            title="Store map fallback"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}

        {showCustomers && customers.length === 0 && (
          <div className="sc-mapEmptyOverlay">
            {customerPostalCode !== "all"
              ? t("locations.noCustomersPostal", { code: customerPostalCode })
              : t("locations.noCustomers")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminStoresPage({
  initialPartnerId = "",
  lockPartner = false,
  view = "stores",
  language = "es",
}) {
  const isLocationsView = view === "locations";
  const activeLocale = useMemo(() => normalizeStoreLocale(language), [language]);
  const t = useCallback(
    (key, values) => translateStore(activeLocale, key, values),
    [activeLocale]
  );
  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [stores, setStores] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showCust, setShowCust] = useState(false);
  const [customerPostalCode, setCustomerPostalCode] = useState("all");
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState("all");
  const [customerTimeFilter, setCustomerTimeFilter] = useState("all");
  const [selectedMapStoreId, setSelectedMapStoreId] = useState("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [boostCustomer, setBoostCustomer] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [hoursModal, setHoursModal] = useState(null);
  const [reservationsModal, setReservationsModal] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyStore);
  const [editingStore, setEditingStore] = useState(null);
  const [coordinatesModalStore, setCoordinatesModalStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [pageError, setPageError] = useState("");
  const [resettingCredentialId, setResettingCredentialId] = useState(null);
  const [posCredentialModal, setPosCredentialModal] = useState(null);
  const [loadingCredentialId, setLoadingCredentialId] = useState(null);

  const loadPartners = useCallback(async () => {
    const response = await api.get("/partners");
    const data = Array.isArray(response.data) ? response.data : [];
    setPartners(data);

    if (!selectedPartnerId) {
      const nextPartnerId = initialPartnerId || String(data[0]?.id || "");
      if (nextPartnerId) {
        setSelectedPartnerId(String(nextPartnerId));
      }
    }

    return data;
  }, [initialPartnerId, selectedPartnerId]);

  const loadStores = useCallback(async (partnerId) => {
    const path = partnerId ? `/api/stores?partnerId=${partnerId}` : "/api/stores";
    const response = await api.get(path);
    setStores(Array.isArray(response.data) ? response.data : []);
  }, []);

  const loadCustomers = useCallback(async (partnerId) => {
    try {
      const path = partnerId ? `/api/customers?partnerId=${partnerId}` : "/api/customers";
      const response = await api.get(path);
      setCustomers(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      console.error("CUSTOMERS LOAD ERROR:", requestError);
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        const loadedPartners = await loadPartners();
        const nextPartnerId =
          selectedPartnerId ||
          initialPartnerId ||
          String(loadedPartners[0]?.id || "");
        await Promise.all([
          loadStores(nextPartnerId),
          isLocationsView ? loadCustomers(nextPartnerId) : Promise.resolve(),
        ]);
        setPageError("");
      } catch (requestError) {
        console.error("ADMIN STORES BOOTSTRAP ERROR:", requestError);
        setPageError(t("error.loadModule"));
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [initialPartnerId, isLocationsView, loadCustomers, loadPartners, loadStores, selectedPartnerId, t]);

  useEffect(() => {
    if (!initialPartnerId) return;
    setSelectedPartnerId(String(initialPartnerId));
  }, [initialPartnerId]);

  useEffect(() => {
    if (!selectedPartnerId) return;
    Promise.all([
      loadStores(selectedPartnerId),
      isLocationsView ? loadCustomers(selectedPartnerId) : Promise.resolve(),
    ]).catch((requestError) => {
      console.error("FILTER STORES ERROR:", requestError);
      setPageError(t("error.filterStores"));
    });
  }, [isLocationsView, loadCustomers, loadStores, selectedPartnerId, t]);

  useEffect(() => {
    if (!stores.length) {
      setSelectedMapStoreId("all");
      return;
    }

    if (String(selectedMapStoreId) === "all") return;
    if (stores.some((store) => String(store.id) === String(selectedMapStoreId))) return;

    setSelectedMapStoreId("all");
  }, [selectedMapStoreId, stores]);

  const customersWithTags = useMemo(
    () =>
      customers.map((customer) => ({
        ...customer,
        postalCode:
          customer.zipCode ||
          customer.territoryZipCode ||
          extractPostalCode(customer.address_1) ||
          t("customer.noPostalCode"),
      })),
    [customers, t]
  );

  const scopedCustomers = useMemo(() => {
    if (String(selectedMapStoreId) === "all") return customersWithTags;

    const selectedStore = stores.find((store) => String(store.id) === String(selectedMapStoreId));
    const storeCity = normalizeComparableText(selectedStore?.city || "");
    const storeZip = String(selectedStore?.zipCode || "").trim();
    const storeAreaKey = postalAreaKey(storeZip);
    if (!storeZip && !storeCity) return [];

    return customersWithTags.filter((customer) => {
      const customerZip = String(customer.postalCode || "").trim();
      const customerAreaKey = postalAreaKey(customerZip);
      const customerAddress = normalizeComparableText(customer.address_1 || "");

      if (storeZip && customerZip === storeZip) return true;
      if (storeAreaKey && customerAreaKey && storeAreaKey === customerAreaKey) return true;
      if (storeCity && customerAddress.includes(storeCity)) return true;
      return false;
    });
  }, [customersWithTags, selectedMapStoreId, stores]);

  const timeScopedCustomers = useMemo(
    () =>
      scopedCustomers.filter((customer) =>
        isCustomerInTimeFilter(customer, customerTimeFilter)
      ),
    [customerTimeFilter, scopedCustomers]
  );

  const customerPostalCodes = useMemo(
    () =>
      [...new Set(timeScopedCustomers.map((customer) => customer.postalCode))]
        .filter(Boolean)
        .sort((left, right) => String(left).localeCompare(String(right))),
    [timeScopedCustomers]
  );

  const customerFilterBase = useMemo(
    () =>
      timeScopedCustomers.filter((customer) =>
        customerPostalCode === "all" ? true : customer.postalCode === customerPostalCode
      ),
    [customerPostalCode, timeScopedCustomers]
  );

  const visibleCustomers = useMemo(
    () =>
      customerFilterBase
        .filter((customer) => {
          const matchesSegment =
            customerSegmentFilter === "all" ? true : getCustomerSegmentKey(customer) === customerSegmentFilter;

          return matchesSegment;
        })
        .sort((left, right) =>
          String(left.name || "").localeCompare(String(right.name || ""), "es", {
            sensitivity: "base",
          })
        ),
    [customerFilterBase, customerSegmentFilter]
  );

  const customerSegmentStats = useMemo(() => {
    const total = customerFilterBase.length;
    const byKey = segmentCards.reduce((acc, segment) => {
      acc[segment.key] = { count: 0, percent: 0 };
      return acc;
    }, {});

    customerFilterBase.forEach((customer) => {
      const key = getCustomerSegmentKey(customer);
      byKey[key] = {
        ...byKey[key],
        count: (byKey[key]?.count || 0) + 1,
      };
    });

    Object.keys(byKey).forEach((key) => {
      byKey[key].percent = total ? (byKey[key].count / total) * 100 : 0;
    });

    return {
      total,
      byKey,
    };
  }, [customerFilterBase]);

  const customerFilterColor =
    segmentMetaByKey[customerSegmentFilter]?.color || "#3b008b";

  useEffect(() => {
    if (customerPostalCode === "all") return;
    if (customerPostalCodes.includes(customerPostalCode)) return;
    setCustomerPostalCode("all");
  }, [customerPostalCode, customerPostalCodes]);

  useEffect(() => {
    setCustomerPostalCode("all");
    setCustomerSegmentFilter("all");
    setSelectedCustomerId("");
  }, [selectedMapStoreId]);

  useEffect(() => {
    if (!visibleCustomers.length) {
      setSelectedCustomerId("");
      return;
    }

    if (visibleCustomers.some((customer) => String(customer.id) === String(selectedCustomerId))) return;

    setSelectedCustomerId("");
  }, [selectedCustomerId, visibleCustomers]);

  const selectedCustomer = useMemo(
    () =>
      visibleCustomers.find((customer) => String(customer.id) === String(selectedCustomerId)) ||
      null,
    [selectedCustomerId, visibleCustomers]
  );

  const submitStore = async (event) => {
    event.preventDefault();

    if (!selectedPartnerId) {
      setFeedback(t("feedback.selectPartner"));
      return;
    }

    const payload = {
      partnerId: Number(selectedPartnerId),
      ...form,
      reservationCapacity: form.acceptsReservations
        ? Number(form.reservationCapacity || 0)
        : null,
    };

    try {
      if (editingStore) {
        await api.patch(`/api/stores/${editingStore}`, payload);
        setFeedback(t("feedback.storeUpdated"));
      } else {
        const response = await api.post("/api/stores", payload);
        const credential = response.data?.posCredentials || {};
        if (credential.pin) {
          setPosCredentialModal({
            id: response.data?.id,
            storeName: response.data?.storeName || form.storeName,
            username:
              credential.username ||
              partners.find((partner) => String(partner.id) === String(selectedPartnerId))?.name ||
              "",
            pin: credential.pin,
            configured: true,
          });
          setFeedback(t("feedback.storeCreatedWithPin"));
        } else {
          setFeedback(t("feedback.storeCreated"));
        }
      }

      await loadStores(selectedPartnerId);
      setForm(emptyStore);
      setEditingStore(null);
      setShowAdd(false);
    } catch (requestError) {
      console.error("SUBMIT STORE ERROR:", requestError);
      setFeedback(requestError.response?.data?.error || t("feedback.saveStoreError"));
    }
  };

  const toggleActive = async (store, next) => {
    if (next && !hasUsableStoreCoordinates(store)) {
      setCoordinatesModalStore(store);
      return;
    }

    try {
      const response = await api.patch(`/api/stores/${store.id}/active`, { active: next });
      const nextActive = Boolean(response.data?.active ?? next);
      setStores((current) =>
        current.map((row) => (row.id === store.id ? { ...row, active: nextActive } : row))
      );
    } catch (requestError) {
      console.error("TOGGLE STORE ACTIVE ERROR:", requestError);
      if (requestError.response?.data?.error === "store_coordinates_required") {
        setCoordinatesModalStore(store);
        return;
      }
      setFeedback(requestError.response?.data?.message || requestError.response?.data?.error || t("feedback.statusError"));
    }
  };

  const regeneratePosPin = async (store) => {
    const confirmed = window.confirm(
      t("confirm.regeneratePin", { name: store.storeName })
    );
    if (!confirmed) return;

    try {
      setResettingCredentialId(store.id);
      setFeedback("");
      const response = await api.post(`/api/stores/${store.id}/pos-credentials/regenerate`);
      const credential = response.data?.posCredentials || {};
      setPosCredentialModal({
        ...store,
        storeName: store.storeName,
        username:
          credential.username ||
          partners.find((partner) => String(partner.id) === String(selectedPartnerId))?.name ||
          "",
        pin: credential.pin || "",
        configured: true,
      });
      await loadStores(selectedPartnerId);
      setFeedback(t("feedback.pinRegenerated"));
    } catch (requestError) {
      console.error("REGENERATE POS PIN ERROR:", requestError);
      setFeedback(t("feedback.pinError"));
    } finally {
      setResettingCredentialId(null);
    }
  };

  const openPosPinModal = async (store) => {
    const username =
      partners.find((partner) => String(partner.id) === String(selectedPartnerId))?.name ||
      "";

    setPosCredentialModal({
      ...store,
      username,
      pin: "",
      configured: Boolean(store.posCredentialsConfigured),
      loading: true,
    });

    try {
      setLoadingCredentialId(store.id);
      const response = await api.get(`/api/stores/${store.id}/pos-credentials`);
      const credential = response.data?.posCredentials || {};
      const safeStore = response.data?.store || store;
      setPosCredentialModal({
        ...safeStore,
        storeName: safeStore.storeName || store.storeName,
        username: credential.username || username,
        pin: credential.pin || "",
        configured: true,
        loading: false,
        regenerated: Boolean(response.data?.regenerated),
      });
      if (response.data?.regenerated) {
        await loadStores(selectedPartnerId);
        setFeedback(t("feedback.pinNew"));
      }
    } catch (requestError) {
      console.error("FETCH POS PIN ERROR:", requestError);
      setPosCredentialModal({
        ...store,
        username,
        pin: "",
        configured: Boolean(store.posCredentialsConfigured),
        loading: false,
        error: t("feedback.pinLoadError"),
      });
    } finally {
      setLoadingCredentialId(null);
    }
  };

  const deleteStore = async (id) => {
    if (!window.confirm(t("confirm.deleteStore"))) return;

    try {
      await api.delete(`/api/stores/${id}`);
      setStores((current) => current.filter((store) => store.id !== id));
      setFeedback(t("feedback.storeDeleted"));
    } catch (requestError) {
      console.error("DELETE STORE ERROR:", requestError);
      setFeedback(t("feedback.deleteStoreError"));
    }
  };

  const editStore = (store) => {
    setEditingStore(store.id);
    setForm({
      storeName: store.storeName || "",
      address: store.address || "",
      latitude: store.latitude ?? "",
      longitude: store.longitude ?? "",
      city: store.city || "",
      zipCode: store.zipCode || "",
      email: store.email || "",
      tlf: store.tlf || "",
      acceptsReservations: Boolean(store.acceptsReservations),
      reservationCapacity: store.reservationCapacity ?? "",
    });
    setShowAdd(true);
  };

  if (loading) {
    return (
      <div className="sc-page">
        <div className="sc-card">
          <h2>{isLocationsView ? t("title.locations") : t("title.stores")}</h2>
          <p>{t("state.loadingModule")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`sc-page ${isLocationsView ? "sc-page--locations" : ""}`}>
        <header className="sc-header">
          <div>
            <h2>{isLocationsView ? t("title.locations") : t("title.stores")}</h2>
            <p className="sc-subtitle">
              {isLocationsView
                ? t("subtitle.locations")
                : t("subtitle.stores")}
            </p>
          </div>

          <div className="sc-headerActions">
            <select
              className="sc-select"
              value={selectedPartnerId}
              onChange={(event) => setSelectedPartnerId(event.target.value)}
              disabled={lockPartner}
            >
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>

            {!isLocationsView && (
              <button
                className="sc-btn primary sc-addStoreBtn"
                onClick={() => setShowAdd(true)}
                type="button"
              >
                <span className="sc-btnIcon" aria-hidden="true">+</span>
                <span>{t("action.addStore")}</span>
              </button>
            )}
          </div>
        </header>

        {(feedback || pageError) && (
          <div className={`sc-banner ${pageError ? "is-error" : ""}`}>
            {pageError || feedback}
          </div>
        )}

        {!isLocationsView && (
        <section className="sc-card">
          <h3>{t("section.storesList")}</h3>

          <table className="store-table">
            <thead>
              <tr>
                <th>{t("table.del")}</th>
                <th>{t("table.edit")}</th>
                <th>{t("table.name")}</th>
                <th>{t("table.city")}</th>
                <th>{t("table.address")}</th>
                <th>{t("table.status")}</th>
                <th>PIN POS</th>
                <th>{t("table.menu")}</th>
                <th>{t("table.report")}</th>
                <th>{t("table.hours")}</th>
                <th>{t("table.reservations")}</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => {
                const storeHasCoordinates = hasUsableStoreCoordinates(store);
                const isOperationalActive = Boolean(store.active && storeHasCoordinates);
                const isCoordinateBlocked = Boolean(store.active && !storeHasCoordinates);

                return (
                <tr key={store.id}>
                  <td>
                    <button
                      className="table-btn table-btn-icon danger"
                      onClick={() => deleteStore(store.id)}
                      type="button"
                      aria-label={`${t("action.delete")} ${store.storeName}`}
                      title={`${t("action.delete")} ${store.storeName}`}
                    >
                      x
                    </button>
                  </td>
                  <td>
                    <button
                      className="table-btn table-btn-icon edit"
                      onClick={() => editStore(store)}
                      type="button"
                      aria-label={`${t("action.edit")} ${store.storeName}`}
                      title={`${t("action.edit")} ${store.storeName}`}
                    >
                      ✎
                    </button>
                  </td>
                  <td>{store.storeName}</td>
                  <td>{store.city || "-"}</td>
                  <td>{store.address || "-"}</td>
                  <td>
                    <button
                      className={`table-btn status ${
                        isOperationalActive ? "active" : isCoordinateBlocked ? "blocked" : "inactive"
                      }`}
                      onClick={() => toggleActive(store, !isOperationalActive)}
                      type="button"
                      title={
                        storeHasCoordinates
                          ? t("status.changeTitle")
                          : t("status.coordsTitle")
                      }
                    >
                      {isOperationalActive
                        ? t("status.active")
                        : isCoordinateBlocked
                        ? t("status.coords")
                        : t("status.inactive")}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`sc-posPinMask ${store.posCredentialsConfigured ? "is-ready" : "is-missing"}`}
                      onClick={() => openPosPinModal(store)}
                      type="button"
                      disabled={loadingCredentialId === store.id}
                    >
                      {loadingCredentialId === store.id
                        ? "..."
                        : store.posCredentialsConfigured
                          ? "******"
                          : t("pin.none")}
                    </button>
                  </td>
                  <td>
                    <button className="table-btn stock" onClick={() => setStockModal(store)} type="button">
                      {t("table.menu")}
                    </button>
                  </td>
                  <td>
                    <button className="table-btn report" onClick={() => setReportModal(store)} type="button">
                      {t("table.report")}
                    </button>
                  </td>
                  <td>
                    <button className="table-btn hours" onClick={() => setHoursModal(store)} type="button">
                      {t("table.hours")}
                    </button>
                  </td>
                  <td>
                    <button
                      className="table-btn reservations"
                      onClick={() => setReservationsModal(store)}
                      type="button"
                    >
                      {t("table.reservations")}
                    </button>
                  </td>
                </tr>
                );
              })}

              {stores.length === 0 && (
                <tr>
                  <td colSpan="11">
                    <div className="sc-emptyState">{t("state.noStores")}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        )}

        {isLocationsView && (
        <section className="sc-card sc-mapCard">
          <div className="sc-cardHead sc-mapHead">
            <div>
              <h3 className="sc-cardTitle">{t("locations.title")}</h3>
              <p className="sc-mapMeta">
                {t("locations.meta", { count: visibleCustomers.length })}
              </p>
            </div>

            <div className="sc-mapActions">
              <select
                className="sc-select sc-select--compact"
                value={selectedMapStoreId}
                onChange={(event) => setSelectedMapStoreId(event.target.value)}
              >
                <option value="all">{t("locations.allStores")}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>

              {showCust && (
                <select
                  className="sc-select sc-select--compact"
                  value={customerPostalCode}
                  onChange={(event) => setCustomerPostalCode(event.target.value)}
                >
                  <option value="all">{t("locations.allPostalCodes")}</option>
                  {customerPostalCodes.map((postalCode) => (
                    <option key={postalCode} value={postalCode}>
                      {postalCode}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                className="sc-btn ghost"
                onClick={() => setShowCust((previous) => !previous)}
              >
                {showCust ? t("action.hideCustomers") : t("action.showCustomers")}
              </button>
            </div>
          </div>

          {showCust && (
            <div className="sc-mapControls">
              <div
                className="sc-timeFilters"
                aria-label={t("locations.signupFilter")}
                style={{ "--sc-time-filter-color": customerFilterColor }}
              >
                <span>{t("locations.signupFilter")}</span>
                <div className="sc-timeFilterChips">
                  {customerTimeFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`sc-timeFilterBtn ${
                        customerTimeFilter === filter.key ? "is-active" : ""
                      }`}
                      onClick={() => setCustomerTimeFilter(filter.key)}
                    >
                      {t(filter.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sc-territoryModes" aria-label="Segment filters">
                <button
                  type="button"
                  className={`sc-territoryModeBtn is-segment ${
                    customerSegmentFilter === "all" ? "is-active" : ""
                  }`}
                  onClick={() => setCustomerSegmentFilter("all")}
                >
                  <span className="sc-territoryLabel">{t("locations.visible")}</span>
                  <span className="sc-segmentMetric">
                    {customerSegmentStats.total}
                  </span>
                </button>
                {segmentCards.map((segment) => {
                  const stats = customerSegmentStats.byKey[segment.key] || {
                    count: 0,
                    percent: 0,
                  };

                  return (
                    <button
                      key={segment.key}
                      type="button"
                      className={`sc-territoryModeBtn is-segment ${
                        customerSegmentFilter === segment.key ? "is-active" : ""
                      }`}
                      style={{ "--sc-segment-color": segment.color }}
                      onClick={() => setCustomerSegmentFilter(segment.key)}
                    >
                      <span className="sc-segmentSwatch" />
                      <span className="sc-territoryLabel">{segment.shortLabel}</span>
                      <span className="sc-segmentMetric">
                        {stats.count}
                        <small>{formatPercent(stats.percent)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          <MapPanel
            stores={stores}
            customers={visibleCustomers}
            showCustomers={showCust}
            customerPostalCode={customerPostalCode}
            selectedStoreId={selectedMapStoreId}
            selectedCustomerId={selectedCustomerId}
            onSelectStore={(storeId) => setSelectedMapStoreId(String(storeId))}
            onSelectCustomer={setSelectedCustomerId}
            t={t}
          />
        </section>
        )}
      </div>

      {isLocationsView && selectedCustomer && !boostCustomer && (
        <CustomerProfileModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomerId("")}
          onBoostCustomer={(customer) => {
            setBoostCustomer(customer);
          }}
          t={t}
        />
      )}

      {isLocationsView && boostCustomer && (
        <OfferCreatePanelCustomer
          partnerId={selectedPartnerId}
          customer={boostCustomer}
          onClose={() => setBoostCustomer(null)}
          onDone={() => setBoostCustomer(null)}
        />
      )}

      {coordinatesModalStore && (
        <div className="sc-modalBack" onMouseDown={() => setCoordinatesModalStore(null)}>
          <div
            className="sc-modalBox sc-modalBox--notice"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="sc-modalHead">
              <div>
                <span className="sc-modalEyebrow">{t("coordinates.eyebrow")}</span>
                <h3 className="sc-modalTitle">{t("coordinates.title")}</h3>
              </div>
              <button
                className="sc-iconBtn"
                onClick={() => setCoordinatesModalStore(null)}
                type="button"
                aria-label={t("action.close")}
              >
                x
              </button>
            </header>
            <div className="sc-modalBody sc-coordinateNotice">
              <p>
                {t("coordinates.body", { name: coordinatesModalStore.storeName })}
              </p>
              <div className="sc-coordinateChecklist">
                <span>
                  {t("coordinates.latitude")}: {coordinatesModalStore.latitude ?? t("coordinates.pending")}
                </span>
                <span>
                  {t("coordinates.longitude")}: {coordinatesModalStore.longitude ?? t("coordinates.pending")}
                </span>
              </div>
            </div>
            <footer className="sc-modalFooter">
              <button
                type="button"
                className="sc-btn ghost"
                onClick={() => setCoordinatesModalStore(null)}
              >
                {t("action.close")}
              </button>
              <button
                type="button"
                className="sc-btn primary"
                onClick={() => {
                  const store = coordinatesModalStore;
                  setCoordinatesModalStore(null);
                  editStore(store);
                }}
              >
                {t("action.completeCoordinates")}
              </button>
            </footer>
          </div>
        </div>
      )}

      {posCredentialModal && (
        <div className="sc-modalBack" onMouseDown={() => setPosCredentialModal(null)}>
          <div
            className="sc-modalBox sc-modalBox--notice"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="sc-modalHead">
              <div>
                <span className="sc-modalEyebrow">PIN POS</span>
                <h3 className="sc-modalTitle">{posCredentialModal.storeName}</h3>
              </div>
              <button
                className="sc-iconBtn"
                onClick={() => setPosCredentialModal(null)}
                type="button"
                aria-label={t("action.close")}
              >
                x
              </button>
            </header>
            <div className="sc-modalBody sc-posPinModal">
              <div>
                <span>{t("pos.user")}</span>
                <strong>{posCredentialModal.username || "-"}</strong>
              </div>
              <div>
                <span>PIN</span>
                <strong>
                  {posCredentialModal.loading
                    ? t("pos.loading")
                    : posCredentialModal.error
                      ? "-"
                      : posCredentialModal.pin || t("pin.none")}
                </strong>
              </div>
              <p>
                {posCredentialModal.error
                  ? posCredentialModal.error
                  : posCredentialModal.loading
                    ? t("pos.querying")
                    : posCredentialModal.regenerated
                      ? t("pos.regenerated")
                      : posCredentialModal.pin
                        ? t("pos.current")
                  : posCredentialModal.configured
                    ? t("pos.configured")
                    : t("pos.missing")}
              </p>
            </div>
            <footer className="sc-modalFooter">
              <button
                type="button"
                className="sc-btn ghost"
                onClick={() => setPosCredentialModal(null)}
              >
                {t("action.close")}
              </button>
              <button
                type="button"
                className="sc-btn primary"
                onClick={() => regeneratePosPin(posCredentialModal)}
                disabled={resettingCredentialId === posCredentialModal.id}
              >
                {resettingCredentialId === posCredentialModal.id
                  ? t("action.generating")
                  : posCredentialModal.configured
                    ? t("action.regeneratePin")
                    : t("action.generatePin")}
              </button>
            </footer>
          </div>
        </div>
      )}

      {showAdd && (
        <div
          className="sc-modalBack"
          onMouseDown={() => {
            setShowAdd(false);
            setEditingStore(null);
            setForm(emptyStore);
          }}
        >
          <div className="sc-modalBox" onMouseDown={(event) => event.stopPropagation()}>
            <header className="sc-modalHead">
              <h3 className="sc-modalTitle">
                {editingStore ? t("form.editTitle") : t("form.addTitle")}
              </h3>
              <button
                className="sc-iconBtn"
                onClick={() => {
                  setShowAdd(false);
                  setEditingStore(null);
                  setForm(emptyStore);
                }}
                type="button"
              >
                x
              </button>
            </header>

            <form onSubmit={submitStore} className="sc-modalBody store-form">
              <div className="sc-grid">
                <div className="sc-field">
                  <label className="sc-label">{t("form.storeName")}</label>
                  <input
                    className="sc-input"
                    value={form.storeName}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, storeName: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">{t("form.address")}</label>
                  <input
                    className="sc-input"
                    value={form.address}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, address: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">{t("form.latitude")}</label>
                  <input
                    className="sc-input"
                    value={form.latitude}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, latitude: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">{t("form.longitude")}</label>
                  <input
                    className="sc-input"
                    value={form.longitude}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, longitude: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">{t("form.city")}</label>
                  <input
                    className="sc-input"
                    value={form.city}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, city: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">{t("form.zipCode")}</label>
                  <input
                    className="sc-input"
                    value={form.zipCode}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, zipCode: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">{t("form.email")}</label>
                  <input
                    className="sc-input"
                    value={form.email}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, email: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">{t("form.phone")}</label>
                  <input
                    className="sc-input"
                    value={form.tlf}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, tlf: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="sc-field sc-field--toggle">
                <label className="sc-label">{t("form.acceptReservations")}</label>
                <button
                  type="button"
                  className={`sc-toggle ${form.acceptsReservations ? "on" : ""}`}
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      acceptsReservations: !previous.acceptsReservations,
                    }))
                  }
                >
                  <span className="sc-toggle-knob" />
                </button>
              </div>

              {form.acceptsReservations && (
                <div className="sc-field">
                  <label className="sc-label">{t("form.reservationCapacity")}</label>
                  <input
                    type="number"
                    className="sc-input"
                    min="1"
                    value={form.reservationCapacity}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        reservationCapacity: event.target.value,
                      }))
                    }
                  />
                </div>
              )}

              <div className="sc-modalFooter">
                <button
                  type="button"
                  className="sc-btn ghost"
                  onClick={() => {
                    setShowAdd(false);
                    setEditingStore(null);
                    setForm(emptyStore);
                  }}
                >
                  {t("action.cancel")}
                </button>

                <button type="submit" className="sc-btn primary">
                  {t("action.saveStore")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stockModal && (
        <MenuAvailabilityModal store={stockModal} onClose={() => setStockModal(null)} t={t} />
      )}
      {reportModal && (
        <StoreReportModal store={reportModal} onClose={() => setReportModal(null)} t={t} />
      )}
      {hoursModal && <StoreHoursModal store={hoursModal} onClose={() => setHoursModal(null)} t={t} />}
      {reservationsModal && (
        <ReservationsModal store={reservationsModal} onClose={() => setReservationsModal(null)} t={t} />
      )}
    </>
  );
}
