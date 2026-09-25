# Cierre de la expansión — 25 de septiembre de 2026

Por decisión de Luigi se cierra la expansión en el lote 36: **3.728 fichas, 14 familias, 2.624 altas y 626 alias alternativos** desde la limpieza. No iniciar el lote 37 ni perseguir las 5.000 fichas. Los informes por lote conservan sus decisiones históricas; este documento sustituye sus instrucciones de continuación.

## Auditoría y validación del estado local

- Los 36 lotes están aplicados y coinciden con sus auditorías, incluidas las huellas de sus bases históricas. La comprobación se ejecutó sin escrituras al catálogo ni a bases de datos.
- Sin claves, nombres normalizados ni alias exactos compartidos entre identidades seleccionables. Se conservan 11 redirecciones y 25 fichas ambiguas apartadas.
- Proyección del backend, taxonomía y resolver coinciden con el storefront. Las 248 necesidades de la lista básica apuntan a registros existentes; esto no acredita todas las variantes ni su disponibilidad comercial.
- Suite general del backend: 270 aprobadas y 1 omitida por falta de configuración MySQL. No se ejecutó integración con base de datos en este cierre.
- Suite general del frontend: 27 suites, 201 pruebas aprobadas. Importador: 11 pruebas aprobadas. Total: **482 aprobadas, 0 fallos, 1 omitida**.
- Compilación de producción correcta: `main.01e55d4e.js` y `main.cdf425e2.css`. Aviso de Browserslist desactualizado; no se actualizan dependencias durante este cierre.
- No se hizo revisión visual ni se abrió el navegador integrado, por el diagnóstico de cierres ya documentado.

Estas suites y la compilación verifican el árbol local completo, que incluye cambios anteriores ajenos al catálogo. El commit de catálogo conserva datos, evidencias y validadores; no representa la entrega de todas las modificaciones de la aplicación.

Además se exportó el índice exacto de ambos repositorios a una carpeta aislada, sin las modificaciones excluidas del commit: el control de cierre y las 11 pruebas del importador también pasaron allí. `git diff --cached --check` pasó en los dos repositorios.

## Reproducir el control del catálogo

Desde `volta-storefront`: `node scripts/audit-ingredient-closure.cjs`.

Este control está versionado, es de solo lectura y no depende de `output/` ni `tmp/`. Comprueba los 36 lotes, sus bases históricas, cobertura referencial, estados pendientes y el validador completo. Si existe el backend hermano comprueba también sus espejos; si no existe lo declara omitido. [Resultado de este cierre](ingredient-master-closure-audit-2026-09-25.json).

Pruebas: `node --test scripts/ingredient-expansion.test.cjs`, `npm test -- --watchAll=false --runInBand` con `CI=true`, `npm run build`; en `volta-backend`, `npm test`.

## Alcance del commit y próximos cambios

Se guarda un punto de control local en cada repositorio: catálogo, taxonomía estática compartida, documentos de investigación y herramientas de validación. No se despliega ni se publica; no se modifican inventarios. El repositorio contenedor no se utiliza para el commit: cada aplicación tiene su propio repositorio Git.

Los dos ajustes de cierre realizados son actualizar la prioridad vigente y conservar un control reproducible dentro del repositorio. Los cambios funcionales adicionales solicitados por Luigi aún deben concretarse; no se inventan requisitos.

Plan acotado para esos cambios:

1. Precisar como máximo dos cambios, con comportamiento esperado y criterio de aceptación; conservar las identidades y claves existentes.
2. Implementarlos por separado, ejecutar solo las pruebas afectadas y guardar un commit por bloque antes de ampliar el alcance. Si requieren investigación amplia, dejarlos documentados para después del reinicio del límite.

La revisión editorial, equivalencias históricas (incluida fibra/inulina), traducciones, imágenes y aprobación de formulaciones siguen pendientes. Todas las altas de investigación permanecen `NEEDS_REVIEW` y `MISSING`; alérgenos vacíos no acreditan ausencia. El despliegue coordinado, la integración operativa y la prueba física Sunmi se gestionan en el plan de entrega previo.
