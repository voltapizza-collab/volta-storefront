# Impresión y pantalla recortada en VigoCity

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
