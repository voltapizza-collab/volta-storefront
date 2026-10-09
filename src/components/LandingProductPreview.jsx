import backofficeScreen from "../assets/hero/backoffice.webp";
import backofficeSmall from "../assets/hero/backoffice-640.webp";
import storefrontScreen from "../assets/hero/storefront.webp";

export default function LandingProductPreview() {
  return (
    <figure className="vp-productPreview" aria-label="Backoffice y Storefront reales de Volta">
      <div className="vp-productDevices">
        <div className="vp-laptop">
          <div className="vp-laptopDisplay">
            <img src={backofficeScreen} srcSet={`${backofficeSmall} 640w, ${backofficeScreen} 1280w`}
              sizes="(max-width: 640px) 67vw, (max-width: 980px) 69vw, 46vw"
              width="1280" height="720" decoding="async"
              alt="Backoffice de Volta: inventario de ingredientes en la cuenta de demostración" />
          </div>
          <div className="vp-laptopBase" aria-hidden="true" />
        </div>
        <div className="vp-phone">
          <img src={storefrontScreen} width="378" height="789" decoding="async"
            alt="Storefront de MyCrushPizza: carta de pizzas de Plaza Diario en el móvil" />
        </div>
      </div>
      <figcaption>Backoffice Volta <span aria-hidden="true">·</span> Storefront MyCrushPizza</figcaption>
    </figure>
  );
}
