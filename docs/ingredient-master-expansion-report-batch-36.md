# Lote 36 — panes regionales y bases para rellenar

25 de septiembre de 2026. **14 altas; total de 3.728 fichas locales.** Se continúa la expansión y se reservan las equivalencias históricas para el final, siguiendo la indicación del usuario.

## Alcance

Se incorporan panes y bases sin acompañamiento de Emilia-Romaña, Toscana y Cerdeña. Las identidades y sus 15 alias se detallan en el [catálogo](ingredient-master-expansion-catalogue-batch-36.md) y el [lote estructurado](ingredient-master-expansion-batch-36.json). Todas se asignan a Panes, masas y harinas, conservando Otros como categoría histórica.

Fuentes oficiales abiertas: [Emilia Romagna Turismo](https://emiliaromagnaturismo.it/en/food-valley/emilia-romagna-on-a-plate/bread), [Visit Tuscany](https://www.visittuscany.com/it/idee/5-traditional-breads-from-tuscany/) e [Italia.it](https://www.italia.it/en/sardinia/things-to-do/sardinian-bread). Se utilizan sus descripciones de identidad; no se importan recetas completas, alegaciones nutricionales ni certificaciones de origen.

Se distinguen bases sin relleno de platos terminados. Las denominaciones regionales no acreditan por sí mismas un suministro DOP o IGP. No se crean registros por tamaño, decoración, envase o marca. Chisola y pan de patata de Garfagnana se apartan por posible cobertura existente; pane frattau y coccoi con huevo no se incorporan como nuevas bases. Estas exclusiones no modifican fichas históricas.

## Validación

Los [controles del lote](ingredient-master-expansion-checks-batch-36.json) verifican conservación de las 3.714 fichas y asignaciones anteriores, documentos históricos, 14 categorías y familias, 11 redirecciones, 25 fichas apartadas y reaplicación idempotente de 36 lotes. Se sincronizan únicamente los archivos locales de proyección y taxonomía del backend.

La [cobertura actual](ingredient-master-coverage-batch-36.json) conserva las 248 necesidades básicas localizadas. Las 14 altas se encuentran mediante 29 consultas de nombres y alias. Las correspondencias anteriores declaradas como localizables también conservan su búsqueda.

**83 pruebas específicas aprobadas**: 30 de interfaz, 42 de backend y 11 del importador. Compilación correcta (/static/js/main.01e55d4e.js). Las comprobaciones no acreditan integración con base de datos ni revisión visual.

Todas las altas mantienen revisión semántica pendiente, imagen ausente y solo nombre español. Alérgenos vacíos significa no aprobados, nunca ausencia; revisar composición y trazas del suministro. La revisión editorial y visual sigue pendiente y se mantiene la decisión de evitar el navegador integrado durante el diagnóstico de cierres.

Todo permanece en local, sin publicación ni escrituras en bases de datos o inventarios. No se publica un aviso de disponibilidad para negocios sobre esta investigación interna. Siguiente bloque: continuar ampliación con nuevas identidades documentadas; equivalencias históricas al final.

Reproducir desde la raíz: `node output/ingredient-expansion/batch36-2026-09-25/check-batch36.cjs`, `node output/ingredient-expansion/batch36-2026-09-25/coverage.cjs` y `node output/ingredient-expansion/batch36-2026-09-25/finish.cjs`. No volver a preparar el lote aplicado.
