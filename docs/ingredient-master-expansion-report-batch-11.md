# Lote 11 — lácteos, huevos y bases de cocina

24 de septiembre de 2026. **33 altas netas: total de 3.394 fichas.** Faltan 1.606 para la referencia aproximada de 5.000.

| Familia de restaurante | Altas |
| --- | ---: |
| Lácteos y huevos | 21 |
| Salsas, condimentos y bases de cocina | 12 |
| **Total** | **33** |

Las categorías históricas Otros y Salsas pasan respectivamente de 552 a 573 y de 178 a 190. Se añaden 21 alias de búsqueda, sin contarlos como ingredientes. Las 21 primeras altas se componen de 15 lácteos y seis ovoproductos o preparaciones de huevo.

## Selección y fuentes

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-11.md) enlaza todas las fichas; el [JSON del lote](ingredient-master-expansion-batch-11.json) conserva referencias, decisiones y 13 exclusiones o grupos de exclusiones.

- Leches semidesnatada y desnatada: referencias de [Pascual](https://lechepascual.es/productos/leches-clasicas/leche-desnatada/). La semidesnatada se pudo contrastar mediante el índice web del fabricante; la apertura posterior de su página falló. Leche evaporada: [Nestlé Cocina](https://www.nestlecocina.es/curiosidades/que-es-la-leche-evaporada), diferenciada de la condensada azucarada.
- Skyr natural, cuajada láctea y kéfir natural: fichas de [Arla Pro](https://www.arlapro.com/en-gb/product-catalogue/arla-skyr-0-fat-natural-yogurt-1kg/) y [Danone Foodservice](https://foodservice.danone.es/product/cuajada/). Yogures y kéfires de cabra y oveja: [Cantero de Letur](https://www.elcanterodeletur.com/cabra-y-oveja/lacteos-de-oveja/). Se evita generar combinaciones de sabores, porcentajes de grasa y envases.
- Clotted cream y ayran: referencias de [Rodda’s](https://www.roddas.co.uk/faqs/) y [GAZİ](https://gazi.de/produkte/gazi-ayran-getraenk-mit-joghurt-und-salz-250ml-becher). No se trasladan marcas, certificaciones ni afirmaciones sanitarias al catálogo.
- Huevo entero, clara y yema líquidos pasteurizados: [dossier de Huevos Guillén](https://www.huevosguillen.com/descargas/DOSSIER_HUEVOS_GUILLEN.pdf), página física 12 (folio impreso 11). Se distinguen de los ingredientes frescos y deshidratados históricos.
- Cinco dashi: identificadores 17019–17023 en las [notas de alimentos de MEXT](https://www.mext.go.jp/component/english/__icsFiles/afieldfile/2017/12/20/1385123_Notes-on-food_r11.pdf), página física 257 y explicación en la siguiente. [JETRO](https://japan-food.jetro.go.jp/en/japanesecuisine/120.html) respalda las denominaciones culinarias. No se añade también una ficha genérica ni se generan otras mezclas.
- Fondos concentrados de cigala y setas: [Nestlé Professional](https://www.nestleprofessional.es/conocimientos-de-nuestras-categorias/descubre-la-gama-de-productos-chef-para-anadir-en-cualquier). Caldos de marisco y pollo con jamón: fichas individuales de [Pastas Gallo](https://www.pastasgallo.es/categorias-productos/caldos/). Beurre manié: [Elle & Vire](https://www.elle-et-vire.com/fr/fr/techniques-de-chef/comment-faire-un-beurre-manie/?tag=beurre), separado de los roux históricos por su preparación sin cocción previa.
- Ocho referencias USDA SR Legacy verificadas por identificador y nombre contra la copia local: yogur desnatado, half-and-half, nata montada, huevo cocido, escalfado y revuelto, y dos caldos deshidratados. No se importan tablas nutricionales ni recetas. Polvo y pastillas no suman fichas separadas.

Las fuentes acreditan una identidad culinaria, no una formulación universal ni la disponibilidad actual de un proveedor. Se conservan los nombres españoles y alias; no se generan traducciones ni fotografías.

## Equivalencias pendientes

Se detecta un **posible solapamiento histórico entre Huevo en polvo y Huevo entero deshidratado**. Ambas fichas preceden a este lote y conservan íntegramente sus claves y datos. Antes de consolidarlas hay que revisar alcance, referencias operativas y redirecciones. El total de 3.394 es un recuento de fichas; la validación exacta de nombres no garantiza que todas las equivalencias semánticas históricas estén resueltas.

También se difieren las delimitaciones de nata para cocinar/montar frente a Crema de leche y Nata doble; fondo de ternera/vacuno y ave/pollo; y consomé frente a caldo. Labneh, Kajmak, Smetana, Crème fraîche, los roux y las especies de huevo ya presentes no suman altas. La investigación del fondo de caza queda pendiente tras fallar la apertura de la fuente.

## Integridad y comprobaciones

Las **3.361 fichas anteriores y sus asignaciones de familia permanecen idénticas**. Se conservan las 25 identidades apartadas, las 11 redirecciones y las cuatro clasificaciones provisionales. El hallazgo de los huevos deshidratados queda documentado aparte y no altera esas 25 fichas.

Maestra, espejo del backend, claves protegidas y taxonomía están sincronizados. La reaplicación de los once lotes es idempotente y conserva sus auditorías históricas. [Comprobaciones estructuradas](ingredient-master-expansion-checks-batch-11.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-11.json).

**78 pruebas específicas aprobadas:** 9 del importador, 42 del backend y 27 de interfaz.

## Alcance y continuación

Solo datos locales del catálogo interno de candidatos de Global Manager. Sin escrituras en bases de datos, inventarios ni despliegue. Todas las altas mantienen NEEDS_REVIEW e imágenes MISSING. Una lista vacía de alérgenos significa no documentado, nunca ausencia; se necesita la formulación del proveedor antes de aprobar su uso operativo.

Siguiente investigación: frutos secos, semillas y auxiliares culinarios, cruzados contra toda la maestra. Revisar también las equivalencias históricas registradas. Siguen pendientes la composición de Pavo, cremas y Tempura, la publicación coordinada y las comprobaciones físicas del Sunmi.

Cierre del lote: compilación verificada y búsqueda «kefir» comprobada en navegador el 24 de septiembre. El modal muestra 3.394 fichas y los tres kéfires en Lácteos y huevos. Ensayo con API vacía local y escrituras bloqueadas; no constituye una prueba de integración con la base de datos.
