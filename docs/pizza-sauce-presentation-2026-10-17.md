# Salsas de base y acabado — 17 de octubre de 2026

El maestro de ingredientes está en `src/data/ingredientMasterSource.json`. Su proyección de identidad para el servidor está en `../volta-backend/data/ingredientMasterCatalogue.json`, relativa a la raíz del storefront. La base operativa conserva algunas claves antiguas: Salsa Tomate usa `tomato_sauce`, Salsa BBQ usa `bbq_sauce` y Cheddar fundido usa `melted_cheddar`. No se deben fusionar esas identidades ni reclasificar todos los tomates para corregir el dibujo.

La presentación del juego se configura en `src/data/ingredientPizzaPresentation.json`, un complemento central del maestro. Cada entrada relaciona claves canónicas o históricas y nombres exactos de respaldo con `sauceRole` (`BASE` o `TOPPING`) y color. Las claves revisadas prevalecen sobre el nombre. No se escribe en la base de datos ni se añaden campos al backoffice de los negocios. Esta metadata visual no modifica disponibilidad, recetas, alérgenos, cantidades comerciales, precios ni tickets.

Solo la salsa de tomate y el tomate triturado revisados son base. No se presupone que toda salsa roja, blanca, bechamel o salsa que contenga tomate sea base. Las demás salsas se representan como acabado por defecto. Para ampliar las bases, revisar y añadir la identidad al archivo central; no añadir reglas dispersas al dibujo. El cheddar sólido sigue en piezas; salsa cheddar y cheddar fundido aparecen en líneas naranjas.

Orden de capas: base de salsa, quesos, otros ingredientes y líneas de salsa de acabado. Las líneas se recortan por la misma zona FULL/LEFT/RIGHT que el resto; doble aumenta su número y grosor. El color propio de cada salsa se conserva. La representación es ilustrativa y no expresa gramajes.

Entrega del 17 de octubre: commit y despliegue autorizados. El aviso ES/EN/IT/FR/PT `pizzaSauceLayersAnnouncementDraft` se activa en el backend después de verificar este storefront en producción. El resultado de publicación se registra en `../../volta-backend/docs/backoffice-notifications.md`. La APK no necesita cambiar por esta corrección del dibujo web.

Verificación: diez pruebas de apariencia, capas SVG y flujo del constructor; diez pruebas de avisos. Se comprobó el orden aunque el queso se añada después de la barbacoa, recorte LEFT/RIGHT, cantidad doble, respaldo para catálogos antiguos y distinción entre tomate fresco, salsa de tomate, cheddar sólido y fundido. Compilación del laboratorio correcta. Prueba visual en `http://127.0.0.1:4175`: tomate entero, mozzarella y líneas de barbacoa solo a la derecha. Captura en `../output/pizza-sauces-2026-10-17/tomate-base-bbq-derecha.png`, relativa a la raíz del storefront. Catálogo sintético, sin pedidos ni cambios en datos operativos.

## Cobertura del queso

La mozzarella, la rallada y el queso genérico añaden una malla de hebras curvas entrecruzadas que ocupa la mayor parte del interior, dejando ver la salsa por los huecos y por el borde. Las hebras tienen un contorno tostado suave y brillo. Doble aumenta la densidad y el grosor de la malla; no añade una capa opaca. Todo queda dentro del recorte FULL/LEFT/RIGHT y debajo de los toppings y salsas de acabado. Queso azul, cabra y cheddar sólido conservan sus piezas distintivas.
