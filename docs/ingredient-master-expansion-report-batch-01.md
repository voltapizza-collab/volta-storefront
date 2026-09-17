# Ampliación de la lista maestra — primer lote

17 de septiembre de 2026. **Ampliación iniciada: 254 fichas nuevas y 1.358 fichas seleccionables en total**, dentro de las mismas 14 categorías. La meta sigue siendo al menos 3.000; faltan 1.642. Este informe describe el primer lote, no el cierre de la ampliación.

Los cambios están preparados localmente. No se han publicado ni se ha escrito en la base de datos.

## Qué se ha incorporado

Se han añadido materias primas, especies, cortes, tipos de queso y preparaciones documentadas que faltaban en la lista. Entre ellas están limón, lentejas, harina de garbanzo, queso Manchego, lubina, níscalo y extracto de café.

Cada ficha nueva tiene una referencia de origen identificable. Las 1.104 fichas anteriores se mantienen intactas. Las 25 fichas ambiguas de la limpieza siguen conservadas aparte y no se cuentan como nuevas altas.

| Categoría existente | Antes | Añadidos | Ahora |
| --- | ---: | ---: | ---: |
| Aceites, grasas y vinagres | 54 | 10 | 64 |
| Aromas y extractos | 17 | 7 | 24 |
| Carnes | 65 | 23 | 88 |
| Otros | 137 | 42 | 179 |
| Cremas dulces | 24 | 5 | 29 |
| Embutidos | 95 | 9 | 104 |
| Endulzantes | 25 | 11 | 36 |
| Frutas | 53 | 20 | 73 |
| Salsas | 146 | 6 | 152 |
| Verduras | 147 | 41 | 188 |
| Hierbas y especias | 96 | 4 | 100 |
| Pescados y mariscos | 58 | 27 | 85 |
| Quesos | 142 | 37 | 179 |
| Setas | 45 | 12 | 57 |
| **Total** | **1.104** | **254** | **1.358** |

Se asigna exactamente una categoría a cada ingrediente. Cereales, legumbres secas, harinas y lácteos que no son quesos se incorporan a Otros, siguiendo la estructura disponible. Las semillas usadas como condimento van a Hierbas y especias; los plátanos de cocinar van a Verduras por criterio culinario.

## Identidades y alias

El lote contiene **83 alias adicionales**, que no aumentan el recuento. Por ejemplo, «Aguaymanto» lleva a Uchuva, «Colín de Alaska» a Abadejo de Alaska y «Aceite de palta» a Aceite de aguacate.

Se conserva la ortografía española con tildes y caracteres Unicode. No se han generado traducciones a otros idiomas. Redactar el nombre español de una identidad documentada en una fuente inglesa no crea una segunda ficha para el nombre inglés.

Antes de incorporar el lote se compararon nombres y alias normalizados, singular/plural y posibles equivalencias de una taxonomía de descubrimiento. Dos coincidencias amplias se revisaron expresamente: guinda frente a cereza genérica y lechuga de hoja roja frente a lechuga genérica. La fuente distingue el tipo específico; no se trató la pertenencia a una misma familia como una sinonimia exacta.

No se crean fichas adicionales por marca, tamaño de envase, certificación, idioma o una variación ortográfica. Sí se distinguen productos culinarios documentados, como bacalao fresco y salado, harina y grano, o extracto y pasta de vainilla.

## Fuentes empleadas

| Fuente | Uso en este lote |
| --- | --- |
| [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets/) | Identidades de alimentos y preparaciones, con su identificador FDC. Se usa SR Legacy como catálogo de referencia; no se incorporan datos nutricionales. Datos de dominio público [CC0](https://fdc.nal.usda.gov/api-guide/). |
| [Secretaría General de Pesca / BOE 2026](https://www.boe.es/buscar/act.php?id=BOE-A-2026-12598) | Nombres comerciales y especies de pescado y marisco; cada alta conserva su nombre científico. |
| [Mercasa: quesos](https://www.mercasa.es/publicaciones/alimentacion-en-espana/leche-y-productos-lacteos/quesos/) | Tipos y denominaciones de quesos españoles; una ficha no certifica un producto comercial. |
| [Comunidad de Madrid: setas](https://www.comunidad.madrid/salud/setas-frescas-silvestres-comercializables) | Nombre de la seta y especie correspondiente. |
| [Nielsen-Massey](https://nielsenmassey.com/vanillas-and-flavors/) | Existencia y distinción de extractos, pasta y vainas de vainilla, sin duplicar por marca. |
| [Sosa Ingredients](https://www.sosa.cat/categoria-producto/azucares-tecnicos/) | Endulzantes de uso culinario. |
| [The Spice House](https://www.thespicehouse.com/collections/all) | Cardamomo negro. |

La taxonomía de Open Food Facts se consultó como ayuda para detectar posibles equivalencias. No se importó masivamente a la lista maestra. Los conjuntos descargados son material de investigación, no un recuento de ingredientes nuevos aprobados.

## Estado de revisión

Las altas conservan los estados NEEDS_REVIEW y MISSING para revisión semántica e imagen, como las fichas anteriores. Los valores de alérgenos utilizan el vocabulario actual de Volta y siguen pendientes de contrastar con el producto o formulación concreta; una lista vacía no certifica ausencia de alérgenos. La investigación de identidad no aprueba automáticamente traducciones, imágenes ni formulaciones.

## Comprobaciones

- Las 1.358 fichas pasan el validador de caracteres, nombres, alias y categorías.
- Se mantienen exactamente las 14 categorías actuales y no hay nombres o alias exactos compartidos entre fichas seleccionables.
- Las 254 altas tienen evidencia de origen y coinciden con el lote editorial.
- Las 1.104 fichas anteriores coinciden íntegramente con la reconstrucción de la auditoría de limpieza.
- El normalizador real del backend acepta toda la lista; las 25 fichas ambiguas siguen bloqueadas para nuevas altas.
- 18 pruebas de interfaz y semántica aprobadas; compilación de producción aprobada.
- No se han generado traducciones, publicado cambios ni escrito en la base de datos.

Las comprobaciones del backend usan nombres sintéticos en los idiomas requeridos, únicamente en memoria: no solicitan ni guardan traducciones.

## Archivos y continuación

- [Catálogo legible de las 254 incorporaciones, con alias y fuentes](ingredient-master-expansion-catalogue.md).
- [Lote editorial con evidencias y decisiones](ingredient-master-expansion-batch-01.json).
- [Auditoría y recuentos](ingredient-master-expansion-audit.json).
- [Comprobación completa](ingredient-master-expansion-checks.json).
- [Lista maestra actualizada](../src/data/ingredientMasterSource.json).

La ampliación continúa pendiente hasta alcanzar al menos 3.000 identidades distintas. El siguiente lote deberá pasar la misma revisión de identidad, nombre español, evidencia, alias y asignación a una de las 14 categorías. No se contabilizará como ingrediente un candidato encontrado en una fuente hasta incorporarlo al maestro.

Para comprobar el lote sin escribir se puede ejecutar «node scripts/expand-ingredient-master.cjs». El modificador «--apply» aplica exclusivamente el lote editorial: no importa fuentes externas automáticamente. El validador «npm run check:ingredients» también se ejecuta antes de compilar.

La entrega afecta a la selección interna de Global Manager. No se anuncia un cambio de inventario a los negocios porque no se han incorporado ingredientes a su base ni alterado sus pantallas del backoffice.
