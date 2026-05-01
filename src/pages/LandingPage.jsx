import { useState } from "react";
import logo from "../assets/logo/the pizza sale enganine.png";
import heroLogo from "../assets/logo/voltaLogo.jpg";
import "../styles/LandingPage.css";

const modules = [
  {
    name: "Menu vivo",
    text: "Publica productos, tamanos, ingredientes, extras, promos y lanzamientos desde un solo panel.",
  },
  {
    name: "Motor comercial",
    text: "Activa cupones, juegos, recompensas y campanas para mover clientes sin depender solo de descuentos manuales.",
  },
  {
    name: "Operacion local",
    text: "Gestiona tiendas, horarios, reservas, delivery, stock y configuracion visual por cada pizzeria.",
  },
  {
    name: "CRM y mensajes",
    text: "Segmenta clientes y prepara comunicaciones por SMS con control de creditos y trazabilidad.",
  },
];

const metrics = [
  ["1", "panel para operar"],
  ["24/7", "catalogo online"],
  ["SMS", "campanas medibles"],
];

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

  return (
    <main className="vp-site">
      <section className="vp-hero" style={{ "--vp-hero-image": `url(${heroLogo})` }}>
        <div className="vp-nav">
          <a className="vp-brand" href="/" aria-label="Volta Pizza">
            <img src={logo} alt="" />
          </a>
          <nav aria-label="Principal">
            <a href="#sistema">Sistema</a>
            <a href="#contacto">Contacto</a>
            <a href="/backoffice">Acceso</a>
          </nav>
        </div>

        <div className="vp-heroCopy">
          <p className="vp-kicker">The pizza sale engine</p>
          <h1>Volta Pizza</h1>
          <p>
            Plataforma comercial para pizzerias que necesitan vender online,
            activar promociones, gestionar clientes y operar sus tiendas desde
            un sistema preparado para crecer.
          </p>
          <div className="vp-heroActions">
            <a className="vp-primaryLink" href="#contacto">Solicitar demo</a>
            <a className="vp-secondaryLink" href="#sistema">Ver sistema</a>
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
          <span>Que resuelve</span>
          <h2>Una pizzeria necesita mas que una carta online.</h2>
          <p>
            Volta une storefront, backoffice, promociones, CRM y creditos de
            mensajes en una estructura pensada para negocios de pizza.
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
            <h2>De la primera visita al cliente recurrente.</h2>
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
