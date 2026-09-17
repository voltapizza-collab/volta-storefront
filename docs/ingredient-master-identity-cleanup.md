# Limpieza de identidades y alias de ingredientes

> Cierre histórico de la limpieza. Después se inició la [ampliación de la lista maestra](ingredient-master-expansion.md): 254 incorporaciones y 1.358 fichas seleccionables, siempre dentro de las 14 categorías. Las 25 fichas pendientes de este informe siguen aparte.

17 de septiembre de 2026. Continuación de la [limpieza ortográfica inicial](ingredient-master-phase1.md). Cambios preparados y comprobados en los repositorios locales; sin publicación ni escrituras en la base de datos.

## Resultado

| Concepto | Resultado |
| --- | ---: |
| Fichas originales | 1.140 |
| Fichas seleccionables para nuevas altas | 1.104 |
| Registros duplicados consolidados | 11, en 10 grupos |
| Fichas conservadas pendientes de identificar | 25 |
| Alias añadidos a las fichas conservadas | 93 |
| Fichas con categoría corregida | 38 |
| Fichas conservadas con algún cambio | 103 |
| Categorías existentes | 14 |
| Ingredientes nuevos / traducciones generadas | 0 / 0 |

**1.104 + 25 + 11 = 1.140**: todas las fichas de partida quedan localizadas. Los 11 registros consolidados están conservados íntegramente en la auditoría y sus claves antiguas apuntan a la ficha superviviente. No son 11 ingredientes nuevos.

La cifra de 1.104 describe las fichas actualmente seleccionables, sin nombres ni alias exactos repetidos entre identidades. No certifica que toda la revisión culinaria esté terminada: se mantienen los estados de revisión originales y quedan 25 casos explícitos pendientes.

## Nombres, alias y traducciones

Se conservan las tildes, la ñ y los caracteres propios de cada idioma en UTF-8/NFC. El nombre mostrado y las traducciones guardan su ortografía; la búsqueda utiliza una forma normalizada que tolera omitir tildes y conserva letras no latinas. Las claves técnicas permanecen independientes del nombre visible.

Un ingrediente tiene una identidad. Los alias son otras formas de nombrarlo dentro de un idioma y las traducciones son sus nombres en otros idiomas; ninguno aumenta el recuento. Se conserva el formato actual de alias de la lista maestra. Esta entrega no crea un catálogo multilingüe nuevo ni genera traducciones.

| Nombre principal | Ejemplos de alias |
| --- | --- |
| Aguacate | Palta |
| Cacahuete | Maní, cacahuate |
| Piña | Ananá, ananás |
| Patatas | Papas |
| Remolacha | Betabel, betarraga |
| Carne molida de vacuno | Carne molida de res, carne picada de vacuno |

Las equivalencias regionales se aplican a la presentación concreta: «Piña caramelizada» conserva su ficha y sus alias calificados. Especies, variedades, madurez o preparaciones diferentes no se fusionan solo por compartir palabras. Se mantienen, por ejemplo, linaza molida y dorada, crimini y portobello, chipotle y salsa de chipotle, y maíz tierno frente al maíz genérico.

