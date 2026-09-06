# POS: identidad de terminal y sesión de pizzería

Implementación del 6 de septiembre de 2026, posterior al diagnóstico inicial. La decisión del usuario es que cada aparato se autorice para Volta independientemente de las tiendas y que el login determine la pizzería activa.

## Estado real

- Migración `20260906120000_add_pos_device_identity` aplicada a la base MySQL remota configurada en `volta-backend/.env`. Antes de ejecutarla se verificó que era la única pendiente y no existían migraciones fallidas. Añade seis tablas y sus relaciones; no cambia credenciales, pedidos ni estados de las tiendas.
- Terminal real registrado: `SUNMI V3 001`, id `40f562de-7dc8-494f-8589-abc513769666`, estado `AUTHORIZED`. Su clave privada se genera y permanece en Android Keystore; el backend conserva la pública. No se ha certificado mediante attestation el nivel de protección de hardware.
- Aplicación `com.volta.poslab` actualizada a 0.2.0, nombre «Volta POS · Piloto». La firma de laboratorio conserva la instalación previa.
- Sesión real de Plaza Diario confirmada por el usuario en el Sunmi. Acceso únicamente con usuario y PIN.
- API piloto escuchando únicamente en `127.0.0.1:8091` en la laptop. `adb reverse tcp:8091 tcp:8091` conecta el Sunmi a ese servidor por USB. No funciona autónomamente sin laptop/cable en esta compilación.
- No se desplegó el backend público. La futura incorporación en `index.js` está detrás de `POS_IDENTITY_ENABLED=true`, desactivada por defecto.

## Modelo y reglas

`PosDevice` no tiene `storeId`. Almacena la identidad, nombre, modelo, estado y última petición aceptada. `PosSession` contiene la asociación temporal con tienda/marca; solo se admite una por aparato. Cerrar sesión elimina esa asociación sin eliminar el terminal.

`PosEnrollment` guarda el hash de un código aleatorio de 256 bits, caduca a los 15 minutos y se consume atómicamente. Las altas se generan desde una herramienta administrativa local, no desde una ruta pública que entregue autorizaciones. El código no queda almacenado en la aplicación.

`PosDeviceNonce` rechaza repeticiones de peticiones; `PosDeviceAudit` registra altas, inicios/cierres de sesión y cambios administrativos. `PosLoginThrottle` limita los intentos por dispositivo y usuario normalizado a 20 por ventana de 15 minutos, con contadores en base de datos compartidos entre instancias.

El PIN sigue siendo por tienda y se verifica mediante su hash. El acceso requiere únicamente usuario y PIN. Si coinciden con varias tiendas, se rechaza con ambiguous_credentials; administración debe corregir la duplicidad, sin solicitar un tercer campo.

Las sesiones duran 30 días y no se renuevan indefinidamente. Cada petición comprueba estado del aparato, marca activa, credenciales habilitadas, pertenencia y huella del PIN actual. Cambiar el PIN invalida la sesión. Suspender o revocar elimina la sesión; volver a autorizar un suspendido exige nuevo login. La revocación es permanente para esa identidad.

## Protocolo

Cabeceras: `X-Volta-Device`, `X-Volta-Time` (segundos Unix), `X-Volta-Nonce`, `X-Volta-Signature`. Firma ECDSA P-256/SHA-256, formato DER/Base64. Se firman, separados por salto de línea: ID, timestamp, nonce, método, ruta con query, SHA-256 del cuerpo crudo y SHA-256 de la cabecera Authorization. Tolerancia de reloj: 120 segundos.

El código de alta y la clave pública también requieren prueba de posesión. Las rutas con sesión exigen además `Authorization: Bearer …`; el token aleatorio se guarda como hash en el servidor y cifrado con AES-GCM en Android Keystore en el aparato. No se guarda el PIN. Las pantallas de sesión usan `FLAG_SECURE` y desactivan autofill en los campos.

