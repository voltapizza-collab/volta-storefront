# Actualizaciones de Volta POS mediante PackageInstaller

## Canal permanente — 3 de octubre

**Resultado físico:** actualización 0.3.16 → 0.3.17 completada mediante el servidor permanente con el USB desconectado. Código 20 reportado como `healthy`, misma identidad y sesión de vigoCity, impresora lista. El usuario corrigió posteriormente esa observación: vuelve al escritorio y debe tocar el icono de Volta; la reapertura automática no está verificada. Evidencia en `../../../output/pos-permanent-2026-10-03/final-verification.json`. Las limitaciones de las secciones antiguas siguientes describen la prueba con túnel, no este resultado.

La implementación nueva usa `https://api.voltapizza.com/api/pos/updates`, registro MySQL y almacenamiento privado Railway, en lugar del catálogo y túnel locales descritos en las secciones históricas. La APK 0.3.16-https/código 19 incorpora el origen permanente por defecto y la versión instalada en el pie. El procedimiento y los límites actuales están en `../../../volta-backend/docs/pos-permanent-updates.md`. El usuario establece el alta inicial por USB y las siguientes actualizaciones por internet. Se instaló 0.3.16 mediante `adb install -r` sobre 0.3.14 en el SUNMI VA08253N40979 y se abrió Volta. Queda asignada 0.3.17/código 20 únicamente a este terminal para comprobarla con el USB desconectado y la aceptación del usuario en el POS.

## Revisión posterior del 3 de octubre: versión visible y canal caducado

El registro `volta-backend/pos-private/update-events.jsonl` contiene evidencia posterior a `verification.json`: a las 01:04:13 del 3 de octubre (Europe/Madrid) el terminal informó `installed`, código 17 (0.3.14-https), tras `apk_sent`; a las 01:05:58 informó `healthy`, tienda 2, primer plano e impresora listos. Por tanto, la versión más reciente confirmada por estos registros es 0.3.14. El reporte `healthy` no demuestra por sí solo la reapertura automática ni que el USB estuviera desconectado.

En esta revisión el origen temporal `manchester-engineering-ate-above.trycloudflare.com` ya no resuelve y el servicio local 8096 no está escuchando. El origen está fijado en la APK; arrancar un túnel con otra dirección no reconecta el terminal instalado. La prueba siguiente por servidor queda pendiente de recuperar el origen anterior o migrar el terminal a un canal estable. No se ha instalado ninguna APK por USB en esta revisión.

Se sustituye el texto fijo «POS v01» por `versionName` leído de Android mediante `updateStatus`, compartiendo la consulta existente del panel de actualizaciones. El pie muestra la versión instalada, nunca la disponible; en navegador muestra «POS Virtual». La corrección queda preparada en el código y su nota ES/EN/IT/FR/PT queda en borrador hasta distribuir la APK correspondiente.

## Cambio del 3 de octubre: decisión desde el POS

La asignación de una APK **ya no autoriza su instalación**. El POS conserva los detalles y muestra un aviso persistente, sin abrir un diálogo por cada consulta. «Ver detalles» presenta título, versión y notas de publicación como texto, con tres caminos: Actualizar ahora, Ahora no → Programar fecha y hora, o Ahora no → Dejar pendiente. Se puede cambiar o cancelar una programación desde ese mismo aviso.

`UpdateConsent` exige autorización para el SHA-256 exacto y la tienda actual. La decisión, fecha absoluta y vencimiento se guardan en SharedPreferences privadas. Cambiar de tienda, cerrar sesión, retirar la versión o sustituir la APK elimina la autorización anterior. Se comprueba antes de descargar, después de descargar y justo antes de `PackageInstaller.commit`; una pulsación de interfaz por sí sola no evita estos controles nativos.

