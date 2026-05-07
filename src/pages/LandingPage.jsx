import { useState } from "react";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import voltaSystemsLogo from "../assets/logo/the pizza sale enganine.png";
import EngineBackground from "../components/Backoffice/EngineBackground";
import "../styles/LandingPage.css";

const modules = [
  {
    name: "Storefront",
    text: "La tienda online publica: menu, reservas, delivery, cupones y pedidos listos para convertir visitas en ventas.",
  },
  {
    name: "Backoffice",
    text: "El centro de mando para operar locales, ventas, clientes, mensajes, configuracion y actividad diaria.",
  },
  {
    name: "Pizza Creator",
    text: "Construye pizzas, tamanos, bases, toppings, extras y combos con una carta preparada para vender.",
  },
  {
    name: "CRM & Promos",
    text: "Segmenta clientes, lanza ofertas, mide redenciones y convierte cada pedido en una nueva oportunidad.",
  },
];

const metrics = [
  ["01", "backoffice central"],
  ["24/7", "storefront activo"],
  ["SMS", "motor comercial"],
];

const partnerBrands = ["Nonna Pizza", "Slice Club", "Forno Vivo", "Masa Nova", "Pizza Norte"];

const footerGroups = [
  {
    title: "Producto",
    links: ["Storefront", "Backoffice", "Pizza Creator", "CRM & Promos"],
  },
  {
    title: "Compras",
    links: ["Pedidos online", "Reservas", "Cupones", "Demo comercial"],
  },
  {
    title: "Marcas",
    links: partnerBrands,
  },
];

const contactLinks = [
  { label: "Email", href: "mailto:contacto@voltapizza.com", icon: "mail" },
  { label: "Demo", href: "#contacto", icon: "chat" },
  { label: "Llamada", href: "#contacto", icon: "phone" },
];

const socialLinks = [
  { label: "X", href: "#contacto", text: "X" },
  { label: "Instagram", href: "#contacto", text: "IG" },
  { label: "Facebook", href: "#contacto", text: "FB" },
  { label: "YouTube", href: "#contacto", text: "YT" },
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

function ContactIcon({ icon }) {
  if (icon === "mail") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16v12H4Z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  if (icon === "phone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h3l1.4 4-2 1.2c1 2 2.4 3.4 4.4 4.4l1.2-2L19 13v3c0 1.2-.8 2-2 2C10.4 18 6 13.6 6 7c0-1.2.8-3 1-3Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7.5C5 5.6 6.6 4 8.5 4h7C17.4 4 19 5.6 19 7.5v4c0 1.9-1.6 3.5-3.5 3.5H12l-4.5 4v-4C6.1 14.6 5 13.2 5 11.5Z" />
      <path d="M8.5 8.5h7M8.5 11.5h4.5" />
    </svg>
  );
}

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
            <div className="vp-heroStatement" aria-label="Propuesta principal">
              <span className="vp-statementLead">Tu pizzeria online</span>
              <span className="vp-statementRow">
                <strong>tus clientes</strong>
                <em>tus pedidos</em>
                <strong>tus datos</strong>
              </span>
            </div>
            <p className="vp-heroPromise">
              Recibe mas del 90% de cada pedido. Vende, opera y vuelve a conectar
              con tus clientes desde un solo motor.
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
        <div className="vp-systemLayout">
          <div className="vp-sectionHead">
            <span>Backoffice Volta</span>
            <h2>El motor de ventas de pizza.</h2>
            <p>
              Un back office pensado para que una pizzeria controle pedidos,
              carta, clientes, promociones, stock y locales desde una misma
              consola. Menos pantallas sueltas; mas ritmo comercial.
            </p>
          </div>

          <div className="vp-backofficePreview" aria-label="Vista de ejemplo del backoffice">
            <div className="vp-previewTopbar">
              <span>MyBackoffice</span>
              <strong>Store live</strong>
            </div>
            <div className="vp-previewMain">
              <div className="vp-previewSidebar">
                <span className="is-active">Pedidos</span>
                <span>Pizza Creator</span>
                <span>Promos</span>
                <span>Clientes</span>
                <span>Stock</span>
              </div>
              <div className="vp-previewStage">
                <div className="vp-previewMetrics">
                  <div><span>Ventas hoy</span><strong>1.248</strong></div>
                  <div><span>Pedidos</span><strong>42</strong></div>
                  <div><span>Repetidos</span><strong>31%</strong></div>
                </div>
                <div className="vp-previewOrders">
                  <div><span>#1082</span><strong>2 pizzas + bebida</strong><em>En horno</em></div>
                  <div><span>#1083</span><strong>Oferta familiar</strong><em>Delivery</em></div>
                  <div><span>#1084</span><strong>Cupon recuperacion</strong><em>Nuevo</em></div>
                </div>
              </div>
            </div>
          </div>
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
              <div className="vp-consoleRow"><span>Promos activas</span><strong>8</strong></div>
              <div className="vp-consoleRow"><span>Cupones generados</span><strong>248</strong></div>
              <div className="vp-consoleRow"><span>Mensajes disponibles</span><strong>12.500</strong></div>
            </div>
            <div className="vp-consoleFooter">
              <span className="vp-consoleBadge">Menu publicado</span>
              <span className="vp-consoleBadge">CRM listo</span>
              <span className="vp-consoleBadge">Delivery activo</span>
            </div>
            <a className="vp-consoleCta" href={backofficeHref}>Abrir MyBackoffice</a>
            <div className="vp-consoleDemo" aria-hidden="true">
              <span className="vp-demoCursor" />
              <span className="vp-demoClick vp-demoClickOne" />
              <span className="vp-demoClick vp-demoClickTwo" />
              <span className="vp-demoClick vp-demoClickThree" />
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

      <footer className="vp-footer">
        <div className="vp-footerMain">
          <div className="vp-footerIdentity">
            <img className="vp-footerLogo" src={voltaSystemsLogo} alt="Volta Systems" />

            <label className="vp-languageSelect">
              <span>Idioma</span>
              <select defaultValue="es">
                <option value="es">Espanol</option>
                <option value="en">English</option>
              </select>
            </label>

            <div className="vp-footerContact" aria-label="Iconos de contacto">
              <span>Contacto</span>
              <div className="vp-contactIcons">
                {contactLinks.map((item) => (
                  <a key={item.label} href={item.href} aria-label={item.label} title={item.label}>
                    <ContactIcon icon={item.icon} />
                  </a>
                ))}
              </div>
              <a className="vp-footerEmail" href="mailto:contacto@voltapizza.com">
                contacto@voltapizza.com
              </a>
            </div>

            <div className="vp-footerSocial" aria-label="Redes sociales">
              <span>Redes sociales</span>
              <div>
                {socialLinks.map((item) => (
                  <a key={item.label} href={item.href} aria-label={item.label} title={item.label}>
                    {item.text}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <nav className="vp-footerColumns" aria-label="Footer">
            {footerGroups.map((group) => (
              <div className="vp-footerColumn" key={group.title}>
                <span>{group.title}</span>
                {group.links.map((link) => (
                  <a key={link} href={link === "Demo comercial" ? "#contacto" : "#sistema"}>
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="vp-footerBottom">
          <span>THE PIZZA SALE ENGINE</span>
        </div>
      </footer>
    </main>
  );
}
