# Lote 12 — frutos secos, semillas y auxiliares culinarios

24 de septiembre de 2026. **38 altas netas: 3.432 fichas locales.** Faltan 1.568 para la referencia aproximada de 5.000.

| Familia de restaurante | Altas |
| --- | ---: |
| Frutos secos y semillas | 23 |
| Panes, masas y harinas | 4 |
| Repostería y auxiliares culinarios | 11 |
| **Total** | **38** |

Incluye 17 variedades de almendra y nuez, seis pastas de frutos secos o semillas, cuatro harinas, dos pralinés y nueve auxiliares. Las categorías históricas Otros y Cremas dulces pasan a 609 y 39 fichas. Se añaden 12 alias, sin contarlos como ingredientes.

## Fuentes y selección

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-12.md) enlaza las referencias de cada alta. El [JSON del lote](ingredient-master-expansion-batch-12.json) registra las decisiones y 15 grupos de exclusiones.

- [Borges BAIN — almendras](https://borges-bain.com/almendra/) y [nueces](https://borges-bain.com/nuez/): variedades identificadas por nombre. Se conservan las fichas genéricas; no se suman calibres, cortes, envases ni certificaciones.
- [Borges BAIN — harinas](https://borges-bain.com/en/flours-and-granules/): almendra, pistacho, avellana y nuez. Se agrupan granulometrías, variedades y gamas comerciales por materia prima.
- [Borges BAIN — cremosos](https://borges-bain.com/cremosos-de-frutos-secos/): pastas puras y pralinés diferenciados. Las referencias con títulos y descripciones inconsistentes no justifican nuevas subdivisiones.
- [Clearspring — tahini negro](https://www.clearspring.co.uk/products/organic-tahini-black-sesame-6-pack?variant=42000199680191): pasta 100% sésamo negro. No se traslada la certificación ni se cuenta el envase.
- [Sosa — pasta de calabaza](https://www.sosa.cat/producto/pasta-de-pipas-de-calabaza/) y [pasta de pecana](https://www.sosa.cat/producto/pasta-de-nuez-pecana/): preparados con otros ingredientes. No se denominan puros. La introducción de la ficha de pecana menciona almendras, mientras su listado declara pacana; se documenta la inconsistencia y se mantiene pendiente la revisión del proveedor.
- Fichas individuales de Sosa para metilcelulosa, CMC, konjac, citrato trisódico, cloruro cálcico, gluconolactato y dos preparados de pectina. Se distingue el preparado HM rápido del LMA con calcio; no se importan dosis ni se crean registros por marca.
- [Unipatis — lecitina de girasol](https://www.unipatis.fr/es/produit/lecitina-de-girasol/): identidad diferenciada de la lecitina de soja histórica.

## Equivalencias y revisión

Se difieren las pastas puras de avellana, pistacho y cacahuete hasta aclarar qué contienen las cremas históricas. La crema pura de anacardo, la de girasol y el tahini genérico ya estaban representados.

Se registra un posible solapamiento histórico entre **Semillas de lino** y **Semillas de lino integral**, además del hallazgo previo **Huevo en polvo / Huevo entero deshidratado**. No se fusionan claves ni se modifican referencias operativas. Inulina frente a Fibra de achicoria también requiere delimitar cobertura antes de una nueva alta.

Las afirmaciones comerciales de ausencia de alérgenos no se trasladan al catálogo. Todas las nuevas fichas siguen NEEDS_REVIEW, con imágenes MISSING y solo nombre español. Un campo de alérgenos vacío significa no documentado. Cada formulación requiere revisión antes de su uso operativo.

## Integridad y comprobaciones

Las **3.394 fichas anteriores y sus asignaciones se conservan idénticas**, junto con las 25 identidades apartadas, 11 redirecciones y cuatro clasificaciones provisionales. Frontend, proyección del backend, claves protegidas y taxonomía están sincronizados. Los doce lotes se pueden reaplicar sin cambios ni alteración de auditorías históricas.

[Controles estructurados](ingredient-master-expansion-checks-batch-12.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-12.json).

**78 pruebas aprobadas:** 9 del importador, 42 del backend y 27 de interfaz. Compilación aprobada (`main.67ff2a56.js`). En el navegador, el modal muestra 3.432 fichas; «marcona», «harina avellana» y el alias «cmc» encuentran las nuevas fichas en sus tres familias. Ensayo con API vacía local y escrituras bloqueadas; no prueba integración con una base de datos.

El cierre pendiente del lote 11 también quedó completado: compilación y búsqueda de los tres kéfires verificadas antes de incorporar el lote 12.

## Continuación

Siguiente investigación: proteínas y alternativas vegetales, algas y condimentos de uso habitual en restaurantes, contrastados con toda la maestra. Revisar también las equivalencias históricas registradas.

Solo archivos locales del catálogo interno de candidatos de Global Manager. Sin altas en inventarios, escrituras en bases de datos ni publicación. La nota para administradores corresponde a la futura disponibilidad coordinada; este lote no activa una mejora en los negocios. Siguen pendientes las clasificaciones de Pavo, cremas y Tempura y las comprobaciones físicas del Sunmi.
