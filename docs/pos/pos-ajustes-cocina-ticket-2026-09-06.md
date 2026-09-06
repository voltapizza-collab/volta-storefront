# Ajustes de cocina y ticket — SUNMI V3

- Tarjetas móviles: ancho relativo al panel, una columna vertical, sin carrusel que recorte el borde derecho. Menos relleno y separación; código largo puede partirse. Resumen de entrega/fecha y pago/total en dos filas.
- Etiqueta de efectivo: `Efectivo pendiente`, también en el formateador del ticket.
- Retiradas pestañas superiores Orders/Inventory. Acceso Inventario con SVG de cajas en la barra inferior junto a cliente y calendario; disponible también desde el ticket. Inventario incluye Volver a cocina. La barra inferior permanece accesible al desplazar contenido en el POS estrecho.
- Impresión Android: ancho 58 mm y letra 24 conservados; 6 puntos de aire tras cada línea, 12 adicionales antes de separadores y después del título. Título y total en negrita. No se imprime una nueva compra automáticamente para verificar estilo.
- APK HTTPS 0.3.1, código 4, conserva identidad/sesión. SHA256 `7D89DBCF7784F35C18C62603C3F3435125B8A4BBE9F6389491A9AAE47EA06804`. Compilación web y Java completadas, firma APK verificada e instalación en SUNMI realizada sin borrar datos. Sin puente USB.

## Pendiente posterior: clasificación de clientes

Revisar incoherencia señalada por el usuario: Sofía figura como cliente potencial pese a tener cuatro pedidos. Comparar reglas de segmentación, estados de pedidos contabilizados, ámbito tienda/partner y actualización de estadísticas. No se modifican aquí datos ni reglas de clientes.

## Validación física

Confirmar con el usuario comodidad del nuevo ticket y navegación de inventario. Los ajustes de frontend se empaquetan en el APK; no se desplegó el storefront público ni se modificó el backend en esta revisión.

## Indicador de inventario (0.3.2)

El acceso inferior muestra fondo amarillo y contador rojo cuando hay ingredientes del menú no disponibles (`!(exists && active)`, misma condición que los controles del inventario). El contador usa el listado completo, no el filtro de búsqueda. Estado compartido con el panel: cambia después de confirmar el PATCH, sin avisos optimistas ante fallos. Fuera de inventario se consulta al entrar y cada 30 segundos; las respuestas de una tienda/panel anterior se descartan. Con cero desactivados desaparece el contador. Se conserva el último listado confirmado si falla la red. Animación breve del contador y respuesta al pulsar, respetando movimiento reducido.

## Información del ticket (0.3.3)

La modalidad aparece debajo de la tienda en negrita: RECOGIDA / PICKUP, ENVIO / DELIVERY, CONSUMO EN LOCAL o MODALIDAD: POR CONFIRMAR. Se imprime fecha de creación cuando existe, horario programado destacado, cliente/teléfono y dirección solo en delivery (aviso explícito si falta). Cantidades delante del producto; se conservan extras y personalizaciones. Observaciones del pedido antes del bloque final total/pago. Estado de tarjeta pagada/pendiente según el campo explícito; efectivo cobrado solo con estado paid/cash_paid, nunca inferido del estado general de la venta.

Verificaciones locales satisfactorias para pickup, courier/delivery, local, modalidad ausente, dirección ausente, método anidado, cantidades/extras, observaciones y estados de pago. Interfaz y APK compilados, firma verificada y versión 0.3.3 instalada conservando datos. Pendiente valorar físicamente la impresión nueva con el usuario.
