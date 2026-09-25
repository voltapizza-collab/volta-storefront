# Ampliación de ingredientes para pizzerías-restaurantes

Actualización del 25 de septiembre tras el [lote 36](ingredient-master-expansion-report-batch-36.md): **3.728 fichas locales**, con las **248 necesidades básicas localizadas mediante una opción explícita**. Se incorporaron 14 panes regionales y bases, conservando las 3.714 fichas previas. Prioridad actual del usuario: cerrar la expansión en el lote 36, auditar y guardar un commit local. No iniciar nuevas altas. Equivalencias históricas pendientes, sin fusiones automáticas. Véase [el cierre](ingredient-master-closure-2026-09-25.md). Sin publicación ni escrituras en inventarios.

Propuesta de organización del 18 de septiembre de 2026. Base comprobada: 3.014 fichas en `src/data/ingredientMasterSource.json`, repartidas en las 14 categorías actuales. Objetivo de investigación: aproximadamente 5.000 fichas, con 1.986 altas netas necesarias para alcanzar esa cifra.

Las secciones siguientes conservan la propuesta y los recuentos de partida del 18 de septiembre. La organización aplicada después se documenta en [la implementación de las 14 familias](../../volta-backend/docs/ingredient-taxonomy-v2-implementation.md); el avance por lotes, en [el estado acumulado](ingredient-master-expansion.md).

## Evaluación de las 14 categorías

Las categorías permiten continuar la ampliación conservando la estructura actual. La mayoría representa grupos reconocibles para una cocina: carnes, charcutería, pescado, verduras, quesos, setas y salsas.

La distribución tiene una limitación para restaurantes: distingue tres grupos muy específicos de cocina dulce —aromas y extractos, cremas dulces y endulzantes— mientras que panes, pastas, cereales, legumbres, huevos y otros lácteos comparten Otros. Por ello, se propone mantener las 14 categorías como primer nivel y añadir familias como segundo nivel de organización. No se considera que la clasificación actual sea definitiva para toda la restauración.

## Reparto propuesto

| Categoría existente | Fichas actuales | Familias que debe cubrir la investigación |
| --- | ---: | --- |
| Aceites, grasas y vinagres | 77 | Aceites vegetales, mantequillas, grasas animales, grasas vegetales y vinagres culinarios. |
| Aromas y extractos | 57 | Extractos, aguas aromáticas, esencias alimentarias y concentrados aromáticos. |
| Carnes | 127 | Vacuno, cerdo, cordero, cabrito, aves, conejo y caza; cortes anatómicos y preparaciones cárnicas diferenciadas. |
| Cremas dulces | 37 | Cremas pasteleras, cremas para untar endulzadas, ganaches y rellenos dulces usados como ingredientes. |
| Embutidos | 128 | Embutidos y charcutería: jamones, salchichones, chorizos, salamis, mortadelas, salchichas y especialidades regionales. |
| Endulzantes | 67 | Azúcares, mieles, melazas, siropes para endulzar y otros edulcorantes de uso culinario. |
| Frutas | 275 | Frutas y variedades identificadas, frutas desecadas y elaboraciones de fruta con identidad culinaria propia. |
| Hierbas y especias | 110 | Hierbas, especias y mezclas de especias documentadas. |
| Otros | 331 | Panes, masas, pastas, cereales, harinas, legumbres, frutos secos, semillas, huevos, lácteos distintos del queso, proteínas vegetales, algas y auxiliares culinarios. Véase el desglose siguiente. |
| Pescados y mariscos | 856 | Pescados, crustáceos, moluscos, huevas y elaboraciones pesqueras diferenciadas. Priorizar huecos de uso habitual en restaurantes. |
| Quesos | 438 | Variedades de quesos frescos, de pasta blanda, de pasta semidura o dura, azules y especialidades regionales documentadas. |
| Salsas | 157 | Salsas para pasta, carnes, pescado, hamburguesas y ensaladas; aderezos y condimentos preparados. |
| Setas | 62 | Setas culinarias identificadas, trufas y elaboraciones diferenciadas. |
| Verduras | 292 | Hortalizas de hoja, raíz, bulbo, tallo y fruto; tubérculos y elaboraciones vegetales identificadas. |
| **Total** | **3.014** | **Se conservan exactamente las categorías existentes.** |

## Familias propuestas dentro de Otros

