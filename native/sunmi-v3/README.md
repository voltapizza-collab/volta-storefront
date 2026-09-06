# Volta POS para SUNMI V3

Aplicación instalada: **Volta POS**, paquete `com.volta.poslab`, entrada `PosActivity`, con icono y acceso directo al escritorio.

Reutiliza el POS existente de React dentro del APK: pantalla de usuario/PIN, cocina, historial, ingredientes, reservas y atención al cliente. Las llamadas pasan por la identidad Android y la sesión autorizada de tienda. JavaScript no recibe el token ni la clave privada. La impresión se dirige a PrinterX en lugar del diálogo de Windows.

## Compilar e instalar

1. En `volta-storefront`, ejecutar `node scripts/build-native-pos.cjs`.
2. Para conexión directa, ejecutar `./build.ps1 -Connection https` e instalar `build/volta-pos-connected-0.3.4.apk` con `adb install -r`.
3. Esta variante usa `https://api.voltapizza.com`, prohíbe HTTP y deshabilita la depuración WebView. Requiere las rutas `/api/pos` publicadas con `POS_IDENTITY_ENABLED=true`.
4. Para el piloto local, ejecutar `./build.ps1 -Connection usb` e instalar `build/volta-pos-pilot-0.2.0.apk`. Solo esta variante requiere `volta-backend/scripts/posPilotServer.js` y `adb reverse tcp:8091 tcp:8091`.

El terminal ya registrado conserva su identidad y sesión al actualizar. El registro de nuevas unidades sigue usando la pantalla administrativa `SessionActivity`; la distribución definitiva aún debe completar ese flujo. El acceso de tienda requiere solo usuario y PIN.

La interfaz se empaqueta bajo `build/packaged/assets/pos`. El origen virtual `https://pos.volta.invalid` se resuelve dentro de Android y no contacta con un sitio externo. Los cambios de CSS de `native.css` solo afectan al Sunmi.

## Estado

Variantes USB y HTTPS disponibles; ambas conservan la firma del laboratorio para actualizar sin perder la identidad del terminal. Login real de Plaza Diario y cola confirmada en el piloto Sunmi. Pruebas del backend: 139 satisfactorias. El escritorio incluye Volta POS y abre la interfaz existente.

Quedan la prueba operativa de un pedido real, cierre de rutas antiguas, firma definitiva, kiosco y arranque automático. La app debe permanecer abierta para recibir avisos. El contador de visitas del piloto USB no comparte memoria con el servidor público. FLAG_SECURE permanece activo.

Detalles: `../../docs/pos/pos-interfaz-sunmi-2026-09-06.md`.

## Preparación y entrega de nuevos terminales

Consultar el [preset VOLTA-SUNMI-V3-01](../../docs/pos/presets/preparacion-entrega-pos-sunmi-v3.md) y completar una [ficha por aparato](../../docs/pos/presets/ficha-entrega-terminal.md). El preset distingue la operación HTTPS validada del flujo de alta de nuevos equipos, todavía pendiente de acceso guiado.

## Ubicación versionada

El código Android se mantiene en `volta-storefront/native/sunmi-v3`. Ejecutar `node scripts/build-native-pos.cjs` desde la raíz de volta-storefront antes de compilar aquí. Custodiar la clave de firma existente fuera de Git y colocarla en build/lab.keystore para actualizar terminales del piloto. No generar otra clave para actualizar una instalación existente. La carpeta hermana histórica volta-pos-android queda como copia de trabajo anterior.
