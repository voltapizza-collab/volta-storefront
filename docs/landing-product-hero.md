# Ajustes finales — revisión local, 9 de octubre de 2026

Sin commits ni despliegues. Esta sección sustituye las limitaciones de alcance de las pasadas anteriores documentadas debajo.

- Incorporación: tres tarjetas claras con iconos circulares, precios solicitados y nota breve. Panel de backoffice, animaciones y enlace de demo conservados.
- Footer: «THE PIZZA SALE ENGINE» en dos líneas, confirmado por el usuario y por la versión anterior de Git. Tipografía ampliada aproximadamente un 27 % en escritorio y un 23 % en móvil respecto a la primera propuesta, con resplandor morado discreto. Se conservan todos los enlaces y controles.
- Fondo: SVG original `src/assets/logo/pizza.svg`, rotación de 96 segundos al 6,5 % de opacidad, junto a los dos engranajes existentes (72 y 56 segundos). La capa decorativa no intercepta interacciones, se oculta hasta 640 px y se detiene con movimiento reducido. Sin imágenes nuevas, filtros animados ni dependencias nuevas.
- No se alteran los textos del hero, pilares, ventajas, formulario, Storefront ni backoffice.

## Verificación de los ajustes finales

- 5 pruebas de landing y 10 pruebas de avisos correctas. Build de producción local correcto; persiste el aviso anterior de Browserslist. Incremento del JS y CSS comprimidos inferior a 1 KB respecto a la pasada anterior.
- Escritorio 1440, tablet 820 y móvil 393/320 px: sin desbordamiento horizontal; tarjetas claras y del mismo alto. En tablet el panel pasa debajo. El footer completo conserva su navegación y texto exacto.
- El enlace «Cómo empezar» navega al bloque; el botón del panel abre `/Backoffice?demo=1` y completa el acceso a `/backoffice/volta-demo?demo=1`. No se envió el formulario ni ningún SMS.
- Se observaron transformaciones distintas en la pizza y los engranajes; ciclos lineales de 96/72/56 segundos. La decoración tiene `pointer-events: none`. Se comprobó la regla compilada que detiene los tres elementos con `prefers-reduced-motion`, sin cambiar preferencias del sistema. En móvil la capa está oculta.
- Comparación contra la copia previa: hero comercial, pilares, sistema, ventajas, panel de incorporación, contacto y navegación del footer conservan exactamente el mismo JSX. Los estilos compartidos de animación no se modifican.
- La importación SVG requirió adaptar únicamente su mock de Jest al runtime React instalado, porque el transformador antiguo de CRA genera elementos React anteriores. La compilación real del SVG se verificó en navegador.

Evidencias: `../../output/landing-final-2026-10-09/`: capturas del hero, incorporación y footer en escritorio; incorporación en tablet y móvil; footer móvil; mediciones responsive, comprobación de conservación y log del build.

## Contraste comercial antes de publicar

La maqueta local muestra exactamente los importes pedidos: desde 250 €, seis cuotas desde 46 €/mes y renting desde 20 €/mes a 12 cuotas. **No publicar sin conciliar estos datos con la oferta vigente.**

Consulta de solo lectura del catálogo actual, versión `pos-2026-10-v4-5-25000-rental-1pct-upfront-v1`:

| Modalidad | Catálogo vigente, IVA incluido | Texto solicitado para revisión local |
|---|---|---|
| Compra | 250 € | Desde 250 € |
| Fraccionado | 5 × 41,67 € + 41,65 € = 250 €, sin intereses | 6 cuotas desde 46 €/mes, sin intereses |
| Renting a 12 meses | 11 × 21,99 € + 22,01 € = 263,90 €; interés mensual 1 %, primera cuota anticipada | Desde 20 €/mes, 12 cuotas |

No se ha confirmado que el precio de renting incluya el software. Se omite esa afirmación condicional. No se modifican precios, contratos, configuraciones ni datos del backend. El tríptico no está disponible entre los recursos encontrados; se siguen las indicaciones visuales expresas del encargo.

