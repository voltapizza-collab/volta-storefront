# Lote 03 de ampliación — 17 de septiembre de 2026

**362 incorporaciones; total al cerrar este lote: 1.974.** Se mantienen las 14 categorías. Las 1.612 fichas anteriores no se modifican.

Especies pesqueras con nombre comercial español identificable. No se incluyen grupos spp., nombres genéricos ya existentes ni especies con denominación compartida sin una alternativa inequívoca.

| Categoría | Antes | Altas | Después |
| --- | ---: | ---: | ---: |
| Aceites, grasas y vinagres | 71 | 0 | 71 |
| Aromas y extractos | 38 | 0 | 38 |
| Carnes | 100 | 0 | 100 |
| Otros | 228 | 6 | 234 |
| Cremas dulces | 34 | 0 | 34 |
| Embutidos | 108 | 0 | 108 |
| Endulzantes | 37 | 0 | 37 |
| Frutas | 120 | 0 | 120 |
| Salsas | 157 | 0 | 157 |
| Verduras | 209 | 0 | 209 |
| Hierbas y especias | 110 | 0 | 110 |
| Pescados y mariscos | 115 | 356 | 471 |
| Quesos | 223 | 0 | 223 |
| Setas | 62 | 0 | 62 |
| **Total** | **1.612** | **362** | **1.974** |

## Evidencias e identidad

Cada ficha está enlazada a su fuente en el [catálogo revisable](ingredient-master-expansion-catalogue-batch-03.md). El [JSON del lote](ingredient-master-expansion-batch-03.json) conserva identificador, nombre de origen, referencia y razón de identidad.

- Scomber japonicus es distinto de S. scombrus y S. colias. Se evita el nombre caballa del sur, compartido en el registro con S. colias.
- Se usa el nombre específico del BOE para Engraulis ringens; no se reutiliza el alias genérico anchoas. La coincidencia de la taxonomía auxiliar era de familia comercial, no de especie.
- Scyllarides latus es un crustáceo. Se añade de mar para evitar confundirlo con los insectos de la categoría Otros.
- Cigala (Nephrops norvegicus): Posible identidad ya representada por Cigala islandesa; se excluye para no contar la procedencia como ingrediente.
- Nombres comerciales compartidos sin calificativo inequívoco: Se excluyen pares de especies rotulados solo camarón, gamba, bocón, cabete, cojinova, almeja del Pacífico o corvina negra.
- Especies genéricas ya representadas: No se añade otra ficha para anchoa europea, anguila europea, camarón nórdico, caballa común, wakame, nori ni grupos spp.

## Comprobación acumulada al terminar la ampliación

Los controles del conjunto aceptan 3.014 fichas y exactamente 14 categorías. Se comprobaron nombres y alias normalizados, Unicode NFC, claves, referencias e integridad de los siete lotes. Las 1.612 fichas previas al trabajo continuo permanecen idénticas y en el mismo orden. Se contrastaron además las siete huellas SHA-256 históricas.

El normalizador real del backend acepta toda la maestra, resuelve los 11 redireccionamientos y bloquea con 409 las 25 fichas ambiguas. Se contrastaron 1.674 referencias directamente con los datos descargados de USDA, BOE y el catálogo PAT; las 835 identidades con nombre científico no repiten ese identificador. Las demás referencias enlazan a catálogos y fichas oficiales o de fabricante.

Resultado: 7 pruebas de aplicación por lotes y 18 pruebas de interfaz aprobadas; compilación de producción aprobada. [Resultado verificable](ingredient-master-expansion-checks-final.json). No se han generado traducciones ni realizado escrituras en la base de datos.

Los nombres conservan tildes y caracteres propios; no se añade una ficha por traducción. La normalización para búsqueda es independiente del nombre visible. Las altas siguen en NEEDS_REVIEW y MISSING para la imagen; los alérgenos deben contrastarse con la formulación concreta y una lista vacía no certifica ausencia.

[Auditoría de este lote](ingredient-master-expansion-audit-batch-03.json) · [Estado acumulado](ingredient-master-expansion.md). Cambios locales de la lista interna de candidatos, sin publicación.
