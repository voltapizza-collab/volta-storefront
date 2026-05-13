import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../setupAxios";
import "../styles/Games.css";

const GAME_COPY = {
  "winning-number": {
    kicker: "Numero ganador",
    title: "Acierta el numero",
    text: "Tienes tres intentos. Si tu tirada coincide con el numero ganador, desbloqueas el cupon dorado.",
  },
  "perfect-timing": {
    kicker: "Perfect Timing",
    title: "Frena en 9.99",
    text: "Pulsa start, espera el momento exacto y detiene el reloj lo mas cerca posible de 9.99 segundos.",
  },
  "crust-ring": {
    kicker: "Borde perfecto",
    title: "Calza el borde",
    text: "Ajusta el borde al diametro exacto de la pizza que gira y bajalo cuando lo veas perfecto.",
  },
};

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const formatNumber = (value) => String(value ?? 0).padStart(3, "0");

function GameShell({ children, context, remainingMs, onBack }) {
  const copy = GAME_COPY[context?.game?.slug] || GAME_COPY["winning-number"];

  return (
    <main className="vg-root">
      <section className="vg-card vg-hero">
        <div>
          <div className="vg-kicker">{copy.kicker}</div>
          <h1>{copy.title}</h1>
          <p>{copy.text}</p>
        </div>
        {context?.partner?.brandLogoUrl && (
          <img src={context.partner.brandLogoUrl} alt={context.partner.name} />
        )}
      </section>

      {remainingMs > 0 ? (
        <section className="vg-card vg-lock">
          <span>Juego en pausa</span>
          <strong>{formatCountdown(remainingMs)}</strong>
          <p>Hace poco hubo un ganador. Vuelve cuando el contador termine.</p>
          <button type="button" onClick={onBack}>Volver a cupones</button>
        </section>
      ) : (
        children
      )}
    </main>
  );
}

