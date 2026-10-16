# Arma tu pizza — auditoría y experimento aislado

Trabajo iniciado el 15 y validado el 16 de octubre de 2026. Sin despliegue ni activación para clientes.

## Acceso desde la tienda local — 16 de octubre

Por indicación del usuario, en `localhost:3000/mycrushpizza/plaza-diario` el recorrido ahora es **Arma tu pizza → elegir base → armado visual**. `VisualPizzaBuilder` recibe el catálogo, las selecciones y los cálculos existentes de StorePage. «Armado rápido» vuelve al constructor tradicional; «Volver al armado visual» conserva tamaño, cantidad e ingredientes confirmados. Cambiar de base reinicia la receta, como en el flujo original.

Este acceso solo se habilita en `localhost`, `127.0.0.1` y loopback IPv6 mediante `isLocalVisualPizzaEnabled`; los dominios públicos siguen mostrando la lista. El componente se carga de forma diferida y su CSS está acotado. En esta vista se usa el carrito habitual del navegador, con su validación de checkout existente. La bandeja sintética sigue disponible exclusivamente en el laboratorio de 4175. No se han enviado pedidos en la comprobación de navegador. No se modifica ni vuelve a distribuir la APK por este cambio de acceso local.

## Arquitectura y reglas comprobadas

`src/pages/StorePage.jsx` contiene la selección tradicional, las consultas del catálogo y el carrito. El flujo permite elegir categoría personalizable y tamaño. `selectedCustomBase` es la propia categoría; no hay entidades seleccionables independientes de masa y base. La salsa es un ingrediente. No se han inventado opciones de masa ni reglas de exclusividad.

| Aspecto | Comportamiento actual y reutilización |
| --- | --- |
| Categorías | `categoryCustomizable`; si ninguna categoría está marcada explícitamente, se consideran categorías de pizza. Los productos de referencia determinan tamaños y precios mínimos. |
| Base | 80 % del precio mínimo por tamaño de la categoría, redondeado a céntimos. Continúa en el constructor tradicional. El catálogo sintético del laboratorio usa esa misma constante. |
| Catálogo | `/stores/:id/ingredients`, con compatibilidad mediante `/ingredients`, y `/api/ingredient-category-uses?categoryId=…&storeId=…`. Se reutilizan identificadores y categorías del modelo; el laboratorio no consulta estas rutas. |
| Disponibilidad | La interfaz filtra por estado y disponibilidad de tienda; los usos acotan la categoría. La autorización definitiva de disponibilidad y precio pertenece al checkout del backend. No se ha cambiado. |
| Tamaños | XS 20, S 25, M 30, L 35, XL 40, XXL 45 y ST 30 cm. El coste de ingrediente se escala por área respecto de M y se redondea antes de aplicar los multiplicadores. |
| Cantidad y zona | SIMPLE ×1; DOUBLE ×2. FULL ×1; LEFT/RIGHT ×0,5. Una selección por ID de ingrediente. No se pueden representar dos cantidades distintas del mismo ingrediente en dos mitades. |
| Total | `(base + suma de ingredientes) × número de pizzas`. El comportamiento numérico original se conserva, incluido su redondeo de presentación; no se han introducido nuevos redondeos en el carrito. |
| Línea de pedido | `CUSTOM_BUILD`, `pizzaId` de referencia, tamaño, cantidad, base, ingredientes, alérgenos, subtotal, `customDetails` y `customMeta`. Los ingredientes tienen ID, nombre, categoría, zona, cantidad, etiquetas, precio y alérgenos. |
| Carrito y persistencia | `addCustomLine` añade la línea al estado `cart`; StorePage mantiene su serialización y persistencia existentes. Se conserva el constructor por listas, su modal y su navegación. |
| Validación servidor | `volta-backend/services/checkoutPricing.js` recalcula los suplementos, verifica usos y categorías, rechaza duplicados y zonas/cantidades inválidas. Las retiradas de recetas de carta siguen su flujo existente. |
| Dos recetas | `HALF_HALF` usa el precio de la mitad más cara. A se guarda en `leftPizzaId`, B en `rightPizzaId`; los extras llevan `side: A/B`. Es un flujo distinto a la personalización por ingredientes. |

