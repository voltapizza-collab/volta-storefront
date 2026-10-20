# Biblioteca pública de recursos

## Arquitectura y alcance

La aplicación sigue usando React y React Router. `/recursos` es la biblioteca;
`/recursos/:slug` es la página individual. Estas rutas se resuelven antes de las
rutas de pizzería. La navegación pública compartida incorpora Inicio y Recursos
en la portada y la biblioteca. La portada no tenía un menú superior renderizado;
sus enlaces del pie y sus botones comerciales se conservan.

No se incorpora un CMS, una API de contenidos, autenticación para lectores ni
otro sistema de reservas. `src/config/commercial.js` contiene el enlace de
Google Calendar compartido con la portada.

El catálogo editorial es `content/resources.json`. Se modifica en el repositorio
y se publica junto con la web. `npm run resources:check` valida los recursos
activos y genera:

- `src/resources/published.json`, utilizado por React.
- `public/resources-manifest.json`, copiado al build para el servidor HTTP.

Ambos archivos son generados e ignorados por Git. Los borradores no se incluyen
en ninguno de ellos ni en el bundle de producción. `npm run build`, `npm run dev`
y `npm test` ejecutan la generación automáticamente.

## Campos y publicación

Cada entrada usa:

| Campo | Uso |
| --- | --- |
| `slug` | Identificador estable en minúsculas y guiones; forma la URL individual. |
| `category` | `investigaciones`, `articulos` o `clases`. |
| `active` | `false` mantiene el recurso como borrador; `true` solicita publicarlo. |
| `order` | Número menor = aparece antes; empates por fecha descendente y slug. |
| `title`, `description`, `introduction` | Título, resumen para la tarjeta e introducción individual. |
| `publishedAt` | Fecha real, `AAAA-MM-DD`, interpretada en UTC. |
| `cover.url`, `cover.alt` | Imagen real y texto alternativo. |
| `seo.title`, `seo.description`, `seo.image` | Metadatos individuales e imagen de vista previa. |
| `body` | Bloques de contenido estructurado. |

Una entrada activa incompleta hace fallar la compilación, en lugar de publicar
una tarjeta rota. Las fechas futuras quedan fuera del manifiesto: **requieren
volver a compilar y desplegar en la fecha elegida**, no existe un publicador
programado en segundo plano.

Para publicar, completar los campos con material aprobado, activar la entrada,
ejecutar `npm run resources:check` y `npm run build`, revisar la vista local y
desplegar mediante el procedimiento habitual del proyecto. Para retirar una
publicación, poner `active: false`, volver a compilar y desplegar. Su página
devuelve 404 y `noindex`; puede haber caché previa durante la propagación.
Los archivos de `public/` son públicos: retirar una entrada no elimina sus
archivos ni revoca enlaces directos ya compartidos. No guardar borradores
confidenciales en `public/`.

Las imágenes admiten rutas locales y URLs HTTPS sin credenciales. Las portadas
deben ser preferiblemente horizontales (16:9) y optimizadas; la imagen social
puede ser distinta. Los archivos locales se comprueban durante la compilación.
Comprobar también accesibilidad y permisos de los medios externos antes de
publicar.

## Añadir una investigación

1. Guardar el PDF definitivo en `public/resources/pdfs/nombre-del-documento.pdf`
   y su portada en `public/resources/covers/`.
2. Crear una entrada con `category: "investigaciones"`, los campos comunes
   completos y `pdfUrl: "/resources/pdfs/nombre-del-documento.pdf"`.
3. Usar `introduction` para el resumen y `body` para la descripción del documento.
4. Revisar el visor, Abrir PDF y Descargar PDF; activar, compilar y desplegar.

El PDF se sirve como `application/pdf`, con soporte de rangos de bytes para el
visor y descarga explícita. El enlace de apertura y el de descarga permiten
acceder al archivo en móviles sin visor integrado. La validación exige que el
archivo exista y tenga cabecera PDF; la revisión editorial debe comprobar que
el documento completo es legible.

No se ha creado un white paper ficticio. La infraestructura está lista para
recibir el documento real de migración de clientes.

## Publicar un artículo

Crear una entrada `category: "articulos"`, completar `author` y añadir el texto
real a `body`. Los bloques admitidos son:

```json
[
  { "type": "heading", "text": "Subtítulo real" },
  { "type": "paragraph", "content": [
    "Texto del artículo. ",
    { "text": "Consulta nuestra biblioteca", "href": "/recursos" }
  ] },
  { "type": "subheading", "text": "Subapartado" },
  { "type": "list", "items": ["Primer punto", "Segundo punto"] }
]
```

