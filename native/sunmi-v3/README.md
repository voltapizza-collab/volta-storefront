# Volta POS para SUNMI V3

Aplicación instalada: **Volta POS**, paquete `com.volta.poslab`, entrada `PosActivity`, con icono y acceso directo al escritorio.

Reutiliza el POS existente de React dentro del APK: pantalla de usuario/PIN, cocina, historial, ingredientes, reservas y atención al cliente. Las llamadas pasan por la identidad Android y la sesión autorizada de tienda. JavaScript no recibe el token ni la clave privada. La impresión se dirige a PrinterX en lugar del diálogo de Windows.

## Compilar e instalar

Versión preparada: **0.3.21 (código 24)**. Compilar desde este proyecto canónico; no usar la carpeta histórica `volta-pos-android` del workspace. Desde la raíz de `volta-storefront`, ejecutar `node scripts/build-native-pos.cjs` sin sobrescribir `VOLTA_ANDROID_PROJECT`, y después `./build.ps1 -Connection https` desde `native/sunmi-v3`. Actualizar sin desinstalar. La instalación operativa de 0.3.21 está pendiente; véase [revisión de VigoCity](../../docs/pos/recuperacion-vigocity-2026-10-06.md).

Actualizador en validación: parámetro opcional `-UpdateServerUrl https://origen-del-canal` al compilar. Sin él no se realizan consultas de actualización. Usar versiones crecientes y la misma clave de firma. El menú «Actualizaciones» abre el estado y la autorización de Android. Véase `../../docs/pos/actualizaciones-packageinstaller-2026-10-02.md`; el canal temporal de comprobación no sustituye al servicio de distribución de producción.

Desde el cambio del 3 de octubre, el aviso permite leer novedades, aceptar esa versión, programarla o dejarla pendiente. La asignación del servidor no basta para instalar. La decisión se conserva en el terminal, vinculada a APK y tienda, y caduca si no puede ejecutarse en el plazo mostrado. La programación requiere el POS abierto; no utiliza un servicio de fondo ni arranca el terminal.

1. En `volta-storefront`, ejecutar `node scripts/build-native-pos.cjs`.
2. Para conexión directa, ejecutar `./build.ps1 -Connection https -VersionName 0.3.12 -VersionCode 15` e instalar `build/volta-pos-connected-0.3.12.apk` con `adb install -r`.
3. Esta variante usa `https://api.voltapizza.com`, prohíbe HTTP y deshabilita la depuración WebView. Requiere las rutas `/api/pos` publicadas con `POS_IDENTITY_ENABLED=true`.
4. Para el piloto local, ejecutar `./build.ps1 -Connection usb` e instalar `build/volta-pos-pilot-0.2.0.apk`. Solo esta variante requiere `volta-backend/scripts/posPilotServer.js` y `adb reverse tcp:8091 tcp:8091`.

El terminal ya registrado conserva su identidad y sesión al actualizar. Desde 0.3.12, una instalación nueva abre automáticamente `SessionActivity` para introducir el código administrativo de alta, de un solo uso. Tras verificar la identidad con el servidor vuelve al POS normal. La actividad de alta continúa sin exportarse; el acceso de tienda requiere solo usuario y PIN.

La entrega 0.3.12-https (código 15) habilita ese acceso inicial y conserva los assets de interfaz verificados de 0.3.11. Se construye con `./build.ps1 -Connection https -VersionName 0.3.12 -VersionCode 15`. Registro de la unidad nueva: `../../docs/pos/alta-sunmi-2026-10-02.md`.

La versión 0.3.8 muestra `CAMBIOS:` bajo cada pizza con retiradas o extras, y `Receta original` para pizzas de carta sin modificaciones. El ticket imprime en negrita el título y las retiradas `SIN ...`. La opción del menú `Impresión de prueba` compara dos pizzas iguales, una modificada y otra con receta original, sin crear una venta.

La interfaz se empaqueta bajo `build/packaged/assets/pos`. El origen virtual `https://pos.volta.invalid` se resuelve dentro de Android y no contacta con un sitio externo. Los cambios de CSS de `native.css` solo afectan al Sunmi.

## Estado

Variantes USB y HTTPS disponibles; ambas conservan la firma del laboratorio para actualizar sin perder la identidad del terminal. Login real de Plaza Diario y cola confirmada en el piloto Sunmi. Pruebas del backend: 139 satisfactorias. El escritorio incluye Volta POS y abre la interfaz existente.

Quedan la prueba operativa de un pedido real, cierre de rutas antiguas, firma definitiva, kiosco y arranque automático. La app debe permanecer abierta para recibir avisos. El contador de visitas del piloto USB no comparte memoria con el servidor público. FLAG_SECURE permanece activo.

Detalles: `../../docs/pos/pos-interfaz-sunmi-2026-09-06.md`.

## Preparación y entrega de nuevos terminales

Consultar el [preset VOLTA-SUNMI-V3-01](../../docs/pos/presets/preparacion-entrega-pos-sunmi-v3.md) y completar una [ficha por aparato](../../docs/pos/presets/ficha-entrega-terminal.md). El preset distingue la operación HTTPS validada del flujo de alta de nuevos equipos, todavía pendiente de acceso guiado.

## Ubicación versionada

El código Android se mantiene en `volta-storefront/native/sunmi-v3`. Ejecutar `node scripts/build-native-pos.cjs` desde la raíz de volta-storefront antes de compilar aquí. Custodiar la clave de firma existente fuera de Git y colocarla en build/lab.keystore para actualizar terminales del piloto. No generar otra clave para actualizar una instalación existente. La carpeta hermana histórica volta-pos-android queda como copia de trabajo anterior.
# Canal permanente de actualizaciones — octubre de 2026

Desde 0.3.20/código 23: consulta al abrir/volver al primer plano y diariamente desde las 15:00 si todavía no se consultó ese día, usando el reloj local del terminal. Recordatorio modal como máximo una vez al día, persistente entre reinicios. Una programación vigente no vuelve a pedir confirmación. Guardar la elección cierra el diálogo. Las instalaciones ya autorizadas se comprueban cada 30 segundos, de forma independiente a la búsqueda diaria. Para verificar estos cambios primero instalar 0.3.20 y después asignar una versión posterior; su aviso de instalación lo gestiona todavía la versión anterior.

Las compilaciones `-Connection https` usan por defecto `https://api.voltapizza.com` tanto para operaciones como para actualizaciones. Para distribuir una versión nueva, aumentar nombre/código y publicar con `volta-backend/scripts/posReleases.js`. El catálogo reside en MySQL y las APKs en almacenamiento privado Railway; no hacen falta un túnel ni un ordenador encendido. Un origen alternativo exige `-AllowTemporaryUpdateChannel` y es solo para ensayos.

Consultar `../../../volta-backend/docs/pos-permanent-updates.md` para publicación, asignación, retirada, estado y migración sin USB desde las antiguas APKs de prueba. Versiones de esta entrega: 0.3.16/código 19 (migración) y 0.3.17/código 20 (comprobación OTA). No confundir una APK compilada con una instalación física verificada.