«Actualizar ahora» autoriza durante 15 minutos; programar permite elegir hasta 30 días y autoriza durante la hora siguiente a la fecha elegida. El diálogo explica ambos plazos. Si el plazo termina sin condiciones seguras, vuelve a pendiente y solicita otra decisión, sin instalar por sorpresa horas o días después. La programación funciona con Volta abierto y en primer plano: no se ha añadido un servicio en segundo plano, alarma exacta ni arranque automático. La elección sobrevive a reinicios; al volver al POS se reevalúa el plazo y se avisa si venció.

Las notas son obligatorias en el catálogo (`title`: 1–160 caracteres; `releaseNotes`: 1–6000). También se devuelven con la tienda activa para poder leer y decidir sin cerrarla. La descarga y la instalación siguen sujetas a la ventana de mantenimiento, tienda cerrada, cola vacía, batería y bloqueo de operaciones. La autorización inicial de Android es independiente de aceptar una versión. La interfaz utiliza la sesión de tienda existente; no introduce un nuevo rol de administrador ni diferencia empleados que compartan esa sesión.

Pruebas del cambio: 6 pruebas React del aviso, detalles, negativa, fecha, cancelación, cambio de APK y errores; 30 pruebas backend de identidad/rutas/actualizaciones; 8 de avisos; pruebas Java puras de `UpdateConsent` y `OperationGate`. Compilar y ejecutar las pruebas Java con los cuatro archivos `OperationGate.java`, `UpdateConsent.java`, `OperationGateTest.java` y `UpdateConsentTest.java`.

El 3 de octubre se comprobó el SUNMI por USB al 100 % y se instaló 0.3.13-https/código 16 con la firma original. El registro siguiente describe el trabajo anterior del 2 de octubre; sus pendientes de carga y artefactos antiguos no describen la instalación actual. El canal HTTPS de comprobación continúa siendo temporal y depende del ordenador; todavía no es el servicio estable de distribución para todas las tiendas. Evidencias de esta sesión en `../../../output/pos-updates-2026-10-03/`.

Se verificó en el SUNMI el aviso visible, sin desbordamiento, con la versión siguiente pendiente y sin instalación automática. La identidad criptográfica y el ID de sesión coinciden con el registro previo de `vigoCity`. No se cambió el estado activo de la tienda ni se aceptó una actualización en nombre del administrador. La instalación silenciosa por Wi-Fi y la reapertura siguen pendientes de prueba física.

La validación detectó consultas lentas desde el canal local a la base remota: el catálogo usa ahora hasta 15 segundos de lectura; los reportes desde receivers conservan un presupuesto corto. El permiso de instalación devuelve una duración relativa, limitada por la ventana de mantenimiento. Android descuenta el viaje completo de la petición con su reloj monotónico y comprueba otra vez antes del commit, evitando depender de que coincidan los relojes de servidor y terminal.

## Alcance y estado

Implementación de la primera puerta técnica: descargar una APK firmada, sustituir la aplicación mediante Android y comprobar su recuperación. La tienda sigue siendo una tienda normal de Volta; no hay modo demo, credenciales especiales ni un paquete diferente.

**Estado: código compilado y pruebas locales superadas; prueba física pendiente de carga del SUNMI.** La instalación silenciosa y la reapertura no se consideran demostradas por compilar el código ni por recibir un resultado de instalación.

Unidad objetivo: SUNMI V3 002, Android 13, dispositivo `c68ea9fd-04bb-4b96-8b1b-1d700488b473`, tienda 2 `vigoCity`, partner 1. Versión de partida instalada: 0.3.12-https, código 15. No se modifica la otra unidad ni se abre la tienda.

## Implementación

