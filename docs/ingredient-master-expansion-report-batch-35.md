# Lote 35 — pastas regionales y rellenas

25 de septiembre de 2026. **14 altas nuevas; total de 3.714 fichas locales.** El usuario indica continuar con la expansión por lotes y dejar las equivalencias históricas para el final. Esta prioridad queda incorporada al plan y al punto de reanudación.

## Incorporaciones

Todas las altas pertenecen a la familia Pastas, arroces y cereales y conservan la categoría histórica Otros. El [catálogo del lote](ingredient-master-expansion-catalogue-batch-35.md) enlaza cada ingrediente con su fuente; el [JSON del lote](ingredient-master-expansion-batch-35.json) conserva decisiones, alias y límites.

- Pasta fregola, pasta lorighittas y culurgiones de patata, queso y menta.
- Pasta pizzoccheri de trigo sarraceno, pasta scialatielli, testaroli sin salsa y fideos para fideuá.
- Anolini de carne, anolini de queso y tortellini de carne.
- Pasta margherite de setas, ravioli de ricotta y salmón y pasta caramelle de ricotta y espinacas.
- Pisarei de pan y harina, sin salsa de alubias.

Se documenta el ingrediente listo para cocinar o terminar, no el plato servido con su salsa. Las identidades regionales y los rellenos explícitos aportan diferencias culinarias; marcas, envases y tamaños no generan fichas nuevas. Se añaden ocho alias específicos, que no suman ingredientes.

## Fuentes y límites

Se contrastaron fuentes de los portales regionales oficiales de Cerdeña, Lombardía y Toscana, los fabricantes Garofalo, Gallo y Pastificio Fontana y la elaboración propia de Trattoria da Pinuccio para pisarei. Las fuentes por fila y el modo de recuperación se registran en el lote. Algunas se recuperaron a través de contenido indexado: Cerdeña bloqueó el acceso directo y varias fichas de Fontana fallaron o agotaron tiempo. Estos accesos no se presentan como verificaciones directas completas.

Las fichas preservan la identidad culinaria sin trasladar porcentajes, certificaciones o formulaciones comerciales universales. Los datos nutricionales y las recetas completas no se importan. Las pastas rellenas requieren revisar trigo, huevo, leche, pescado y otros alérgenos según el suministro; una lista de alérgenos vacía significa pendiente de aprobación, nunca ausencia.

Malloreddus y risoni quedan fuera del lote por su relación con gnocchetti sardi y orzo existentes. Chicche verdi y caramelle de ricotta y radicchio tampoco se incorporan: falta recuperar una ficha suficientemente precisa. No se resuelven equivalencias históricas ni se cambian sus claves.

## Conservación y validación

Los [controles](ingredient-master-expansion-checks-batch-35.json) verifican la conservación de las 3.700 fichas y asignaciones anteriores, los documentos históricos, 14 categorías y familias, 11 redirecciones y 25 fichas apartadas. Los 35 lotes se reaplican sin duplicar registros. La proyección local del backend y ambas taxonomías permanecen coherentes.

La [cobertura actual](ingredient-master-coverage-batch-35.json) conserva las 248 necesidades básicas localizadas. Las 14 nuevas fichas son encontrables por sus nombres y alias: 22 consultas verificadas, además de las correspondencias previas que declaraban búsqueda disponible. La lista básica no se amplía artificialmente ni se presenta como cobertura exhaustiva.

**83 pruebas específicas aprobadas**: 30 de interfaz, 42 de backend y 11 del importador. Compilación correcta (/static/js/main.8b6edeb0.js). Las comprobaciones no acreditan integración con base de datos ni revisión visual.

Todas las altas mantienen revisión semántica pendiente, imágenes ausentes y únicamente el nombre español. La revisión editorial, visual y de formulaciones sigue pendiente. Se mantiene la decisión de evitar el navegador integrado mientras se diagnostican los cierres.

Solo archivos locales: sin publicación, escrituras en bases de datos ni altas en inventarios. El catálogo de avisos no se publica con esta investigación interna. Siguiente bloque: continuar ampliación de familias con huecos documentados; equivalencias históricas al terminar.

Reproducción desde la raíz: `node output/ingredient-expansion/batch35-2026-09-25/check-batch35.cjs` y `node output/ingredient-expansion/batch35-2026-09-25/coverage.cjs`. No volver a preparar el lote ya aplicado.
