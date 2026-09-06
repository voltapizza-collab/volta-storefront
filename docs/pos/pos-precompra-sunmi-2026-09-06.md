# Revisión previa a compra SUNMI V3 — 6 septiembre 2026

## Ticket

El formato anterior del navegador ya declaraba papel de 58 mm, margen 4 mm y contenido 50 mm. El Sunmi utiliza impresión nativa: no imprime esa página HTML. La referencia de SUNMI para papel de 58 mm es área útil 48 mm / 384 puntos. Fuente oficial: https://file.cdn.sunmi.com/SUNMIDOCS/SunmiPrinter-Developer-Docs-1-1.pdf

Se añadió Receipt58, con saltos de línea por palabras, corte seguro de palabras largas y máximo conservador de 30 columnas a tamaño 24. Conserva tildes, ñ y euro; cuenta caracteres anchos como dos columnas. Las verificaciones locales de ancho, palabras largas y caracteres pasaron.

El menú incluye Probar ticket de 58 mm. Usa el mismo formateador y el mismo camino de impresión que el pedido, con cabecera PRUEBA y pie SIN VALIDEZ COMERCIAL. No crea ventas, clientes ni pagos. Se imprimió una vez con texto largo y datos ficticios: PrinterX confirmó PRINT_RESULT code=0. Queda pendiente la inspección física del usuario.

## Aviso de pedido

La implementación actual consulta la cola cada 10 segundos. Un pedido nuevo abre el aviso existente; el sonido se repite cada 5200 ms hasta aceptar. La aceptación detiene ese bucle; imprimir se realiza con el botón de impresión, no automáticamente. Existe una melodía distinta para mensajes del cliente.

Se ejecutó Probar sonido pedido en el aparato. Audio multimedia activo, altavoz seleccionado y volumen 12/15, sin silencio. La confirmación auditiva depende del usuario. La app debe permanecer abierta; no existe aún servicio de recepción en segundo plano ni garantía de alerta con la app cerrada.

## Conexión

Todavía usa http://127.0.0.1:8091 mediante adb reverse y servidor de la laptop. El endpoint https://api.voltapizza.com/api/pos/device devuelve HTTP 404. No se ha instalado ni declarado una versión independiente de USB.

Se redujeron dos consultas habituales de autenticación: el índice único de nonce rechaza duplicados sin lectura previa y la limpieza de nonces vencidos pasa a mantenimiento ocasional. Se conserva la firma, el bloqueo del terminal y la validación de sesión por petición. Las 139 pruebas del backend pasan y el piloto local se reinició con estos cambios.

La cuenta actual de Railway lista los servicios históricos de Ventas y proyectos Volta sin servicios. Ninguno coincide con el destino DNS de api.voltapizza.com (cofz0ial.up.railway.app). Se solicitó al usuario localizar la cuenta/proyecto del backend actual. No se modificaron despliegues remotos.

Para autonomía: desplegar las rutas protegidas en el backend correcto, verificar HTTPS y la base de datos, configurar la app con ese destino y probarla con USB físicamente desconectado. Después quedan la recepción en segundo plano/kiosco y la validación operativa completa.

Usuario confirma ticket perfecto y sonido audible pero demasiado bajo. Audio multimedia del Sunmi ya estaba en 15/15. Se aumentó la señal generada solo en la app nativa (ganancia x4 con tope 0,3 por tono y sostenimiento breve antes de desvanecer). Verificación OfflineAudioContext de la melodía estándar: pico anterior 0,0816 / nuevo 0,5844, sin recorte digital. APK instalado y prueba de sonido reproducida una vez; percepción de volumen y distorsión acústica pendientes de confirmación del usuario.
