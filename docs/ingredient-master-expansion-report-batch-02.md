# Segundo lote de ingredientes — 17 de septiembre de 2026

**254 fichas incorporadas. Total actual: 1.612, dentro de las 14 categorías existentes.** Faltan 1.388 para llegar a 3.000.

Las 1.358 fichas anteriores se conservan íntegramente. El segundo lote añade 46 alias alternativos, que no aumentan el número de ingredientes. Las 25 fichas ambiguas de la limpieza siguen separadas. Cambios locales, sin publicación ni escrituras en la base de datos.

## Reparto del lote

| Categoría | Antes | Lote 2 | Ahora |
| --- | ---: | ---: | ---: |
| Aceites, grasas y vinagres | 64 | 7 | 71 |
| Aromas y extractos | 24 | 14 | 38 |
| Carnes | 88 | 12 | 100 |
| Otros | 179 | 49 | 228 |
| Cremas dulces | 29 | 5 | 34 |
| Embutidos | 104 | 4 | 108 |
| Endulzantes | 36 | 1 | 37 |
| Frutas | 73 | 47 | 120 |
| Salsas | 152 | 5 | 157 |
| Verduras | 188 | 21 | 209 |
| Hierbas y especias | 100 | 10 | 110 |
| Pescados y mariscos | 85 | 30 | 115 |
| Quesos | 179 | 44 | 223 |
| Setas | 57 | 5 | 62 |
| **Total** | **1.358** | **254** | **1.612** |

Se asigna una categoría a cada ficha. Cereales, harinas, legumbres secas, huevos y lácteos que no son queso permanecen en Otros, según la estructura actual. No se ha creado ninguna categoría nueva.

Ejemplos: harina integral de trigo, espelta, arroz glutinoso, chirimoya, higo chumbo, canónigos, solomillo de cerdo, lenguado europeo, queso Cantal, oronja y eritritol.

## Identidad, nombres y alias

Los nombres mantienen tildes y Unicode normalizado. La comparación de búsqueda ignora acentos; la ficha visible conserva la escritura correcta. Las nuevas fichas solo tienen nombre español: no se han generado traducciones.

Se revisaron los nombres y alias contra el maestro anterior, sus claves retiradas y las fichas pendientes. El cruce exacto y el contraste de singular/plural no detectaron nombres o alias compartidos. Una taxonomía auxiliar se usó para descubrir posibles equivalencias, sin importarla al maestro.

Se admiten especies, variedades y preparaciones con identidad culinaria documentada. La marca, el idioma, el envase y los cortes en dados o rodajas no generan nuevas fichas. Así, las distintas presentaciones de una misma fruta liofilizada se agrupan en una sola entrada. Un tipo específico puede coexistir con una ficha genérica anterior: por ejemplo, manzana Fuji y Manzana. No se afirma haber resuelto toda la taxonomía histórica del maestro.

Decisiones revisadas expresamente:

