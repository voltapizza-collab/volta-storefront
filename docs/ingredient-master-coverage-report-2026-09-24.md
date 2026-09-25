# Cobertura práctica de las 14 familias — 24 de septiembre de 2026

**Cambio de prioridad aprobado por Luigi: cerrar huecos cotidianos y resolver identidades antes de seguir ampliando especialidades para alcanzar 5.000.** El catálogo conserva 3.683 fichas. Esta revisión no añade, elimina ni reclasifica ingredientes.

Se ha contrastado una lista editorial inicial de **248 necesidades de ingredientes** para una pizzería y un restaurante general en España: **227 localizadas**, **10 con alcance pendiente** y **11 sin ficha específica localizada**. Una necesidad puede corresponder a una o varias fichas. Estos resultados no son un porcentaje de cobertura de toda la restauración ni una certificación de catálogo completo.

## Método y límites

La lista se seleccionó para esta revisión y se contrastó con los nombres y alias de toda la maestra, también fuera de la familia esperada. Las correspondencias no exactas se revisaron expresamente y se conservan con las claves encontradas. La búsqueda de palabras relacionadas solo ayudó a investigar: no se usa para aprobar coincidencias. La presencia de una ficha genérica no prueba que represente una elaboración concreta.

El alcance toma como orientación el [surtido de hostelería de Makro](https://www.makro.es/productos), los [formatos de pasta de De Cecco](https://www.dececco.com/es_es/products/) y los [panes de Europastry](https://europastry.com/es/es/productos/pan/tradicional/). No se ha importado todo su catálogo ni se equiparan referencias comerciales con identidades. La lista es una primera referencia explícita, ampliable con menús y necesidades reales de los negocios.

Evidencia local: [lista de las 248 comprobaciones](ingredient-master-coverage-checklist-2026-09-24.md) y [resultados con claves y familias](ingredient-master-coverage-2026-09-24.json). Reproducción: `node ../output/ingredient-coverage-2026-09-24/audit.cjs` desde `volta-storefront`.

## Balance por familia

«Localizadas» se refiere exclusivamente a esta lista básica. «Revisar» indica una ficha cercana cuyo alcance no permite dar la necesidad por cubierta. «Sin ficha» es un candidato a investigar, no un alta autorizada por el recuento.

| Familia | Fichas totales | Localizadas / revisadas | Revisar alcance | Sin ficha específica | Prioridad práctica |
| --- | ---: | ---: | ---: | ---: | --- |
| Carnes y aves | 136 | 14 / 20 | 1 | 5 | Completar cortes cotidianos |
| Embutidos y charcutería | 192 | 12 / 13 | 0 | 1 | Contrastar salchichón |
| Pescados y mariscos | 856 | 16 / 18 | 2 | 0 | Aclarar presentaciones, sin ampliar especies ahora |
| Quesos | 474 | 15 / 15 | 0 | 0 | Mantener; muestra básica localizada |
| Lácteos y huevos | 56 | 13 / 15 | 2 | 0 | Precisar las natas |
| Verduras, setas y algas | 423 | 23 / 24 | 1 | 0 | Aclarar aceitunas y nombres de tomate |
| Frutas | 303 | 16 / 16 | 0 | 0 | Revisar nombres de búsqueda |
| Legumbres y proteínas vegetales | 151 | 16 / 16 | 0 | 0 | Mantener; muestra básica localizada |
| Pastas, arroces y cereales | 194 | 17 / 18 | 0 | 1 | Documentar canelones sin relleno |
| Panes, masas y harinas | 138 | 19 / 21 | 2 | 0 | Resolver ficha conjunta de pan de hamburguesa/perrito |
| Frutos secos y semillas | 75 | 15 / 15 | 0 | 0 | Resolver cremas/pastas históricas antes de ampliar |
| Aceites, grasas y vinagres | 89 | 13 / 14 | 0 | 1 | Documentar margarina |
| Salsas, condimentos y bases | 406 | 22 / 26 | 2 | 2 | Aclarar tomate y documentar vinos como ingrediente |
| Repostería y auxiliares | 190 | 16 / 17 | 0 | 1 | Precisar café y revisar equivalencia de fibra/inulina |
| **Total** | **3.683** | **227 / 248** | **10** | **11** | **Un bloque conjunto de cierre de básicos** |

Aguacate aparece en la referencia de frutas pero se localiza en Verduras, setas y algas por clasificación culinaria. No se considera ausente ni se reclasifica. La revisión de cremas de frutos secos y fibra/inulina queda registrada aparte: no está incluida artificialmente en el recuento de 248 necesidades.

## Cola priorizada para el siguiente bloque

### 1. Once necesidades sin ficha específica localizada

- **Carnes: cinco.** Carrillera de cerdo, carrillera de vacuno, secreto, presa y pluma de cerdo. El catálogo de [Solobuey](https://www.solobuey.com/tienda/carnes/cerdo-iberico/) documenta secreto, presa, pluma y carrilleras ibéricas; [ElPozo](https://www.elpozo.com/productos/carrillada/) documenta carrillada de cerdo. Completar la fuente específica del corte de vacuno. Mantener la especie en el nombre: las coincidencias actuales de pluma son peces y pasta.
- **Charcutería: una.** Salchichón, presente en el [catálogo de COVAP](https://tienda.covap.es/catalogo/). Revisar composición y equivalencias con embutidos existentes antes de incorporar.
- **Pasta: una.** Canelones sin relleno. Hay evidencia de [placas de Gallo](https://www.pastasgallo.es/categorias-productos/placas/) y [cannelloni al huevo de De Cecco](https://www.dececco.com/es_es/product/cannelloni-n-100-alluovo/). Precisar formato y composición; no crear una ficha de plato terminado ni multiplicar por marca.
- **Grasas: una.** Margarina alimentaria. [Makro](https://www.makro.es/productos/lacteos) documenta su uso en el surtido hostelero. Concretar composición; no deducir ausencia de leche o alérgenos.
- **Bases: dos.** Vino blanco y vino tinto empleados como ingredientes. Solo aparecen sus vinagres, junto a vinos específicos como Marsala y Oporto. Completar evidencia de producto y familia; el uso para cocinar no crea por sí mismo una identidad nueva.
- **Repostería: una.** Café usado en elaboración. Existe Extracto de café, pero no una ficha que permita dar por cubiertos café soluble, molido o infusión. Precisar la forma realmente necesaria. [Nestlé Professional](https://www.nestleprofessional-latam.com/pe/recetas/tiramisu) documenta café en una elaboración de tiramisú; esa receta no sustituye la ficha de composición.

Estas once necesidades podrían resolverse mediante altas, equivalencias o una decisión de alcance. No constituyen once nuevas identidades confirmadas.

### 2. Diez necesidades que requieren aclarar fichas existentes

| Necesidad | Fichas relacionadas | Decisión pendiente |
| --- | --- | --- |
| Entrecot de vacuno | Lomo de ternera; Ojo de lomo de vacuno | Contrastar despiece y nombres regionales |
| Boquerón | Anchoas | Precisar fresco, curado o en vinagre |
| Atún en conserva | Atún | Precisar elaboración; no confundir con fresco |
| Nata para cocinar | Crema de leche; Nata doble | Precisar composición y uso |
| Nata para montar | Crema de leche; Nata doble; Nata montada | Distinguir nata líquida de preparación montada |
| Aceitunas verdes de mesa | Variedades Manzanilla/Gordal; verdes a la griega | Precisar estado y alcance del genérico |
| Pan para hamburguesa | Pan para hamburguesa o perrito caliente; Pan brioche | Revisar ficha conjunta y búsqueda |
| Pan para perrito caliente | Pan para hamburguesa o perrito caliente | Revisar ficha conjunta; no separar solo por forma |
| Tomate triturado | Tomate; Coulis de tomate; Concentrado de tomate | Precisar elaboración del genérico |
| Tomate frito | Tomate; Sofrito; Coulis de tomate | Precisar elaboración del genérico |

[Central Lechera Asturiana](https://www.centrallecheraasturiana.es/productos/nata/nata-para-cocinar/) distingue nata para cocinar y para montar. [Hida](https://hida.es/diferencias-entre-tomate-frito-triturado-y-sofrito/) distingue tomate triturado, frito y sofrito. Estas distinciones justifican revisar el alcance, no sobrescribir automáticamente fichas históricas.

### 3. Claridad de nombres y equivalencias

- **Tomate / Tomates frescos:** existe Tomates frescos en Verduras; el genérico Tomate está en Salsas. No falta tomate fresco, pero su nombre genérico resulta ambiguo. Resolver denominación y búsqueda conservando claves y redirecciones necesarias.
- **Fibra de achicoria / Inulina de achicoria:** la primera es histórica y carece de composición documentada; la segunda entró en el lote 30. Debí contrastar este posible solapamiento antes de esa alta. [Sosa](https://www.sosa.cat/producto/inulina-caliente/) identifica inulina como fibra de achicoria, pero también documenta [oligofructosa de esa raíz](https://www.sosa.cat/producto/oligofruct/). Sin la composición original no procede fusionar por nombre. Registrar como posible equivalencia prioritaria; las auditorías de aplicación permanecen intactas.
- **Once correspondencias sin nombre o alias exacto:** merluza, sardina, gambas, patata, champiñones, nori, plátano, fresa, frambuesa, uva y pasas. Hay fichas relacionadas localizadas. Revisar pluralización, especie y nombre regional. Esto no demuestra un fallo del buscador: no se ha probado la interfaz. No convertir un nombre amplio como gambas en alias exclusivo de una especie.
- **Cuatro asignaciones provisionales conservadas:** Crema de avellanas, Crema de cacahuete, Crema de pistacho y Tempura. Resolver formulación antes de aprobar familia definitiva o añadir pastas puras.
- Siguen vigentes las 25 fichas apartadas, las 11 redirecciones y las equivalencias pendientes de lotes anteriores, incluidas huevo en polvo y semillas de lino.

## Forma de continuar y criterio de cierre

El siguiente bloque agrupará las once necesidades sin ficha, las diez revisiones de alcance y las correcciones de nombres relacionadas. Se investigarán conjuntamente; una sola entrega recogerá altas confirmadas, alias aprobados y decisiones todavía pendientes. Sin cuota de altas por familia ni lote por cada especialidad pequeña.

Para cerrar la cobertura de esta lista, cada necesidad debe tener una ficha con alcance verificable o una exclusión justificada; las búsquedas ambiguas deben quedar resueltas. Para publicar, además, siguen pendientes revisión editorial, composición/alérgenos, traducciones, imágenes y verificación visual. Los 3.683 registros siguen NEEDS_REVIEW. Superar 5.000 se conserva como referencia de investigación, no como requisito de terminación o medida de utilidad.

## Verificación de esta revisión

Se comprueban 14 familias y 3.683 asignaciones, las 248 decisiones y sus claves. Se conserva una huella SHA-256 de maestra, pendientes, claves protegidas, taxonomías, proyección del backend y todas las auditorías de aplicación. No hay cambios en esos archivos. Esta entrega solo añade documentos y scripts de revisión; no requiere recompilar la aplicación. La última compilación funcional sigue siendo la del lote 30, con 84 pruebas aprobadas. No hay escrituras en base de datos ni publicación. La revisión visual sigue pendiente y no se utiliza el navegador integrado durante el diagnóstico de cierres de Codex.
