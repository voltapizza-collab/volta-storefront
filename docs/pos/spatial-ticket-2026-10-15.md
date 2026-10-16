# Comanda espacial — APK publicada

Trabajo iniciado el 15 y validado el 16 de octubre de 2026. APK 0.3.24 publicada y asignada a los tres SUNMI registrados el 16 de octubre por autorización explícita del usuario para toda la red. Instalación y prueba física pendientes.

## Diagnóstico

El backend conserva las líneas del pedido. El contenido de impresión se construye en React: `PosApp.jsx` para pantalla/HTML Windows y `printers/mockPrinter.js` para líneas SUNMI. Había dos implementaciones del detalle que recorrían los ingredientes en el orden almacenado y daban prioridad a la etiqueta completa. Android recibe `lines` mediante `nativeCall`; `PosActivity.java` las imprime con PrinterX y `Receipt58.wrap` ajusta a 30 columnas conservadoras en papel de 58 mm (384 puntos, tamaño 24).

La APK lleva React empaquetado. Cambiar solo el storefront web no actualiza esos assets. Se requiere APK nueva desde `native/sunmi-v3`, que es el proyecto canónico. La carpeta hermana `volta-pos-android` es histórica y no se modifica.

## Implementación

- `src/pos/orderLineDetails.js`: formateador único y puro para los tres destinos. Agrupa personalizadas en FULL, DERECHA, IZQUIERDA; omite grupos vacíos y no repite la zona por ingrediente. Conserva Simple/Doble, retiradas, extras y notas de línea (`notes`, `note`, `comment`). Las observaciones del pedido permanecen en el pie.
- No ordena ni muta los datos originales, no modifica subtotal, precio ni carrito. No consulta recetas actuales para reinterpretar pedidos históricos.
- Acepta listas y arrays JSON, con respaldo de `customDetails.ingredients`. Solo abrevia etiquetas reconocidas del serializador. Las etiquetas desconocidas se conservan y las ubicaciones no reconocidas se presentan en SIN UBICACIÓN para que cocina pueda revisarlas, sin inventar una mitad.
- `HALF_HALF` conserva la correspondencia verificada: A / `leftPizzaId` → LADO 1; B / `rightPizzaId` → LADO 2. Nombre y extras se agrupan bajo cada lado. No se rotula automáticamente como derecha/izquierda. El pedido no guarda una copia de los ingredientes base de cada receta: se conserva su nombre, sin reconstruirlo con datos actuales.
- `PosApp.jsx` y `mockPrinter.js` consumen el formateador. Los encabezados y retiradas se resaltan también en pantalla/Windows. `orderLineChanges.js` mantiene el formato de carta y conserva las cantidades explícitas de extras.
- `Receipt58.isDetailHeading` permite negrita en las zonas y lados sin cambiar protocolo, tamaño de letra, SDK ni ajuste de ancho.
- Impresión de prueba del POS incorpora una personalizada intercalada con doble cantidad y una pizza de dos recetas. Se mantienen los ejemplos de retirada y receta original. No crea una venta.

## Casos y verificación

`../../../output/pizza-experiment-2026-10-15/ticket-cases.json` y `.txt` contienen:

| Caso | Verificación |
| --- | --- |
| FULL solamente | Un único encabezado, todas las cantidades simples |
| Tres zonas intercaladas | FULL → DERECHA → IZQUIERDA, cada ingrediente una vez |
| Dobles | Doble en pizza entera y mitad, sin alterar precios |
| Retiradas | SIN CEBOLLA en su línea de carta, y retirada por zona en personalizadas |
| Mitad y mitad | LADO 1/2 con el extra de su propia receta, aunque llegue intercalado |
| Observaciones | Nota de línea y observaciones generales conservadas |
| Modificaciones simultáneas | Zonas, doble, retirada, extra y nota sin pérdida |

Pruebas automatizadas: 22 casos de POS (espacial, retiradas, pago y códigos), escape HTML, JSON legado, etiquetas opacas, ausencia de mutación y preservación de nombres largos. `Receipt58Test` comprueba encabezados y pasa las siete comandas completas por el ajuste real de Android: ninguna fila supera 30 columnas ni pierde caracteres de contenido. `node scripts/check-pizza-contract.cjs` regenera las muestras.

La salida física todavía **no está validada**. No hubo conexión a una impresora ni instalación. Para el ensayo autorizado en SUNMI: comprobar versión y tienda, ejecutar Impresión de prueba, cotejar títulos en negrita, ancho, acentos, cantidades, lados y notas; revisar ausencia de cortes y confirmar con el pizzero la lectura. Comprobar también reimpresión y que una actualización conserva sesión/identidad. Registrar modelo, Android/WebView, fecha, versión anterior, foto y resultado antes de aprobar una asignación operativa.

## APK y canal existente

- Preparada: **0.3.24**, `versionCode 27`, `com.volta.poslab`.
- API mínima 23, objetivo 33; mismos permisos y firma que la APK local 0.3.23. Compatibilidad binaria comprobada; compatibilidad física pendiente.
- Firma SHA-256: `5fbbf18196c59f52a491032c67afd88ee577e5ff1f65f17a18b83d9795bb03de`. `apksigner` verifica esquemas v1/v2/v3.
- Se compila con `node scripts/build-native-pos.cjs` y `./build.ps1 -Connection https -VersionName 0.3.24 -VersionCode 27` desde la carpeta Android. El origen operativo y el de actualizaciones siguen siendo `https://api.voltapizza.com`.
- APK y `release-metadata.json` preparados en `../../../output/pizza-experiment-2026-10-15/`. Consultar ese JSON para el SHA y tamaño exactos del binario entregado.

Publicada mediante `posReleases.js publish` a las 11:09:53 UTC del 16 de octubre y asignada mediante `assign` a SUNMI V3 001, 002 y 003. Se verificó el certificado contra la versión 0.3.23 del registro, la firma y manifiesto del APK, su SHA y la copia descargada del almacenamiento permanente. El código 27 estaba libre y los tres terminales reportaban código 26. Comprobación posterior a las 11:10:21 UTC: versión habilitada, tres asignaciones al SHA correcto; ninguno había reportado aún la instalación nueva. Evidencia en `../../../output/pos-spatial-release-2026-10-16/publication-verification.json`. La autorización de distribución a toda la red no equivale a validación física de impresión.

El procedimiento de distribución sigue [el canal permanente](../../../volta-backend/docs/pos-permanent-updates.md): publicar APK + metadatos con `posReleases.js`, asignar su SHA a IDs de dispositivos concretos, dejar que el operador acepte en Actualizaciones y verificar reportes. La descarga autenticada, SHA, consentimiento, espera de operaciones y actualización sin desinstalar se mantienen. No requiere USB ni cambios de infraestructura. Una retirada impide nuevas descargas, pero no revierte una APK ya instalada: una corrección requiere código superior.

## Aviso para administradores

`pizzaSpatialAnnouncementDraft` está exportado desde `volta-backend/data/backofficeAnnouncements.js`, con texto ES/EN/IT/FR/PT en `pizzaSpatialAnnouncement.js`, **fuera del feed**. Activarlo con fechas reales y audiencia adecuada cuando web/POS estén disponibles y validados. El prototipo visual no se anuncia como función disponible.
