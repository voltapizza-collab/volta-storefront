import { useState } from "react";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import EngineBackground from "../components/Backoffice/EngineBackground";
import "../styles/LandingPage.css";

const modules = [
  {
    name: "Inventory",
    text: "Productos, bases, ingredientes, extras y stock vivos en un panel denso, rapido y preparado para tienda real.",
  },
  {
    name: "Pizza Creator",
    text: "Construye la carta con tamanos, categorias, toppings y lanzamientos sin romper la operacion del dia.",
  },
  {
    name: "Stores",
    text: "Controla locales, horarios, delivery, reserva y presencia publica desde la misma consola.",
  },
  {
    name: "Customers",
    text: "Segmenta clientes, actividad, cupones y mensajes para convertir visitas en pedidos repetidos.",
  },
];

const metrics = [
  ["01", "backoffice central"],
  ["24/7", "storefront activo"],
  ["SMS", "motor comercial"],
];

const getBackofficeHref = () => {
  const envUrl = process.env.REACT_APP_BACKOFFICE_URL?.trim();
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocal) return `${window.location.origin}/Backoffice`;
  }

  return "https://api.voltapizza.com/Backoffice";
};

export default function LandingPage() {
  const [lead, setLead] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    message: "",
  });

  const updateLead = (field) => (event) => {
    setLead((current) => ({ ...current, [field]: event.target.value }));
  };

  const submitLead = (event) => {
    event.preventDefault();

    const subject = encodeURIComponent(`Nuevo contacto Volta Pizza - ${lead.business || lead.name || "Pizzeria"}`);
    const body = encodeURIComponent(
      [
        `Nombre: ${lead.name}`,
        `Pizzeria: ${lead.business}`,
        `Email: ${lead.email}`,
        `Telefono: ${lead.phone}`,
        "",
        lead.message || "Quiero informacion sobre Volta Pizza.",
      ].join("\n")
    );

    window.location.href = `mailto:contacto@voltapizza.com?subject=${subject}&body=${body}`;
  };

  const backofficeHref = getBackofficeHref();

  return (
    <main className="vp-site">
      <section className="vp-hero">
        <div className="vp-engineField" aria-hidden="true">
          <EngineBackground />
          <div className="vp-tunnelLines"></div>
          <PizzaBg className="vp-bgPizza" />
          <div className="vp-orbit vp-orbitOne"></div>
          <div className="vp-orbit vp-orbitTwo"></div>
        </div>

        <div className="vp-heroGrid">
          <div className="vp-heroCopy">
            <p className="vp-kicker">The pizza sale engine</p>
            <h1>Volta Pizza</h1>
            <p>
              Tu pizzería online, tus clientes y tus datos.
              Recibe más del 90% de cada pedido.
              Vende y opera todo desde un solo motor.
            </p>
            <div className="vp-heroActions">
              <a className="vp-primaryLink" href={backofficeHref}>MyBackoffice</a>
              <a className="vp-secondaryLink" href="#sistema">Ver sistema</a>
              <a className="vp-secondaryLink" href="#contacto">Contacto</a>
            </div>
          </div>
        </div>

        <div className="vp-heroStatus" aria-label="Resumen del sistema">
          {metrics.map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="sistema" className="vp-band vp-systemBand">
        <div className="vp-sectionHead">
          <span>App-layout primero</span>
          <h2>El backoffice como identidad visual del producto.</h2>
          <p>
            El home ahora parte del mismo universo que el login: engranajes,
            movimiento, profundidad, cristal y controles compactos. La pagina
            publica se siente como la puerta de entrada al sistema.
          </p>
        </div>

        <div className="vp-moduleGrid">
          {modules.map((item) => (
            <article key={item.name} className="vp-moduleCard">
              <h3>{item.name}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="vp-band vp-productBand">
        <div className="vp-productLayout">
          <div>
            <span className="vp-kicker">Operacion real</span>
            <h2>Una consola para vender, operar y volver a vender.</h2>
            <p>
              Cada tienda puede tener su menu, promociones, reservas, motor de
              cupones y base de clientes. El objetivo es convertir visitas en
              pedidos repetidos y campanas medibles.
            </p>
          </div>

          <div className="vp-console" aria-label="Vista resumida del producto">
            <div className="vp-consoleTop">
              <span>Backoffice</span>
              <strong>MyCrushPizza</strong>
            </div>
            <div className="vp-consoleRows">
              <div><span>Promos activas</span><strong>8</strong></div>
              <div><span>Cupones generados</span><strong>248</strong></div>
              <div><span>Mensajes disponibles</span><strong>12.500</strong></div>
            </div>
            <div className="vp-consoleFooter">
              <span>Menu publicado</span>
              <span>CRM listo</span>
              <span>Delivery activo</span>
            </div>
            <a className="vp-consoleCta" href={backofficeHref}>Abrir MyBackoffice</a>
          </div>
        </div>
      </section>

      <section id="contacto" className="vp-band vp-contactBand">
        <div className="vp-contactCopy">
          <span className="vp-kicker">Contacto</span>
          <h2>Hablemos de tu pizzeria.</h2>
          <p>
            Envia tus datos y preparamos una demo con el flujo que necesita tu
            negocio: menu, promociones, clientes, reservas y mensajes.
          </p>
          <a href="mailto:contacto@voltapizza.com">contacto@voltapizza.com</a>
        </div>

        <form className="vp-contactForm" onSubmit={submitLead}>
          <label>
            <span>Nombre</span>
            <input value={lead.name} onChange={updateLead("name")} required />
          </label>
          <label>
            <span>Pizzeria</span>
            <input value={lead.business} onChange={updateLead("business")} required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={lead.email} onChange={updateLead("email")} required />
          </label>
          <label>
            <span>Telefono</span>
            <input value={lead.phone} onChange={updateLead("phone")} />
          </label>
          <label className="vp-wideField">
            <span>Mensaje</span>
            <textarea value={lead.message} onChange={updateLead("message")} rows="4" />
          </label>
          <button type="submit">Enviar solicitud</button>
        </form>
      </section>
    </main>
  );
}
