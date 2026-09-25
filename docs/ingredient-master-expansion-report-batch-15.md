# Lote 15 — verduras, encurtidos y conservas vegetales

24 de septiembre de 2026. **23 altas netas: 3.498 fichas locales.** Faltan 1.502 para la referencia aproximada de 5.000.

| Grupo | Altas |
| --- | ---: |
| Hortalizas de hoja, raíz, inflorescencia y fruto | 8 |
| Variedades de aceituna de mesa | 5 |
| Encurtidos y conserva tradicional | 4 |
| Fermentados vegetales condimentados | 4 |
| Pimientos secos identificados | 2 |
| **Total** | **23** |

Se incorporan mizuna, choi sum, tatsoi, komatsuna, romanesco, daikon, tomatillo y pimiento de Padrón; aceitunas Manzanilla sevillana, Gordal sevillana, Morona, Hojiblanca y Verdial de Huévar; alcaparrones, ajo encurtido, berenjena de Almagro y guindilla de Ibarra en vinagre; kimchis de col napa, rábano, hojas de mostaza y cebolleta; ñora y pimiento choricero secos. Los 23 alias alternativos no suman ingredientes.

## Fuentes y decisiones de identidad

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-15.md) enlaza las fuentes oficiales o de productor. El [JSON del lote](ingredient-master-expansion-batch-15.json) conserva las decisiones, las notas de las fuentes y once grupos de exclusiones.

- Johnny’s documenta cuatro tipos de verdura de hoja, romanesco, daikon y tomatillo. Se agrupan los cultivares comerciales. Se conservan Pak choi, Brócoli chino, Rábano, Coliflor y otras fichas genéricas; tomatillo no es tomate inmaduro ni uchuva, y no duplica la salsa de tomatillo.
- El Concello de Padrón identifica la variedad. No se crea otra ficha por la certificación de Herbón ni se atribuye ese origen a una compra.
- Manzanilla Olive identifica cinco variedades de aceituna de mesa. No se generan combinaciones por aliño, hueso, relleno, color, calibre o envase; el alias Verdial sin apellido se evita por ambigüedad.
- Rioverde distingue el alcaparrón, fruto, de la alcaparra, botón floral, y documenta el ajo en vinagre. Se mantiene el enlace de alcaparrones aunque su slug contiene «alcaparras».
- El pliego del MAPA describe la berenjena de Almagro como conserva de una variedad identificada, con cocción, fermentación y aliño. Gobierno Vasco documenta la guindilla de Ibarra en vinagre. Estas referencias respaldan identidades, sin certificar productos operativos.
- Jongga documenta cuatro fermentados con distintas bases vegetales. No se separan cortes, marcas o envases ni se usa «Kimchi» como alias exclusivo de una de las bases. La cebolleta fermentada no modifica la ficha ambigua «Cebolla de verdeo».
- Dani diferencia ñora y choricero; La Barraca describe la conservación del choricero mediante secado. Se registran los pimientos secos, sin sumar sus pulpas comerciales. Conservan la categoría Verduras, como los pimientos enteros secos históricos.

Las 23 altas se clasifican en **Verduras, setas y algas**, manteniendo las 14 categorías históricas y las 14 familias de restaurante. No cambian las asignaciones anteriores.

## Revisión pendiente y exclusiones

No se duplican chucrut, pepinillos, cebolla o remolacha encurtidas ni conservas al natural que solo cambien el envase. Mezclas como menestra y giardiniera requieren delimitar si representan un preparado comprado como ingrediente o una receta.

Se registra una nueva duda histórica: **Nabo encurtido frente a takuan o daikon encurtido**. Falta determinar si el nombre histórico es una traducción imprecisa de rábano; se difiere el alta de takuan y se conserva la ficha intacta.

Todas las altas siguen **NEEDS_REVIEW**, con imagen **MISSING** y solo nombre español. Las listas vacías de alérgenos significan no aprobadas, nunca ausencia. Las referencias de kimchi incluyen pescado y, según producto, crustáceos, mostaza o sésamo; la de ajo declara sulfitos. Las notas conservan esa información para revisión, sin convertir la formulación de una marca en receta universal ni aprobar etiquetas veganas. No se importan alegaciones sanitarias ni códigos de aditivos inconsistentes de las páginas.

## Comprobaciones

Las **3.475 fichas previas y sus asignaciones se conservan idénticas**, junto con las 25 apartadas y las 11 redirecciones. Fuente, proyección del backend, claves protegidas y taxonomía están sincronizadas; continúan las cuatro clasificaciones provisionales.

Los quince lotes pueden reaplicarse sin duplicar ingredientes ni cambiar las auditorías históricas, cuyos hashes se capturaron antes de esta aplicación. La validación no detecta nombres duplicados ni alias exactos compartidos. Las posibles equivalencias semánticas requieren la revisión documentada.

[Controles estructurados](ingredient-master-expansion-checks-batch-15.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-15.json).

84 pruebas aprobadas: 9 del importador, 48 del backend y 27 de tres suites específicas del storefront (alta desde maestra, edición semántica e inventario por familias en POS). Compilación aprobada (main.8d382d05.js). Navegador verificado con 3.498 fichas y seis búsquedas: «romanesco», «rabanO japones», «alcaparr», «kimchi», «aceitunas gordal» y «nora». Las nuevas fichas aparecen en Verduras, setas y algas; alcaparras, alcaparrones y su salsa se mantienen diferenciados. API local vacía con escrituras bloqueadas: este ensayo no verifica una integración con base de datos.

## Continuación

Siguiente investigación: hierbas, especias y chiles de uso culinario que aún falten. Cruzar materia prima, variedad y elaboración con nombres y alias de toda la maestra; conservar las dudas históricas y no sumar marcas, molienda o envases como identidades automáticas.

Solo archivos locales del catálogo interno de candidatos de Global Manager. Sin publicación, escrituras en bases de datos ni altas en inventarios. Las traducciones, imágenes, revisión editorial, clasificación de Pavo, cremas y Tempura y comprobaciones físicas del Sunmi siguen pendientes. No se activa una nota de administradores antes de publicar la disponibilidad.
