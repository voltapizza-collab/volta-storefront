# Limpieza de la lista maestra de ingredientes

> Informe histórico de la limpieza ortográfica. La continuación del 17 de septiembre consolida identidades, añade alias y separa las fichas ambiguas: [resultado actualizado](ingredient-master-identity-cleanup.md). Los recuentos y tareas pendientes de este documento corresponden al cierre de la primera revisión.

16 de septiembre de 2026. Cambio preparado en el código local del storefront; pendiente de publicación. La lista se utiliza en «Añadir ingrediente» de Global Manager. No se han modificado ingredientes ya guardados en la base de datos ni traducciones de los negocios.

## Resultado

| Revisión | Resultado |
| --- | --- |
| Fichas conservadas | 1.140 |
| Categorías conservadas | 14 |
| Fichas con cambios | 264 |
| Nombres principales corregidos | 263 |
| Nombres que contenían `�` | 185 antes; 0 después |
| Nombres con caracteres de control | 1 antes; 0 después |
| Nombres principales distintos tras limpiar | 1.139 |
| Identificadores, relaciones de categoría, alérgenos y estados de revisión | Conservados |

Se han corregido los nombres principales, su campo español y los alias asociados. Las tildes, la ñ y los diacríticos internacionales se conservan. Todos los textos de la lista están guardados en UTF-8 y normalizados a NFC. Los nombres culinarios propios, marcas y denominaciones regionales se conservan; las expresiones genéricas adaptadas al español mantienen alias válidos para su búsqueda.

| Antes | Después |
| --- | --- |
| Jam�n serrano | Jamón serrano |
| Aceite de c�rtamo | Aceite de cártamo |
| Pi�a | Piña |
| Extracto de oregano | Extracto de orégano |
| Rabano | Rábano |
| Cr�me Fra�che | Crème fraîche |
| Chouri�o | Chouriço |
| Requeij�o cremoso | Requeijão cremoso |
| Past1rma | Pastırma |
| bejna | Ġbejna |
| Shichimi tMgarashi | Shichimi togarashi |
| Tomates fresco | Tomates frescos |

«BBQ» sigue siendo un alias de «Salsa barbacoa»; «Popcorn», de «Palomitas de maíz»; «Couscous», de «Cuscús». Se elimina el alias ortográficamente incorrecto «Mozzarella rayada», conservando «Mozzarella rallada» y los otros alias válidos. Las claves históricas como `jam_n_serrano` siguen siendo identificadores internos; no se regeneran a partir del nombre corregido.

## Duplicados y revisión semántica

Se confirma un grupo duplicado: **Champiñones blancos**, con las claves `champi_ones_blancos` y `champi_nes_blancos`. Se conservan ambas fichas para que una futura consolidación compruebe las referencias a cada identidad antes de retirarla.

Además, se documentan **22 grupos de posibles equivalencias**. Incluyen «res/vacuno», «linaza/semillas de lino», «alubias rojas/judías rojas» y «cebolla morada/roja de Tropea». Son candidatos, no una confirmación automática: algunos nombres pueden representar otra variedad, especie, preparación o grado de madurez. No se fusionan fichas por compartir una palabra o por normalizarse a la misma búsqueda.

La revisión también registra ocho grupos de clasificación y siete grupos de identidad que necesitan trabajo específico: por ejemplo, proteínas vegetales dentro de hierbas y especias, mermelada de tocino en frutas, «Queso duro blando» y mezclas de nombres como «Cocodrilo / caimán». Estos casos quedan identificados; la limpieza ortográfica no modifica categorías ni certifica identidad, composición o alérgenos. Todos los estados de revisión semántica originales se conservan.

Consulta el [registro inicial de casos pendientes](ingredient-master-phase1-review.json), conservado con las claves exactas y el motivo de cada revisión. Las [decisiones posteriores](ingredient-master-review.json) registran el resultado de la continuación.

## Trazabilidad y fuentes

El [registro completo de cambios](ingredient-master-phase1-audit.json) incluye el commit y SHA-256 de la lista original, cada clave afectada, sus nombres y alias anteriores y posteriores, y 14 fuentes para contrastar grafías internacionales.

Se utilizaron fuentes de organismos públicos, turismo oficial y productores: [Údené mäso — Slovakia Travel](https://slovakia.travel/vydajte-sa-s-nami-objavovat-chute-slovenskych-regionov), [Cârnăciori — catálogo AFIR](https://cpac.afir.info/Produs?id=99), [Ġbejna — especificación MCCAA](https://mccaa.org.mt/media/3472/2-website_%C4%A1bejna-product-specification.pdf), [Pastırma — GoTürkiye](https://goturkiye.com/tr/kayseri/tat), [Gräddost — Arla](https://www.arla.se/produkter/graddost/), [Piton Maïdo — Fromages de La Réunion](https://fromagesdelareunion.re/produit/piton-maido/) y [Västerbottensost — productor](https://vasterbottensost.com/en/). Las demás fuentes figuran en el registro completo. Su uso confirma la grafía, no la equivalencia entre fichas.

## Control de calidad

`npm run check:ingredients` verifica codificación UTF-8 válida, NFC, ausencia de caracteres dañados o de control, límites de longitud, nombres y alias, claves únicas, traducción española coherente y correspondencia entre categorías. También rechaza duplicados nuevos; la excepción histórica de champiñones blancos queda documentada expresamente. El control se ejecuta automáticamente antes de cada compilación de producción.

Comprobada la conservación de las 1.140 claves y de todos los campos ajenos a nombres, traducción española y alias. Las 1.140 fichas pasan el validador de entrada real del backend usando nombres de prueba para los otros idiomas, sin crear registros ni solicitar traducciones.

Validación final: 16 pruebas de interfaz y 25 pruebas de backend correctas; 13 búsquedas sobre la lista real usando las funciones del frontend correctas, incluyendo `jamon`, `pina`, `creme fraiche`, `chourico`, `requeijao`, `kielbasa`, `pastirma`, `roget al`, `gbejna`, `bbq` y `popcorn`. Compilación de producción completada correctamente y `git diff --check` sin errores. La compilación muestra únicamente el aviso de antigüedad de la base de navegadores Browserslist; no se actualizaron dependencias para este cambio.

## Publicación

El cambio se incorpora al publicar el storefront. Los nombres de ingredientes que ya existan en la base de datos requieren una revisión o migración posterior; este cambio solo limpia la fuente maestra de altas. La ampliación a 3.000–3.420 ingredientes sigue siendo una fase separada.

La corrección afecta al selector de la lista maestra de Global Manager. No cambia una función del backoffice de los negocios ni sus fichas ya guardadas, por lo que no se añade una notificación general a los negocios sobre una actualización de su catálogo.
