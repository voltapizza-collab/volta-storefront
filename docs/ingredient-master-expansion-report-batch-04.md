# Lote 04 de ampliación — 17 de septiembre de 2026

**235 incorporaciones; total al cerrar este lote: 2.209.** Se mantienen las 14 categorías. Las 1.974 fichas anteriores no se modifican.

Tipos de queso y elaboraciones tradicionales documentados. Se conservan nombres propios; no se cuenta otra ficha por sello DOP/IGP ni se importan marcas.

| Categoría | Antes | Altas | Después |
| --- | ---: | ---: | ---: |
| Aceites, grasas y vinagres | 71 | 0 | 71 |
| Aromas y extractos | 38 | 0 | 38 |
| Carnes | 100 | 0 | 100 |
| Otros | 234 | 0 | 234 |
| Cremas dulces | 34 | 0 | 34 |
| Embutidos | 108 | 20 | 128 |
| Endulzantes | 37 | 0 | 37 |
| Frutas | 120 | 0 | 120 |
| Salsas | 157 | 0 | 157 |
| Verduras | 209 | 0 | 209 |
| Hierbas y especias | 110 | 0 | 110 |
| Pescados y mariscos | 471 | 0 | 471 |
| Quesos | 223 | 215 | 438 |
| Setas | 62 | 0 | 62 |
| **Total** | **1.974** | **235** | **2.209** |

## Evidencias e identidad

Cada ficha está enlazada a su fuente en el [catálogo revisable](ingredient-master-expansion-catalogue-batch-04.md). El [JSON del lote](ingredient-master-expansion-batch-04.json) conserva identificador, nombre de origen, referencia y razón de identidad.

- Fresa es el nombre propio de un queso sardo; no es una fruta. Se mantiene el prefijo Queso para distinguirlo.
- Crescenza, Fiordilatte, Casu frazigu, Fontal y Caciocavallo genérico: Equivalencias de stracchino, mozzarella de vaca, Casu marzu, queso fontal o caciocavallo ya presentes.
- Nuevas fichas solo por denominación de procedencia de prosciutto, coppa, lardo o mozzarella: Se priorizan elaboraciones con identidad diferenciada; las denominaciones solapadas quedan fuera.

Se corrigieron cuatro referencias tras detectar que la extracción del PDF arrastraba el encabezado regional al pasar de Valle de Aosta a Véneto. El nombre de origen y la página fueron rectificados contra el PDF; las cuatro fichas y sus claves no cambiaron. La corrección queda documentada en el JSON.

## Comprobación acumulada al terminar la ampliación

Los controles del conjunto aceptan 3.014 fichas y exactamente 14 categorías. Se comprobaron nombres y alias normalizados, Unicode NFC, claves, referencias e integridad de los siete lotes. Las 1.612 fichas previas al trabajo continuo permanecen idénticas y en el mismo orden. Se contrastaron además las siete huellas SHA-256 históricas.

El normalizador real del backend acepta toda la maestra, resuelve los 11 redireccionamientos y bloquea con 409 las 25 fichas ambiguas. Se contrastaron 1.674 referencias directamente con los datos descargados de USDA, BOE y el catálogo PAT; las 835 identidades con nombre científico no repiten ese identificador. Las demás referencias enlazan a catálogos y fichas oficiales o de fabricante.

Resultado: 7 pruebas de aplicación por lotes y 18 pruebas de interfaz aprobadas; compilación de producción aprobada. [Resultado verificable](ingredient-master-expansion-checks-final.json). No se han generado traducciones ni realizado escrituras en la base de datos.

Los nombres conservan tildes y caracteres propios; no se añade una ficha por traducción. La normalización para búsqueda es independiente del nombre visible. Las altas siguen en NEEDS_REVIEW y MISSING para la imagen; los alérgenos deben contrastarse con la formulación concreta y una lista vacía no certifica ausencia.

[Auditoría de este lote](ingredient-master-expansion-audit-batch-04.json) · [Estado acumulado](ingredient-master-expansion.md). Cambios locales de la lista interna de candidatos, sin publicación.