function ClaimPanel({ won, playId, context }) {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { partnerSlug, gameSlug } = useParams();

  if (!won || !playId) return null;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const { data } = await api.post(`/api/games/${partnerSlug}/${gameSlug}/claim`, {
        playId,
        name: form.name,
        phone: form.phone,
      });
      setResult(data);
    } catch (requestError) {
      const code = requestError.response?.data?.error;
      setError(
        code === "out_of_stock"
          ? "Ahora mismo no quedan cupones dorados para este juego."
          : code === "invalid_phone"
            ? "Revisa el telefono para enviarte el cupon."
            : "No se pudo reclamar el premio."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="vg-card vg-claim">
      {result?.coupon ? (
        <>
          <span>Cupon dorado listo</span>
          <strong>{result.coupon.code}</strong>
          <p>
            {result.sms?.sent
              ? "Te lo enviamos por SMS."
              : "El codigo queda reservado. Si no llega SMS, puedes usar este codigo."}
          </p>
        </>
      ) : (
        <form onSubmit={submit}>
          <span>Ganaste</span>
          <strong>{context?.game?.name || "Premio dorado"}</strong>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Tu nombre"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Telefono"
            inputMode="tel"
          />
          {error && <p className="vg-error">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Reclamando..." : "Enviar cupon por SMS"}
          </button>
        </form>
      )}
    </section>
  );
}

function WinningNumberGame({ context, onPlayed }) {
  const [attempts, setAttempts] = useState(3);
  const [last, setLast] = useState(null);
  const [won, setWon] = useState(false);
  const [playId, setPlayId] = useState(null);
  const [rolling, setRolling] = useState(false);
  const { partnerSlug, gameSlug } = useParams();

  const play = async () => {
    if (rolling || attempts <= 0 || won) return;
    setRolling(true);
    try {
      const { data } = await api.post(`/api/games/${partnerSlug}/${gameSlug}/play`, {});
      setLast(data.result?.attempt);
      setWon(Boolean(data.won));
      setPlayId(data.playId || null);
      setAttempts((current) => Math.max(0, current - 1));
      onPlayed(data);
    } finally {
      setRolling(false);
    }
  };

  return (
    <>
      <section className="vg-card vg-number">
        <span>Numero ganador</span>
        <div className="vg-digits">{formatNumber(context?.targetNumber).split("").map((digit, index) => <b key={index}>{digit}</b>)}</div>
        {last != null && <p>Tu tirada: <strong>{formatNumber(last)}</strong></p>}
        <button type="button" onClick={play} disabled={rolling || attempts <= 0 || won}>
          {rolling ? "Girando..." : "Probar suerte"}
        </button>
        <small>Intentos restantes: {attempts}</small>
      </section>
      <ClaimPanel won={won} playId={playId} context={context} />
    </>
  );
}

function PerfectTimingGame({ context, onPlayed }) {
  const [running, setRunning] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [attempts, setAttempts] = useState(3);
  const [won, setWon] = useState(false);
  const [playId, setPlayId] = useState(null);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const { partnerSlug, gameSlug } = useParams();

  useEffect(() => {
    if (!running) return undefined;
    const tick = (now) => {
      if (!startRef.current) startRef.current = now;
      setTimeMs(now - startRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [running]);

  const toggle = async () => {
    if (attempts <= 0 || won) return;
    if (!running) {
      startRef.current = null;
      setTimeMs(0);
      setRunning(true);
      return;
    }

    setRunning(false);
    cancelAnimationFrame(frameRef.current);
    const finalTime = timeMs;
    const { data } = await api.post(`/api/games/${partnerSlug}/${gameSlug}/play`, { timeMs: finalTime });
    setWon(Boolean(data.won));
    setPlayId(data.playId || null);
    setAttempts((current) => Math.max(0, current - 1));
    onPlayed(data);
  };

  return (
    <>
      <section className="vg-card vg-timing">
        <div className={`vg-clock ${won ? "is-win" : ""}`}>{(timeMs / 1000).toFixed(2)}</div>
        <button type="button" onClick={toggle} disabled={attempts <= 0 || won}>
          {running ? "STOP" : "START"}
        </button>
        <small>Objetivo: 9.99s · intentos: {attempts}</small>
      </section>
      <ClaimPanel won={won} playId={playId} context={context} />
    </>
  );
}

function CrustRingGame({ context, onPlayed }) {
  const [fit, setFit] = useState(86);
  const [won, setWon] = useState(false);
  const [playId, setPlayId] = useState(null);
  const [attempts, setAttempts] = useState(3);
  const { partnerSlug, gameSlug } = useParams();

  const drop = async () => {
    if (attempts <= 0 || won) return;
    const { data } = await api.post(`/api/games/${partnerSlug}/${gameSlug}/play`, { fit });
    setWon(Boolean(data.won));
    setPlayId(data.playId || null);
    setAttempts((current) => Math.max(0, current - 1));
    onPlayed(data);
  };

  return (
    <>
      <section className="vg-card vg-crust">
        <div className="vg-pizzaStage">
          <div className="vg-pizzaBase" />
          <div className={`vg-crustRing ${won ? "is-win" : ""}`} style={{ width: `${fit}%`, height: `${fit}%` }} />
        </div>
        <label>
          Ajuste del borde
          <input
            type="range"
            min="82"
            max="118"
            step="0.5"
            value={fit}
            onChange={(event) => setFit(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={drop} disabled={attempts <= 0 || won}>
          Bajar borde
        </button>
        <small>Intentos restantes: {attempts}</small>
      </section>
      <ClaimPanel won={won} playId={playId} context={context} />
    </>
  );
}

export default function GamePage({ fixedGameSlug }) {
  const params = useParams();
  const navigate = useNavigate();
  const partnerSlug = params.partnerSlug || "mycrushpizza";
  const gameSlug = fixedGameSlug || params.gameSlug || "winning-number";
  const [context, setContext] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    let mounted = true;
    api.get(`/api/games/${partnerSlug}/${gameSlug}/status`).then(({ data }) => {
      if (!mounted) return;
      setContext(data);
      setRemainingMs(data.remainingMs || 0);
    });
    return () => {
      mounted = false;
    };
  }, [partnerSlug, gameSlug]);

  useEffect(() => {
    if (!remainingMs) return undefined;
    const id = setInterval(() => setRemainingMs((current) => Math.max(0, current - 1000)), 1000);
    return () => clearInterval(id);
  }, [remainingMs]);

  const gameNode = useMemo(() => {
    const onPlayed = (data) => {
      if (data.remainingMs) setRemainingMs(data.remainingMs);
    };
    if (gameSlug === "perfect-timing") return <PerfectTimingGame context={context} onPlayed={onPlayed} />;
    if (gameSlug === "crust-ring") return <CrustRingGame context={context} onPlayed={onPlayed} />;
    return <WinningNumberGame context={context} onPlayed={onPlayed} />;
  }, [context, gameSlug]);

  if (!context) {
    return <main className="vg-root"><section className="vg-card vg-lock">Cargando juego...</section></main>;
  }

  return (
    <GameShell
      context={context}
      remainingMs={remainingMs}
      onBack={() => navigate(`/${partnerSlug}/coupons`)}
    >
      {gameNode}
    </GameShell>
  );
}
