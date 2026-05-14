export default function CouponPortalTransition({
  badge = "VOLTA COUPONS",
  eyebrow = "Activando cupones",
  title = "Preparando tu pase",
  steps = [],
  ariaLabel = "Entrando al salon de cupones",
}) {
  const lanes = [-22, -17, -12, -7, 7, 12, 17, 22];
  const visibleSteps = steps.length ? steps : ["Zona", "Premios", "Partner"];

  return (
    <main className="cg-transitionShell" aria-live="polite">
      <div className="cg-transitionSparkle" />
      <section className="cg-transitionStage" aria-label={ariaLabel}>
        <div className="cg-transitionTunnel" aria-hidden="true">
          {lanes.map((angle, index) => (
            <span
              key={angle}
              className="cg-transitionLane"
              style={{
                "--cg-lane-angle": `${angle}deg`,
                "--cg-lane-delay": `${index * 0.08}s`,
              }}
            />
          ))}
        </div>

        <div className="cg-transitionGate">
          <div className="cg-transitionGateCore">
            <span className="cg-transitionGateRing" />
            <span className="cg-transitionGateRing cg-transitionGateRing-2" />
            <span className="cg-transitionGateRing cg-transitionGateRing-3" />
            <div className="cg-transitionBadge">{badge}</div>
          </div>
        </div>

        <div className="cg-transitionPanel">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <div className="cg-transitionSteps">
            {visibleSteps.map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
          <div className="cg-transitionProgress" aria-hidden="true">
            <span />
          </div>
        </div>
      </section>
    </main>
  );
}