1. **Panes y masas:** panes de hamburguesa, brioche, chapata, baguette, molletes, focaccias, panes planos y masas utilizadas como ingredientes.
2. **Pastas y fideos:** pasta larga, corta, para sopa, láminas, rellena y fideos; formatos como linguine, rigatoni, penne, fusilli o ravioli, con composición cuando sea necesaria para distinguir la identidad.
3. **Arroces y cereales:** variedades de arroz, otros cereales en grano y productos derivados diferenciados.
4. **Harinas, sémolas y almidones:** materias primas para panes, masas, pasta, rebozados y espesado.
5. **Legumbres:** especies, variedades y preparaciones diferenciadas de legumbres.
6. **Frutos secos y semillas:** frutos secos, semillas y pastas puras de estos ingredientes.
7. **Huevos y ovoproductos:** huevos por especie, claras, yemas y ovoproductos diferenciados.
8. **Lácteos distintos del queso:** leches, natas, yogures y derivados que no pertenecen a Quesos, Cremas dulces o Aceites, grasas y vinagres.
9. **Proteínas y alternativas vegetales:** tofu, tempeh, seitán y preparados vegetales identificados.
10. **Algas:** algas culinarias identificadas y elaboraciones diferenciadas.
11. **Fondos, caldos y bases de cocina:** bases que sirven como ingrediente de una receta y no son por sí mismas una salsa terminada.
12. **Auxiliares culinarios:** levaduras, gelificantes, estabilizantes y otros ingredientes técnicos de uso alimentario documentado.

## Reglas de clasificación e identidad

- Cada ficha tiene una categoría principal y, cuando se implemente este segundo nivel, una familia. Los usos posibles —hamburguesa, pasta, pizza o ensalada— podrán servir para buscar sin duplicar la ficha.
- Conservar las claves e identidades actuales. Las anomalías históricas se registran para revisión; no se reclasifican automáticamente durante una ampliación.
- Las traducciones, sinónimos regionales y variantes ortográficas son alias. No suman ingredientes. Verificar equivalencias antes de consolidarlos.
- Los cortes anatómicos sí pueden representar ingredientes distintos: solomillo, costillar o carrillera. Cortar el mismo producto en dados, rodajas o tiras no genera automáticamente una identidad nueva.
- No multiplicar registros mediante combinaciones automáticas de tamaño, envase, marca, formato de corte o certificación. Incorporar diferencias de composición o elaboración cuando estén documentadas y sean relevantes.
- Desambiguar los nombres: «Pluma de cerdo» y «Pasta tipo pluma» deben identificarse de forma diferente; un alias genérico compartido no debe resolver silenciosamente a uno de ellos.
- Un pan o una pasta pueden ser ingredientes aunque sean productos elaborados. Una hamburguesa completa o un plato de pasta con salsa pertenecen a la receta del restaurante, salvo que se esté documentando expresamente un preparado comprado como ingrediente.
- Diferenciar una pasta pura de frutos secos, encuadrada en Otros, de una crema dulce endulzada. Diferenciar nata de mantequilla y queso. Diferenciar fondo o caldo de salsa terminada.
- Mantener las fuentes por ficha y los estados de revisión. La inclusión en el vocabulario no aprueba automáticamente traducciones, imágenes, formulaciones ni alérgenos.

## Orden vigente — ampliación primero, equivalencias al final

Indicación del usuario del 25 de septiembre: continuar con la expansión por lotes y dejar las equivalencias históricas para el final.

1. Investigar nuevas identidades útiles y contrastarlas con la maestra completa antes de incorporarlas.
2. Entregar lotes con fuentes, conservación de claves y asignaciones, sincronización local y controles reproducibles.
3. Apartar las candidatas cuya novedad dependa de resolver un nombre histórico; no frenar las altas inequívocas.
4. Al terminar la expansión, revisar conjuntamente las equivalencias históricas, incluida fibra/inulina. La revisión editorial, visual y de formulación sigue pendiente antes de publicación.

## Orden de trabajo original (conservado como antecedente)

1. Auditar los huecos de panes y masas, formatos de pasta, carnes y cortes, y salsas y bases de cocina.
2. Investigar incorporaciones por familias, contrastando cada candidato con las 3.014 fichas y sus alias.
3. Completar queso y charcutería con variedades útiles que todavía falten; ampliar las otras categorías según huecos documentados.
4. Entregar lotes con altas netas, exclusiones y fuentes. Comprobar el total acumulado sin imponer cuotas artificiales por categoría.
5. Validar exactamente 14 categorías, claves históricas, ausencia de duplicados, coherencia entre frontend y backend y trazabilidad de cada alta.

Alcanzar 5.000 depende de documentar suficientes identidades útiles y distintas. Las cantidades por familia se fijarán después de deduplicar los candidatos.

## Referencias de organización consultadas

- Catálogo actual y `docs/ingredient-master-expansion.md`, como base de recuentos, identidad y alcance de las 14 categorías.
- [De Cecco: formatos de pasta de sémola](https://www.dececco.com/es_es/products/pasta-de-semola/), como referencia de formatos y familias de pasta.
- [Europastry: panes tradicionales](https://europastry.com/es/es/productos/pan/tradicional/) y [catálogo PanBurger](https://europastry.com/es/wp-content/uploads/sites/5/2025/05/PanBurger_DIC_2024.pdf), como referencias de familias de pan. Las referencias comerciales o los envases no se contarán como identidades distintas por sí solos.
