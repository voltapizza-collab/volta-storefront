# SUNMI V3: conexión directa a producción

## Despliegue verificado

Railway: proyecto `fba98967-e8ec-45f3-bcb1-a7f4272f6fda`, entorno `production`, servicio `volta-backend` (`542b8fcb-169c-4b32-aa2b-f0ba0d604a88`). Dominio `https://api.voltapizza.com`.

Despliegue `477096fc-ee20-4ad7-86f6-ea9e79074382`: SUCCESS. Se activó `POS_IDENTITY_ENABLED=true`. La versión anterior es `82474d96-a98a-4645-ad7a-a9f1c61a93d1`, commit `2e097cd59267e53330184da6f2b32bc6b81b508a`, también base del código local. Se subió una copia de los archivos de código, excluyendo credenciales, logs y datos privados; no se hizo push a GitHub. Antes de un próximo despliegue desde GitHub, incorporar los cambios locales del POS para no perder estas rutas.

La base de datos del servicio usa la misma base y credenciales que el piloto. El arranque confirmó 53 migraciones, sin pendientes. Se conserva el terminal autorizado y su sesión de tienda 1 (Plaza Diario).

## Aparato

Instalado `com.volta.poslab`, versión `0.3.0-https`, código 3. APK `volta-pos-android/build/volta-pos-connected-0.3.0.apk`, SHA256 `0D3E081CB54D1D1F2838190130D2F7630AE24CE1467C3B162CF45B7F53BD9BBD`.

Se actualizó sin borrar datos, se eliminó `adb reverse tcp:8091` y se apagó el servidor local del piloto. La aplicación se reinició y realizó peticiones firmadas a producción: `/api/pos/device`, `/api/pos/bootstrap`, reservas, tienda, pedidos pendientes y presencia respondieron 200. Tras la conexión inicial (2217 ms), las consultas observadas duraron 60–112 ms en los logs HTTP de Railway; esto no mide toda la latencia percibida en pantalla.

Las peticiones anónimas a device, bootstrap e interfaz dieron 401 `device_required`; `/health` dio 200. El dispositivo sigue conectado físicamente por USB para instalación/diagnóstico, pero ya no hay túnel de datos hacia la laptop. Falta la confirmación física del usuario tras desenchufarlo.

## Alcance pendiente

El usuario confirmó ticket de 58 mm correcto y sonido correcto tras el ajuste. Falta la primera compra real por internet y validar recepción, aceptación e impresión del pedido. Mantener Volta abierta: recepción en segundo plano, modo kiosco y arranque automático siguen pendientes. También quedan distribución/firma definitiva y cierre de las rutas antiguas del POS web; la nueva API protegida no sustituye por sí sola esas rutas.

Rollback de conexión del terminal: compilar `build.ps1 -Connection usb`, reinstalar con `adb install -r`, arrancar el piloto y restablecer `adb reverse tcp:8091 tcp:8091`. No borrar datos ni claves. Para rollback del servidor se dispone del despliegue anterior, pero este no contiene las rutas requeridas por el APK HTTPS.
