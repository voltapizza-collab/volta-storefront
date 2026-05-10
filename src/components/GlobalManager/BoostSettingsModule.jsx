import React, { useEffect, useMemo, useState } from "react";
import api from "../../setupAxios";
import "../../styles/CategoriesModule.css";

const toInputNumber = (value) =>
  value == null || Number.isNaN(Number(value)) ? "" : String(value);

export default function BoostSettingsModule() {
  const [form, setForm] = useState({
    active: true,
    unitPrice: "0.2",
    maxOptions: "3",
    voltaSharePercent: "25",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const partnerSharePercent = useMemo(() => {
    const volta = Number(form.voltaSharePercent || 0);
    return Number.isFinite(volta) ? Math.max(0, 100 - volta) : 75;
  }, [form.voltaSharePercent]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setMessage("");
      const data = await api.get("/api/boost-settings");
      setForm({
        active: data?.active !== false,
        unitPrice: toInputNumber(data?.unitPrice ?? 0.2),
        maxOptions: toInputNumber(data?.maxOptions ?? 3),
        voltaSharePercent: toInputNumber(data?.voltaSharePercent ?? 25),
      });
    } catch (error) {
      console.error(error);
      setMessage("No se pudo cargar la configuracion de Boost.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setMessage("");
  };

  const save = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        active: Boolean(form.active),
        unitPrice: Number(form.unitPrice),
        maxOptions: Number(form.maxOptions),
        voltaSharePercent: Number(form.voltaSharePercent),
      };

      const data = await api.patch("/api/boost-settings", payload);
      setForm({
        active: data?.active !== false,
        unitPrice: toInputNumber(data?.unitPrice),
        maxOptions: toInputNumber(data?.maxOptions),
        voltaSharePercent: toInputNumber(data?.voltaSharePercent),
      });
      setMessage("Configuracion de Boost guardada.");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo guardar la configuracion de Boost.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gmc-container">
      <div className="gmc-header">
        <div>
          <div className="gmc-kicker">Volta System</div>
          <h2>Boost Manager</h2>
          <p>
            Control global del precio de Boost y reparto de ingresos entre Volta
            y el partner.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="gmc-empty">Cargando configuracion...</div>
      ) : (
        <form className="gmc-form" onSubmit={save}>
          <label className="gmc-switchRow">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateField("active", event.target.checked)}
            />
            <span>Boost activo globalmente</span>
          </label>

          <label className="gmc-field">
            <span>Precio por posicion</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.unitPrice}
              onChange={(event) => updateField("unitPrice", event.target.value)}
            />
          </label>

          <label className="gmc-field">
            <span>Opciones maximas mostradas</span>
            <input
              type="number"
              step="1"
              min="1"
              value={form.maxOptions}
              onChange={(event) => updateField("maxOptions", event.target.value)}
            />
          </label>

          <label className="gmc-field">
            <span>Porcentaje Volta</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.voltaSharePercent}
              onChange={(event) =>
                updateField("voltaSharePercent", event.target.value)
              }
            />
          </label>

          <div className="gmc-row gmc-rowStatic">
            <div>
              <div className="gmc-rowName">Reparto actual</div>
              <div className="gmc-rowMeta">
                Volta {Number(form.voltaSharePercent || 0).toFixed(2)}% · Partner{" "}
                {partnerSharePercent.toFixed(2)}%
              </div>
            </div>
          </div>

          <button className="gmc-primaryBtn" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar Boost"}
          </button>

          {message && <div className="gmc-feedback">{message}</div>}
        </form>
      )}
    </div>
  );
}
