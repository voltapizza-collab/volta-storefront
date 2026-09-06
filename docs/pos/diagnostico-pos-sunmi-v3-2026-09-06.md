# Diagnóstico de integración POS físico — SUNMI V3

Fecha: 6 de septiembre de 2026.

**Resultado:** existe un POS web con funciones de negocio aprovechables. Todavía falta la infraestructura que convierte cada SUNMI en un terminal identificado, autorizado, revocable y gestionado. La prioridad es cerrar la autenticación y autorización del servidor y después incorporar la aplicación Android, su arranque y la impresión física.

## Alcance y evidencia

Se revisaron `volta-backend`, `volta-storefront/src`, el esquema Prisma, las migraciones POS y documentación local. Se consultó directamente la base remota configurada en el entorno local mediante `SHOW TABLES`, `SHOW COLUMNS` y un `SELECT` limitado a tiendas y sus indicadores. No se leyeron valores de PIN, hashes ni secretos. No se ejecutaron migraciones, cambios de datos, regeneraciones, SMS ni pruebas sobre endpoints de producción.

La conexión remota responde, pero no se ha contrastado su identidad con el despliegue publicado: sus datos se describen como **base configurada**, sin asumir que demuestran el estado completo de producción. Tampoco se verificaron controles externos del alojamiento, otra rama o repositorios ajenos a este espacio.

La foto muestra dos cajas etiquetadas SUNMI V3. No permite determinar SKU, versión instalada, NFC, GMS, permisos de gestión ni estado de los equipos. La documentación adjunta o local se ha tratado como evidencia, no como una autorización adicional para intervenir.

## 1. Qué existe hoy

| Área | Implementación encontrada | Evaluación |
| --- | --- | --- |
| Aplicación POS | React, ruta `/pos`, `PosApp.jsx` | Reutilizable; actualmente accesible como aplicación web |
| Acceso | Nombre/slug de marca y PIN de seis dígitos por tienda | Identifica la tienda en el login; no autentica el aparato |
| Credenciales | Hash scrypt, copia cifrada AES-256-GCM y fecha de actualización | Base útil; falta cerrar acceso administrativo y ciclo de revocación |
| Pedidos | Consulta cada cinco segundos, prioridades, avisos sonoros y marcar listo | Funciones de negocio existentes |
| Otras operaciones | Reservas, mensajes al cliente, ingredientes y apertura/cierre | Reutilizables tras autorización por tienda y dispositivo |
| Impresión | Preparación de ticket, diálogo de Windows y registro virtual | Falta controlador real de impresora SUNMI |
| Conectividad | Detección local de errores y antigüedad de sincronización | No equivale a monitorizar terminales desde el servidor |
| Presencia | Visitantes del storefront en un `Map` con ventana de 30 segundos | No es presencia de POS; no persiste ni se comparte entre instancias |

Evidencias: `volta-storefront/src/App.js:48`; `volta-storefront/src/pos/PosApp.jsx:15`, `:1567`, `:2016`, `:2058`; `volta-storefront/src/pos/printers/mockPrinter.js`; `volta-backend/routes/presence.js`.

## 2. Base de datos: activación y desactivación

En `Store` existen efectivamente `posPinHash`, `posPinEncrypted`, `posPinUpdatedAt` y `posCredentialsEnabled`. Están declarados en Prisma y tienen migraciones de 17 de junio de 2026. También hay un mecanismo que intenta crear columnas durante peticiones; para la integración física conviene depender de migraciones controladas, no de DDL en rutas de uso normal.

Estos estados cumplen funciones diferentes:

| Campo | Función actual | Lo que no representa |
| --- | --- | --- |
| `Partner.active` | Habilitación de la marca; se comprueba en login POS | Identidad de un terminal |
| `Store.active` | Activación de tienda; lo cambia el botón de apertura/cierre del POS | Revocación de credenciales del aparato |
| `Store.acceptingOrders` | Disponibilidad para recibir pedidos, junto con otras reglas | Conectividad o autorización del POS |
| `Store.posCredentialsEnabled` | Permite que sus credenciales participen en el login | Sesión revocable ni bloqueo de un equipo concreto |

