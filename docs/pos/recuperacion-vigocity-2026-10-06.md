# Revisión del terminal VigoCity — 6 de octubre de 2026

Durante «compila todo» se compiló y enlazó por error el proyecto histórico `../volta-pos-android` (0.3.4, código 7). El proyecto Android vigente y versionado es `native/sunmi-v3`. No distribuir los APK de la carpeta histórica. La versión registrada más reciente de SUNMI V3 002 era 0.3.20, código 23.

El usuario reportó el mensaje genérico de validación después de intentar instalar el APK HTTPS enlazado. No hay dispositivo conectado a ADB. El servidor responde y la unidad sigue AUTHORIZED, vinculada a vigoCity con sesión vigente. Su última petición autenticada observada fue a las 11:14:17 UTC. Esto no demuestra la causa concreta del fallo mostrado. Falta confirmar la versión realmente instalada y si hubo desinstalación: Android normalmente rechaza actualizar un código de versión superior con otro inferior.

Se prepara 0.3.21, código 24, desde las fuentes canónicas, con la interfaz actual y errores de inicio que distinguen registro, autorización, comprobación de identidad y conectividad. No se cambian claves, sesiones, asignaciones ni permisos de dispositivos. Una instalación que haya perdido su registro conserva el flujo de alta existente en las versiones actuales.

- APK: `native/sunmi-v3/build/volta-pos-connected-0.3.21.apk`.
- SHA256: `0d48e96411a364e5504d39e52c1e1720a84701dc2f8732f5bfc47e859d733227`.
- Certificado: `5fbbf18196c59f52a491032c67afd88ee577e5ff1f65f17a18b83d9795bb03de`, coincide con la versión 23 registrada.
- Compilación Java, interfaz y verificación de firma correctas. Dos pruebas de mensajes de arranque correctas.

Actualizar encima de la aplicación existente, sin desinstalar ni borrar datos. Pendiente instalación en el terminal y comprobación operativa por el usuario; no afirmar recuperado el terminal sin esa evidencia. No se ha publicado ni asignado esta versión en el canal de actualizaciones.