Este ejemplo documenta el formato; no se publica como contenido. No se acepta
HTML en bruto. Los enlaces HTTPS externos se abren con `noopener noreferrer`;
los enlaces internos mantienen la navegación de la web. Los enlaces a páginas
individuales de Recursos deben apuntar a otros recursos publicados.

Añadir `references` con objetos `{ "title": "...", "author": "...", "year": "...",
"url": "https://..." }` usando las referencias reales. Un array vacío se permite
cuando no hay referencias; no se inventan fuentes. Tras completar portada,
fecha y SEO, activar, validar y desplegar.

El artículo previsto sobre migración desde marketplaces debe incorporarse
cuando exista su texto aprobado; no se ha generado una publicación ficticia.

## Incorporar la primera clase

Ya existe un borrador desactivado con el título y la descripción proporcionados:

`/recursos/por-que-tus-clientes-siguen-comprando-en-marketplaces`

La URL devolverá 404 mientras sea un borrador. Para publicarla:

1. Completar `videoUrl` con una URL pública reproducible de YouTube, Vimeo o un
   archivo HTTPS `.mp4`/`.webm`; también se admiten archivos locales bajo
   `/resources/videos/`.
2. Incorporar la portada real, su texto alternativo, la imagen social y la fecha.
3. Completar `body` con la descripción real del contenido de la clase.
4. Probar el vídeo, cambiar `active` a `true`, validar, compilar y desplegar.

YouTube se convierte a `youtube-nocookie.com/embed/...`; Vimeo usa su URL pública
`player.vimeo.com/video/...`. No se admiten iframes arbitrarios. Verificar que
el proveedor permita incrustar el vídeo; enlaces privados que necesiten permisos
o hashes especiales no se deben publicar con este formato.

La clase es gratuita, sin registro, con reproductor, descripción y el botón
«Agendar una reunión». Nunca se renderiza un reproductor sin URL válida.

## SEO y validación

El servidor añade title, description, canonical, Open Graph, Twitter e imagen
configurable al HTML inicial, también para clientes que no ejecutan JavaScript
(por ejemplo, vistas previas de WhatsApp). React mantiene esos metadatos al
navegar. Los recursos inexistentes o desactivados devuelven HTTP 404 y noindex.

Comprobaciones:

```text
npm run resources:check
node --test scripts/resources.test.cjs
npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/ResourcesPage.test.jsx src/pages/LandingPage.test.jsx src/utils/seo.test.js
npm run build
```

Los tests usan datos sintéticos y archivos temporales solo para verificar los
componentes de PDF/vídeo y sus respuestas HTTP; no se publican. Antes de publicar
un material real, comprobar su reproducción/lectura y su enlace compartido.
La biblioteca comienza vacía y la primera clase continúa desactivada.

## Entrega y archivos

Verificado localmente el 20 de octubre de 2026:

- Compilación de producción correcta; avisos existentes de Browserslist y tamaño
  de bundle, sin errores de compilación.
- 16 pruebas React/SEO y 4 pruebas Node de publicación y medios superadas.
- Navegación Inicio → Recursos → Inicio y filtros en navegador.
- Escritorio 1440 px y móviles 393/320 px sin desbordamiento horizontal.
- Sin errores de consola en la biblioteca.
- HTTP real: biblioteca 200 con SEO en el HTML inicial; borrador 404 con noindex;
  manifiesto publicado vacío.
- Las secciones de la portada desde Sistema, incluido formulario y pie, se
  compararon con Git y son idénticas. El enlace de reserva y el destino de demo
  se conservan. No se modifican procesos de venta ni backoffice.

No hay despliegue en producción. Los medios reales siguen pendientes de entrega;
las pruebas de PDF/vídeo usan fixtures exclusivos de tests.
Capturas locales en `../../output/resources-2026-10-20/`.

Archivos de esta tarea:

```text
.gitignore
package.json
server.js
src/App.js
src/pages/LandingPage.jsx
src/config/commercial.js
src/components/PublicNavigation.jsx
src/components/ResourceContent.jsx
src/pages/ResourcesPage.jsx
src/pages/ResourcePage.jsx
src/pages/ResourcesPage.test.jsx
src/styles/PublicNavigation.css
src/styles/Resources.css
src/resources/catalog.js
content/resources.json
scripts/build-resources.cjs
scripts/resources-http.cjs
scripts/resource-media.cjs
scripts/resources.test.cjs
docs/resources.md
```

Los cambios locales ajenos a Recursos que ya existían en checkout, pedidos y
Storefront se conservan. La prueba de LandingPage también contenía los cambios
de la tarea anterior de botones comerciales.
