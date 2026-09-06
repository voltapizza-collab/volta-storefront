# Volta POS en SUNMI: interfaz existente integrada — 6 septiembre 2026

La app instalada se llama **Volta POS** y conserva el paquete com.volta.poslab. La actividad de entrada es PosActivity. Incluye el icono de Volta y solicita un acceso directo al escritorio cuando el lanzador lo permite.

## Interfaz y conexión

Se compila directamente el componente existente volta-storefront/src/pos/PosApp.jsx dentro del APK. No se abre Chrome ni se descarga una página de Volta para ejecutar código remoto. Un WebView muestra exclusivamente los archivos empaquetados bajo un origen local interceptado. El puente Android mantiene la clave privada y la sesión fuera de JavaScript, firma las peticiones y usa el servidor piloto por USB. El login conserva únicamente usuario y PIN.

El transporte adapta las llamadas de la interfaz existente a /api/pos/ui. Todas atraviesan la autenticación de terminal y sesión, una lista explícita de operaciones permitidas y comprobaciones de propiedad de tienda/pedido/reserva. Reutiliza los controladores existentes para cocina, historial, ingredientes, reservas, apertura de tienda y atención al cliente. Los resúmenes del terminal limitan tiendas y clientes a su ámbito; las claves de caché incluyen la tienda derivada de la sesión.

La impresión usa el formato de líneas existente y PrinterX. Antes de imprimir se verifica el acceso al pedido. Solo el callback satisfactorio del SDK se presenta como impresión confirmada. Una respuesta incierta no provoca reimpresión automática. Los controladores de pedidos y mensajes mantienen sus efectos habituales (incluido SMS cuando corresponde); no se ejecutan esos cambios automáticamente durante la verificación.

## Compilación

1. En volta-storefront: node scripts/build-native-pos.cjs
2. En volta-pos-android: ./build.ps1
3. Instalar build/volta-pos-pilot-0.2.0.apk con adb install -r.
4. Mantener el servidor volta-backend/scripts/posPilotServer.js y adb reverse tcp:8091 tcp:8091 activos.

El build web contiene solo el POS y sus dependencias. Las adaptaciones de ancho se cargan únicamente en la app nativa. La versión web mantiene su transporte anterior.

## Verificación y límites

139 pruebas del backend pasan, incluidas pruebas de rechazo de recursos ajenos y rutas no permitidas. La app fue compilada, instalada y se comprobó el login real de Plaza Diario, el diseño sin desbordamiento horizontal y la lectura de cola. La impresora informa que está preparada. No se han generado pedidos ni se han probado mutaciones o SMS sobre datos reales.

Sigue siendo un piloto USB con firma de laboratorio, sin despliegue público, kiosco ni inicio automático al encender. Las visitas web en tiempo real usan memoria del proceso: el servidor piloto independiente no comparte el contador de visitas del servidor público. El clima y festivos requieren acceso a sus servicios externos.

El WebView bloquea navegación externa, archivos, contenido mixto y marcos; el documento aplica CSP. FLAG_SECURE permanece activo. La inspección WebView por la conexión USB autorizada está habilitada solo mientras el destino sea el servidor local del piloto. Antes de distribuir: HTTPS, compilación de producción sin depuración y firma definitiva, gestión de terminales, cierre de las rutas antiguas y validación operativa de pedidos/impresión.

Verificación final en el dispositivo: acceso directo fijado en el escritorio y apertura comprobada; sesión Plaza Diario conservada; ancho 360 CSS px sin desbordamiento; cola sincronizada; tienda, reservas (0), ingredientes (45) e historial responden HTTP 200 a través del puente firmado. Clima de Ourense y estado SUNMI preparados visibles. Las consultas del piloto se espacian diez segundos y toleran la latencia de la base remota.


Ajuste de visibilidad: avisos centrales con X y Cerrar, foco modal y supresión de errores idénticos tras descartarlos; eliminado el banner de push manual y el aviso temporal de pedido programado. Los nuevos pedidos mantienen su modal propio sin aviso duplicado. Accesos inferiores en una fila propia, sin cubrir información. Verificado en SUNMI: viewport 360x728 CSS px, contenido de espera 360x728, cabecera sin solapamiento y accesos por debajo de la tarjeta. Modal abierto y cerrado mediante su botón en el dispositivo.
