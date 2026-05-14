import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CouponPortalTransition from "../components/CouponGallery/CouponPortalTransition";
import api from "../setupAxios";
import "../styles/CouponGallery.css";
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
  const partnerName = context?.partner?.name || "Volta";
  const gameName = context?.game?.name || copy.title;

  return (
    <main className="vg-root">
      <div className="vg-transitionSparkle" aria-hidden="true" />
      <div className="vg-layout">
        <section className="vg-block vg-hero">
          <div>
            <div className="vg-kicker">{copy.kicker}</div>
            <h1>{gameName}</h1>
            <p>{copy.text}</p>
          </div>
          {context?.partner?.brandLogoUrl && (
            <img src={context.partner.brandLogoUrl} alt={context.partner.name} />
          )}
        </section>

        <section className="vg-block vg-playBlock" aria-label="Area de juego">
          {remainingMs > 0 ? (
            <div className="vg-lock">
              <span>Juego en pausa</span>
              <strong>{formatCountdown(remainingMs)}</strong>
              <p>Hace poco hubo un ganador. Vuelve cuando el contador termine.</p>
              <button type="button" onClick={onBack}>Volver a cupones</button>
            </div>
          ) : (
            children
          )}
        </section>

        <section className="vg-block vg-adBanner" aria-label="Informacion de tienda">
          <div>
            <span>{partnerName}</span>
            <strong>Cupones activos en tienda</strong>
          </div>
          <p>Guarda tu premio dorado y canjealo en tu siguiente pedido.</p>
          <button type="button" onClick={onBack}>Ver mas cupones</button>
        </section>
      </div>
    </main>
  );
}

function ClaimPanel({ won, playId, context, partnerSlug, gameSlug }) {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
    <section className="vg-gamePanel vg-claim">
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

function OutOfAttemptsModal({ onContinue, onStore }) {
  return (
    <div className="vg-endModalBack" role="dialog" aria-modal="true" aria-labelledby="vg-end-title">
      <section className="vg-endModal">
        <span>Intentos agotados</span>
        <h2 id="vg-end-title">Se acabaron tus 3 oportunidades</h2>
        <p>Puedes reiniciar el reto ahora o volver a la tienda.</p>
        <div className="vg-endActions">
          <button type="button" onClick={onContinue}>Seguir jugando</button>
          <button type="button" onClick={onStore}>Volver a tienda</button>
        </div>
      </section>
    </div>
  );
}

function WinningNumberGame({ context, onPlayed, partnerSlug, gameSlug, onBackToStore }) {
  const [attempts, setAttempts] = useState(3);
  const [last, setLast] = useState(null);
  const [won, setWon] = useState(false);
  const [playId, setPlayId] = useState(null);
  const [rolling, setRolling] = useState(false);

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
      <section className="vg-gamePanel vg-number">
        <span>Numero ganador</span>
        <div className="vg-digits">{formatNumber(context?.targetNumber).split("").map((digit, index) => <b key={index}>{digit}</b>)}</div>
        {last != null && <p>Tu tirada: <strong>{formatNumber(last)}</strong></p>}
        <button type="button" onClick={play} disabled={rolling || attempts <= 0 || won}>
          {rolling ? "Girando..." : "Probar suerte"}
        </button>
        <small>Intentos restantes: {attempts}</small>
      </section>
      <ClaimPanel won={won} playId={playId} context={context} partnerSlug={partnerSlug} gameSlug={gameSlug} />
      {attempts <= 0 && !won && (
        <OutOfAttemptsModal
          onContinue={() => {
            setAttempts(3);
            setLast(null);
          }}
          onStore={onBackToStore}
        />
      )}
    </>
  );
}