**Inventario leído en la base configurada:**

| ID | Tienda | Activa | Recibe pedidos (campo) | Credenciales habilitadas | PIN configurado |
| --- | --- | --- | --- | --- | --- |
| 1 | Plaza Diario | Sí | Sí | Sí | Sí |
| 2 | vigoCity | No | Sí | Sí | Sí |
| 5 | Demo Central | Sí | Sí | Sí | No |
| 6 | pizza luigi | Sí | No | Sí | Sí |
| 7 | Asomasima TR | No | No | Sí | No |
| 8 | Pizza Planet | No | No | Sí | No |
| 9 | Pickza | No | No | Sí | Sí |
| 10 | Napolit TM | No | No | Sí | Sí |

Ocho tiendas, cinco con hash y copia cifrada presentes, tres sin PIN. Todas tienen el indicador de credenciales habilitado y su marca activa. La columna «recibe pedidos» refleja el valor almacenado; la aceptación efectiva depende también de activación, horarios y reglas del checkout.

No aparece un modelo de terminales en Prisma ni tablas con nombres relativos a POS, dispositivos, rooms, sesiones o impresión en la base consultada. No hay inventario donde registrar por separado los dos SUNMI de la foto.

No se encontró una ruta o control de interfaz que cambie `posCredentialsEnabled` a falso. La edición general de tienda no lo actualiza. Existe consulta/regeneración de PIN, pero `buildPosPinData()` siempre habilita las credenciales. El login filtra marca activa y credenciales habilitadas, **no exige tienda activa**; esto permite entrar para reabrir una tienda, pero debe distinguirse expresamente de una revocación administrativa.

Evidencias: `volta-backend/prisma/schema.prisma:191`; `volta-backend/routes/partners.js:989`; `volta-backend/routes/stores.js:1095`, `:1407`, `:1520`, `:1560`; `volta-backend/services/posCredentials.js:67`.

## 3. Rooms, arranque y seguridad

No se encontró implementación POS de WebSocket, Socket.IO, MQTT, pertenencia a rooms, proyecto Android, launcher, arranque al encender o modo kiosco. El estado actual es polling HTTP desde React. Esto no descarta un diseño previo o trabajo en otro repositorio.

Hay dos piezas distintas que conviene concretar al hablar de «room»:

- **Entorno del aparato:** aplicación dedicada que se abre al encender, restringe navegación y se recupera tras un reinicio o fallo.
- **Canal del servidor:** conexión autenticada y suscripción a eventos de la tienda autorizada.

Un room distribuye eventos; no demuestra quién es el dispositivo. Un kiosco restringe la interfaz; no protege por sí solo las rutas del servidor. No hace falta asumir una ROM personalizada para conseguir el comportamiento solicitado.

### Hallazgos prioritarios

1. **No hay sesión de servidor para el POS.** El login devuelve datos de tienda/marca, sin token ni cookie de sesión. React guarda ese objeto en `localStorage` y envía identificadores en las peticiones. `setupAxios.js` no añade prueba de autenticación.
2. **Falta autorización en rutas operativas revisadas.** El montaje Express y las rutas de pedidos, cambios de tienda y credenciales no muestran middleware de autenticación. `/api/myorders/pending` toma el alcance de parámetros enviados por el cliente; `/:id/ready` busca por ID y estado de pago, sin comprobar pertenencia al terminal. Es un hallazgo del código; no se ha realizado una explotación remota ni verificado una posible barrera externa. CORS no sustituye este control.
3. **Consulta de PIN con efectos de escritura.** `GET /stores/:id/pos-credentials` devuelve el PIN y, si no puede descifrarlo, lo regenera y habilita credenciales. Debe pasar a un flujo administrativo protegido, explícito y auditable, sin regeneración automática al consultar.
4. **Revocación incompleta.** Cambiar el PIN o deshabilitar nuevas entradas no invalida una identidad ya guardada en el navegador ni protege las llamadas posteriores. Cada petición y conexión deberá comprobar una sesión y un terminal autorizados.
5. **Protección del PIN.** No se encontró limitación de intentos en el login. La clave de cifrado admite varios fallbacks, incluido un valor de desarrollo. El entorno local usado para consultar no define `POS_PIN_ENCRYPTION_KEY`; esto no acredita qué variables tiene el servidor desplegado. Se necesita una clave dedicada y un procedimiento de rotación.

