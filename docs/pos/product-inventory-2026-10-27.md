# Inventario de ingredientes y productos — POS 0.3.25

El inventario y su buscador incluyen ingredientes y productos vendibles activos del negocio. Cada fila identifica el tipo y conserva un interruptor independiente por tienda. Productos incluye bebidas, entrantes, postres y platos con receta. La búsqueda ignora tildes; el contador incluye ingredientes y productos apagados.

Las escrituras se confirman antes de cambiar la pantalla. Durante una escritura se bloquean los interruptores y Sync; los errores conservan el último estado confirmado. La búsqueda de ingredientes por platos afectados se conserva. Reactivar un producto no reactiva sus ingredientes: el POS muestra cuáles impiden su disponibilidad. El checkout mantiene la comprobación de disponibilidad del producto y de su receta, también para productos sin ingredientes.

El backend expone GET `/api/stock/:storeId` y PATCH `/api/stock/:storeId/:pizzaId/active` a la sesión POS web y Android mediante la lista de rutas autorizadas. Solo permite la tienda de la sesión; el producto debe pertenecer al negocio, ser vendible y estar activo en el catálogo. El POS no recibe permisos para modificar cantidades. No hay migraciones.

Validación local: 36 pruebas de servidor (inventario, acceso POS/web y checkout), 10 de avisos, 6 del inventario React y 13 de acceso/pausa del POS. Compilación web y empaquetado nativo correctos. APK 0.3.25/código 28, paquete `com.volta.poslab`, firma v1/v2/v3 verificada y certificado igual a 0.3.24. SHA-256 `b6db6b2e3d9b799f90a362f41a3ece4597292dc16c5fd6e7e418cd0b3333537f`.

Luigi autorizó expresamente la distribución a todos los POS el 27 de octubre. Orden de publicación: backend, web, APK y asignación a terminales; activar después la nota `posProductInventoryAnnouncementDraft`. La instalación física se confirma por los reportes de cada equipo, no por la compilación o asignación. La prueba de manejo en un terminal físico queda pendiente.
