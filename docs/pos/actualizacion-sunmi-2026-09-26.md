# Actualización USB del SUNMI — 26 de septiembre de 2026

Por petición de Luigi se actualizó el V3 `VA08253N40441`, paquete `com.volta.poslab`, desde `0.3.9-https` (12) a **`0.3.10-https` (13)** mediante `adb install -r`. Resultado `Success`, arranque `Status: ok`. Se conservan UID 10161 y fecha inicial de instalación 2026-09-06; no se borraron datos ni se desinstaló la aplicación.

Compilada la interfaz actual con `node scripts/build-native-pos.cjs` y el proyecto canónico `native/sunmi-v3/build.ps1 -Connection https -VersionName 0.3.10 -VersionCode 13`. Incluye la agrupación del inventario por familias y los avisos de revisión del reparto cuando el servidor proporciona esa marca. No implica publicar los cambios pendientes del backend ni cargar las 3.728 fichas en inventarios operativos.

- Firma SHA256 del APK anterior y del nuevo: `5fbbf18196c59f52a491032c67afd88ee577e5ff1f65f17a18b83d9795bb03de`.
- SHA256 del nuevo APK: `F9477933159E08B3C93DFC857AF09ACE72F61EA2325A4736FBFE582E098A83C3`.
- Copia de recuperación: `output/pos-update-2026-09-26/installed-before-0.3.9.apk`, desde la raíz del workspace.
- APK entregado: `output/pos-update-2026-09-26/volta-pos-connected-0.3.10.apk`.
- 14 pruebas específicas de inventario y tickets aprobadas; compilación de interfaz, APK y verificación de firma correctas.
- Variante HTTPS contra `https://api.voltapizza.com`, sin túneles `adb reverse`. El cable se usó para actualizar y diagnosticar.

No se creó una venta ni se imprimió un ticket. La prueba física de impresión y la comprobación del usuario con el USB desconectado quedan pendientes.

Comprobación de arranque en el proceso nuevo: `login:false`, `pos:true`, `inputs:0`, `overflow:false`, `cardsFit:true`, `inventory:true`. La sesión llega directamente al POS y muestra acceso al inventario. Sin errores AndroidRuntime/chromium en el registro filtrado de ese arranque. Evidencia: `output/pos-update-2026-09-26/startup-check.log`.

## Corrección posterior de alineación — versión 0.3.11

Luigi confirmó que los nombres deben quedar a la izquierda y los contadores a la derecha. Se elimina el centrado heredado del botón al partir nombres largos, se reserva el espacio del contador y se añade separación de 12 px. Los nombres pueden ocupar varias líneas sin cortarse y los contadores no se parten.

Comprobación de layout con los estilos reales y las 14 categorías en Chromium headless a 320, 360, 393 y 768 px: todas las líneas parten del mismo borde izquierdo, separación mínima de 12 px y sin desbordamientos ni contadores partidos. Captura revisada en `output/pos-category-alignment/after.png`. No se abrió el navegador integrado. Ocho pruebas del catálogo de avisos aprobadas; nota ES/EN/IT/FR/PT guardada como borrador fuera del feed hasta la publicación general.

Compilada e instalada **0.3.11-https (14)** en el mismo terminal mediante `adb install -r`, resultado `Success` y arranque `Status: ok`; firma, UID y fecha original de instalación conservados. APK `output/pos-update-2026-09-26/volta-pos-connected-0.3.11.apk`, SHA256 `0778F4D7216FBCFDC95D928981389258FCAC2AE8FCBAA86C727B57315B7F49FF`. Esta versión sustituye a la 0.3.10 de la sección anterior.
