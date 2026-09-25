# Lote 09 — quesos y charcutería

24 de septiembre de 2026. **96 altas netas: 60 de charcutería y 36 de quesos. Total: 3.302 fichas.** Faltan 1.698 para la referencia aproximada de 5.000.

| Categoría histórica | Antes | Altas | Después |
| --- | ---: | ---: | ---: |
| Embutidos | 128 | 60 | 188 |
| Quesos | 438 | 36 | 474 |
| **Catálogo completo** | **3.206** | **96** | **3.302** |

La familia de restaurante «Embutidos y charcutería» reúne 192 fichas porque ya incluía cuatro correspondencias de otras categorías históricas. Esas asignaciones no cambian en este lote.

Ejemplos: bresaola de búfala y de caballo, jamón cocido al vino de Cori, salame de cabra, de oveja y de jabalí; Manouri, Metsovone, Sfela, Azeitão, São Jorge, Serpa y Serra da Estrela. Se añaden 81 alias de búsqueda, sin contarlos como ingredientes.

## Fuentes y decisiones

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-09.md) enlaza todas las fichas. El [JSON revisado](ingredient-master-expansion-batch-09.json) conserva referencias, nombres de origen, alias, razones y 15 exclusiones o grupos de exclusiones.

- 62 altas contrastadas por identificador y nombre con la copia histórica de MASAF PAT 2024. Se detectaron errores de continuidad de cabeceras en el índice extraído: sus categorías no se importan. La familia se asigna expresamente por identidad. La fuente histórica no certifica vigencia registral ni disponibilidad comercial actual.
- 17 quesos y requesones documentados por DGADR. Se separan las tres variedades expresamente enumeradas de Beira Baixa; no se añade otra ficha para el nombre paraguas. Se conservan nombres de origen como alias, sin generar fichas por sello o envase.
- 13 variedades nominadas en el portal oficial Greek Farms. Se contrasta «Sfela» con la documentación ministerial; «Sfella», grafía del portal, queda como alias. «Ladotyri Mytilinis» también se conserva como alias de la misma ficha.
- 4 elaboraciones contrastadas en fichas ARSIAL: bresaola de búfala, jamón cocido al vino de Cori, Susianella y queso ovino curado en aceite. Las fichas pueden contener más de un producto en la misma página; se identifica el bloque correspondiente.
- Las referencias regionales adicionales explican las diferencias de Bel e cot, Cappello del prete, Salsiccia gialla fina, Salam di cueste y Salame pancettato. No se importan recetas completas, imágenes, datos nutricionales ni instrucciones de elaboración.

Se aparta Mariola porque fuentes regionales describen un salame curado y un cotechino bajo el mismo nombre. También se dejan fuera posibles equivalencias como Coppa di testa frente al fiambre de cabeza ya presente, Mortandela genérica frente a Marcundela, y Pancetta con filetto frente a Pancetta con lomo. Formas de mozzarella, localidades sin diferencia documentada y denominaciones históricas ya representadas no suman altas.

El Caprino de leche de vaca queda explícitamente denominado. La variante de Supino no se añade como otra ficha: su descripción admite también leche mixta y requiere revisar el solapamiento. Los nombres de especialidad no sustituyen la formulación de un proveedor concreto.

## Integridad y validación

Las 3.206 fichas previas y sus asignaciones de familia permanecen idénticas. Se mantienen las 25 identidades apartadas, las 11 redirecciones y las cuatro clasificaciones provisionales. Las decisiones de composición de Pavo, cremas y Tempura continúan abiertas.

Maestra, espejo del backend, claves protegidas y clasificación están sincronizados. Los nueve lotes se comprueban mediante reaplicación idempotente y huellas de sus bases históricas: no se reescriben auditorías ni se vuelven a contar altas.

Pruebas específicas: **78 aprobadas** — 9 del importador, 42 del backend y 27 de interfaz. [Comprobaciones estructuradas](ingredient-master-expansion-checks-batch-09.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-09.json).

Compilación completa correcta: `main.ffcd48b6.js` y `main.6cd59d28.css`, copiada al servidor local. Browserslist mantiene su aviso no bloqueante sobre antigüedad de datos; no se actualizaron dependencias.

Comprobación en navegador: la lista maestra muestra 3.302 fichas; buscar «Sfella» devuelve una sola ficha «Sfela» en Quesos. El catálogo operativo de la copia local conserva sus 131 ingredientes. No se guardó ningún alta ni se solicitaron traducciones durante esta revisión.

## Alcance y siguiente punto

Datos locales del catálogo interno de candidatos del Global Manager. No se han escrito bases de datos ni inventarios, ni desplegado producción. Todas las altas conservan NEEDS_REVIEW y las imágenes MISSING. Solo se prepara el nombre español con alias de búsqueda; faltan traducciones y revisión de formulación. Una lista vacía de alérgenos significa no documentado.

No procede anunciar disponibilidad a los negocios antes de publicar y aprobar sus fichas. La siguiente investigación priorizará huecos en arroces, cereales, harinas y legumbres, cruzados contra las 3.302 identidades actuales. La meta de 5.000 sigue abierta y no justifica variantes artificiales.
