# Alta de SUNMI V3 002 — 2 de octubre de 2026

Unidad: SUNMI V3, serie VA08253N40979. Android 13, compilación 4.5.1, servicio de impresión 6.6.39. No tenía instalado `com.volta.poslab` al comenzar. Es distinta de la unidad 001 previamente registrada.

Destino operativo: MyCrushPizza, tienda vigoCity (Store 2, Partner 1), Rúa Policarpo Sanz, 2, Vigo. Opera con el flujo normal de Volta; no se añadió modo demo ni se fijó la tienda en la APK.

## Cambio y entrega

APK 0.3.12-https, versionCode 15. PosActivity abre la pantalla interna de alta cuando no existe identidad local. Tras el registro y la verificación del dispositivo, SessionActivity devuelve al acceso normal de Volta. La actividad de alta continúa sin exportarse. Se protegen las llamadas del ciclo de vida cuando todavía no existe WebView y se adaptan los textos de configuración a HTTPS.

Los 48 assets de interfaz empaquetados coincidían por SHA-256 con el APK 0.3.11 verificado. Se conservaron para limitar esta entrega al acceso inicial de registro. Compilación: `build.ps1 -Connection https -VersionName 0.3.12 -VersionCode 15`, sin reconstruir la interfaz con otros cambios locales.

- SHA-256 APK: `3CF9006ECB30F19A6AB7EF989B817A4A9D914303FB620E91DDBA594DAAA20109`.
- Certificado SHA-256: `5fbbf18196c59f52a491032c67afd88ee577e5ff1f65f17a18b83d9795bb03de`.
- Instalación por USB: `Success`; arranque: `Status: ok`.
- PosDevice: `c68ea9fd-04bb-4b96-8b1b-1d700488b473`, nombre `SUNMI V3 002`, estado `AUTHORIZED`.
- Alta mediante código de un uso, sin guardar el código ni claves en este documento. Clave privada generada por Android Keystore en esta unidad.
- El backend confirmó el registro y la app llegó al login normal: `login:true`, `pos:false`, `overflow:false`.
- Código de alta confirmado como consumido. 30 pruebas de identidad, aislamiento POS y notificaciones aprobadas. Sin errores AndroidRuntime en el registro consultado. No hay túneles `adb reverse`; las llamadas del terminal utilizan el backend HTTPS.

## Pendientes operativos

Inicio de sesión con el PIN de vigoCity y confirmación de Store 2. La lectura inicial mostró la tienda inactiva con credenciales POS habilitadas; no se cambió su estado comercial. No se han creado pedidos ni impreso tickets. Batería observada al 1 %, cargando por USB: cargar antes de validar impresión y autonomía.

Quedan las comprobaciones con USB desconectado, apertura tras reiniciar y ciclo pedido/impresión/listo. No se ha implementado actualización remota, reasignación administrada ni kiosco. La app debe permanecer abierta durante la operación.

La nota de registro inicial se preparó en el catálogo de novedades del backend, traducida ES/EN/IT/FR/PT y fuera del feed hasta distribuir esta APK a sus destinatarios. No se desplegó el backend.