Archivos: `src/pages/LandingPage.jsx`, `src/styles/LandingPage.css`, `src/pages/LandingPage.test.jsx`, este documento y el borrador de avisos con su documentación en backend. El borrador ES/EN/IT/FR/PT permanece fuera del feed.

## Recuperación selectiva del movimiento — 9 de octubre de 2026

Se inspeccionaron `EngineBackground.jsx`, `EngineBackground.css` y las animaciones históricas de la landing: siete engranajes, resplandor, pizza rotatoria, líneas concéntricas y órbitas. Se reutiliza el componente original con estilos limitados al hero: solo dos engranajes visibles al 7,5 % y 5,5 %, ciclos de 72 y 56 segundos, y resplandor estático sin desenfoque. No se cambian los estilos compartidos del backoffice. En esta primera pasada no se recuperaron pizza, túnel ni órbitas. La petición final posterior recupera solo la pizza, con menor contraste (véase arriba).

En móvil hasta 640 px se oculta la capa. `prefers-reduced-motion: reduce` detiene ambos engranajes. La decoración conserva `aria-hidden` y `pointer-events: none`.

La petición inicial de incorporación llegó truncada. Queda sustituida por las instrucciones completas de ajustes finales recibidas posteriormente. No hay despliegue a producción.

# Hero de producto — implementación local, 9 de octubre de 2026

No desplegado. El usuario exige autorización expresa para producción.

## Cambios

- `src/pages/LandingPage.jsx`: promesa con «ventas directas» amarillas, iconos de los tres pilares y composición real a la derecha; se retira la decoración animada del fondo del hero. Identidad, eslogan, textos y destinos de botones conservados.
- `src/components/LandingProductPreview.jsx`: laptop y teléfono en CSS con capturas reales y textos alternativos. Superposición parcial solo en escritorio; separación en tablet y móvil, debajo de texto y botones.
- `src/styles/LandingPage.css`: dos columnas, jerarquía, degradado morado y amarillo, marcos y adaptación responsive. Reglas nuevas limitadas al hero.
- `src/assets/hero/`: tres WebP optimizados y procedencia documentada.
- `src/pages/LandingPage.test.jsx`: conservación de textos, destinos y pilares, representación del producto y pruebas existentes del formulario.
- `../volta-backend/data/backofficeAnnouncements.js`: `landingProductHeroAnnouncementDraft`, ES/EN/IT/FR/PT, fuera del feed.
- `../volta-backend/docs/backoffice-notifications.md`: estado de borrador, pendiente de autorización y publicación.

Las secciones a partir de `#sistema` son idénticas a la copia local anterior de `LandingPage.jsx`; no se cambian Storefront, backoffice ni reglas comerciales. Se preservan otros cambios locales anteriores de ambos repositorios.

## Comprobaciones

- Escritorio 1440, tablet 820 y móvil 393 y 320 px: sin desbordamiento horizontal ni textos recortados; imágenes cargadas. Tablet sin superposición; dispositivos después de los botones en móvil.
- Navegación real: Ver sistema llega a `#sistema`, Solicitar una demostración llega a `#contacto`, Explorar la demo abre `/Backoffice?demo=1` y entra a la cuenta demo existente. Sin enviar el formulario de contacto.
- 3 pruebas de landing correctas, incluidas las dos anteriores del formulario.
- 10 pruebas de avisos de backend correctas. La nota nueva no se publica.
- `npm run build` correcto. Persisten avisos generales de Browserslist y tamaño del paquete; la entrega añade aproximadamente 665 B de JS y 729 B de CSS comprimidos respecto al build local anterior.
- Imágenes: ~123 KiB en escritorio; ~71 KiB con la variante pequeña. Dimensiones explícitas; sin iframes, API ni animaciones nuevas en el hero.

Capturas y log: `../../output/hero-technology-2026-10-09/desktop.png`, `tablet.png`, `mobile.png`, `build.log`.
