export default function OrderPortalTransition({
  title = "Welcome",
  eyebrow = "Volta Arcade",
  partnerName = "MyCrushPizza",
  mode = "order",
}) {
  const beams = [-42, -31, -20, -9, 8, 19, 30, 41];
  const speedLines = Array.from({ length: 14 }, (_, index) => index);
  const headlineWords =
    mode === "brand"
      ? ["Welcome", "Bienvenido", "Benvenuti"]
      : title.replace(/\.+$/, "").split(" ");
  const ariaTitle = headlineWords.join(" ");

  return (
    <main className={`sf-orderPortal sf-orderPortal--${mode}`} aria-live="polite">
      <div className="sf-orderPortal__scan" aria-hidden="true" />
      <section className="sf-orderPortal__stage" aria-label={ariaTitle}>
        <div className="sf-orderPortal__speedLines" aria-hidden="true">
          {speedLines.map((line) => (
            <span key={line} style={{ "--sf-line-index": line }} />
          ))}
        </div>
        <div className="sf-orderPortal__powerField" aria-hidden="true">
          {beams.map((angle, index) => (
            <span
              key={angle}
              className="sf-orderPortal__beam"
              style={{
                "--sf-power-angle": `${angle}deg`,
                "--sf-power-delay": `${index * 0.07}s`,
              }}
            />
          ))}
        </div>
        <div className="sf-orderPortal__rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="sf-orderPortal__aura" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="sf-orderPortal__core">
          <p>{mode === "brand" ? partnerName : eyebrow}</p>
          <h1>
            {headlineWords.map((word, index) => (
              <span
                key={`${word}-${index}`}
                className="sf-orderPortal__word"
                style={{ "--sf-word-delay": `${index * 0.08}s` }}
              >
                {word}
              </span>
            ))}
          </h1>
        </div>
      </section>
    </main>
  );
}