El diagnóstico local de seguridad de 23 de julio ya describía parte de estos problemas. Las conclusiones anteriores se han comprobado nuevamente en código; no se asumen solucionadas por existir documentación.

### Fiabilidad con varios terminales

- «Aceptar pedido» actualmente solo silencia y guarda el aviso en `localStorage`; no confirma recepción/aceptación al backend (`PosApp.jsx:2221`). Dos equipos no comparten ese acuse.
- La impresión se registra localmente como virtual; falta cola durable, estados físicos, identificación del terminal y reimpresión explícita.
- Marcar listo comprueba y actualiza en operaciones separadas. Con dos aparatos existe una posible carrera y duplicación de efectos secundarios. Se requiere transición atómica e idempotencia.
- La lectura de pendientes consulta como máximo 200 registros y devuelve hasta el límite solicitado. La recuperación tras desconexiones debe diseñarse con sincronización completa/paginación, no depender solo de eventos o de ese primer bloque.
- No se encontró una cola durable de operaciones sin conexión. El indicador local de desconexión no garantiza recuperación, entrega ni impresión.

## 4. SUNMI V3: encaje preliminar

La ficha del fabricante describe un V3 con SUNMI OS basado en Android 13 de 64 bits, pantalla de 6,75 pulgadas (720 × 1600), 3 GB/32 GB, impresora térmica de 58 mm, Wi-Fi y conectividad móvil. NFC, escáner y GMS dependen de variante. Esto sirve para planificar; debe verificarse en nuestras unidades. [Ficha SUNMI V3](https://cdn.sunmi.com/public/generalfile/mgt_import/ba711a2a76d6485d9cedf56d7fa41113.pdf).

SUNMI documenta acceso desde aplicaciones Android a su servicio de impresión mediante SDK/AIDL. La propuesta es adaptar el ticket existente a impresión nativa y verificar la compatibilidad exacta del servicio instalado en el V3. [Documentación de impresoras integradas SUNMI](https://cdn.sunmi.com/public/generalfile/mgt-document/841c6680d673447ba9c5d9b1e1131d01.pdf).

Android ofrece modo dedicado mediante políticas de dispositivo y `lock task mode`. El bloqueo gestionado exige configurar correctamente el controlador de políticas; fijar una pantalla manualmente no ofrece el mismo control. El método de aprovisionamiento y arranque debe comprobarse con el firmware y permisos disponibles. [Android: lock task mode](https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode).

La familia V3 anuncia capacidades SoftPOS/NFC y gestión DMP. Esto no demuestra que nuestras unidades tengan NFC, acceso administrativo a DMP ni una integración de cobro habilitada. Si además se quiere cobrar tarjetas físicamente, habrá que confirmar variante y proveedor compatible como alcance específico. [SUNMI V3 Family](https://www.sunmi.com/en/v3-family).

**Propuesta técnica:** reutilizar la interfaz y lógica de negocio React dentro de una aplicación Android con contenido controlado, puente nativo mínimo para impresión y credenciales protegidas. Comparar esa opción con una interfaz completamente nativa después de probar rendimiento y usabilidad. Hay reglas CSS adaptativas, pero no una validación sobre el equipo: 720 píxeles físicos no equivalen al ancho CSS efectivo.

## 5. Arquitectura propuesta, aún no implementada

Flujo: encendido → aplicación dedicada → identificación criptográfica del aparato → comprobación de autorización en servidor → sincronización de pedidos → suscripción al canal asignado → confirmaciones y operación.

El servidor conserva autoridad sobre pedidos, permisos y asignación. El terminal inicia una conexión saliente segura, presenta su identidad y solo recibe eventos y ejecuta operaciones permitidas para su tienda.

| Entidad propuesta | Datos y responsabilidad |
| --- | --- |
| `PosDevice` | ID interno, marca/tienda, alias, serial de inventario, modelo, estado autorizado/suspendido/revocado, clave pública, versión y última conexión |
| `PosEnrollment` | Código de alta de un uso y corta duración, creado por un administrador autorizado |
| `PosSession` | Sesión por terminal, expiración, renovación y revocación; sin guardar secretos en claro |
| `PosAuditEvent` | Quién dio de alta, reasignó, suspendió, reactivó o revocó el equipo |
| `PosDelivery` / `PosCommand` | Identificador de evento/operación, secuencia, confirmación y reintentos |
| `PosPrintJob` | Pedido, terminal, estado, error, intentos y reimpresión identificada |

El serial es inventario, no contraseña. La clave privada del dispositivo debe mantenerse protegida en Android. El PIN de un operador, si se conserva, será distinto de la identidad del aparato.

Separar **autorización**, **conectividad** y **estado de tienda**. Suspender un equipo debe bloquear sus peticiones y cerrar su canal desde el servidor; no depender de que reciba voluntariamente una orden de bloqueo. Un terminal sin conexión no puede recibir una orden inmediata: aplicar una política local de caducidad y limitar las operaciones offline.

Los rooms se asignarán en el servidor a partir de la identidad autorizada. Para varias instancias habrá que compartir presencia y eventos. La distribución de eventos debe incluir recuperación tras reconectar; un socket por sí solo no es una cola durable. La impresión física requiere tratar resultados inciertos: no prometer «exactamente una impresión» después de un corte eléctrico sin reconciliación.

## 6. Orden recomendado y criterios de salida

1. **Cerrar acceso del backend.** Autenticación administrativa y POS, autorización por tienda en todas las rutas relacionadas y sus alias, limitación de intentos y retirada del acceso público a credenciales. Salida: llamadas anónimas rechazadas y un terminal de A no puede leer ni modificar B.
2. **Crear inventario y alta por terminal.** Migraciones, emparejamiento, credenciales de dispositivo y panel de suspensión/revocación. Salida: suspender uno de los dos equipos mantiene al otro operativo y rechaza nuevas peticiones del suspendido.
3. **Probar un V3 como equipo de laboratorio.** Identificar SKU, Android/SUNMI OS, actualizaciones, GMS, NFC si interesa, acceso a instalación/gestión, impresora y opciones de arranque. Sin flashear ni restaurar de fábrica durante este diagnóstico.
4. **Construir aplicación dedicada e impresión.** Arranque automático, restricciones de navegación, almacenamiento seguro, sonidos y ticket real. Salida: reinicio completo hasta pantalla operativa e impresión legible con manejo de falta de papel.
5. **Incorporar canal y recuperación.** Rooms autenticados, presencia, sincronización, confirmaciones e idempotencia. Salida: cortes de Wi-Fi, cambios de red y reinicio del backend sin pérdida de pedidos ni duplicación de acciones.
6. **Piloto con dos aparatos.** Determinar si comparten tienda o se asignan a tiendas distintas; probar aceptación, impresión y finalización simultáneas, actualización de app y retorno a versión anterior.

El primer piloto debe demostrar: aislamiento entre tiendas; revocación efectiva; encendido autónomo; pedido recibido y confirmado; ticket físico; recuperación tras desconexión; y trazabilidad del terminal que realiza cada operación.

## Verificación realizada

Se ejecutaron `node --test tests/posCredentials.test.js tests/myordersFilters.test.js`: **8 pruebas aprobadas, 0 fallos**. Verifican utilidades de credenciales y filtros/formato de pedidos, no seguridad integral, arranque Android ni impresión física. No se añadieron pruebas ni se modificó código de aplicación o base de datos. Este informe es el único archivo creado para el diagnóstico.