Referencias léxicas: [palta, ASALE](https://www.asale.org/damer/palta), [maní, RAE](https://dle.rae.es/man%C3%AD), [choclo, ASALE](https://www.asale.org/damer/choclo).

## Consolidaciones

Las fuentes apoyan las equivalencias terminológicas; consolidar dos fichas es una decisión editorial basada también en que no describen diferencias de presentación, variedad o preparación. Se comprobó que las fichas de cada grupo conservaban los mismos alérgenos y categoría antes de consolidarlas.

| Ficha conservada | Fichas absorbidas | Criterio y evidencia |
| --- | --- | --- |
| Champiñones blancos | Champiñones blancos; Champiñones de París | Mismo champiñón blanco de cultivo, sin diferencias de preparación indicadas. Se conservan los crimini y portobello como variedades/presentaciones diferenciadas. [Fuente 1](https://www.mushroomcouncil.com/mushroom-101/varieties/white-button/) [Fuente 2](https://lou-legumes.com/gammes/poeler-croquer/) |
| Extracto de pimentón | Extracto de paprika | Sinónimo del mismo extracto genérico. La equivalencia ya está recogida en seedIngredientSemanticFinalCleanup.js y en la base consultada (75 → pimenton_extract). [Fuente 1](https://www.mapa.gob.es/ministerio/pags/plataforma_conocimiento/alimentos/fichas%20de%20alimentos/condimentos/PIMENTON.pdf) |
| Carne molida de vacuno | Carne molida de res | Misma carne y misma preparación; res y vacuno son denominaciones regionales en este contexto culinario. [Fuente 1](https://www.larousse.com/en/dictionaries/spanish-english/res/33589) |
| Carne de vacuno | Res | Misma identidad genérica de carne bovina; se mantienen ternera y buey por separado. [Fuente 1](https://www.larousse.com/en/dictionaries/spanish-english/res/33589) |
| Alubias rojas | Judías rojas | Misma denominación genérica de alubia roja, sin variedad ni preparación diferente documentada. [Fuente 1](https://www.mapa.gob.es/ministerio/pags/biblioteca/hojas/hd_1948_23.pdf) |
| Semillas de lino | Linaza | Linaza es el nombre de la semilla de lino; se mantienen linaza molida y dorada por separado. [Fuente 1](https://dle.rae.es/linaza) |
| Cayena | Pimienta cayena | Dos nombres de la misma especia. No se incorpora chile genérico ni otras variedades. [Fuente 1](https://dle.rae.es/cayena) |
| Cebolla roja de Tropea | Cebolla morada de Tropea | Misma cebolla de Tropea, sin diferencia de preparación; roja y morada son variantes de denominación. [Fuente 1](https://www.consorziocipollatropeaigp.com/cipolla-rossa-di-tropea-calabria-igp.html) |
| Salsa peri-peri | Salsa piri piri | Variantes de escritura de la salsa genérica; ninguna ficha especifica receta, marca o intensidad distinta. No se fusionan formulaciones concretas. [Fuente 1](https://dictionary.cambridge.org/us/dictionary/english/peri-peri) |
| Pimientos al vinagre | Peperoni en vinagre | Peperoni es el nombre italiano de pimientos; ambas fichas indican la misma preparación en vinagre. No se equipara peperoncino picante ni encurtido sin medio especificado. [Fuente 1](https://dictionary.cambridge.org/us/dictionary/italian-english/peperone) |

## Clasificación

Se reutilizan las 14 categorías existentes y se conserva la categoría de origen para trazabilidad. Las 25 proteínas vegetales o preparados que figuraban como hierbas y especias pasan a Otros. También se corrigen lácteos, pescado, tomates, cuajo y otras ubicaciones incoherentes. No se han reevaluado ni cambiado alérgenos.

| Movimiento | Fichas |
| --- | ---: |
| HIERBAS_ESPECIAS → OTROS | 25 |
| CARNES → OTROS | 2 |
| CREMAS_DULCES → OTROS | 1 |
| FRUTAS → SALSAS | 1 |
| OTROS → PESCADOS_Y_MARISCOS | 4 |
| OTROS → QUESOS | 1 |
| QUESOS → OTROS | 1 |
| FRUTAS → VERDURAS | 2 |
| SALSAS → HIERBAS_ESPECIAS | 1 |

El detalle de las 38 reclasificaciones está en la [auditoría](ingredient-master-identity-audit.json), dentro del campo «reclassified».

## Fichas pendientes

Estas 25 fichas se conservan completas en [ingredientMasterPendingReview.json](../src/data/ingredientMasterPendingReview.json). Quedan fuera del selector para nuevas altas y el servidor rechaza sus claves mientras siga pendiente la identificación, incluso si llega una petición de una versión anterior del navegador. Los ingredientes ya guardados no se borran ni se desactivan.

Para resolver cada caso hace falta la definición original, una etiqueta, una receta, la especie o una fuente que permita decidir si es un alias de una ficha existente o un ingrediente diferente. No se divide una etiqueta ambigua en dos ingredientes sin confirmar lo que representa.

| Ficha | Qué falta aclarar |
| --- | --- |
| Cocodrilo / caimán | Combina animales distintos. Hace falta determinar el producto original antes de asignar referencias o crear fichas separadas. |
| Hierba luisa / lemongrass | El nombre regional puede representar Aloysia citrodora o Cymbopogon citratus; falta la especie. |
| Chapulines / grillos tostados | Combina saltamontes y grillos; no son alias del mismo ingrediente. |
| Queso duro blando | Descripción contradictoria; falta el nombre del queso. |
| Soppressata: salami sin curar | Sin curar puede significar sin nitritos añadidos o ausencia de curación; no se puede inferir equivalencia con otra soppressata. |
| Gamonal | Nombre no suficientemente identificado con una fuente de producto. |
| Keong khas Banyubiru | Falta distinguir especie de caracol y preparación regional. |
| Kingfish / pez rey del Golfo | Kingfish designa especies distintas por región; falta la especie. |
| Pljevlja / queso de oveja de Pljevlja | Falta confirmar el tipo de leche de esta ficha; no se deduce del origen geográfico. |
| Queso yuki | Denominación no suficientemente identificada; falta productor o tipo de queso. |
| Queso tasty | Tasty puede ser una denominación comercial de cheddar maduro; falta especificación para contar una identidad distinta. |
| Picante | Es una propiedad, no identifica una salsa concreta. |
| Salsa de hueso | No se conoce el producto, la especie ni la preparación a que se refiere. |
| Salsa K-Ssamjang | Falta confirmar si K-Ssamjang es una receta o marca diferenciada de ssamjang. |
| Vinaza roja | Falta identificar si se refiere a lías de fermentación, una salsa u otro producto. |
| Rocket maldivo | Falta identificar la planta y el significado de la denominación regional. |
| Coriandro | Puede referirse a la planta, sus hojas o sus semillas. No se une a cilantro ni a semillas de cilantro sin conocer la parte usada. |
| Salsa Tum | Probable variante de toum; las fichas discrepan en los alérgenos heredados. Falta receta para consolidar. |
| Crema fresca | Falta confirmar si es nata sin fermentar o crème fraîche fermentada. |
| Mermelada / compota de grosella | Mermelada y compota son preparaciones distintas. Falta identificar cuál representa la ficha. |
| Ostiones | El nombre regional puede designar ostras o vieiras; hace falta país y especie. |
| Boletus | Denominación demasiado amplia para distinguirla de porcini; falta especie o mezcla. |
| Scungilli / caracola | Falta especie o presentación que permita distinguirlo de la ficha genérica caracola. |
| Cebolla de verdeo | Falta especie o madurez que permita distinguirla de cebolleta. |
| Peperoni encurtidos | Falta indicar si son pimientos en vinagre o fermentados, y si hay una variedad distinta. |

## Compatibilidad y datos existentes

Se consultó la base configurada únicamente en lectura: 132 registros, 128 del sistema. Había referencias a ingredientes afectados en recetas y existencias; por eso no se ejecutó ninguna fusión sobre la base. Esta consulta no acredita el estado de otros entornos.

Las 11 claves consolidadas se reconocen tanto en el selector como en el servidor. El servidor resuelve una clave antigua hacia la ficha superviviente y comprueba nombres y alias para evitar nuevas altas duplicadas. Las claves de compatibilidad no se guardan como nombres visibles. No se han cambiado identificadores numéricos, recetas, existencias ni traducciones de los negocios.

Los archivos de frontend y backend deben publicarse de forma coordinada, con las reglas del backend disponibles antes de actualizar el selector. No hay migración de base de datos. Esta entrega está preparada localmente y no se ha publicado. Es una mejora interna de Global Manager; no se añade un aviso a los administradores de las pizzerías porque esta entrega no cambia su inventario ni sus pantallas del backoffice.

## Comprobaciones

- Validador de la lista maestra: UTF-8/NFC, textos, categorías, alias, claves y referencias, sin duplicados exactos en la lista seleccionable.
- Backend: 28 pruebas de incorporación y semántica aprobadas.
- Frontend: 18 pruebas de incorporación y semántica aprobadas.
- Compilación de producción del frontend aprobada.
- Las 1.104 fichas activas pasan la normalización real del backend; las 25 pendientes se rechazan y las 11 claves antiguas se resuelven correctamente.
- Las reglas de frontend y backend coinciden. Las 1.140 fichas originales están contabilizadas; se conservan alérgenos, estados, procedencia y traducciones distintas del español.

La comprobación completa utiliza traducciones sintéticas únicamente como datos de prueba, sin guardarlas ni consultar proveedores. No consume traducciones ni realiza escrituras en la base.

## Archivos de revisión

- [Lista maestra seleccionable](../src/data/ingredientMasterSource.json).
- [Inventario pendiente con motivos](../src/data/ingredientMasterPendingReview.json).
- [Auditoría con antes/después, fichas absorbidas y fuentes](ingredient-master-identity-audit.json).
- [Decisiones sobre los grupos señalados en la primera revisión](ingredient-master-review.json).
- [Revisión inicial conservada](ingredient-master-phase1-review.json).

El siguiente trabajo de limpieza es resolver las 25 definiciones pendientes. La ampliación hacia 3.000 ingredientes diferentes pertenece a una fase posterior y todavía no se ha iniciado.
