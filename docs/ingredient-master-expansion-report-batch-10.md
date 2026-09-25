# Lote 10 — arroces, cereales, harinas y legumbres

24 de septiembre de 2026. **59 altas netas: total de 3.361 fichas.** Faltan 1.639 para la referencia aproximada de 5.000.

| Familia de restaurante | Altas |
| --- | ---: |
| Pastas, arroces y cereales | 30 |
| Panes, masas y harinas | 10 |
| Legumbres y proteínas vegetales | 19 |
| **Total** | **59** |

Las altas conservan la categoría histórica Otros, que pasa de 493 a 552 fichas. Cada una declara su familia de restaurante expresamente. Se añaden 13 alias, que no cuentan como ingredientes.

## Fuentes y decisiones

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-10.md) enlaza las 59 referencias. El [JSON revisado](ingredient-master-expansion-batch-10.json) conserva nombres de origen, decisiones y 12 exclusiones o grupos de exclusiones.

- Arroces: 14 cultivares enumerados en el [pliego de MAPA de 2024](https://www.mapa.gob.es/images/es/arroz_de_valencia_2024_04_18_tcm30-211433.pdf), 10 denominaciones en [Riso Gallo](https://www.risogallo.it/pages/cultura-del-riso) y arroz rojo en la página 5 del [catálogo EcoSalim](https://int-salim.com/img/cms/catalogos/EcoSalim_CATALOGO-web.pdf). Son referencias de identidad, sin afirmar certificación ni disponibilidad actual. La descarga posterior de EcoSalim devolvió 403: solo se usa el bloque de arroz rojo que pudo consultarse mediante el índice web, no sus otras secciones.
- Cereales: cinco copos documentados por [Emilio Esteban](https://emilioesteban.com/copos). Los tamaños de copos de avena se reúnen en una ficha.
- Harinas: siete de [El Granero](https://elgranero.com/saborear/recetas-para-usar-todas-nuestras-harinas/), teff contrastado con una [ficha de composición del molino](https://harineraelmolino.com/wp-content/uploads/2020/11/ficha-tecnica-ecologica-harina-teff-blanca-36.pdf), coco con [ficha del proveedor](https://semillaselecta.com/pages/informacion-nutricional-harina-de-coco) y patata en USDA. Se excluyen marcas y certificaciones del nombre. La harina de patata no se confunde con fécula ni copos.
- Legumbres: 14 variedades documentadas por [Alimentos de España](https://www.alimentosdespana.es/es/turismo-agroalimentario-y-gastronomia/gastronomia/bloc/legumbres/definicion-y-variedades), Canela y Plancheta por el [Consejo Regulador de La Bañeza–León](https://www.alubiadelabanezaleon.es/nuestros-productos/) y tres semillas maduras secas en USDA. Judía alada seca queda separada de la judía alada tierna histórica.
- Los cuatro identificadores USDA se contrastan con la copia local SR Legacy y sus nombres originales. No se importan tablas nutricionales, fotografías, recetas ni traducciones.

Se difieren las equivalencias de garrafó, alubias de riñón, Negrilla y lenteja Verdina. Arroz Originario y Patna requieren delimitar su posible uso como grupo comercial. Las harinas y legumbres ya representadas no suman altas. Las mezclas de teff tampoco se confunden con la harina pura.

## Integridad y validación

Las **3.302 fichas anteriores y sus familias permanecen idénticas**. Se conservan las 25 identidades apartadas, las 11 redirecciones y las cuatro clasificaciones provisionales. Continúan pendientes las decisiones de composición de Pavo, cremas y Tempura.

Maestra, espejo del backend, claves protegidas y taxonomía están sincronizados. Se comprueba la reaplicación idempotente de los diez lotes: no modifica la maestra ni sus auditorías históricas. [Comprobaciones estructuradas](ingredient-master-expansion-checks-batch-10.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-10.json).

**78 pruebas aprobadas:** 9 del importador, 42 del backend y 27 de interfaz. Compilación completa correcta: `main.2051fa28.js` y `main.6cd59d28.css`, servidas en localhost. Permanece el aviso no bloqueante de Browserslist sobre antigüedad de datos.

Navegador: el selector muestra 3.361 fichas. «Harina de quinua», «pardiña» y «arroz sénia» devuelven una ficha cada una en la familia prevista. El catálogo operativo local conserva sus 131 ingredientes; no se seleccionó ni guardó ningún alta y no se solicitaron traducciones.

## Alcance y siguiente punto

Ampliación local del catálogo interno de candidatos de Global Manager. Sin escrituras en bases de datos, inventarios ni despliegue. Todas las altas mantienen NEEDS_REVIEW e imágenes MISSING, con nombre español y alias. Una lista vacía de alérgenos significa no documentado, nunca ausencia.

La investigación hacia 5.000 sigue abierta. Siguiente bloque propuesto: lácteos distintos del queso, huevos y bases de cocina, cruzados contra las 3.361 identidades. La publicación coordinada y las comprobaciones físicas del Sunmi siguen pendientes.
