# Guía de revisión del SUNMI V3 de Volta

Fecha: 6 de septiembre de 2026. Investigación de documentación oficial, contrastada con las fotos del usuario. El usuario ha ejecutado la prueba física de impresión desde POS Steward y comunica que terminó sin novedad; el asistente no ha operado directamente el terminal.

## Equipo confirmado

V3, modelo de etiqueta T5F1A, Android 13, SUNMI OS y compilación 4.5.1, firmware mostrado 586, 3 GB RAM y 32 GB de almacenamiento, pantalla 720 × 1600. La etiqueta identifica impresora de 58 mm y NFC. No se reproducen identificadores únicos del equipo.

En las fotos aparecen Tool, Ajustes y App Store. Tool contiene Actualización, Instruction, POS Steward, Remote Assistance, ShopCenter, una aplicación Snapdragon, Archivos y Calculadora. En Ajustes aparecen Additional settings, SunmiPrinter, ShopCenter, Sistema e Información del dispositivo. No se han visto los submenús de esas aplicaciones.

## Documentación localizada

1. [Manual multilingüe alojado por SUNMI, modelo T5F1A](https://cdn.sunmi.com/public/generalfile/mgt_import/97133c7eade64b0b9f624f6166dd6c4c.pdf). 23 páginas; español en páginas 17–18 del PDF. Explica manejo físico, colocación del papel y software preinstalado. El título interno contiene V3H y algunas secciones incluyen referencias genéricas a lectores de tarjetas: no se deben atribuir esas capacidades a nuestra unidad. Es una guía física, no un inventario completo de menús de SUNMI OS 4.5.1.
2. [Ficha oficial V3 en español](https://cdn.sunmi.com/public/generalfile/mgt_import/d855cb35f4274e58bae93ea15394dbf6.pdf). Referencia específica de las características del V3, con opciones según variante.
3. [SUNMI: funciones de diagnóstico de POS Steward](https://sunmi-1.atlassian.net/wiki/spaces/DI/pages/978616412/Q%2BWhich%2Bhardware%2Bfunctions%2Bcan%2Bthe%2BPOS%2BSteward%2Bcheck). Documenta diagnóstico de impresora, red, pantalla, táctil y altavoz. Publicación general de 2021: las etiquetas exactas pueden variar.
4. [SUNMI: impresora que no expulsa papel](https://sunmi-1.atlassian.net/wiki/spaces/DS/pages/857149512/Common%2BProblemThe%2Bprinter%2Bdoes%2Bnot%2Beject%2Bpaper.). Corrobora POS Steward como herramienta para imprimir una página de autocomprobación.
5. [SUNMI: habilitar modo desarrollador en terminales no dedicados al pago](https://sunmi-1.atlassian.net/wiki/spaces/NARHOWTO/pages/1782087685/How%2Bto%2BTurn%2BOn%2Bnon-payment%2BDevice%2BDeveloper%2BMode). Actualización de junio de 2025, con indicaciones para Android 11 o superior.
6. [SUNMI OS](https://www.sunmi.com/en/sunmi-os/). Confirma funciones de kiosco, bloqueo de aplicaciones, permisos, asistencia remota, OTA y servicio de impresora. No acredita ubicación exacta de estas opciones ni disponibilidad administrativa en este equipo.
7. [Documentación del servicio de impresión](https://file.cdn.sunmi.com/SUNMIDOCS/SunmiPrinter-Developer-Docs-1-1.pdf). Incluye `printerSelfChecking(ICallback)` para autoprueba desde una aplicación integrada con el servicio. La compatibilidad de cada API se comprobará con la versión instalada.

La página oficial de desarrolladores del V3 se localizó, pero su contenido no se pudo recuperar de forma fiable. No se ha encontrado un manual público completo específico de todos los menús de OS 4.5.1.

## Primera prueba: impresora

Ruta documentada y apoyada por la app visible en las fotos: **pantalla principal → Tool → POS Steward → Printer / Impresora**.

Con el rollo correctamente instalado y la tapa cerrada, ejecutar una prueba sencilla de impresión o página de autocomprobación si esa opción aparece. La documentación también menciona pruebas de envejecimiento del cabezal: no son necesarias para esta primera comprobación. No se afirma el texto exacto del botón interior sin ver la versión instalada.

Resultado comunicado por el usuario: impresión de prueba realizada sin novedad. La foto muestra un ticket con logotipo, texto e importes, y confirma la salida física de contenido. La calidad fina y la uniformidad del cabezal no se certifican a partir de la fotografía. Pendiente: imprimir desde la futura aplicación Volta.

La nueva foto de POS Steward confirma las entradas individuales Pantalla, Red, Altoparlante, NFC, Batería, Escáner e Impresora. El estado general «Unchecked» no acredita que se haya ejecutado el chequeo completo; esta actualización registra solo la prueba individual de impresión comunicada.

**SunmiPrinter en Ajustes** está visible en el equipo; aún no se ha inspeccionado su contenido. No se debe afirmar que contiene un botón de prueba. La ruta de diagnóstico localizada por documentación es POS Steward.

## Mapa de revisión

| Necesidad de Volta | Punto de revisión | Estado |
| --- | --- | --- |
| Impresión física | Tool → POS Steward → Impresora | Completada por el usuario sin novedad; ticket fotografiado |
| Red y estabilidad | Diagnóstico de red de POS Steward | Función documentada; prueba pendiente |
| Avisos sonoros | Diagnóstico de altavoz de POS Steward | Función documentada; prueba pendiente |
| Pantalla y pulsaciones | Diagnósticos de pantalla y táctil de POS Steward | Funciones documentadas; pruebas pendientes |
| Ajustes de impresión | Ajustes → SunmiPrinter | Entrada observada; submenús pendientes |
| Manual incluido | Tool → Instruction | Aplicación observada; contenido pendiente |
| Actualizaciones | Información del dispositivo → Actualizaciones del sistema; app de actualización en Tool | Entradas observadas; versión disponible pendiente, no actualizar como parte del inventario |
| Instalar APK de desarrollo | Modo desarrollador y USB | ADB autorizado y operativo; instalación de APK pendiente |
| Arranque y kiosco | Funciones de SUNMI OS o gestión Android | Capacidad documentada; ruta y permisos concretos pendientes |
| Distribución y gestión | App Store, herramientas de gestión SUNMI | No consta cuenta ni control administrativo de Volta sobre el equipo |

## Conexión por USB: siguiente etapa tras diagnóstico

Actualización: conexión ADB autorizada por el usuario y comprobada desde la laptop; estado `device`. Consultas de solo lectura confirman modelo V3, Android 13, ABI principal arm64-v8a, servicio de impresión `woyou.aidlservice.jiuiv5` versión 6.6.39 y Android System WebView 101.0.4951.61. La laptop dispone del SDK Android con plataformas 34/36 y build-tools 36.0.0/36.1.0. No se ha instalado todavía una aplicación ni modificado políticas del dispositivo. La presencia del servicio no acredita aún impresión desde Volta.

Para Android 11 o superior, SUNMI indica pulsar ocho veces **Número de compilación** en **Información del dispositivo**, y después abrir **Sistema → Opciones de desarrollador → Depuración USB**. En las fotos, Número de compilación muestra 4.5.1: es el campo documentado, no Firmware Version 586.

Después se conecta mediante un cable USB de datos al ordenador y se comprueba la detección/autorización. Una política del proveedor puede exigir un permiso adicional: si aparece, hay que identificar el requisito concreto. La existencia del menú no garantiza que ya tengamos autorización de desarrollo.

Objetivo técnico de esa conexión: inspeccionar versiones y servicios, instalar un APK de prueba, imprimir y leer errores. No es una modificación de ROM.

## Orden de trabajo

Actualización del laboratorio: se creó e instaló `com.volta.poslab` versión 0.1.0 desde `volta-pos-android`. Con SUNMI PrinterX 1.0.20 detecta una impresora en estado READY y el servicio confirmó la primera transacción con código 0, «Transaction print successful!». Pendiente inspección del ticket físico por el usuario. El APK no utiliza Internet ni cambia políticas de kiosco/arranque. Detalles y compilación en `volta-pos-android/README.md`.

1. Ejecutar diagnósticos básicos del equipo y registrar resultados.
2. Verificar configuración de impresora y posibilidades de instalación/gestión.
3. Conectar por USB e inventariar servicios y permisos disponibles.
4. Construir e instalar una aplicación Android mínima con ticket de prueba.
5. Configurar y probar arranque y kiosco con salida administrativa prevista.
6. Integrar el POS y la identidad segura del aparato con el backend.

La prueba de hardware no demuestra aún entrega fiable de pedidos. El piloto de Volta deberá comprobar además aislamiento entre tiendas, revocación, recuperación de red, confirmaciones y control de reimpresiones.
