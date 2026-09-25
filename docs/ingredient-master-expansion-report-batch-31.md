# Lote 31 — cobertura cotidiana y búsquedas

25 de septiembre de 2026. **11 altas netas; 3.694 fichas locales.** Se trabaja el bloque conjunto acordado tras la revisión del día 24. La referencia aproximada de 5.000 queda a 1.306 fichas y no dirige la prioridad.

## Altas confirmadas

Carrillera de cerdo, carrillera de vacuno, secreto de cerdo, presa de cerdo, pluma de cerdo, salchichón, placas para canelones, margarina, vino blanco, vino tinto y café soluble. Se añaden nueve alias alternativos, sin contarlos como ingredientes.

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-31.md) enlaza cada fuente. El [JSON del lote](ingredient-master-expansion-batch-31.json) conserva los criterios de identidad y 17 grupos de decisiones.

- Solobuey documenta los cuatro cortes de cerdo; Discarlux, la carrillera de vacuno fresca. No se generan variantes por raza, procedencia o fileteado.
- COVAP documenta salchichón curado de cerdo con especias. Se conserva su denominación culinaria; no se convierte salami en alias ni se presume equivalencia con todos los embutidos regionales. La fuente menciona posibles trazas de leche y soja; no se aprueba una formulación universal.
- Gallo documenta placas para canelones sin relleno y su catálogo las sitúa en pasta de trigo. No se importa el plato terminado ni una receta del fabricante.
- Margarina se sustenta en el registro histórico USDA SR Legacy **172346**, comprobado en el CSV local: emulsión convencional del 80% de grasa. El [catálogo profesional de Puratos](https://www.puratos.es/es/bakery/categories/margarinas) corrobora el uso y la variabilidad de formulaciones. Se agrupan sal y envase; no se incluyen automáticamente grasas anhidras, mezclas con mantequilla o preparados reducidos en grasa. La ficha Zas consultada describe materia grasa al 75% y no se emplea para justificar la composición convencional.
- García Carrión documenta vino blanco y tinto. «Para cocinar» es un uso, registrado como alias. No se deduce ausencia de sulfitos ni eliminación de alcohol en una preparación.
- Nestlé documenta café soluble seco. Se diferencia del [extracto líquido de café de Nielsen-Massey](https://nielsenmassey.com/products/pure-coffee-extract/), fuente de la ficha anterior, que contiene agua y alcohol. La necesidad de café se acota aquí a soluble; molido e infusión no se dan por equivalentes.

## Resultado del bloque de cobertura

La lista editorial sigue teniendo **248 necesidades: 240 localizadas y 8 con alcance pendiente**. Las once necesidades originales sin ficha quedan vinculadas a las nuevas altas. Las dos de panes se resuelven mediante la ficha conjunta existente, sustentada en **USDA 172796, Rolls, hamburger or hotdog, plain**, contrastada en el CSV local. No se separan panes solo por forma ni se equipara esa ficha con cualquier brioche o pan integral. El acceso web a esa ficha USDA falló; el resultado procede del conjunto local conservado.

Evidencia completa: [lista actualizada](ingredient-master-coverage-checklist-2026-09-25.md) y [decisiones, claves y comprobaciones de búsqueda](ingredient-master-coverage-2026-09-25.json). Se conservan intactos los documentos y resultados del día 24.

Las ocho dudas pendientes se han investigado y quedan acotadas:

| Necesidad | Evidencia y dato que falta |
| --- | --- |
| Entrecot de vacuno | [Goia](https://carnicasgoia.com/producto/entrecot/) ofrece lomo alto y bajo. Precisar el corte de Lomo de ternera; no convertir entrecot en alias exclusivo de Ojo de lomo. |
| Boquerón | La [Comisión Europea](https://fish-commercial-names.ec.europa.eu/fish-names/species/engraulis-encrasicolus_es) documenta la especie. Anchoas no precisa especie ni preparación; hace falta el origen de esa ficha. |
| Atún en conserva | [Calvo](https://calvo.es/producto/atun-claro-en-aceite-de-oliva/) documenta una conserva con aceite y sal. Atún antiguo no precisa estado ni cobertura. |
| Nata para cocinar | [Asturiana](https://www.centrallecheraasturiana.es/productos/nata/nata-para-cocinar/) distingue nata líquida de menor grasa. Falta composición de Crema de leche. |
| Nata para montar | [Asturiana](https://www.centrallecheraasturiana.es/productos/nata/nata-reposteria/) documenta nata para repostería. Precisar Crema de leche y Nata doble; Nata montada es otra preparación. |
| Aceitunas verdes | [Serpis](https://www.serpis.com/producto/verdes/) documenta Manzanilla verde de mesa. Precisar preparación de las fichas de variedad y el genérico con hueso. |
| Tomate triturado | [Hida](https://hida.es/diferencias-entre-tomate-frito-triturado-y-sofrito/) diferencia triturado, frito y sofrito. Falta conocer qué representaba Tomate en Salsas. |
| Tomate frito | Misma revisión de la ficha antigua: no atribuirle fritura ni equipararla a sofrito o coulis sin elaboración documentada. |

La posible equivalencia **Fibra de achicoria / Inulina de achicoria** sigue abierta: Sosa documenta [inulina](https://www.sosa.cat/producto/inulina-caliente/) y [oligofructosa](https://www.sosa.cat/producto/oligofruct/) de esa raíz. El nombre histórico no identifica la composición. No se fusionan las claves. También siguen pendientes las cuatro clasificaciones provisionales y las equivalencias de los lotes anteriores.

## Correcciones de búsqueda

Se ejecutó la función actual del buscador sobre las once correspondencias sin alias exacto. Nueve ya funcionaban. Se corrigen las dos restantes: **gambas** encuentra candidatas como Gamba blanca y Gamba roja del Mediterráneo; **plátano** incluye Bananas.

Son términos para encontrar candidatas, no alias canónicos: la búsqueda puede mostrar varias identidades y requiere seleccionar la adecuada. Se conservan los filtros por las otras palabras, de modo que «plátano macho» no devuelve Bananas. No se modifican nombres, claves ni auditorías para resolver una búsqueda. El cambio se limita al catálogo y selector internos de Global Manager; no modifica el buscador del negocio.

## Comprobaciones y alcance

Las **3.683 fichas y asignaciones anteriores permanecen idénticas**. Se mantienen 14 categorías históricas, 14 familias, 25 fichas apartadas, 11 redirecciones y cuatro asignaciones provisionales. Maestra, claves protegidas, taxonomías y proyección del backend sincronizadas. Los **31 lotes son idempotentes**, con auditorías históricas intactas. No hay nombres duplicados ni alias exactos compartidos; esto no certifica la resolución de todas las equivalencias semánticas.

**94 pruebas específicas aprobadas** (9 importador, 57 backend, 28 interfaz). Compilación aprobada (main.6220603a.js). Resultados y registros: [controles del lote](ingredient-master-expansion-checks-batch-31.json). La verificación visual de los lotes 16–31 continúa pendiente; no se ha abierto el navegador integrado durante la investigación de cierres. No se acredita prueba en pantalla, integración con base de datos ni comprobación física del Sunmi.

Todas las altas quedan **NEEDS_REVIEW**, imágenes **MISSING** y nombre español. Alérgenos vacíos significa no aprobados, nunca ausencia. Traducciones, imágenes, composición y aprobación editorial siguen pendientes. Solo cambios locales; sin publicación, escrituras en bases de datos ni altas en inventarios. No se publica un aviso para los negocios sobre un catálogo interno aún no disponible para ellos.

## Siguiente paso

Recuperar el origen o ficha técnica de los ocho alcances históricos y de Fibra de achicoria. Esos datos permitirán decidir renombres, equivalencias o altas adicionales sin adivinar formulaciones. La lista básica aún no se considera cerrada.

Reproducción desde la raíz del workspace: `node output/ingredient-expansion/batch31-2026-09-25/check-batch31.cjs` y `node output/ingredient-expansion/batch31-2026-09-25/coverage.cjs`.
