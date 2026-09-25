# Lote 13 — alternativas vegetales, algas y condimentos

24 de septiembre de 2026. **24 altas netas: 3.456 fichas locales.** Faltan 1.544 para la referencia aproximada de 5.000.

| Familia de restaurante | Altas |
| --- | ---: |
| Legumbres y proteínas vegetales | 4 |
| Verduras, setas y algas | 6 |
| Salsas, condimentos y bases de cocina | 14 |
| **Total** | **24** |

Se incorporan tofu sedoso, yuba, tempeh de guisante y garbanzo; lechuga de mar, codium, kombu atlántico, musgo de Irlanda, musgo estrellado y arame; doce pastas o salsas, gomasio y levadura nutricional inactiva. Los 16 alias alternativos no suman ingredientes.

## Fuentes y decisiones

El [catálogo por identidad](ingredient-master-expansion-catalogue-batch-13.md) enlaza las referencias de cada alta. El [JSON del lote](ingredient-master-expansion-batch-13.json) conserva nombres, alias, fuentes y doce grupos de exclusiones.

- Taifun documenta el tofu sedoso; Hodo explica la película de soja que constituye la yuba, distinta de la cuajada. Se agrupan las presentaciones de yuba sin contar hojas o tiras como ingredientes distintos.
- Vegetalia reconoce tempeh de guisante y de garbanzo. Su artículo se utiliza como evidencia de identidad culinaria, no de disponibilidad comercial actual ni formulación completa. No se presupone que estos productos carezcan de soja.
- Porto-Muiños identifica cinco algas. Ulva y Codium se conservan al nivel de género que declara el proveedor. Laminaria ochroleuca se separa del Kombu de azúcar histórico, Saccharina latissima. Chondrus crispus y Mastocarpus stellatus tienen fichas separadas; no reciben el alias ambiguo «musgo de mar». Clearspring identifica arame como Eisenia bicyclis.
- Sempio documenta doenjang y ssamjang, distintos de la mayonesa de doenjang existente. Clearspring documenta miso de cebada, arroz integral y blanco de arroz. Se conserva el miso de soja genérico y se difiere hatcho hasta delimitar su cobertura. Las cremas formuladas de miso no se renombran ni fusionan.
- Hikari documenta shio koji y shoyu koji; S&B, yuzu kosho. Son condimentos elaborados, no cultivos puros, aromas o salsa de soja sola.
- Lee Kum Kee documenta doubanjiang, salsa de soja negra fermentada y ajo, char siu y XO. Sus páginas ofrecen ingredientes principales; se requiere ficha completa del proveedor antes de una aprobación de formulación. **XO contiene marisco en la referencia y no es una alternativa vegetal.**
- Eden documenta gomasio de sésamo y sal; El Granero, levadura nutricional inactiva. Se diferencian de sésamo solo, furikake y levaduras activas de panadería. No se generan altas por fortificación vitamínica.

Quedan fuera tofu y tempeh genéricos, seitán, soja texturizada, natto, algas y condimentos ya representados. Tofu fermentado y proteína de guisante texturizada requieren delimitar su alcance frente a fichas históricas antes de añadirlos. No se crean altas por envases, certificaciones, cortes o marcas.

Todas las nuevas fichas siguen **NEEDS_REVIEW**, con imágenes **MISSING** y solo nombre español. Los alérgenos vacíos significan no documentados; no acreditan ausencia. No se importan dosis, información nutricional ni afirmaciones sanitarias de los proveedores.

## Integridad y comprobaciones

Las **3.432 fichas anteriores y sus asignaciones se conservan idénticas**, al igual que las 25 identidades apartadas, 11 redirecciones y cuatro clasificaciones provisionales. Frontend, proyección del backend, claves protegidas y taxonomía están sincronizados. Los trece lotes se pueden reaplicar sin duplicar altas ni modificar auditorías históricas. Se comprobó que las seis nuevas identidades científicas no repetían las existentes.

[Controles estructurados](ingredient-master-expansion-checks-batch-13.json) · [Auditoría de aplicación](ingredient-master-expansion-audit-batch-13.json).

Pruebas automatizadas: **84 aprobadas** (9 del importador, 48 del backend y 27 de interfaz). Compilación aprobada (main.e9b6190e.js). Ensayo en navegador cerrado: 3.456 fichas y búsquedas «piel de tofu», «kombu atlantico» y «toban djan» correctas en sus respectivas familias. API local vacía con escrituras bloqueadas; no verifica integración con una base de datos.

## Continuación

Siguiente investigación: bebidas, cremas y fermentados vegetales para cocina, con familia explícita según materia prima y elaboración; continuar después con huecos documentados de verduras y conservas. Revisar las equivalencias históricas registradas sin fusionar claves automáticamente.

Solo archivos locales del catálogo interno de candidatos de Global Manager. Sin altas en inventarios, escrituras en bases de datos ni publicación. La nota de administradores ya preparada para las familias de restaurante permanece fuera del feed; este lote no activa disponibilidad en negocios. Siguen pendientes traducciones, imágenes, revisión editorial, clasificaciones de Pavo, cremas y Tempura, y comprobaciones físicas del Sunmi.
