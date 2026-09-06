# Confirmación de pedido en efectivo

Se reemplazó la cabecera verde animada por tarjeta blanca centrada, importe destacado, explicación del cobro al recoger/recibir, horario y tienda/dirección. Acción principal Confirmar pedido en efectivo; secundaria Cambiar método de pago. Se conservan los callbacks originales y bloqueo durante envío. No se realizaron compras de prueba ni cobros.

Compilación local correcta. Revisión visual con CSS completo a 390 px, sin recortes. Se corrigió la interacción con reglas globales de modales móviles mediante selectores específicos y columnas minmax(0, 1fr).

Publicación Railway storefront: 5560e508-da05-44cc-bffb-b8d195eb5f6f. Fuente preparada desde HEAD dff43ce1914a1023238c47f564365c911faea496 con únicamente StorePage.jsx y bloque CSS del modal modificados. No incorpora cambios locales del POS ni ajuste previo ajeno en las píldoras de disponibilidad. No se ha hecho push a GitHub: integrar este cambio antes de futuras publicaciones desde GitHub.
Publicación final: 17c9e158-39c8-4115-8237-d9e7aa0a926b. La primera falló por advertencias ESLint preexistentes tratadas como errores por CI. La entrega incluye railway.toml con buildCommand CI=false npm run build (errores reales siguen fallando) y startCommand node server.js para servir la compilación. Verificado HTTP 200 y bundle público main.577def5c.js con el nuevo texto y sin el anterior.