- `PosUpdater`: consulta en primer plano cada 30 segundos; canal HTTPS fijo configurado al construir, sin redirecciones. Peticiones y descarga firmadas por la identidad P-256 del dispositivo; nunca se envía la sesión de tienda al canal de actualizaciones.
- Verifica tamaño (máximo 100 MiB), SHA-256, paquete `com.volta.poslab`, código creciente, compatibilidad Android y certificado idéntico al instalado y al catálogo. Se guarda primero un `.part`, se sincroniza y solo entonces se acepta el archivo completo.
- `OperationGate`: bloquea nuevas operaciones nativas al comenzar el mantenimiento y exige que terminen las peticiones ya encoladas y el callback físico de impresión. Una impresión sin callback mantiene bloqueada la actualización.
- Se exige batería real de al menos 30 %, almacenamiento disponible y una ventana autorizada que caduca. En esta validación se exige tienda inactiva y cero ventas PAID pendientes; se comprueba nuevamente justo antes de instalar. No se cierra automáticamente la tienda.
- `PackageInstaller` usa `USER_ACTION_NOT_REQUIRED`. Se declaran `REQUEST_INSTALL_PACKAGES` y `UPDATE_PACKAGES_WITHOUT_USER_ACTION`; la autorización inicial de origen se concede desde los ajustes normales de Android. No se utiliza root ni Device Owner.
- Un resultado `STATUS_PENDING_USER_ACTION` detiene y bloquea esa versión; no abre ni acepta automáticamente el diálogo. Un timeout también bloquea la versión para evitar ciclos de instalación. Los fallos de conexión tienen espera creciente, hasta 15 minutos.
- Se abandonan sesiones incompletas no selladas al arrancar. Las copias antiguas descargadas se limpian después de verificar la nueva versión.
- `MY_PACKAGE_REPLACED` solicita abrir `PosActivity`. El servidor distingue `installed` de `healthy`: este último exige primer plano, restauración de sesión, interfaz lista, lectura reciente de pedidos y estado reciente de impresora listo. Android puede impedir la reapertura: debe medirse en el dispositivo.
- Menú normal del POS → Actualizaciones: versión, estado, autorización inicial y comprobación manual. El canal vacío desactiva la consulta.

## Canal de validación

`volta-backend/scripts/posUpdateValidationServer.js` escucha solamente en `127.0.0.1:8096`. Se expone temporalmente mediante un túnel HTTPS. Solo monta `/api/pos/updates`; no despliega rutas de pedidos, cambios de esquema ni otros cambios locales del backend.

Usa `authenticateDevice` existente, con estado AUTHORIZED y antirrepetición. El catálogo privado decide la APK por dispositivo. `/check` devuelve metadatos sin rutas locales; `/apk/:sha` comprueba asignación e integridad antes de enviar; `/prepare` vuelve a comprobar ventana, tienda y cola; `/report` conserva un conjunto limitado de campos en `PosDeviceAudit` y en JSONL local. No registra PIN, token ni claves.

Ejemplo de catálogo, guardado en `volta-backend/pos-private/update-catalogue.json` (ignorado en Git):

```json
{
  "schema": 1,
  "devices": {
    "UUID-DEL-DISPOSITIVO": {
      "sha256": "SHA256-DE-LA-APK",
      "maintenanceUntil": "FECHA-ISO-FUTURA-MAXIMO-24-HORAS"
    }
  },
  "releases": {
    "SHA256-DE-LA-APK": {
      "packageName": "com.volta.poslab",
      "versionCode": 17,
      "versionName": "0.3.14-https",
      "size": 123,
      "certificateSha256": "SHA256-DEL-CERTIFICADO",
      "apkPath": "RUTA-ABSOLUTA-DEL-ARCHIVO"
    }
  }
}
```

El túnel es temporal: no es el canal definitivo de tiendas. Al terminar se retira la asignación y se detiene el servicio. Una APK que conserve ese origen no podrá recibir siguientes versiones si el túnel desaparece; antes de distribuir a más terminales hay que definir el servicio HTTPS estable y migrar esta unidad a él.

## Validación reproducible

Desde `volta-backend`:

```powershell
node --test tests/posUpdates.test.js tests/posIdentity.test.js tests/posUi.test.js tests/backofficeNotifications.test.js
node scripts/posUpdateValidationServer.js
```

