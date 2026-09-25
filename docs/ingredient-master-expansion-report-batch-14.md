# Lote 14 — bebidas, cremas y fermentados vegetales

24 de septiembre de 2026. **19 altas netas: 3.475 fichas locales.** Faltan 1.525 para la referencia aproximada de 5.000.

| Elaboración | Altas |
| --- | ---: |
| Bebidas vegetales | 10 |
| Cremas vegetales para cocinar | 5 |
| Fermentados y alternativas al yogur | 4 |
| **Total** | **19** |

Se incorporan bebidas de soja, avena, arroz, espelta, mijo, almendra, avellana, anacardo, cáñamo y guisante; cremas de cocina de soja, avena, arroz, almendra y anacardo; fermentados naturales de soja y coco, alternativa de avena al yogur natural y kéfir de soja. Los 23 alias alternativos no suman ingredientes.

## Fuentes y decisiones

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-14.md) enlaza las referencias oficiales de cada alta. El [JSON del lote](ingredient-master-expansion-batch-14.json) conserva nombres, alias, fuentes, razones de identidad y diez grupos de exclusiones.

- Lima documenta bebidas por materia prima y usos culinarios. Ecomil acredita arroz, avellana, anacardo y cáñamo; Ripple identifica la bebida formulada con proteína de guisante. Se agrupan marcas, envases, fortificación y variantes barista; no se generan combinaciones de bases.
- Isola Bio, Lima y Ecomil documentan cremas de cocina. Se distinguen de las bebidas y de las pastas puras. La nueva crema de anacardo es una emulsión con aceite; se conserva intacta la Crema pura de anacardo histórica.
- Sojade documenta el fermentado de soja y la bebida con cultivos de kéfir. Esta última contiene zumo de manzana en la referencia; no se presenta como soja pura. No se suman variantes de yogur de soja por textura o estilo griego.
- Alpro documenta la base de coco con fermentos. Oatly acredita la alternativa de avena y sus usos en aliños y repostería, pero la página global no ofrece una formulación universal: requiere ficha del mercado y proveedor antes de aprobar composición.
- La referencia de bebida de cáñamo presenta una denominación inconsistente del aceite en el texto explicativo. La de crema de avena contiene una mención aislada a almendra en los usos. Se toma la identidad coherente con título e ingredientes y no se trasladan esas inconsistencias.
- Las leches de coco y patata, el agua y la crema de coco ya existen. La separación de bebida de coco diluida necesita delimitar la ficha histórica. Quedan pendientes las mezclas, horchatas, fermentados de frutos secos y untables que puedan solaparse con quesos vegetales existentes.

Los alias con «leche», «nata vegetal» o «yogur» sirven para búsqueda; los nombres principales identifican bebidas, cremas y alternativas vegetales. Ninguna alta se clasifica como lácteo. Las bebidas y fermentados se asignan por materia prima: 4 a Legumbres y proteínas vegetales, 5 a Pastas, arroces y cereales, 4 a Frutos secos y semillas y 1 a Frutas. Las 5 cremas elaboradas se asignan a Salsas, condimentos y bases de cocina. Se mantienen las 14 categorías históricas y las 14 familias de restaurante, sin reclasificar fichas anteriores.

Todas las altas siguen **NEEDS_REVIEW**, con imágenes **MISSING** y solo nombre español. Los alérgenos vacíos significan no documentados; no acreditan ausencia. Las fuentes respaldan identidad culinaria y trazabilidad, no una formulación universal ni disponibilidad comercial actual. No se importan propiedades sanitarias, datos nutricionales, dosis o certificaciones.

## Integridad y comprobaciones

Las **3.456 fichas anteriores y sus asignaciones se conservan idénticas**, al igual que las 25 identidades apartadas, 11 redirecciones y cuatro clasificaciones provisionales. Frontend, proyección del backend, claves protegidas y taxonomía están sincronizados. Los catorce lotes pueden reaplicarse sin duplicar altas ni modificar auditorías históricas. No hay nombres duplicados ni alias exactos compartidos en la fuente seleccionable; las equivalencias semánticas pendientes se conservan explícitas.

[Controles estructurados](ingredient-master-expansion-checks-batch-14.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-14.json).

**252 pruebas aprobadas:** 9 del importador, 48 del backend y 195 de las 27 suites del storefront. Compilación aprobada (main.ddafe555.js). Ensayo en navegador cerrado: 3.475 fichas; búsquedas «leche de canamo», «anacardo», «yogur de avena», «kefir de soja» y «yogur de coco» correctas en sus cinco familias. La búsqueda de anacardo conserva y diferencia el fruto, la pasta pura histórica, la bebida y la crema de cocina. API local vacía con escrituras bloqueadas; este ensayo no verifica integración con una base de datos.

El cierre pendiente del lote 13 quedó registrado antes de aplicar este lote: compilación y búsquedas «piel de tofu», «kombu atlantico» y «toban djan» verificadas con 3.456 fichas.

## Continuación

Siguiente investigación: huecos documentados de verduras, encurtidos y conservas vegetales para cocina. Cruzar especies, variedades y elaboraciones con toda la maestra y sus alias; no duplicar un ingrediente solo por envase, corte o conservación sin identidad culinaria diferenciada. Mantener aparte las equivalencias históricas hasta resolverlas con evidencia.

Solo archivos locales del catálogo interno de candidatos de Global Manager. Sin altas en inventarios, escrituras en bases de datos ni publicación. La nota de administradores ya preparada para las familias de restaurante permanece fuera del feed; este lote no activa disponibilidad en negocios. Siguen pendientes traducciones, imágenes, revisión editorial, clasificaciones de Pavo, cremas y Tempura, y comprobaciones físicas del Sunmi.
