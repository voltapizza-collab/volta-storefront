# Lote 32 — procedencia y alcance de fichas existentes

25 de septiembre de 2026. **Cero altas; se mantienen 3.694 fichas locales.** Se revisan las ocho necesidades abiertas en el lote 31 y la posible equivalencia entre fibra e inulina de achicoria. Este lote registra decisiones editoriales; no cambia nombres, alias, categorías ni formulaciones de las fichas.

## Resultado

La referencia de 248 necesidades queda en **242 localizadas y 6 con alcance pendiente**. Las dos correspondencias nuevas se resuelven mediante variantes documentadas ya existentes. «Localizada» significa que hay una opción identificada para esa necesidad básica, no que estén representadas todas sus variantes.

| Necesidad | Correspondencia y límite |
| --- | --- |
| Entrecot de vacuno | **Ojo de lomo de vacuno**, procedente del registro USDA 170839, representa ribeye deshuesado y la opción de entrecot de lomo alto. La fuente de [Goia](https://carnicasgoia.com/producto/entrecot/) diferencia alto y bajo; [Pozas](https://carnicaspozas.com/es/vacuno/1707-entrecot-de-ternera-00718.html) documenta una opción de lomo bajo. No se convierte entrecot en alias exclusivo de ribeye ni se afirma que la ficha cubra cualquier entrecot. |
| Aceitunas verdes | **Aceituna Gordal sevillana**, ya incluida en el lote 15, tiene una presentación verde de mesa documentada en la [ficha del proveedor original](https://www.manzanillaolive.es/wp-content/uploads/2019/05/FICHA-A15-ALINO-ABUELA.pdf). La política del lote 15 agrupa color, hueso y aliño dentro de las variedades. No hace falta otra alta por color, ni se afirma que toda aceituna verde sea Gordal. |

El hallazgo del entrecot se basa en cruzar la fuente de la identidad existente con el uso culinario documentado: es una correspondencia editorial. Lomo de ternera no era una ficha sin origen: el lote 07 la documentó con **USDA 173823, Veal, loin, separable lean and fat, raw**. Se mantiene distinta y no se renombra automáticamente a lomo bajo de vacuno.

La [lista actualizada](ingredient-master-coverage-checklist-batch-32.md), el [resultado estructurado](ingredient-master-coverage-batch-32.json) y las [decisiones del lote](ingredient-master-expansion-batch-32.json) conservan claves, fuentes y límites. Los balances anteriores permanecen intactos.

## Procedencia recuperada

Se revisó el historial Git del storefront. El commit `07eb1d6` ya contenía listas de nombres con anotaciones de alérgenos: Atún, Anchoas, Crema de leche, Nata doble y Fibra de achicoria, entre otros. Las maestras de `55c7924` y `5756ac6` conservaron siete fichas relevantes sin proveedor, SKU, porcentaje graso ni elaboración. Ese historial no permite atribuirles ahora una formulación concreta.

La evidencia queda en [procedencia del lote 32](ingredient-master-provenance-batch-32.json): commits completos, huellas de archivos, extractos con línea y filas originales. También se comprobaron directamente los registros USDA 170839 y 173823 en el CSV histórico local. La fuente de variedades del lote 15, [Manzanilla Olive](https://www.manzanillaolive.es/es/creciendo/variedades-aceitunas-manzanilla-olive/), se recuperó junto con la ficha de Gordal verde.

La apertura directa de Goia agotó el tiempo; se recuperó el contenido indexado y se contrastó el corte bajo con Pozas. Algunas páginas de Asturiana y Sosa no respondieron en esta revisión; no se presentan esos accesos como nuevas comprobaciones completas. Se conservan las fuentes y conclusiones pendientes del lote 31.

## Seis necesidades que siguen abiertas

- **Boquerón:** Anchoas antiguo no documenta especie ni presentación fresca, en salazón o en vinagre. La equivalencia de nombres de una especie no determina el estado del producto.
- **Atún en conserva:** Atún antiguo no documenta preparación ni líquido de cobertura.
- **Nata para cocinar y nata para montar:** Crema de leche y Nata doble no documentan composición ni materia grasa. Nata montada es una preparación posterior, no prueba de equivalencia con nata líquida.
- **Tomate triturado y tomate frito:** Tomate, situado en Salsas, no documenta elaboración. La categoría no permite adjudicarle una de esas preparaciones.

Además, **Fibra de achicoria / Inulina de achicoria** sigue pendiente fuera del recuento de las 248 necesidades. El nombre en la lista original no basta para confirmar inulina frente a otras fibras de esa raíz. Tampoco se ha reinterpretado el genérico Aceitunas con hueso. Continúan las cuatro asignaciones provisionales y las equivalencias anteriores.

Para resolver estos puntos hace falta aclarar el significado pretendido de los nombres antiguos o recuperar una ficha de composición. La ausencia de esa información no se convierte en una aprobación de nuevas equivalencias.

## Búsqueda y uso

Esta entrega no modifica el buscador. Las consultas amplias **«entrecot de vacuno»** y **«aceitunas verdes»** no encuentran necesariamente las correspondencias elegidas con esos términos. Para consultarlas, buscar **«Ojo de lomo de vacuno»** y **«Aceituna Gordal sevillana»**. No se añaden alias universales que puedan confundir cortes, variedades o preparaciones. Las correcciones de gambas y plátano del lote 31 permanecen.

## Validación

**11 pruebas del importador aprobadas.** Se añadió soporte explícito para un lote editorial sin altas: registra su auditoría, se reaplica sin reescribir la maestra y detecta cambios posteriores en sus decisiones. Las pruebas también verifican que no pueda añadir identidades bajo ese modo ni ocultar cambios en la base histórica.

Los **32 lotes son idempotentes**. Se comprobaron huellas de maestra, pendientes, claves protegidas, ambas taxonomías, proyección del backend, balances anteriores y todas las auditorías previas. Se mantienen las 3.694 fichas y sus asignaciones, 14 categorías y familias, 25 apartadas y 11 redirecciones. [Controles verificables](ingredient-master-expansion-checks-batch-32.json).

No se recompila la aplicación porque no cambian su interfaz ni sus datos de ejecución. La última compilación funcional sigue siendo la del lote 31, `main.6220603a.js`. La revisión visual, traducciones, imágenes, formulaciones y aprobación editorial continúan pendientes. No se abre el navegador integrado durante el diagnóstico de cierres; no se acredita prueba visual, integración con base de datos ni comprobación del Sunmi.

Solo archivos locales. Sin publicación, escrituras en bases de datos ni altas en inventarios. No corresponde un aviso para negocios sobre esta revisión interna.

Reproducción desde la raíz: `node output/ingredient-expansion/batch32-2026-09-25/check-batch32.cjs`. Desde el storefront: `node scripts/expand-ingredient-master.cjs --batch=32 --apply` y `node --test scripts/ingredient-expansion.test.cjs`.
