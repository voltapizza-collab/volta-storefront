import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../setupAxios";
import "../../../styles/CouponsModule.css";

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
];

const initialForm = {
  name: "",
  triggerMode: "FIXED",
  fixedAmount: "",
  percentOverAvg: "",
  rewardPizzaId: "",
  active: false,
  startsAt: "",
  endsAt: "",
  daysActive: [],
  windowStart: "",
  windowEnd: "",
};

const formatMoney = (value) => `EUR ${Number(value || 0).toFixed(2)}`;

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toMinutes = (value) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (value) => {
  if (value == null || value === "") return "";
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const getHourRange = (incentives) => {
  const hours = new Set();

  incentives.forEach((incentive) => {
    if (!incentive.active) return;

    if (incentive.windowStart == null || incentive.windowEnd == null) {
      for (let hour = 0; hour < 24; hour += 1) hours.add(hour);
      return;
    }

    const start = Math.floor(incentive.windowStart / 60);
    const end = Math.ceil(incentive.windowEnd / 60);
    const normalizedEnd = incentive.windowStart <= incentive.windowEnd ? end : 24;

    for (let hour = start; hour < normalizedEnd; hour += 1) {
      hours.add(hour);
    }

    if (incentive.windowStart > incentive.windowEnd) {
      for (let hour = 0; hour < end; hour += 1) hours.add(hour);
    }
  });

  return Array.from(hours).sort((left, right) => left - right);
};

const isCellInWindow = (incentive, hour) => {
  if (incentive.windowStart == null || incentive.windowEnd == null) return true;

  const cellStart = hour * 60;
  const cellEnd = cellStart + 60;

  if (incentive.windowStart <= incentive.windowEnd) {
    return cellStart < incentive.windowEnd && cellEnd > incentive.windowStart;
  }

  return cellEnd > incentive.windowStart || cellStart < incentive.windowEnd;
};

export default function IncentivesPanel({ partnerId }) {
  const [incentives, setIncentives] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadAll = useCallback(async () => {
    if (!partnerId) return;

    try {
      setLoading(true);
      const [incentivesResponse, pizzasResponse] = await Promise.all([
        api.get(`/api/incentives?partnerId=${partnerId}`),
        api.get(`/api/pizzas?partnerId=${partnerId}`),
      ]);

      setIncentives(Array.isArray(incentivesResponse.data?.incentives) ? incentivesResponse.data.incentives : []);
      const rows = Array.isArray(pizzasResponse.data) ? pizzasResponse.data : pizzasResponse.data?.pizzas || [];
      setPizzas(rows.filter((pizza) => pizza.status === "ACTIVE" && pizza.type !== "BASE"));
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron cargar los incentivos.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const hours = useMemo(() => getHourRange(incentives), [incentives]);
  const activeDays = useMemo(() => {
    const days = new Set();

    incentives.forEach((incentive) => {
      if (!incentive.active) return;
      const incentiveDays = Array.isArray(incentive.daysActive) && incentive.daysActive.length
        ? incentive.daysActive
        : DAYS.map((day) => day.value);

      incentiveDays.forEach((day) => days.add(day));
    });

    const ordered = DAYS.map((day) => day.value).filter((day) => days.has(day));
    return ordered.length ? ordered : DAYS.map((day) => day.value);
  }, [incentives]);

  const activeCell = (hour, day) => {
    const match = incentives.find((incentive) => {
      if (!incentive.active) return false;
      const days = Array.isArray(incentive.daysActive) && incentive.daysActive.length
        ? incentive.daysActive
        : DAYS.map((item) => item.value);

      return days.includes(day) && isCellInWindow(incentive, hour);
    });

    if (!match) return null;
    const index = incentives.findIndex((item) => item.id === match.id);
    return { name: match.name, color: (index % 7) + 1 };
  };

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setMessage("");
    setForm(initialForm);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (incentive) => {
    setEditingId(incentive.id);
    setForm({
      name: incentive.name || "",
      triggerMode: incentive.triggerMode || "FIXED",
      fixedAmount: incentive.fixedAmount ?? "",
      percentOverAvg: incentive.percentOverAvg ?? "",
      rewardPizzaId: incentive.rewardPizzaId ?? "",
      active: Boolean(incentive.active),
      startsAt: toDateTimeLocalValue(incentive.startsAt),
      endsAt: toDateTimeLocalValue(incentive.endsAt),
      daysActive: Array.isArray(incentive.daysActive) ? incentive.daysActive : [],
      windowStart: minutesToTime(incentive.windowStart),
      windowEnd: minutesToTime(incentive.windowEnd),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      daysActive: prev.daysActive.includes(day)
        ? prev.daysActive.filter((item) => item !== day)
        : [...prev.daysActive, day],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Pon un nombre para el incentivo.");
      return;
    }

    if (!form.rewardPizzaId) {
      setMessage("Selecciona una pizza de recompensa.");
      return;
    }

    if (form.triggerMode === "FIXED" && !Number(form.fixedAmount)) {
      setMessage("Importe minimo invalido.");
      return;
    }

    if (form.triggerMode === "SMART_AVG_TICKET" && !Number(form.percentOverAvg)) {
      setMessage("Porcentaje sobre ticket medio invalido.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        partnerId,
        name: form.name.trim(),
        triggerMode: form.triggerMode,
        rewardPizzaId: Number(form.rewardPizzaId),
        active: Boolean(form.active),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        daysActive: form.daysActive,
        windowStart: toMinutes(form.windowStart),
        windowEnd: toMinutes(form.windowEnd),
        ...(form.triggerMode === "FIXED" ? { fixedAmount: Number(form.fixedAmount) } : {}),
        ...(form.triggerMode === "SMART_AVG_TICKET" ? { percentOverAvg: Number(form.percentOverAvg) } : {}),
      };

      if (editingId) {
        await api.patch(`/api/incentives/${editingId}`, payload);
      } else {
        await api.post("/api/incentives", payload);
      }

      await loadAll();
      closeForm();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || error.response?.data?.error || "No se pudo guardar el incentivo.");
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id) => {
    try {
      setMessage("");
      await api.patch(`/api/incentives/${id}/activate`, { partnerId });
      await loadAll();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || "No se pudo activar el incentivo.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Eliminar incentivo?")) return;

    try {
      await api.delete(`/api/incentives/${id}?partnerId=${partnerId}`);
      await loadAll();
    } catch (error) {
      console.error(error);
      setMessage("No se pudo eliminar el incentivo.");
    }
  };

  return (
    <div className="cp-incentivesLayout">
      <section className="cp-card">
        <div className="cp-incentivesHeader">
          <div>
            <div className="cp-kicker">Incentivos</div>
            <h3>Motor de ticket medio</h3>
          </div>
          <button className="cp-primaryBtn" type="button" onClick={openCreate}>
            Crear incentivo
          </button>
        </div>

        {message && <div className="cp-feedback">{message}</div>}

        <div className="cp-incentivesList">
          {loading && <div className="cp-stateCard">Cargando incentivos...</div>}
          {!loading && !incentives.length && (
            <div className="cp-stateCard">No hay incentivos configurados.</div>
          )}

          {incentives.map((incentive) => (
            <article key={incentive.id} className="cp-incentiveRow">
              <div>
                <strong>{incentive.name}</strong>
                <span>
                  {incentive.triggerMode === "FIXED"
                    ? `Minimo ${formatMoney(incentive.fixedAmount)}`
                    : `${incentive.percentOverAvg}% sobre ticket medio`}
                </span>
                <span>Recompensa: {incentive.rewardPizza?.name || "Pizza no disponible"}</span>
              </div>
              <div className="cp-incentiveMeta">
                <span className={incentive.active ? "is-active" : ""}>
                  {incentive.active ? "Activo" : "Borrador"}
                </span>
                <span>
                  {incentive.windowStart == null
                    ? "Todo el dia"
                    : `${minutesToTime(incentive.windowStart)} - ${minutesToTime(incentive.windowEnd)}`}
                </span>
              </div>
              <div className="cp-rowActions">
                <button type="button" disabled={incentive.active} onClick={() => activate(incentive.id)}>
                  Activar
                </button>
                <button type="button" onClick={() => openEdit(incentive)}>
                  Editar
                </button>
                <button type="button" onClick={() => remove(incentive.id)}>
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-kicker">Agenda</div>
        <h3>Horario activo</h3>

        {!hours.length ? (
          <div className="cp-stateCard">No hay horarios activos.</div>
        ) : (
          <div className="cp-incentiveScheduleWrap">
            <table className="cp-incentiveSchedule">
              <thead>
                <tr>
                  <th>Hora</th>
                  {activeDays.map((day) => (
                    <th key={day}>{DAYS.find((item) => item.value === day)?.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour}>
                    <td>{String(hour).padStart(2, "0")}:00</td>
                    {activeDays.map((day) => {
                      const cell = activeCell(hour, day);
                      return (
                        <td
                          key={day}
                          className={cell ? `cp-scheduleCell incentive-${cell.color}` : "cp-scheduleCell"}
                          title={cell?.name || ""}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="cp-modalOverlay">
          <form className="cp-modal cp-form" onSubmit={submit}>
            <div>
              <div className="cp-kicker">{editingId ? "Editar" : "Crear"}</div>
              <h3>{editingId ? "Editar incentivo" : "Crear incentivo"}</h3>
            </div>

            <label className="cp-field">
              <span>Nombre</span>
              <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </label>

            <div className="cp-formGrid">
              <label className="cp-field">
                <span>Objetivo</span>
                <select value={form.triggerMode} onChange={(event) => updateForm("triggerMode", event.target.value)}>
                  <option value="FIXED">Subir a importe fijo</option>
                  <option value="SMART_AVG_TICKET">% sobre ticket medio</option>
                </select>
              </label>

              {form.triggerMode === "FIXED" ? (
                <label className="cp-field">
                  <span>Importe minimo</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.fixedAmount}
                    onChange={(event) => updateForm("fixedAmount", event.target.value)}
                  />
                </label>
              ) : (
                <label className="cp-field">
                  <span>% sobre ticket medio</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.percentOverAvg}
                    onChange={(event) => updateForm("percentOverAvg", event.target.value)}
                  />
                </label>
              )}
            </div>

            <label className="cp-field">
              <span>Pizza recompensa</span>
              <select value={form.rewardPizzaId} onChange={(event) => updateForm("rewardPizzaId", event.target.value)}>
                <option value="">Selecciona una pizza</option>
                {pizzas.map((pizza) => (
                  <option key={pizza.id} value={pizza.id}>
                    {pizza.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="cp-formGrid">
              <label className="cp-field">
                <span>Activo desde</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => updateForm("startsAt", event.target.value)}
                />
              </label>
              <label className="cp-field">
                <span>Vence</span>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => updateForm("endsAt", event.target.value)}
                />
              </label>
            </div>

            <div className="cp-field">
              <span>Dias</span>
              <div className="cp-pillRow">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={`cp-pill ${form.daysActive.includes(day.value) ? "is-active" : ""}`}
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="cp-helper">Sin dias marcados = todos los dias.</div>
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

            <label className="cp-checkRow">
              <input
                checked={form.active}
                onChange={(event) => updateForm("active", event.target.checked)}
                type="checkbox"
              />
              Activar al guardar
            </label>

            <div className="cp-actions">
              <button type="button" className="cp-tabBtn" onClick={closeForm}>
                Cancelar
              </button>
              <button className="cp-primaryBtn" disabled={saving} type="submit">
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>

            {message && <div className="cp-feedback">{message}</div>}
          </form>
        </div>
      )}
    </div>
  );
}
