# Lote 07 de ampliación — 17 de septiembre de 2026

**167 incorporaciones; total al cerrar este lote: 3.014.** Se mantienen las 14 categorías. Las 2.847 fichas anteriores no se modifican.

Zumos, frutas deshidratadas, materias primas vegetales, cortes cárnicos, mieles por origen floral, conservas y auxiliares culinarios. Se excluyen diferencias de envase, marca, grado nutricional o mero porcentaje de grasa.

| Categoría | Antes | Altas | Después |
| --- | ---: | ---: | ---: |
| Aceites, grasas y vinagres | 71 | 6 | 77 |
| Aromas y extractos | 38 | 19 | 57 |
| Carnes | 100 | 27 | 127 |
| Otros | 291 | 40 | 331 |
| Cremas dulces | 34 | 3 | 37 |
| Embutidos | 128 | 0 | 128 |
| Endulzantes | 37 | 30 | 67 |
| Frutas | 233 | 42 | 275 |
| Salsas | 157 | 0 | 157 |
| Verduras | 292 | 0 | 292 |
| Hierbas y especias | 110 | 0 | 110 |
| Pescados y mariscos | 856 | 0 | 856 |
| Quesos | 438 | 0 | 438 |
| Setas | 62 | 0 | 62 |
| **Total** | **2.847** | **167** | **3.014** |

## Evidencias e identidad

Cada ficha está enlazada a su fuente en el [catálogo revisable](ingredient-master-expansion-catalogue-batch-07.md). El [JSON del lote](ingredient-master-expansion-batch-07.json) conserva identificador, nombre de origen, referencia y razón de identidad.

- Leches y huevos en polvo ya presentes, variedades de zumo solo por fortificación y recortes cárnicos solo por grado de grasa: No representan altas nuevas de identidad.
- Aroma de jengibre, limón, naranja, almendra, vainilla, café y humo: Identidades ya representadas por extractos o aromas; no se amplía cambiando solamente la palabra aroma/extracto.
- Psyllium, inulina/fibra de achicoria, fibra de lino, crema de coco y sapa/reducción de uva: Se evitan equivalencias o posibles solapamientos con la maestra.

## Comprobación acumulada al terminar la ampliación

Los controles del conjunto aceptan 3.014 fichas y exactamente 14 categorías. Se comprobaron nombres y alias normalizados, Unicode NFC, claves, referencias e integridad de los siete lotes. Las 1.612 fichas previas al trabajo continuo permanecen idénticas y en el mismo orden. Se contrastaron además las siete huellas SHA-256 históricas.

El normalizador real del backend acepta toda la maestra, resuelve los 11 redireccionamientos y bloquea con 409 las 25 fichas ambiguas. Se contrastaron 1.674 referencias directamente con los datos descargados de USDA, BOE y el catálogo PAT; las 835 identidades con nombre científico no repiten ese identificador. Las demás referencias enlazan a catálogos y fichas oficiales o de fabricante.

Resultado: 7 pruebas de aplicación por lotes y 18 pruebas de interfaz aprobadas; compilación de producción aprobada. [Resultado verificable](ingredient-master-expansion-checks-final.json). No se han generado traducciones ni realizado escrituras en la base de datos.

Los nombres conservan tildes y caracteres propios; no se añade una ficha por traducción. La normalización para búsqueda es independiente del nombre visible. Las altas siguen en NEEDS_REVIEW y MISSING para la imagen; los alérgenos deben contrastarse con la formulación concreta y una lista vacía no certifica ausencia.

[Auditoría de este lote](ingredient-master-expansion-audit-batch-07.json) · [Estado acumulado](ingredient-master-expansion.md). Cambios locales de la lista interna de candidatos, sin publicación.
