# Lote 34 — seis variantes para cerrar la lista básica

25 de septiembre de 2026. **6 altas; total de 3.700 fichas locales.** Se conserva íntegra la maestra anterior de 3.694 fichas y sus asignaciones.

El usuario confirmó que Tomate, Anchoas, Atún, Crema de leche, Nata doble y Fibra de achicoria eran nombres genéricos del catálogo. Se registra esta aclaración en el [lote estructurado](ingredient-master-expansion-batch-34.json). Permite incorporar variantes expresas; no atribuye composición a los genéricos ni autoriza equivalencias automáticas.

| Alta | Alcance y fuente |
| --- | --- |
| Boquerón fresco | Pescado fresco para cocinar, documentado por [Pescaderías Coruñesas](https://www.pescaderiascorunesas.es/preparaciones/boqueron). No es salazón ni encurtido; no se asigna especie científica por suposición. |
| Atún claro en conserva al natural | Una opción de conserva con agua y sal documentada por [Calvo](https://calvo.es/producto/atun-claro-supernatural/); el fabricante también la identifica en [latas](https://calvo.es/receta/ensalada-de-lentejas-con-atun-y-dressing-de-tahine-y-anacardos/). No representa conserva en aceite o escabeche. |
| Nata para cocinar | Uso culinario lácteo documentado por [Central Lechera Asturiana](https://www.centrallecheraasturiana.es/productos/nata/nata-para-cocinar/nata-cocinar-500ml/). La composición y materia grasa dependen del producto. |
| Nata para montar | Nata líquida destinada a montarse, distinta de nata ya montada; [fuente del fabricante](https://www.centrallecheraasturiana.es/productos/nata/nata-para-montar/nata-montar-38mg-500ml/). No se impone un porcentaje graso universal. |
| Tomate triturado | Preparación triturada, diferenciada de frito, concentrado y sofrito por [Hida](https://hida.es/diferencias-entre-tomate-frito-triturado-y-sofrito/). No se presupone ausencia de tratamiento térmico en una conserva comercial. |
| Tomate frito | Preparación cocinada con aceite, documentada por [Hida](https://hida.es/productos/sofritos-caseros/tomate-frito/). No se importa una receta comercial como formulación universal. |

Se añaden únicamente dos alias específicos: Nata líquida para cocinar y Nata líquida para montar. Las marcas, envases, porcentajes y alegaciones comerciales no generan identidades adicionales. Las fuentes se consultaron de nuevo para este lote; la receta de Calvo se contrastó mediante su resultado indexado.

## Cobertura

Las **248 necesidades de la lista editorial tienen una opción identificada**. La [lista completa](ingredient-master-coverage-checklist-batch-34.md) y la [cobertura estructurada](ingredient-master-coverage-batch-34.json) conservan fuentes, límites y las candidatas históricas de los seis puntos resueltos. Las seis consultas encuentran las nuevas fichas mediante el buscador existente, sin cambios de lógica.

Este cierre se refiere a la lista básica: no certifica todas las variantes ni elimina las equivalencias pendientes de lotes anteriores. Se mantienen las fichas genéricas, las 25 apartadas y las cuatro asignaciones provisionales. Fibra de achicoria e Inulina de achicoria siguen separadas hasta aclarar composición y referencias operativas. Tampoco se fusionan nombres de inventarios o recetas.

## Validación y estado

Los [controles del lote](ingredient-master-expansion-checks-batch-34.json) comprueban conservación de la base histórica y de sus documentos, 14 categorías y familias, 11 redirecciones, coherencia de la proyección del backend y de las taxonomías, y reaplicación idempotente de los 34 lotes. El [catálogo](ingredient-master-expansion-catalogue-batch-34.md) enumera las altas y fuentes.

**83 pruebas específicas aprobadas**: 30 de interfaz, 42 de backend y 11 del importador. Compilación correcta (/static/js/main.d213caa0.js). Se verificó también el catálogo de avisos durante el cierre del lote 33: 8 pruebas aprobadas; el borrador permanece fuera del feed.

Las seis fichas quedan con revisión semántica pendiente e imagen ausente. Alérgenos vacíos significa no aprobados, nunca ausencia; deben verificarse el suministro y las trazas, especialmente pescado y leche. No se aprueban formulaciones ni traducciones por este recuento.

Revisión visual pendiente; se conserva la decisión de evitar el navegador integrado durante el diagnóstico de cierres. Todo queda en local, sin publicación ni escrituras en bases de datos o inventarios.

Reproducción desde la raíz: `node output/ingredient-expansion/batch34-2026-09-25/check-batch34.cjs` y `node output/ingredient-expansion/batch34-2026-09-25/coverage.cjs`. El lote ya aplicado no se vuelve a preparar.