## Cambio compartido y acotado

`src/utils/customPizza.js` extrae las funciones existentes de precio por tamaño, precio por zona/cantidad, etiquetas y construcción de línea. `StorePage` y el prototipo llaman al mismo código. No cambia la fórmula, el contrato del backend ni la interacción tradicional. El formateador de comanda se comparte aparte en `src/pos/orderLineDetails.js`; no depende del laboratorio.

## Propuesta de experiencia

1. Mostrar la base de categoría y tamaños disponibles junto a la pizza. Si en el futuro hay masas distintas, incorporarlas únicamente cuando existan en catálogo y precios.
2. Ofrecer Salsas, Quesos e Ingredientes como familias, con navegación libre y búsqueda. No obligar a completar cada familia.
3. Al tocar un ingrediente, abrir controles integrados para Toda, Derecha, Izquierda y Simple/Doble. Confirmar coloca automáticamente los trozos en su zona.
4. Mantener pizza, precio, resumen editable y deshacer. El modo rápido reduce el catálogo a filas compactas; no implica otro modelo de pedido.
5. Revisar receta, observaciones, alérgenos y comanda espacial. Añadir a una bandeja local de prueba. Una integración posterior deberá usar el carrito real y su checkout existente.

La referencia estudiada fue [Papa’s Pizzeria To Go](https://www.flipline.com/apps/papaspizzeriatogo/index.html), con estaciones de preparación adaptadas a teléfono, y [la explicación de estaciones de Deluxe](https://www.flipline.com/blog/archives/19577), que presenta masa, salsa, queso y toppings. Se toma la progresión visual como inspiración. Se omiten puntuación, tiempos de cocción, precisión manual, arrastre de cada pieza y mecánicas de corte. No se reutilizan imágenes, marcas del juego ni otros recursos de Flipline.

## Implementación del prototipo

- El laboratorio separado conserva su entrada `src/experiments/pizza-lab/entry.jsx`. La tienda local carga ahora `VisualPizzaBuilder` tras elegir base; comparte el SVG y utiliza los datos de StorePage. El laboratorio de muestra no se importa en las rutas de tienda ni en `nativeEntry`.
- `npm run pizza:lab` compila en `build-pizza-lab/` y sirve únicamente `http://127.0.0.1:4175`. `npm run pizza:lab:build` solo compila. No usar la carpeta como despliegue del storefront.
- Catálogo de 10 ingredientes sintéticos, una categoría y tamaños M/L/XL. Los importes y alérgenos son de muestra. No representan la disponibilidad de un negocio.
- SVG 2D propio: salsa recortada por mitad, piezas deterministas que no saltan al modificar otro ingrediente, doble densidad para doble cantidad y capas de salsa/queso/toppings. Sin imágenes descargadas, canvas, WebGL ni dependencias nuevas.
- Animación de 180 ms; respeta `prefers-reduced-motion` y el control visible de reducción. Los nombres, etiquetas de zona y resumen permiten utilizar el constructor sin interpretar el dibujo.
- Botones con nombres accesibles, estados `aria-pressed`, controles de teclado, Escape, foco contextual y avisos `role=status`. La pizza se mantiene visible con un panel compacto en móvil.
- Historial de hasta 50 cambios, incluida cantidad, tamaño y observaciones. La bandeja es memoria local de la pestaña y se borra al recargar. No usa el carrito ni el almacenamiento del negocio.
- CSP con `connect-src 'none'` y sin formularios de envío: el laboratorio no crea pedidos ni realiza pagos.

## Ventajas, límites y evaluación

| Constructor por listas | Experimento visual |
| --- | --- |
| Flujo operativo y conectado al catálogo real | Mejor percepción de zonas y cambios, pendiente de prueba con usuarios |
| Menor necesidad de recursos gráficos | Necesita asignar representaciones reconocibles al catálogo completo |
| Resumen textual y controles existentes | Pizza visible, panel integrado, deshacer y atajo de armado rápido |
| Checkout y disponibilidad de producción | Solo datos de muestra y bandeja local; contrato validado offline |

La imagen es ilustrativa, no expresa gramajes ni garantiza el reparto físico exacto. El catálogo real tiene miles de ingredientes; hará falta una tabla de recursos por ID o categoría con sustitución textual cuando no haya ilustración. La forma visual por sí sola no cubre alérgenos ni disponibilidad. No se ha medido rendimiento en un teléfono físico de gama media ni conversión comercial.

Para evaluar: tareas de reproducir una pizza con dos mitades, corregir una cantidad, quitar un ingrediente y terminar el pedido; comparar tiempo, errores de zona, retrocesos y abandono con la lista. Realizar pruebas de teclado, lector de pantalla, zoom y reducción de movimiento con usuarios. No activar para clientes antes de decidir el resultado de esa evaluación.

Para una integración futura: proporcionar al componente las categorías/usos reales, mantener estados de carga y error, refrescar disponibilidad antes del checkout, probar los errores 409 y conservar ambas modalidades. Verificar alérgenos de la base y los ingredientes con los datos del negocio. La validación del servidor sigue siendo obligatoria. Un motor visual diferente podría representar capas de hamburguesas o bocadillos; las selecciones y precios compartidos son reutilizables, pero el modelo por mitades no debe imponerse a esos productos.

## Evidencia

- 4 pruebas de modelo/interacción del laboratorio: precios, zonas, doble cantidad, modificar/quitar/deshacer, notas y bandeja.
- 6 pruebas existentes de StorePage superadas tras la extracción, y compilación de producción correcta.
- `node scripts/check-pizza-contract.cjs`: 36 combinaciones de tamaño, zona, cantidad y unidades aceptadas por el servicio real `checkoutPricing` con contexto sintético, sin HTTP ni base de datos.
- Navegador: construcción con salsa y mozzarella FULL, bacon DOUBLE RIGHT y piña SIMPLE LEFT; precio y zonas coinciden. Sin desbordamiento horizontal a 393 y 320 px. A 320 px los controles de cantidad mantienen 44 × 44 px y la acción principal ocupa una fila.
- Salidas de auditoría y capturas: `../../output/pizza-experiment-2026-10-15/`.

La validación física del ticket y la preparación OTA se documentan por separado en [Ticket espacial](pos/spatial-ticket-2026-10-15.md).

## Mesa de armado integrada — 16 de octubre de 2026

En localhost, elegir la base abre el constructor visual con una mesa de altura acotada: pizza a la izquierda y cinco recipientes de familias a la derecha. El buscador ocupa la barra superior. Familias, ingredientes, edición de zona/cantidad y receta se alternan en el mismo panel; los catálogos y recetas largos se dividen en páginas de seis elementos. En pantallas pequeñas el panel puede desplazarse por separado sin mover la pizza. Armado rápido conserva la selección y los precios compartidos.

Validación de esta revisión: nueve pruebas de frontend (familias, paginación, búsqueda sin tildes entre familias, zona/doble, quitar/deshacer y transición al carrito) y diez de avisos. El aviso traducido `pizzaWorkbenchAnnouncementDraft` queda fuera del feed hasta que se publique la mejora. La activación continúa limitada a localhost/loopback; no se ha desplegado.

Comprobación visual: a 1264 × 720 px, mesa, pizza y panel de edición sin desbordamiento horizontal ni vertical (441/441, 367/367 y 303/303 px de alto visible/contenido). A 393 × 852 px, pizza y panel permanecen uno al lado del otro y el total sigue visible. Receta de salsa, mozzarella y bacon doble a la derecha: EUR 7,13 antes y después de pasar por Armado rápido. No se añadió al carrito ni se envió un pedido durante la prueba real.

La previsualización de localhost:3000 sirve `build` con `node server.js`; esta compilación usa `REACT_APP_API_URL=https://api.voltapizza.com` para leer el catálogo existente. No se modifica `.env` (que sigue apuntando al backend local de desarrollo).

## Precio explícito por categoría — 16 de octubre de 2026

La versión siguiente sustituye el mínimo de categoría × 0,8 por `categoryBasePriceBySize`, configurado en `PartnerCategory.customBasePrices` desde los iconos de las tarjetas del backoffice. Solo admite capacidades habilitadas en Global Manager y tamaños con precio explícito. El backend verifica el mismo importe y rechaza precios antiguos. Detalles y activación coordinada en `../volta-backend/docs/category-base-prices-2026-10-16.md`. La compilación está en `build-category-pricing`; no sustituye el build anterior de localhost:3000 hasta que el backend incluya el nuevo contrato. Vista de revisión aislada de los componentes reales del backoffice: `http://127.0.0.1:4180`, con datos de muestra y sin llamadas externas.

## Móvil compacto y retorno a familias — 16 de octubre de 2026

Tras activar el backend local, `localhost:3000` sirve ahora `build` compilado con `REACT_APP_API_URL=http://localhost:8080`. Esta revisión reúne las cinco familias en una fila compacta bajo la pizza en móvil; la pizza dispone del ancho completo. En pantallas de poca altura, durante la edición, los controles de tamaño y unidades se colocan junto a la pizza.

Confirmar «Poner en mi pizza» limpia la búsqueda, la familia y la página seleccionadas, sale de Tu receta y devuelve el foco al encabezado de ingredientes. Conserva la receta, las cantidades, las zonas y Deshacer. Cerrar los controles sin confirmar mantiene la bandeja anterior.

Dos pruebas de interacción cubren adición desde familias y búsqueda, edición desde receta, retorno, foco, cancelación y deshacer. Diez pruebas del catálogo de avisos superadas; el aviso existente está actualizado en ES/EN/IT/FR/PT y sigue como borrador. La prueba en navegador usa el catálogo real, sin enviar pedidos. Capturas en `../../output/pizza-mobile-flow-2026-10-16` desde este repositorio. La memoria al cerrar el modal queda fuera de esta revisión.

## Controles diferenciados y aspecto de ingredientes — 16 de octubre de 2026

Los grupos de ubicación y cantidad conservan sus fieldsets y leyendas, con fondos verde y crema, bordes, separación y estados seleccionados diferenciados. No forman una única tira de cinco opciones.

La auditoría encontró un color común para todos los quesos y un fallback marrón para pulpo y muchos otros ingredientes. `src/utils/ingredientArtwork.js` separa ahora las reglas ilustrativas por nombre del fallback taxonómico. Distingue mozzarella, cheddar, queso azul, pulpo, calamar, gambas, embutidos, vegetales y salsas reconocibles. Añade anillos, rodajas, tentáculos, vetas y granos a los SVG compartidos de recipiente/pizza. Los nombres desconocidos mantienen un fallback estable por familia; no es una representación fotográfica ni una clasificación comercial. No cambia identificadores, precios, alérgenos ni cantidades.

Cinco pruebas superadas de aspecto y flujo; diez de avisos. El aviso traducido sigue como borrador y la compilación se sirve solo en localhost, conectada al backend local.

## Orden de preparación y variaciones dentro de cada familia — 16 de octubre de 2026

El constructor visual heredaba el orden alfabético de `ingredientCategoryUses`; el rápido tenía un comparador parcial para tomate/mozzarella. Ambos usan ahora `sortIngredientsForBuilding`: tomate, blanca y BBQ antes de otras salsas; mozzarella rallada y fresca antes de quesos de complemento. Incluye prioridades para embutidos, carnes, vegetales y pescado. Es un orden editorial culinario, sin datos de popularidad; los empates y nombres desconocidos conservan el orden recibido y ningún ingrediente desaparece.

Las tarjetas de familias y catálogo tienen un color guía suave. Los dibujos mantienen el color del alimento: BBQ marrón, tomate rojo, queso fresco claro, cheddar naranja. Mozzarella rallada usa hebras; fresca, discos; parmesano, lascas. Pepperoni, chorizo y salami son rodajas con tonos y texturas distintos. La misma ilustración aparece en el recipiente y en la pizza.

Verificación: 19 pruebas de orden, ilustración, flujo y StorePage; 10 del catálogo de avisos. Build local con API 8080; sin publicación. El aviso existente incluye los cambios en cinco idiomas y sigue como borrador.
