import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../setupAxios";
import OfferCreatePanelCustomer from "../components/Backoffice/Coupons/OfferCreatePanelCustomer";
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

const segmentCards = [
  { key: "S1", shortLabel: "Potencial", color: "#7c3aed" },
  { key: "S2", shortLabel: "Nuevo", color: "#0ea5e9" },
  { key: "S3", shortLabel: "Dormido", color: "#f59e0b" },
  { key: "S4", shortLabel: "Activo", color: "#16a34a" },
  { key: "S5", shortLabel: "VIP", color: "#db2777" },
];

const customerTimeFilters = [
  { key: "today", label: "Hoy", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "all", label: "Historico", days: null },
];

const customerReviewFilters = [
  { key: "all", label: "Reviews", color: "#3b008b" },
  { key: "LIKE", label: "Likes", color: "#16a34a" },
  { key: "DISLIKE", label: "Dislikes", color: "#db2777" },
];

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
  const key = String(customer?.segment || "S1").trim().toUpperCase();
  return segmentMetaByKey[key] ? key : "S1";
};

const getCustomerSegmentMeta = (customer) => segmentMetaByKey[getCustomerSegmentKey(customer)];

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

const createCustomerPinIcon = (google, customer, isSelected, reviewFilter = "all") => {
  const segment = getCustomerSegmentMeta(customer);
  const reviewMode = customerReviewFilters.find((item) => item.key === reviewFilter);
  const markerColor = reviewMode && reviewMode.key !== "all" ? reviewMode.color : segment.color;
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

function MenuAvailabilityModal({ store, onClose }) {
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
        setError("No pudimos cargar la disponibilidad del menu de esta tienda.");
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
      setError("No pudimos actualizar la disponibilidad de esta pizza.");
    } finally {
      setSavingPizzaId(null);
    }
  };

  const grouped = useMemo(() => {
    const map = {};

    rows.forEach((row) => {
      const category = row?.pizza?.category || "Sin categoria";
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
          <h3>Catalogo de tienda - {store.storeName}</h3>
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
                        <th className="right">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row) => (
                        <tr key={row.pizzaId}>
                          <td className="sc-pizzaNameCell">{row.pizza?.name}</td>
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
                                ? "Guardando..."
                                : !row.active
                                  ? "Oculta"
                                  : row.available
                                  ? "Disponible"
                                  : "Bloqueada"}
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
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

function StoreHoursModal({ store, onClose }) {
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

  const dayLabels = {
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miercoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sabado",
    Sunday: "Domingo",
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
      setError("No pudimos cargar los horarios.");
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
          <h3>Horario - {store.storeName}</h3>
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
            Aplicar a todos los dias
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
                  <strong>{dayLabels[day] || day}</strong>
                  <button className="table-btn edit" onClick={() => addSlot(day)} type="button">
                    + Anadir bloque
                  </button>
                </div>

                {slotsByDay[day].length === 0 && (
                  <div className="sc-hoursEmpty">Sin bloques todavia.</div>
                )}

                {slotsByDay[day].map((slot) => {
                  const openH = Math.floor(slot.openTime / 60);
                  const openM = slot.openTime % 60;
                  const closeH = Math.floor(slot.closeTime / 60);
                  const closeM = slot.closeTime % 60;

                  return (
                    <div key={slot.id} className="sc-hoursRow">
                      <div className="sc-hoursTimeGroup">
                        <span className="sc-hoursTimeLabel">Abre</span>
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
                        <span className="sc-hoursTimeLabel">Cierra</span>
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
                        aria-label="Eliminar bloque"
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
            Cancelar
          </button>
          <button
            className="sc-btn primary"
            onClick={async () => {
              await save();
              onClose();
            }}
            type="button"
          >
            Guardar y cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

function ReservationsModal({ store, onClose }) {
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
        setError("El backend de reservas aun no esta transplantado en Volta.");
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
      setError("No pudimos actualizar la reserva.");
    }
  };

  const reservationStatusLabel = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending") return "Pendiente";
    if (normalized === "confirmed") return "Confirmada";
    if (normalized === "complete" || normalized === "completed") return "Completada";
    if (normalized === "cancel" || normalized === "canceled" || normalized === "cancelled") return "Cancelada";
    return status || "-";
  };

  return (
    <div className="sc-modalBack" onMouseDown={onClose}>
      <div className="sc-modalBox sc-modalBox--wide sc-reservationsModal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sc-modalHead">
          <div>
            <span className="sc-modalEyebrow">Reservas</span>
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
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Telefono</th>
                    <th>Personas</th>
                    <th>Estado</th>
                    <th className="actions">Acciones</th>
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
                                    Completar
                                  </button>
                                  <button
                                    className="table-btn danger"
                                    onClick={() => patchReservationStatus(row.id, "cancel")}
                                    type="button"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <button className="table-btn" disabled type="button">
                                  Cerrada
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
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

function StoreReportModal({ store, onClose }) {
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
        setError("No pudimos cargar el reporte de esta tienda.");
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
          label: "Ventas totales",
          value: formatMoney(report.kpis?.totalSales),
          meta: report.periodLabel,
        },
        {
          label: "Pedidos",
          value: String(report.kpis?.ordersCount || 0),
          meta: "Ordenes no canceladas",
        },
        {
          label: "Ticket promedio",
          value: formatMoney(report.kpis?.averageTicket),
          meta: "Valor medio por pedido",
        },
        {
          label: "Hora mas vendida",
          value: report.kpis?.bestHour || "Sin dato",
          meta: `${report.kpis?.bestHourOrders || 0} pedidos`,
        },
        {
          label: "Dia mas vendido",
          value: report.kpis?.bestDay || "Sin dato",
          meta: formatMoney(report.kpis?.bestDaySales),
        },
      ]
    : [];

  return (
    <div className="sc-modalBack" onMouseDown={onClose}>
      <div className="sc-modalBox sc-modalBox--wide" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sc-modalHead">
          <h3>Reporte - {store.storeName}</h3>
          <button className="sc-iconBtn" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="sc-modalBody">
          {error ? (
            <div className="sc-emptyState">{error}</div>
          ) : !report ? (
            <div className="sc-emptyState">Cargando reporte...</div>
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
                  <span className="sc-reportLabel">Canal top</span>
                  <strong className="sc-reportValue sc-reportValue--small">
                    {report.kpis?.topChannel || "Sin dato"}
                  </strong>
                  <span className="sc-reportMeta">
                    {report.kpis?.topChannelCount || 0} pedidos
                  </span>
                </div>

                <div className="sc-reportFootCard">
                  <span className="sc-reportLabel">Ultima venta</span>
                  <strong className="sc-reportValue sc-reportValue--small">
                    {report.lastSaleAt
                      ? new Date(report.lastSaleAt).toLocaleString("es-ES")
                      : "Sin dato"}
                  </strong>
                  <span className="sc-reportMeta">Pulso actual de la tienda</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="sc-modalFooter">
          <button className="sc-btn ghost" onClick={onClose} type="button">
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

function CustomerProfileModal({ customer, onClose, onBoostCustomer }) {
  if (!customer) return null;

  const daysOff = Number(customer.daysOff || 0);
  const segment = getCustomerSegmentMeta(customer);
  const daysOffLabel = Number(customer?.orderCount || 0) > 0 ? String(daysOff) : "Sin compras";
  const profileStats = [
    {
      label: "Ticket promedio",
      value: formatCustomerMoney(customer, customer.averageTicket),
      meta: getTicketComparisonLabel(customer),
    },
    {
      label: "Ultimo ticket",
      value: formatCustomerMoney(customer, customer.lastTicket),
      meta: formatDateTime(customer.lastOrderAt),
    },
    {
      label: "Valor acumulado",
      value: formatCustomerMoney(customer, customer.lifetimeValue),
      meta: `${customer.orderCount || 0} pedidos`,
    },
    {
      label: "Dias sin pedir",
      value: daysOffLabel,
      meta: formatDateTime(customer.lastOrderAt),
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
            <h3 className="sc-modalTitle">{customer.name || "Cliente"}</h3>
            <p className="sc-customerProfileSub">
              {customer.phone || "Sin telefono"} - {customer.postalCode || customer.zipCode || "Sin CP"}
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
            <span>{customer.segment || "S1"}</span>
            <span>{getTicketComparisonLabel(customer)}</span>
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
              <span>Direccion</span>
              <strong>{customer.address_1 || "Sin direccion registrada"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{customer.email || "Sin email"}</strong>
            </div>
            {customer.observations && (
              <div>
                <span>Observaciones</span>
                <strong>{customer.observations}</strong>
              </div>
            )}
          </div>
        </div>

        <footer className="sc-modalFooter">
          <button className="sc-btn ghost" onClick={onClose} type="button">
            Cerrar
          </button>
          <button
            className="sc-btn primary"
            onClick={() => onBoostCustomer?.(customer)}
            type="button"
          >
            Crear boost
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
  customerReviewFilter,
  onSelectStore,
  onSelectCustomer,
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
              postalCode !== "Sin CP" &&
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
  }, [customers, postalCoordinates, showCustomers]);

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
              icon: createCustomerPinIcon(google, customer, isSelected, customerReviewFilter),
              title: `${customer.name || "Cliente"} - ${segment.shortLabel} - ${customer.reviewLikes || 0} likes / ${customer.reviewDislikes || 0} dislikes`,
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
    customerReviewFilter,
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
            No hay clientes para este filtro
            {customerPostalCode !== "all" ? ` en ${customerPostalCode}` : ""}.
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
}) {
  const isLocationsView = view === "locations";
  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [stores, setStores] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showCust, setShowCust] = useState(false);
  const [customerPostalCode, setCustomerPostalCode] = useState("all");
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState("all");
  const [customerReviewFilter, setCustomerReviewFilter] = useState("all");
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
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [pageError, setPageError] = useState("");

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
        setPageError("No pudimos cargar el modulo de tiendas.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [initialPartnerId, isLocationsView, loadCustomers, loadPartners, loadStores, selectedPartnerId]);

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
      setPageError("No pudimos filtrar las tiendas del partner.");
    });
  }, [isLocationsView, loadCustomers, loadStores, selectedPartnerId]);

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
          "Sin CP",
      })),
    [customers]
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
          const matchesReview =
            customerReviewFilter === "LIKE"
              ? Number(customer.reviewLikes || 0) > 0
              : customerReviewFilter === "DISLIKE"
                ? Number(customer.reviewDislikes || 0) > 0
                : true;

          return matchesSegment && matchesReview;
        })
        .sort((left, right) =>
          String(left.name || "").localeCompare(String(right.name || ""), "es", {
            sensitivity: "base",
          })
        ),
    [customerFilterBase, customerReviewFilter, customerSegmentFilter]
  );

  const customerReviewStats = useMemo(() => {
    const total = customerFilterBase.filter((customer) => Number(customer.reviewVotes || 0) > 0).length;
    const likes = customerFilterBase.filter((customer) => Number(customer.reviewLikes || 0) > 0).length;
    const dislikes = customerFilterBase.filter((customer) => Number(customer.reviewDislikes || 0) > 0).length;

    return {
      all: total,
      LIKE: likes,
      DISLIKE: dislikes,
    };
  }, [customerFilterBase]);

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
    setCustomerReviewFilter("all");
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
      setFeedback("Selecciona un partner antes de guardar la tienda.");
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
        setFeedback("Tienda actualizada.");
      } else {
        await api.post("/api/stores", payload);
        setFeedback("Tienda creada.");
      }

      await loadStores(selectedPartnerId);
      setForm(emptyStore);
      setEditingStore(null);
      setShowAdd(false);
    } catch (requestError) {
      console.error("SUBMIT STORE ERROR:", requestError);
      setFeedback(requestError.response?.data?.error || "No pudimos guardar la tienda.");
    }
  };

  const toggleActive = async (id, next) => {
    await api.patch(`/api/stores/${id}/active`, { active: next });
    setStores((current) =>
      current.map((store) => (store.id === id ? { ...store, active: next } : store))
    );
  };

  const deleteStore = async (id) => {
    if (!window.confirm("Delete store?")) return;

    try {
      await api.delete(`/api/stores/${id}`);
      setStores((current) => current.filter((store) => store.id !== id));
      setFeedback("Tienda eliminada.");
    } catch (requestError) {
      console.error("DELETE STORE ERROR:", requestError);
      setFeedback("No pudimos eliminar la tienda.");
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
          <h2>{isLocationsView ? "Locations" : "Stores"}</h2>
          <p>Cargando modulo...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`sc-page ${isLocationsView ? "sc-page--locations" : ""}`}>
        <header className="sc-header">
          <div>
            <h2>{isLocationsView ? "Locations" : "Stores"}</h2>
            <p className="sc-subtitle">
              {isLocationsView
                ? "Mapa, clientes y filtros para analizar el territorio."
                : "Lista de tiendas y funciones operativas del partner."}
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
                <span>Add Stores</span>
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
          <h3>Stores list</h3>

          <table className="store-table">
            <thead>
              <tr>
                <th>Del</th>
                <th>Edit</th>
                <th>Name</th>
                <th>City</th>
                <th>Address</th>
                <th>Status</th>
                <th>Menu</th>
                <th>Reporte</th>
                <th>Hours</th>
                <th>Reservations</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id}>
                  <td>
                    <button
                      className="table-btn table-btn-icon danger"
                      onClick={() => deleteStore(store.id)}
                      type="button"
                      aria-label={`Eliminar ${store.storeName}`}
                      title={`Eliminar ${store.storeName}`}
                    >
                      x
                    </button>
                  </td>
                  <td>
                    <button
                      className="table-btn table-btn-icon edit"
                      onClick={() => editStore(store)}
                      type="button"
                      aria-label={`Editar ${store.storeName}`}
                      title={`Editar ${store.storeName}`}
                    >
                      ✎
                    </button>
                  </td>
                  <td>{store.storeName}</td>
                  <td>{store.city || "-"}</td>
                  <td>{store.address || "-"}</td>
                  <td>
                    <button
                      className={`table-btn status ${store.active ? "active" : "inactive"}`}
                      onClick={() => toggleActive(store.id, !store.active)}
                      type="button"
                    >
                      {store.active ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td>
                    <button className="table-btn stock" onClick={() => setStockModal(store)} type="button">
                      Menu
                    </button>
                  </td>
                  <td>
                    <button className="table-btn report" onClick={() => setReportModal(store)} type="button">
                      Reporte
                    </button>
                  </td>
                  <td>
                    <button className="table-btn hours" onClick={() => setHoursModal(store)} type="button">
                      Hours
                    </button>
                  </td>
                  <td>
                    <button
                      className="table-btn reservations"
                      onClick={() => setReservationsModal(store)}
                      type="button"
                    >
                      Reservations
                    </button>
                  </td>
                </tr>
              ))}

              {stores.length === 0 && (
                <tr>
                  <td colSpan="10">
                    <div className="sc-emptyState">No hay tiendas para este partner todavia.</div>
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
              <h3 className="sc-cardTitle">Store locations</h3>
              <p className="sc-mapMeta">
                {visibleCustomers.length} clientes visibles - filtros de segmento y territorio
              </p>
            </div>

            <div className="sc-mapActions">
              <select
                className="sc-select sc-select--compact"
                value={selectedMapStoreId}
                onChange={(event) => setSelectedMapStoreId(event.target.value)}
              >
                <option value="all">All stores</option>
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
                  <option value="all">Todos los codigos postales</option>
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
                {showCust ? "Hide customers" : "Show customers"}
              </button>
            </div>
          </div>

          {showCust && (
            <div className="sc-mapControls">
              <div
                className="sc-timeFilters"
                aria-label="Filtro de alta de clientes"
                style={{ "--sc-time-filter-color": customerFilterColor }}
              >
                <span>Altas</span>
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
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sc-territoryModes" aria-label="Filtros de segmento">
                <button
                  type="button"
                  className={`sc-territoryModeBtn is-segment ${
                    customerSegmentFilter === "all" ? "is-active" : ""
                  }`}
                  onClick={() => setCustomerSegmentFilter("all")}
                >
                  <span className="sc-territoryLabel">Visibles</span>
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

              <div className="sc-reviewModes" aria-label="Filtros de reviews">
                {customerReviewFilters.map((filter) => {
                  const count =
                    filter.key === "all"
                      ? customerReviewStats.all
                      : customerReviewStats[filter.key] || 0;

                  return (
                    <button
                      key={filter.key}
                      type="button"
                      className={`sc-territoryModeBtn is-review ${
                        customerReviewFilter === filter.key ? "is-active" : ""
                      }`}
                      style={{ "--sc-review-color": filter.color }}
                      onClick={() => setCustomerReviewFilter(filter.key)}
                    >
                      <span className="sc-reviewSwatch" />
                      <span className="sc-territoryLabel">{filter.label}</span>
                      <span className="sc-reviewMetric">{count}</span>
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
            customerReviewFilter={customerReviewFilter}
            onSelectStore={(storeId) => setSelectedMapStoreId(String(storeId))}
            onSelectCustomer={setSelectedCustomerId}
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
              <h3 className="sc-modalTitle">{editingStore ? "Edit store" : "Add store"}</h3>
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
                  <label className="sc-label">Store name</label>
                  <input
                    className="sc-input"
                    value={form.storeName}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, storeName: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">Address</label>
                  <input
                    className="sc-input"
                    value={form.address}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, address: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">Latitude</label>
                  <input
                    className="sc-input"
                    value={form.latitude}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, latitude: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">Longitude</label>
                  <input
                    className="sc-input"
                    value={form.longitude}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, longitude: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">City</label>
                  <input
                    className="sc-input"
                    value={form.city}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, city: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">Zip code</label>
                  <input
                    className="sc-input"
                    value={form.zipCode}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, zipCode: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">Email</label>
                  <input
                    className="sc-input"
                    value={form.email}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, email: event.target.value }))
                    }
                  />
                </div>

                <div className="sc-field">
                  <label className="sc-label">Phone</label>
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
                <label className="sc-label">Accept reservations</label>
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
                  <label className="sc-label">Reservation capacity (people)</label>
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
                  Cancel
                </button>

                <button type="submit" className="sc-btn primary">
                  Save store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stockModal && (
        <MenuAvailabilityModal store={stockModal} onClose={() => setStockModal(null)} />
      )}
      {reportModal && (
        <StoreReportModal store={reportModal} onClose={() => setReportModal(null)} />
      )}
      {hoursModal && <StoreHoursModal store={hoursModal} onClose={() => setHoursModal(null)} />}
      {reservationsModal && (
        <ReservationsModal store={reservationsModal} onClose={() => setReservationsModal(null)} />
      )}
    </>
  );
}
