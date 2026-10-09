import { useState } from "react";
import { usePublicSeo } from "../utils/seo";
import LandingProductPreview from "../components/LandingProductPreview";
import EngineBackground from "../components/Backoffice/EngineBackground";
import { ReactComponent as PizzaBg } from "../assets/logo/pizza.svg";
import api from "../setupAxios";
import "../styles/LandingPage.css";

const modules = [
  {
    name: "Storefront",
    text: "Tu carta y tus pedidos, con la identidad de tu pizzería. Comparte el acceso desde tu web y tus canales propios.",
  },
  {
    name: "Backoffice",
    text: "Gestiona pedidos, clientes y tiendas desde un mismo backoffice.",
  },
  {
    name: "Pizza Creator",
    text: "Una carta preparada para pizzas: tamaños, ingredientes, extras y combinaciones.",
  },
  {
    name: "CRM & Promos",
    text: "Segmentación, promociones y datos para orientar tu estrategia comercial, fidelizar clientes y fomentar la repetición de compra.",
  },
];

const pillars = [
  ["Migración de clientes", "Estrategias para atraer compradores de marketplaces al canal directo de la pizzería."],
  ["Tecnología de venta", "Un motor online para vender desde la web, Instagram, QR y enlaces."],
  ["Inteligencia comercial", "Promociones, datos y herramientas para aumentar la conversión y fidelizar clientes."],
];

const advantages = [
  ["90% del ticket", "El 90% del ticket para tu pizzería.", "Un modelo vinculado a tus ventas, con las condiciones detalladas antes de contratar."],
  ["Storefront activo 24/7", "Tu tienda online siempre disponible.", "El escaparate permanece accesible. La recepción de pedidos respeta los horarios y las condiciones que configures."],
  ["Clientes directos", "Conoce y fideliza a tus compradores.", "Desarrolla una relación comercial directa mediante datos, promociones y segmentación."],
  ["Acompañamiento", "Tecnología y estrategia comercial.", "Te acompañamos en la puesta en marcha y en el desarrollo de estrategias para impulsar tus ventas directas. Concretamos contigo el alcance del apoyo."],
];

const landingSeo = {
  title: "Volta Pizza — El motor para vender pizzas por Internet",
  description: "Motor de venta online para pizzerías. Pedidos directos, promociones y datos de clientes para impulsar la compra directa y la repetición.",
  canonicalUrl: "https://voltapizza.com/",
};

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
    title: "Venta directa",
    links: ["Ventajas comerciales", "Cómo empezar", "Condiciones comerciales"],
  },
];

const contactLinks = [
  { label: "Email", href: "mailto:contacto@voltapizza.com", icon: "mail" },
  { label: "Demo", href: "#contacto", icon: "chat" },
  { label: "Solicitar llamada", href: "#contacto", icon: "phone" },
];

const socialLinks = [
  { label: "X", href: "#contacto", text: "X" },
  { label: "Instagram", href: "#contacto", text: "IG" },
  { label: "Facebook", href: "#contacto", text: "FB" },
  { label: "YouTube", href: "#contacto", text: "YT" },
];

const getBackofficeHref = () => {
  const envUrl = process.env.REACT_APP_BACKOFFICE_URL?.trim();
  if (envUrl) {
    const separator = envUrl.includes("?") ? "&" : "?";
    return `${envUrl}${separator}demo=1`;
  }

  if (typeof window !== "undefined") {
    const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocal) return `${window.location.origin}/Backoffice?demo=1`;
  }

  return "https://voltapizza.com/Backoffice?demo=1";
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

function PillarIcon({ index }) {
  return <svg className="vp-pillarIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {index === 0 ? <><circle cx="7" cy="6" r="3" /><path d="M2 19v-3a5 5 0 0 1 10 0v3M14 10h8m-3-3 3 3-3 3M16 17h6" /></>
      : index === 1 ? <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4m-2-14 5 3-5 3Z" /></>
        : <><path d="M3 3v18h18M7 16v-4m5 4V9m5 7V6M6 8l5-4 4 1 5-3" /></>}
  </svg>;
}

function PaymentIcon({ type }) {
  return <span className="vp-paymentIcon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {type === "purchase" ? <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18m-5 5 1.5 1.5L20 14M7 15h3" /></>
        : type === "installments" ? <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2m4 0h2" /></>
          : <><path d="M20 9a8 8 0 0 0-14-3L3 9m0-5v5h5M4 15a8 8 0 0 0 14 3l3-3m0 5v-5h-5" /><path d="m9 12 2 2 4-4" /></>}
    </svg>
  </span>;
}