Desde `volta-storefront`, empaquetar la interfaz con `node scripts/build-native-pos.cjs`. Desde `native/sunmi-v3`, construir la primera APK con:

```powershell
./build.ps1 -Connection https -VersionName 0.3.13 -VersionCode 16 -UpdateServerUrl https://ORIGEN-HTTPS
```

Las versiones siguientes para probar son 0.3.14/código 17 y 0.3.15/código 18, misma firma y origen. **Solo la primera se instala por USB**. Se verifican hashes y certificados antes de asignarlas. No desinstalar, borrar datos, crear una identidad nueva ni usar downgrade: la identidad y sesión deben mantenerse.

Prueba pura del bloqueo, desde el proyecto Android (JDK en PATH):

```powershell
javac -d build/gate-tests src/com/volta/poslab/OperationGate.java tests/OperationGateTest.java
java -cp build/gate-tests OperationGateTest
```

Resultado local: 29 tests de backend (7 nuevos del actualizador), 8 de avisos y bloqueo de cola/impresión con 1.000 carreras concurrentes superados. `npm run test:pos` y `npm test` incluyen ahora los tests del actualizador. La UI empaqueta y las APKs 16/17/18 verifican esquemas de firma v1/v2/v3. Estos tests no prueban el verificador de APK ni las restricciones del instalador en Android real. Artefactos, hashes, tamaños y certificado: `../../../output/pos-updates-2026-10-02/build-verification.json`.

La última lectura de la base de datos encontró `vigoCity` **activa**, con cero pedidos pendientes. No se ha cambiado su estado. Esta versión esperará mientras siga activa. El terminal se desconectó del ordenador para cargar; no se instaló ninguna de las APKs del actualizador y el catálogo permanece sin dispositivos asignados.

El servicio y el túnel de comprobación se detuvieron al quedar pendiente el hardware. El origen temporal guardado en los artefactos ya no debe utilizarse. Antes de instalarlos, abrir un nuevo túnel y reconstruir las tres versiones con el origen vigente; todavía no se ha consumido ningún código de versión en el SUNMI.

## Puerta física pendiente

1. Cargar ≥30 %, conectar USB e instalar 0.3.13 con `adb install -r`. Registrar antes/después identidad, sesión, versión y tienda sin extraer secretos.
2. Autorizar el origen Volta POS en ajustes de Android. Volver al POS y comprobar pedidos/impresora.
3. Desconectar USB del ordenador, mantener Wi-Fi. Asignar 0.3.14 a esta única unidad y una ventana de mantenimiento.
4. Observar descarga, instalación sin diálogo y recuperación automática. Exigir reporte autenticado de versión 17 con salud completa, sesión original y tienda 2. No abrir manualmente la app durante la medición de reapertura.
5. Repetir hacia código 18. Comprobar impresión mediante la opción normal de ticket de prueba; no crear ventas reales.
6. Si Android pide confirmación o impide volver al POS, registrar por separado lo conseguido y lo fallido y detener la extensión a más tiendas.

## Trabajo posterior a esa puerta

Servicio estable, publicación autenticada de versiones, protección y respaldo de firma, almacenamiento inmutable, despliegue por grupos, interbloqueo de mantenimiento en el backend de pedidos, observabilidad, recuperación y panel administrativo. El chequeo de tienda cerrada actual **no es una reserva transaccional** frente a una reapertura o cobro concurrente desde otro cliente; no se debe usar para flota hasta resolverlo. No hay rollback automático: una corrección se publica con código superior, y la recuperación USB debe preservar datos.

No se han implementado kiosco, arranque tras reinicio, receptor de pedidos en segundo plano ni administración integral de la flota. Nota ES/EN/IT/FR/PT preparada como `posUpdatesAnnouncementDraft`, fuera del feed hasta disponibilidad real.
