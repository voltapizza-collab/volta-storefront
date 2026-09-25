# Lote 08 — continuación del plan para restaurantes

24 de septiembre de 2026. **192 altas netas; 3.206 fichas en total.** Faltan 1.794 para la referencia aproximada de 5.000. Este lote cierra el primer bloque de investigación prioritario, no la ampliación completa.

| Familia de restaurante | Altas |
| --- | ---: |
| Panes, masas y harinas | 63 |
| Pastas, arroces y cereales | 99 |
| Carnes y aves | 9 |
| Salsas, condimentos y bases de cocina | 21 |
| **Total** | **192** |

Entre las altas: chapata, baguette, mollete, brioche, focaccia, naan, linguine, rigatoni, penne, ravioli de ricotta, corte Denver, fondos, roux y demi-glace. Se incorporan además 117 alias alternativos, que no suman ingredientes.

## Identidad y fuentes

El [catálogo revisable](ingredient-master-expansion-catalogue-batch-08.md) enlaza cada identidad a su fuente. El [JSON del lote](ingredient-master-expansion-batch-08.json) conserva nombres de origen, referencias, alias y razones editoriales. Se utilizan USDA SR Legacy, el catálogo histórico PAT 2024, De Cecco, Panamar, Europastry, Mollete San Roque, Unilever Food Solutions y Gallina Blanca. PAT documenta identidad histórica, no vigencia registral actual. No se importan imágenes, descripciones comerciales ni valores nutricionales.

Se documentan 12 exclusiones o grupos de exclusiones. Entre ellas: taglierini por posible sinonimia con tagliolini; fettuccelle, millerighe y puntalette por solapamientos pendientes de contraste; brioche de hamburguesa por representar la misma base en otro formato; brazuelo por equivalencia anatómica no suficientemente contrastada. Números comerciales, envases, fortificación y tamaños no se cuentan automáticamente como altas.

La ausencia de colisiones exactas no certifica que toda posible sinonimia regional esté resuelta. Las nuevas fichas conservan NEEDS_REVIEW, imágenes MISSING y solo nombre español. Los alérgenos vacíos significan no documentado: requieren contrastar la formulación concreta.

## Integración y controles

- Las 3.014 fichas previas y sus asignaciones de familia permanecen idénticas y en el mismo orden. Permanecen las 25 identidades apartadas y las 11 redirecciones históricas.
- Se conserva exactamente el conjunto de 14 categorías históricas. Las nuevas fichas declaran además una de las 14 familias de restaurante; el generador valida esta decisión explícita antes de asignarla.
- Maestra, espejo del backend, claves protegidas y clasificación generada están sincronizados. El validador rechaza cambios de familia respecto del lote revisado.
- Los ocho lotes se vuelven a aplicar de forma idempotente: no cambian fichas, auditorías ni recuentos históricos. Se contrastan las huellas de las bases anteriores.
- Pruebas: 9 del importador, 42 del backend y 27 de interfaz, todas satisfactorias. Se actualizaron los fixtures del importador para incluir el manifiesto de clasificación que exige el validador.
- Compilación completa satisfactoria: `main.e7662925.js` y `main.6cd59d28.css`, servida en localhost. Aviso no bloqueante de Browserslist sobre antigüedad de sus datos; no se actualizaron dependencias durante esta ampliación.
- Navegador: el alta del Global Manager muestra 3.206 fichas. Buscar «linguini» devuelve una sola ficha, «Pasta linguine», en Pastas, arroces y cereales; al seleccionarla conserva el nombre español y exige completar los demás idiomas antes del alta. No se guardó ni tradujo ninguna ficha durante esta comprobación.

[Comprobaciones estructuradas](ingredient-master-expansion-checks-batch-08.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-08.json).

## Alcance y continuación

Altas en el catálogo interno de candidatos del Global Manager, sin escrituras en bases de datos, inventarios ni producción. No se publica un aviso a los negocios porque no se ha incorporado una disponibilidad nueva a sus inventarios. Se mantienen las dudas de Pavo, las cremas y Tempura; esta ampliación no decide su composición.

Continuar contrastando huecos en las familias prioritarias y después quesos, charcutería y demás familias según el [plan](ingredient-master-restaurant-plan.md). Cada lote debe documentar altas útiles y distintas, sin completar el objetivo numérico mediante variantes artificiales.