| Ruta | Requisito | Resultado |
| --- | --- | --- |
| POST `/api/pos/devices/enroll` | Código administrativo y firma de la clave nueva | Terminal autorizado sin tienda |
| GET `/api/pos/device` | Identidad firmada y autorizada | Estado de terminal |
| POST `/api/pos/session` | Terminal autorizado y credenciales de tienda | Sesión limitada a esa tienda |
| DELETE `/api/pos/session` | Terminal autorizado | Cierra su sesión aunque el PIN haya cambiado |
| GET `/api/pos/bootstrap` | Terminal y sesión válidos | Nombre de tienda/marca y estados comerciales |
| GET `/api/pos/orders` | Terminal y sesión válidos | Pendientes pagados de esa tienda, paginados por ID |

La consulta de pedidos rechaza parámetros de alcance enviados por el cliente. Solo admite `after` y obtiene tienda/marca de la sesión. La UI del piloto presenta un resumen de la primera página; no sustituye la cola operativa del POS virtual.

## Operación administrativa

Desde `volta-backend`:

```powershell
node scripts/posAdmin.js list
node scripts/posAdmin.js enroll-code "SUNMI V3 002" "Luigi" "pos-private/sunmi-002.json"
node scripts/posAdmin.js status ID SUSPENDED "Luigi" "Equipo en mantenimiento"
node scripts/posAdmin.js status ID AUTHORIZED "Luigi" "Mantenimiento finalizado"
node scripts/posAdmin.js status ID REVOKED "Luigi" "Baja definitiva"
```

`ID` debe sustituirse por el identificador del terminal elegido. La herramienta usa acceso administrativo a la base configurada; no es una API para el dispositivo. `pos-private/` está ignorado por Git y los códigos se escriben en archivos exclusivos para evitar sobrescribir otro código.

Para arrancar el piloto: `npm run pos:pilot`. Conectar ADB y ejecutar `adb -d reverse tcp:8091 tcp:8091`. El servidor iniciado en esta tarea corre oculto; PID y logs se guardan en `volta-backend/tmp/pos-pilot.*`. Para pararlo, verificar primero que el PID corresponde a `scripts/posPilotServer.js`.

La APK permite únicamente HTTP al loopback `127.0.0.1` para este túnel USB; el resto del tráfico en claro está prohibido. Una versión pública debe apuntar al host HTTPS correcto y retirar esa excepción. No hay desactivación de validación TLS.

## Pruebas y límites

`npm test`: 135 pruebas aprobadas, 0 fallos. Incluye 17 casos nuevos: integridad de firmas, timestamp, identidad, replay, cambio de PIN, suspensión/revocación, expiración, cambio de tienda, credenciales ambiguas, límites de intentos, código consumido y aislamiento de tienda en la ruta HTTP. Las pruebas de lógica utilizan dobles de base de datos; no demuestran por sí solas carreras reales de MySQL. Los cambios de sesión y estado se serializan con bloqueo de fila por terminal.

En el Sunmi se verificaron registro, autenticación firmada y sesión real de Plaza Diario. El cambio de tienda continúa pendiente de validación manual.

Antes de producción quedan: proteger también las rutas antiguas de pedidos y credenciales (sus accesos previos no se eliminan por añadir esta API), desplegar y verificar HTTPS, retirar mecanismos de laboratorio, integrar la interfaz completa y todas sus operaciones, gestión visual de terminales, entrega/acuse fiable de pedidos, reimpresión controlada y kiosco/arranque. El piloto tampoco incluye attestation, reintentos automáticos de alta tras pérdida de respuesta ni canal push. Si el alta se consume pero se pierde su respuesta, será necesaria recuperación administrativa; no regenerar identidad ni autorizar automáticamente.

La consulta automática de pedidos cada diez segundos, mientras la pantalla está activa, permite detectar revocación en cada petición; no implica que una pantalla offline pueda recibir una orden instantánea. La aplicación limpia la vista al cerrar/cambiar sesión y no permite un nuevo login mientras quede pendiente el cierre remoto.