- Queso asadero y Oaxaca se mantienen separados: el [Ministerio de Agricultura mexicano](https://www.gob.mx/agricultura/articulos/quesos-mexicanos-genuinos-delicias-que-nos-distinguen) los enumera como tipos distintos.
- Zapote mamey y mamey de Santo Domingo se distinguen mediante su especie; no comparten el alias ambiguo «mamey».
- Yaca madura y verde tienen usos culinarios distintos documentados por [UC Davis](https://postharvest.ucdavis.edu/es/produce-facts-sheets/jaca).
- Los nuevos boletos se identifican por especie; no se añade otro nombre genérico equivalente a Porcini.
- Se incorporan pralinés con formulación de fruto seco y azúcar documentada por el fabricante. No se añaden fichas por porcentaje o marca.
- Se excluyó «Hojas de acedera»: el registro inglés Dock no respaldaba inequívocamente esa identidad. También se dejaron fuera Munster y nuevas denominaciones de Brie/Camembert por sus posibles solapamientos con entradas anteriores.

## Fuentes

Cada incorporación conserva una referencia concreta, enlazada en el [catálogo del lote](ingredient-master-expansion-catalogue-batch-02.md) y en el [JSON de evidencias](ingredient-master-expansion-batch-02.json).

| Fuente | Uso |
| --- | --- |
| [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets/) | Identidades y preparaciones con identificador FDC; datos SR Legacy de dominio público. No se importan valores nutricionales. |
| [BOE / Secretaría General de Pesca](https://www.boe.es/buscar/act.php?id=BOE-A-2026-12598) | Nombres comerciales y especies; 30 nuevas fichas con nombre científico. |
| [Ministerio de Agricultura francés](https://agriculture.gouv.fr/les-fromages-aop-le-savoir-faire-des-terroirs) | Tipos de queso; la ficha no implica certificación de un producto comercial. |
| [Comunidad de Madrid](https://www.comunidad.madrid/salud/comercializacion-setas) | Nombres y especies de setas. |
| [DGADR](https://tradicional.dgadr.gov.pt/pt/cat/salsicharia-fumados-presuntos-e-paletas) | Alheira, farinheira, paio y salpicão con referencia individual. |
| [Sosa Ingredients](https://www.sosa.cat/) | Aromas, pralinés, frutas liofilizadas y eritritol; los enlaces del catálogo llevan a la ficha o familia específica. |
| [The Spice House](https://www.thespicehouse.com/products/long-pepper) | Pimienta larga y granos del paraíso, con sus referencias individuales. |
| [Kikkoman](https://www.kikkoman.eu/products/detail/kikkoman-ponzu-citrus-seasoned-soy-sauce-lemon) | Ponzu de limón y su composición. |

## Validación y estado

- Maestro completo: 1.612 fichas con UTF-8/NFC válido, nombres, alias, claves y exactamente 14 categorías.
- Conservación íntegra de las 1.358 fichas anteriores, contrastada con la copia previa y su huella SHA-256.
- Evidencia por cada una de las 254 altas, sin reutilizar una identidad de fuente ya aplicada en el primer lote.
- Normalizador real del backend: acepta las 1.612 fichas; mantiene los 11 redireccionamientos históricos y bloquea las 25 fichas pendientes.
- 7 pruebas de regresión de aplicación por lotes y 18 pruebas de interfaz/semántica aprobadas.
- Compilación de producción aprobada; resultado en [comprobaciones](ingredient-master-expansion-checks-batch-02.json).
- Sin traducciones generadas, llamadas a proveedores de traducción, publicaciones ni escrituras en la base de datos.

Las altas mantienen NEEDS_REVIEW para revisión semántica y MISSING para imagen. Los alérgenos usan el vocabulario actual y deben contrastarse con el producto o formulación concreta; una lista vacía no certifica ausencia. La investigación de identidad no aprueba automáticamente traducciones, imágenes ni formulaciones.

## Reproducibilidad

El script admite múltiples lotes: «node scripts/expand-ingredient-master.cjs --batch=02» comprueba el segundo; «--apply» lo incorpora. Reaplicar un lote no reordena registros, no duplica altas y no reescribe sus auditorías históricas.

Controles: «npm run check:ingredients» y «node --test scripts/ingredient-expansion.test.cjs». Las pruebas usan copias temporales y no modifican el maestro real. La prueba del normalizador usa nombres sintéticos en memoria para los idiomas requeridos; no los guarda como traducciones.

[Auditoría del lote](ingredient-master-expansion-audit-batch-02.json) · [Estado acumulado](ingredient-master-expansion.md) · [Catálogo revisable](ingredient-master-expansion-catalogue-batch-02.md).

El alcance sigue siendo la lista interna de candidatos de Global Manager. No se publica un aviso a los negocios por un cambio que todavía no incorpora ingredientes a su inventario ni modifica sus pantallas del backoffice.
