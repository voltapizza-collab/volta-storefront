# Impresión y pantalla recortada en VigoCity

Confirmación posterior del usuario, 7 de octubre: el terminal quedó actualizado y «ya no se rompe al imprimir el ticket». Es una comprobación física comunicada por el usuario; no una impresión realizada por el agente.

## Seguimiento: 0.3.23 publicada y asignada

Las siguientes fotos del usuario muestran explícitamente 0.3.20 y el modal antiguo. La consulta de producción confirmó código 23 instalado y 0.3.20 asignada: 0.3.22 nunca se había distribuido, solo enlazado como archivo local. Por tanto, estas fotos no verifican ni refutan la corrección de 0.3.22.

Se añade en 0.3.23/código 26 un número operativo corto para referencias web de 32 caracteres hexadecimales: `WEB-<Sale.id>`. Se usa igual en cola, avisos, historial, ticket en pantalla e impresión SUNMI/Windows. No se alteran `Sale.code`, enlaces, consultas ni identificadores de API. Se conservan códigos anteriores cortos y tickets de prueba. No se acorta por truncamiento, evitando colisiones entre pedidos distintos.

Validación adicional: 15 pruebas de numeración, impresión y pago; ocho pruebas de avisos; navegador a 360 px con código web nuevo y a 320 px con código legado largo, impresión doble y retorno a cola. Compilación y firma correctas. APK `native/sunmi-v3/build/volta-pos-connected-0.3.23.apk`, SHA256 `c67c0c989d3c64ffcfbc823023d0e0cc3b7227b0415ea504f0850a83fba49bc0`, certificado aprobado sin cambios.

Publicada mediante `scripts/posReleases.js`, que verifica firma, manifiesto y lectura del objeto almacenado. Asignada únicamente al SUNMI V3 002 (`c68ea9fd-04bb-4b96-8b1b-1d700488b473`). Comprobación posterior: versión objetivo 0.3.23/código 26 habilitada; instalada reportada código 23, último reporte `2026-10-07T07:29:02.882Z`. La asignación no instala por sí sola: el operador debe aceptar la versión desde la app. Pendiente verificación física del ticket y de la pantalla; el anuncio general de backoffice permanece en borrador.

La sección siguiente documenta la investigación y compilación local anteriores.

El usuario identifica el disparador: pulsar Imprimir. El ticket sale y el aviso dice «impresión confirmada por SUNMI», pero la pantalla queda desplazada y debe cerrar y abrir la aplicación. Esta evidencia es distinta del anterior mensaje genérico de validación; no demuestra un fallo de credenciales ni de la impresora.

## Evidencia reproducible

Se ejecutó la interfaz nativa empaquetada en Chromium/Edge con puente Android simulado y un pedido ficticio con código del mismo largo que el de la foto. No se consultaron ni modificaron pedidos reales ni se imprimió en hardware.

Antes de la corrección, con pantalla de 360 px, `innerWidth` y `documentElement.scrollWidth` crecían a 393 px al abrir el ticket. El encabezado y el código en la vista previa no permitían partir el texto ni reducir el hijo flex. La confirmación de impresión abría `PosNotice.showModal()` y cambiaba el desplazamiento vertical de 114 a 63 px. El navegador reproduce el desbordamiento y el salto, pero no el desplazamiento completo y persistente de la foto en el WebView físico. No afirmar que se ha reproducido ese último síntoma en el dispositivo.

## Corrección

- El encabezado permite encoger su contenido y partir códigos largos; el botón Cola conserva su ancho. La vista previa ajusta textos largos al ancho disponible.
- La impresión nativa, incluida la de prueba, informa en la página mediante una región de estado sin abrir el modal ni mover el foco. El error sigue indicando comprobar el ticket antes de repetir.
- Una operación pendiente bloquea el doble envío desde la interfaz. La protección del puente Android permanece intacta.
- No se cambian identidad, sesión, permisos, pedidos ni contenido de impresión.

## Validación y entrega

15 pruebas unitarias satisfactorias: estado de impresión, reintento, doble pulsación, pago en tickets y mensajes de arranque. Prueba de navegador con el paquete real y puente simulado: impresión dos veces y regreso a la cola, sin desbordamiento ni modal. Anchos 320, 360, 393 y 1024 px comprobados. Ocho pruebas del catálogo de avisos satisfactorias.

Regresión reproducible: compilar con `node scripts/build-native-pos.cjs` y ejecutar `node scripts/verify-pos-print.cjs`. Requiere Playwright accesible por Node (o `POS_PLAYWRIGHT_MODULE` con la ruta al módulo instalado) y Edge; `POS_BROWSER_CHANNEL` permite otro canal instalado y `POS_TEST_WIDTH` elige el ancho, 360 por defecto. Solo usa datos ficticios y todas las peticiones están interceptadas. Con la interfaz previa falla la comprobación de ancho; con la corregida permite imprimir dos veces y regresar a la cola. Guarda capturas en el directorio de compilación.

APK HTTPS canónico: `native/sunmi-v3/build/volta-pos-connected-0.3.22.apk`, código 25. SHA256: `2404657d71912286cc07e3b8ba894bbd1097ad4bf65763b9dfe7616fa09f1c57`. Firma Android verificada en la compilación; certificado SHA256 `5fbbf18196c59f52a491032c67afd88ee577e5ff1f65f17a18b83d9795bb03de`, igual al de la versión 23.

No hay terminal conectado a ADB. Falta instalar como actualización, conservando los datos, y comprobar en VigoCity: abrir un ticket con código largo, imprimir, verificar papel, pulsar Ready o volver a Cola y repetir con otro ticket. Esta compilación no está publicada ni asignada en el canal de actualizaciones. El aviso de backoffice `posPrintLayoutAnnouncementDraft` queda fuera del feed hasta validar la disponibilidad y el recorrido físico.
