# Lote 33 — búsquedas con opciones documentadas

25 de septiembre de 2026. **Cero altas; se mantienen 3.694 fichas locales.** Se completa el lote interrumpido durante su cierre. Las dos correspondencias del lote 32 se pueden encontrar ahora desde la búsqueda de la bolsa maestra y del catálogo ya añadido de Global Manager.

## Resultado

| Consulta | Opción y explicación visible |
| --- | --- |
| Entrecot, entrecot de vacuno, entrecot de lomo alto, entrecot lomo alto | Ojo de lomo de vacuno. «Opción de entrecot de lomo alto (ribeye); no representa el lomo bajo.» |
| Aceitunas verdes, aceituna verde | Aceituna Gordal sevillana. «Gordal: una variedad con presentación verde documentada. Confirmar el aliño del suministro.» |

Las sugerencias requieren la consulta completa normalizada y la clave de la ficha maestra. Se toleran mayúsculas, tildes, puntuación y espacios repetidos. No se descartan calificadores: «entrecot de lomo bajo», «aceitunas negras», «aceitunas verdes rellenas» y las consultas con «ahumado» no activan estas sugerencias. Los filtros de categoría siguen aplicándose y la selección conserva la identidad original.

Las correspondencias y sus límites proceden de las [decisiones del lote 32](ingredient-master-expansion-batch-32.json); no se realizó una investigación nueva de fuentes. El [lote estructurado](ingredient-master-expansion-batch-33.json) registra las consultas y notas utilizadas. No se modifican nombres canónicos, alias, composición, alérgenos ni asignaciones.

## Cobertura y pendientes

La [cobertura actual](ingredient-master-coverage-batch-33.json) mantiene **242 de 248 necesidades localizadas y 6 por aclarar**. Ahora las consultas amplias de entrecot de vacuno y aceitunas verdes encuentran sus opciones documentadas. Esto no amplía la cobertura a todas las variantes.

Siguen pendientes boquerón, atún en conserva, nata para cocinar, nata para montar, tomate triturado y tomate frito. Fibra de achicoria frente a inulina sigue abierta fuera del recuento. El historial recuperado no contiene composición ni proveedor: hace falta aclarar el sentido de los nombres antiguos antes de reinterpretar esas fichas. Se conservan también las equivalencias anteriores y las 25 fichas apartadas.

## Validación y entrega

El [control reproducible](ingredient-master-expansion-checks-batch-33.json) comprueba 170 archivos protegidos, las 3.694 fichas, 14 categorías, 11 redirecciones, taxonomías y proyección del backend. Los 33 lotes se reaplican de forma idempotente y todas las auditorías previas conservan su huella.

Se verificaron los registros guardados antes de la interrupción: **30 pruebas de interfaz y 11 del importador aprobadas**, compilación correcta `main.1b232b87.js`. El cierre vuelve a ejecutar la validación de maestra y los controles de conservación e idempotencia. La compilación avisó de datos de Browserslist antiguos, sin impedir la generación.

La nota `ingredientDiscoveryAnnouncementDraft` queda preparada en el catálogo del backend con ES/EN/IT/FR/PT, fuera del feed hasta la publicación coordinada. La revisión visual y editorial sigue pendiente; se mantiene la decisión de no abrir el navegador integrado durante el diagnóstico de cierres. No se acredita prueba con base de datos ni con Sunmi.

Todo queda en local: sin despliegue, publicación ni escrituras en bases de datos o inventarios.

Reproducción desde la raíz: `node output/ingredient-expansion/batch33-2026-09-25/check-batch33.cjs`. Desde el storefront: `node scripts/expand-ingredient-master.cjs --batch=33 --apply`. No volver a ejecutar `prepare-batch33.cjs`: el lote ya aplicado es inmutable.
