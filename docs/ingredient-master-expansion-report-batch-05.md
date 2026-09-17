# Lote 05 de ampliación — 17 de septiembre de 2026

**250 incorporaciones; total al cerrar este lote: 2.459.** Se mantienen las 14 categorías. Las 2.209 fichas anteriores no se modifican.

Variedades alimentarias tradicionales con denominación específica. La variedad se mantiene como nombre propio y se traduce el tipo de alimento. Se excluyen nombres regionales que solo repiten el producto genérico y equivalencias evidentes entre regiones.

| Categoría | Antes | Altas | Después |
| --- | ---: | ---: | ---: |
| Aceites, grasas y vinagres | 71 | 0 | 71 |
| Aromas y extractos | 38 | 0 | 38 |
| Carnes | 100 | 0 | 100 |
| Otros | 234 | 54 | 288 |
| Cremas dulces | 34 | 0 | 34 |
| Embutidos | 128 | 0 | 128 |
| Endulzantes | 37 | 0 | 37 |
| Frutas | 120 | 113 | 233 |
| Salsas | 157 | 0 | 157 |
| Verduras | 209 | 83 | 292 |
| Hierbas y especias | 110 | 0 | 110 |
| Pescados y mariscos | 471 | 0 | 471 |
| Quesos | 438 | 0 | 438 |
| Setas | 62 | 0 | 62 |
| **Total** | **2.209** | **250** | **2.459** |

## Evidencias e identidad

Cada ficha está enlazada a su fuente en el [catálogo revisable](ingredient-master-expansion-catalogue-batch-05.md). El [JSON del lote](ingredient-master-expansion-batch-05.json) conserva identificador, nombre de origen, referencia y razón de identidad.

- Manzana rugginosa/Golden, alubia dell’occhio, alcachofa por procedencia sin variedad y múltiples sinónimos locales: Se omiten equivalencias del catálogo existente o denominaciones que no aportan una identidad de variedad suficientemente clara.
- Variedades Limoncella, Zitella, Turchesa, Lupinaro, Spadona y Corazón de Buey repetidas por región: Una sola alta por identidad; no se multiplican al aparecer en más de una región.

## Comprobación acumulada al terminar la ampliación

Los controles del conjunto aceptan 3.014 fichas y exactamente 14 categorías. Se comprobaron nombres y alias normalizados, Unicode NFC, claves, referencias e integridad de los siete lotes. Las 1.612 fichas previas al trabajo continuo permanecen idénticas y en el mismo orden. Se contrastaron además las siete huellas SHA-256 históricas.

El normalizador real del backend acepta toda la maestra, resuelve los 11 redireccionamientos y bloquea con 409 las 25 fichas ambiguas. Se contrastaron 1.674 referencias directamente con los datos descargados de USDA, BOE y el catálogo PAT; las 835 identidades con nombre científico no repiten ese identificador. Las demás referencias enlazan a catálogos y fichas oficiales o de fabricante.

Resultado: 7 pruebas de aplicación por lotes y 18 pruebas de interfaz aprobadas; compilación de producción aprobada. [Resultado verificable](ingredient-master-expansion-checks-final.json). No se han generado traducciones ni realizado escrituras en la base de datos.

Los nombres conservan tildes y caracteres propios; no se añade una ficha por traducción. La normalización para búsqueda es independiente del nombre visible. Las altas siguen en NEEDS_REVIEW y MISSING para la imagen; los alérgenos deben contrastarse con la formulación concreta y una lista vacía no certifica ausencia.

[Auditoría de este lote](ingredient-master-expansion-audit-batch-05.json) · [Estado acumulado](ingredient-master-expansion.md). Cambios locales de la lista interna de candidatos, sin publicación.