export default function LandingPage() {
  usePublicSeo(landingSeo);
  const [lead, setLead] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    message: "",
  });
  const [leadStatus, setLeadStatus] = useState("");
  const [submittingLead, setSubmittingLead] = useState(false);

  const updateLead = (field) => (event) => {
    setLead((current) => ({ ...current, [field]: event.target.value }));
    setLeadStatus("");
  };

  const submitLead = async (event) => {
    event.preventDefault();

    try {
      setSubmittingLead(true);
      setLeadStatus("");

      await api.post("/api/onboarding/demo-requests", lead);

      setLead({
        name: "",
        business: "",
        email: "",
        phone: "",
        message: "",
      });

      setLeadStatus(
        "Solicitud de demostración recibida. Te contactaremos para conocer tu pizzería y mostrarte el sistema."
      );
    } catch (error) {
      console.error(error);
      setLeadStatus("No pudimos enviar la solicitud. Inténtalo de nuevo o escribe a contacto@voltapizza.com.");
    } finally {
      setSubmittingLead(false);
    }
  };

  const backofficeHref = getBackofficeHref();

  return (
    <main className="vp-site">
      <section className="vp-hero">
        <div className="vp-engineField vp-engineField--subtle" aria-hidden="true">
          <EngineBackground />
          <PizzaBg className="vp-bgPizza vp-bgPizza--subtle" viewBox="320 0 800 810" focusable="false" />
        </div>
        <div className="vp-heroGrid">
          <div className="vp-heroCopy">
            <h1>VOLTA PIZZA</h1>
            <p className="vp-heroSlogan">El motor para vender pizzas por Internet.</p>
            <h2 className="vp-heroBenefit">Aumenta las <span>ventas directas</span> de tu pizzería.</h2>
            <p className="vp-heroPromise">
              Combinamos migración de clientes, tecnología de venta e inteligencia
              comercial para atraer compradores de los marketplaces a tu canal
              directo y fomentar la repetición de compra.
            </p>
            <div className="vp-heroActions">
              <a className="vp-primaryLink" href={backofficeHref}>Explorar la demo</a>
              <a className="vp-secondaryLink" href="#sistema">Ver sistema</a>
              <a className="vp-secondaryLink" href="#contacto">Solicitar una demostración</a>
            </div>
          </div>
          <LandingProductPreview />
        </div>

        <div className="vp-heroStatus vp-pillars" aria-label="Pilares estratégicos">
          {pillars.map(([value, label], index) => (
            <div key={label}>
              <PillarIcon index={index} />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="sistema" className="vp-band vp-systemBand">
        <div className="vp-systemFacts" aria-label="Infraestructura del sistema">
          <div><strong>01</strong><span>Backoffice central</span></div>
          <div><strong>24/7</strong><span>Storefront activo</span></div>
          <div><strong>SMS</strong><span>Motor comercial</span></div>
        </div>
        <div className="vp-systemLayout">
          <div className="vp-sectionHead">
            <span>Backoffice Volta</span>
            <h2>Tecnología para gestionar tu venta directa.</h2>
            <p>
              Tu carta, pedidos, clientes y promociones conectados en una misma
              plataforma especializada en pizzerías. Control operativo para
              poner en marcha tu estrategia comercial.
            </p>
          </div>

          <div className="vp-backofficePreview" aria-label="Vista de ejemplo del backoffice">
            <div className="vp-previewTopbar">
              <span>MyBackoffice</span>
              <strong>Ejemplo ilustrativo</strong>
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
                  <div><span>#1084</span><strong>Cupón de recuperación</strong><em>Nuevo</em></div>
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

      <section id="venta-directa" className="vp-band vp-advantagesBand" aria-labelledby="advantages-title">
        <div className="vp-sectionHead">
          <h2 id="advantages-title">Las ventajas de vender con Volta.</h2>
        </div>
        <div className="vp-moduleGrid">
          {advantages.map(([label, title, text]) => (
            <article className="vp-moduleCard" key={label}>
              <span className="vp-advantageLabel">{label}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p id="condiciones" className="vp-commercialNote">El reparto previsto es 90% para el comercio, 9% para Volta y 1% para el embajador, conforme a las condiciones del servicio. El POS y los SMS opcionales se pagan por separado. La oferta concreta la base de cálculo, los costes aplicables y las liquidaciones antes de contratar.</p>
      </section>

      <section id="como-empezar" className="vp-band vp-productBand">
        <div className="vp-productLayout">
          <div>
            <span className="vp-kicker">Incorporación</span>
            <h2>Empieza a vender con Volta.</h2>
            <p>Elige la modalidad de incorporación que mejor se adapte a tu pizzería.</p>
            <div className="vp-paymentOptions" aria-label="Modalidades de incorporación">
              <article className="vp-paymentCard">
                <PaymentIcon type="purchase" />
                <h3>Pago único</h3>
                <strong className="vp-paymentPrice"><small>Desde </small>250 €</strong>
                <span className="vp-paymentDescription">Equipo en propiedad.</span>
              </article>
              <article className="vp-paymentCard">
                <PaymentIcon type="installments" />
                <h3>Pago fraccionado</h3>
                <span className="vp-paymentTerm">6 cuotas</span>
                <strong className="vp-paymentPrice"><small>Desde </small>46 €<span>/mes</span></strong>
                <span className="vp-paymentDescription">Sin intereses.</span>
              </article>
              <article className="vp-paymentCard">
                <PaymentIcon type="rental" />
                <h3>Renting tecnológico</h3>
                <strong className="vp-paymentPrice"><small>Desde </small>20 €<span>/mes</span></strong>
                <span className="vp-paymentDescription">12 cuotas.</span>
              </article>
            </div>
            <p className="vp-paymentNote">Consulta las condiciones completas con nuestro equipo.</p>
          </div>

          <div className="vp-console" aria-label="Vista resumida del producto">
            <div className="vp-consoleTop">
              <span>Backoffice</span>
              <strong>Ejemplo ilustrativo</strong>
            </div>
            <div className="vp-consoleRows">
              <div className="vp-consoleRow"><span>Promos activas</span><strong>8</strong></div>
              <div className="vp-consoleRow"><span>Cupones generados</span><strong>248</strong></div>
              <div className="vp-consoleRow"><span>SMS cortos disponibles</span><strong>101</strong></div>
            </div>
            <div className="vp-consoleFooter">
              <span className="vp-consoleBadge">Menú publicado</span>
              <span className="vp-consoleBadge">CRM listo</span>
              <span className="vp-consoleBadge">Delivery activo</span>
            </div>
            <a className="vp-consoleCta" href={backofficeHref}>Explorar la demo</a>
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
          <h2>Veamos cómo impulsar tu venta directa.</h2>
          <p>
            Cuéntanos cómo vende hoy tu pizzería. Te mostraremos el motor
            y las herramientas que pueden ayudarte a desarrollar tu canal directo.
          </p>
          <a href="mailto:contacto@voltapizza.com">contacto@voltapizza.com</a>
        </div>

        <form className="vp-contactForm" onSubmit={submitLead}>
          <label>
            <span>Nombre</span>
            <input value={lead.name} onChange={updateLead("name")} required />
          </label>
          <label>
            <span>Pizzería</span>
            <input value={lead.business} onChange={updateLead("business")} required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={lead.email} onChange={updateLead("email")} required />
          </label>
          <label>
            <span>Teléfono (opcional)</span>
            <input value={lead.phone} onChange={updateLead("phone")} />
          </label>
          <label className="vp-wideField">
            <span>Mensaje (opcional)</span>
            <textarea value={lead.message} onChange={updateLead("message")} rows="4" />
          </label>
          <button type="submit" disabled={submittingLead}>
            {submittingLead ? "Enviando..." : "Solicitar demostración"}
          </button>
          <p className="vp-wideField vp-formNotice">Usaremos tus datos para responder a tu solicitud. Solicitar una demo no inicia el alta, no requiere documentos y no genera ningún pago.</p>
          {leadStatus && <div className="vp-formStatus" role="status">{leadStatus}</div>}
        </form>
      </section>

      <footer className="vp-footer">
        <div className="vp-footerMain">
          <div className="vp-footerIdentity">
            <strong className="vp-footerBrand">Volta Pizza</strong>

            <label className="vp-languageSelect">
              <span>Idioma</span>
              <select defaultValue="es">
                <option value="es">Español</option>
                <option value="en" disabled>English — próximamente</option>
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
              <span>Redes sociales · próximamente</span>
              <div>
                {socialLinks.map((item) => (
                  <span key={item.label} className="vp-socialPending" aria-label={`${item.label}: próximamente`} title={`${item.label}: próximamente`}>
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <nav className="vp-footerColumns" aria-label="Footer">
            {footerGroups.map((group) => (
              <div className="vp-footerColumn" key={group.title}>
                <span>{group.title}</span>
                {group.links.map((link) => (
                  <a key={link} href={link === "Demo comercial" ? "#contacto" : link === "Condiciones comerciales" ? "#condiciones" : link === "Cómo empezar" ? "#como-empezar" : group.title === "Venta directa" ? "#venta-directa" : "#sistema"}>
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="vp-footerBottom">
          <span>THE PIZZA<br /> SALE ENGINE</span>
        </div>
      </footer>
    </main>
  );
}