function PerfectTimingGame({ context, onPlayed, partnerSlug, gameSlug, onBackToStore }) {
  const [running, setRunning] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [attempts, setAttempts] = useState(3);
  const [won, setWon] = useState(false);
  const [playId, setPlayId] = useState(null);
  const [clockFeedback, setClockFeedback] = useState("");
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const resetTimerRef = useRef(null);

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

  useEffect(() => () => window.clearTimeout(resetTimerRef.current), []);

  const toggle = async () => {
    if (attempts <= 0 || won) return;
    if (!running) {
      window.clearTimeout(resetTimerRef.current);
      setClockFeedback("");
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
    if (data.won) {
      setClockFeedback("win");
    } else {
      setClockFeedback("miss");
      resetTimerRef.current = window.setTimeout(() => {
        setTimeMs(0);
        setClockFeedback("");
      }, 680);
    }
    onPlayed(data);
  };

  return (
    <>
      <section className="vg-gamePanel vg-timing">
        <div className={`vg-clock ${clockFeedback === "win" ? "is-win" : ""} ${clockFeedback === "miss" ? "is-miss" : ""}`}>
          {(timeMs / 1000).toFixed(2)}
        </div>
        {clockFeedback === "miss" && <p className="vg-clockHint">No era el numero objetivo. Reiniciando...</p>}
        <button type="button" onClick={toggle} disabled={attempts <= 0 || won}>
          {running ? "STOP" : "START"}
        </button>
        <small>Objetivo: 9.99s - intentos: {attempts}</small>
      </section>
      <ClaimPanel won={won} playId={playId} context={context} partnerSlug={partnerSlug} gameSlug={gameSlug} />
      {attempts <= 0 && !won && (
        <OutOfAttemptsModal
          onContinue={() => {
            window.clearTimeout(resetTimerRef.current);
            setAttempts(3);
            setTimeMs(0);
            setClockFeedback("");
          }}
          onStore={onBackToStore}
        />
      )}
    </>
  );
}

function CrustRingGame({ context, onPlayed, partnerSlug, gameSlug, onBackToStore }) {
  const [fit, setFit] = useState(86);
  const [won, setWon] = useState(false);
  const [playId, setPlayId] = useState(null);
  const [attempts, setAttempts] = useState(3);

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
      <section className="vg-gamePanel vg-crust">
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
      <ClaimPanel won={won} playId={playId} context={context} partnerSlug={partnerSlug} gameSlug={gameSlug} />
      {attempts <= 0 && !won && (
        <OutOfAttemptsModal
          onContinue={() => {
            setAttempts(3);
            setFit(86);
          }}
          onStore={onBackToStore}
        />
      )}
    </>
  );
}

export default function GamePage({ fixedGameSlug }) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const partnerSlug = params.partnerSlug || "mycrushpizza";
  const gameSlug = fixedGameSlug || params.gameSlug || "winning-number";
  const [context, setContext] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [portalReady, setPortalReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPortalReady(false);
    const timer = window.setTimeout(() => setPortalReady(true), 900);
    return () => window.clearTimeout(timer);
  }, [partnerSlug, gameSlug]);

  useEffect(() => {
    let mounted = true;
    setError("");
    api
      .get(`/api/games/${partnerSlug}/${gameSlug}/status`)
      .then(({ data }) => {
        if (!mounted) return;
        setContext(data);
        setRemainingMs(data.remainingMs || 0);
      })
      .catch((requestError) => {
        console.error(requestError);
        if (mounted) setError("No se pudo cargar el juego.");
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
    const props = {
      context,
      onPlayed,
      partnerSlug,
      gameSlug,
      onBackToStore: () => navigate(`/${partnerSlug}`),
    };
    if (gameSlug === "perfect-timing") return <PerfectTimingGame {...props} />;
    if (gameSlug === "crust-ring") return <CrustRingGame {...props} />;
    return <WinningNumberGame {...props} />;
  }, [context, gameSlug, navigate, partnerSlug]);

  if (error && portalReady) {
    return (
      <main className="vg-root">
        <div className="vg-transitionSparkle" aria-hidden="true" />
        <section className="vg-block vg-lock">{error}</section>
      </main>
    );
  }

  if (!context || !portalReady) {
    const gameName = location.state?.gameName || gameSlug.replaceAll("-", " ");
    return (
      <CouponPortalTransition
        badge="VOLTA PLAY"
        eyebrow="Activando juego"
        title="Entrando al premio dorado"
        steps={["Cupon dorado", gameName, location.state?.partnerName || partnerSlug]}
        ariaLabel="Entrando al juego del cupon"
      />
    );
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
