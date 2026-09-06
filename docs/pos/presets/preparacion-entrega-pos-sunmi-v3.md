# Preset de preparación y entrega — Volta POS / SUNMI V3

Identificador: `VOLTA-SUNMI-V3-01` · Revisión 1 · 6 septiembre 2026.

Estado: procedimiento operativo documentado a partir del primer terminal. No es una imagen de sistema ni un instalador automático. El alta de nuevos equipos todavía necesita un flujo técnico accesible; ver paso 4. No considerar completada la preparación sin superar todos los controles de entrega.

## Qué recibe el restaurante

Un SUNMI V3 con Volta POS instalado, identificado y autorizado. El restaurante conecta el Wi-Fi, abre Volta e introduce usuario y PIN de su tienda. No necesita laptop ni cable USB para operar. Por ahora debe mantener la app abierta.

La misma app sirve para todas las tiendas. Cada aparato tiene su propia «matrícula» interna; usuario y PIN determinan la tienda de la sesión. No clonar datos privados de un terminal para preparar otro. Registrar aparte el destino de entrega: no confundirlo con una vinculación permanente de la identidad a una tienda.

## Configuración de referencia

| Elemento | Valor documentado |
| --- | --- |
| Equipo validado | SUNMI V3, Android 13, SUNMI OS 4.5.1, firmware 586, 3 GB / 32 GB |
| Aplicación | Volta POS, paquete `com.volta.poslab` |
| APK validado al crear esta revisión | `volta-pos-connected-0.3.4.apk`, versión `0.3.4-https`, código 7 |
| SHA256 del APK | `C7D4C3624AC13E4A9C8CDCFA9EEF8F38FBDA4778CF3CE4E8A5DB57F9D2F8CA32` |
| Servidor | `https://api.voltapizza.com` |
| Acceso de tienda | Usuario y PIN; no añadir un tercer campo |
| Impresora | SUNMI PrinterX 1.0.20, papel 58 mm, ancho útil de referencia 48 mm |
| Ticket | Letra 24, ajuste conservador a 30 columnas, separación vertical; modalidad, horario, cliente, productos, observaciones, total y pago |
| Icono | Fondo #FFB61C, V #3B008B y dos pizzas interiores; diseño aprobado |
| Pedidos | Consulta cada 10 segundos con la app abierta; aviso repetido hasta aceptar |
| Inventario | Aviso amarillo y contador rojo de ingredientes no disponibles |
| Sesión | Caduca a los 30 días; cambiar PIN, suspender o revocar puede exigir nuevo inicio |

Estos valores describen el equipo probado, no obligan a degradar otros aparatos a ese firmware. Si cambia hardware, firmware o versión de app, repetir validación y actualizar esta revisión. Registrar siempre el hash del APK realmente distribuido; recompilar puede cambiarlo.

## 1. Preparar la tienda en Volta

- Confirmar marca y tienda correctas, carta, precios, horarios, modalidades y datos de contacto.
- Tener habilitadas sus credenciales POS. Verificar que usuario y PIN identifican una única tienda.
- Entregar las credenciales por el canal acordado. No guardarlas en este documento, Git ni en la ficha de entrega.
- No confundir tienda cerrada para pedidos con aparato suspendido: son controles diferentes.

## 2. Recibir e inventariar el aparato

- Abrir una ficha con la [plantilla de entrega](ficha-entrega-terminal.md).
- Anotar número de serie, modelo, versiones de Android/SUNMI y nombre interno, por ejemplo `SUNMI V3 002`.
- Revisar pantalla, carga, Wi-Fi, altavoz, tapa y avance de papel. Ajustar fecha/hora automáticas y zona horaria del destino.
- Usar diagnóstico integrado para prueba de impresión. Registrar resultado, no solo que existe una impresora.

## 3. Instalar la versión aprobada

Usar una única versión aprobada para el lote, no recompilar una app diferente por pizzería. La variante de entrega es HTTPS. No entregar el APK USB ni dejar una dependencia de `127.0.0.1:8091`.

Si hace falta construir una nueva versión, desde `volta-storefront`:

```powershell
node scripts/build-native-pos.cjs
```

Esperar su finalización correcta. Después, desde `volta-pos-android`:

```powershell
./build.ps1 -Connection https
```

Verificar firma y hash. Durante preparación, conectar un único equipo y autorizar la depuración USB. Comprobar su serie con `adb devices`; especificar siempre el terminal de destino:

```powershell
adb -s SERIE_VERIFICADA install -r build/volta-pos-connected-0.3.4.apk
```

Sustituir la serie y la versión por las verificadas. En actualizaciones conservar paquete, firma y datos. No desinstalar ni borrar almacenamiento para resolver un problema rutinario: puede perderse la identidad.

La firma actual es de laboratorio. Custodiarla; no es todavía el mecanismo definitivo de distribución para una flota comercial.

## 4. Registrar y autorizar cada terminal nuevo

La aplicación genera una clave propia dentro de Android Keystore; el servidor registra su clave pública e identificador. No copiar claves ni sesiones del primer Sunmi. Dos POS de la misma tienda deben seguir siendo dos aparatos distintos.

El operador usa la herramienta administrativa conectada a la base correcta. Desde `volta-backend`, crear la carpeta privada si no existe y generar un código por aparato:

```powershell
New-Item -ItemType Directory -Force pos-private | Out-Null
node scripts/posAdmin.js enroll-code "SUNMI V3 002" "OPERADOR" "pos-private/sunmi-002.json"
```

El código es de un solo uso y caduca a los 15 minutos. No es el PIN de la tienda. Usar nombre de archivo nuevo para cada intento; la herramienta no sobrescribe archivos existentes. No publicar su contenido.

**Limitación actual:** existe `SessionActivity` con pantalla de alta y existe el endpoint de registro, pero la actividad no está exportada ni tiene un acceso desde la pantalla principal `PosActivity`. Instalar el APK de entrega en un aparato virgen no completa por sí solo el registro. Antes de preparar el siguiente lote hay que habilitar un flujo de aprovisionamiento interno controlado y probarlo de principio a fin. No documentar como solución un comando ADB que abra una actividad no exportada ni exponerla públicamente sin diseñar el acceso.

Una vez completado el alta mediante el flujo técnico habilitado, verificar:

```powershell
node scripts/posAdmin.js list
```

Registrar en la ficha el UUID del aparato y comprobar estado `AUTHORIZED`. La prueba debe demostrar que es una identidad nueva, no la del equipo usado como referencia.

## 5. Validar funcionamiento antes del envío

- Abrir Volta desde el icono del escritorio.
- Iniciar sesión en la tienda de prueba acordada y verificar nombre y ámbito correctos.
- Comprobar cola de pedidos, inventario y calendario. No modificar ingredientes de una tienda operativa sin coordinación.
- Imprimir ticket de prueba de 58 mm: bordes, tildes, modalidad pickup/delivery, dirección cuando corresponde, horario, productos y total legibles.
- Probar sonido al volumen adecuado para el local. Registrar valoración física; el éxito del software no confirma que sea audible.
- Hacer un pedido operativo controlado cuando esté coordinado: recepción, aviso, aceptación, impresión y finalización. Distinguirlo de la impresión sintética, que no crea compra. No marcar listo un pedido real de cliente como prueba.
- Cerrar cualquier sesión de prueba antes del envío y comprobar que aparece el acceso con usuario/PIN. Cerrar sesión conserva el registro del aparato.

## 6. Comprobar autonomía y entregar

- Eliminar cualquier puente de prueba USB que exista y apagar el servidor local del piloto.
- Desconectar físicamente el USB y comprobar que la app sigue funcionando por Wi-Fi.
- Reiniciar el dispositivo: en esta versión se debe abrir Volta manualmente. No prometer arranque automático.
- Retirar accesos Wi-Fi de laboratorio que no deban viajar con el equipo y desactivar depuración USB al cerrar la preparación.
- Entregar instrucciones breves, contacto de soporte y ficha cumplimentada sin secretos.

Instrucción para el restaurante: «Conecta el Wi-Fi, abre Volta e introduce usuario y PIN. Confirma el nombre de tu tienda. Mantén Volta abierta para recibir pedidos. El cable USB no es necesario».

En destino, comprobar sonido en el ambiente real del local y realizar la puesta en marcha coordinada. La entrega no se declara validada si quedan fallos de registro, conexión, alcance de tienda o impresión.

## 7. Soporte, sustitución y baja

Usar el UUID verificado del aparato, no el identificador de tienda:

```powershell
node scripts/posAdmin.js status UUID_VERIFICADO SUSPENDED "OPERADOR" "Motivo de suspensión"
node scripts/posAdmin.js status UUID_VERIFICADO AUTHORIZED "OPERADOR" "Fin del mantenimiento"
node scripts/posAdmin.js status UUID_VERIFICADO REVOKED "OPERADOR" "Baja definitiva"
```

Son ejemplos para ejecutar cuando corresponda, no pasos automáticos de entrega. Suspensión elimina la sesión; reautorizar exige nuevo login. Revocación es definitiva para esa identidad. Un sustituto se registra como aparato nuevo; no se clona el anterior. La app refleja la desautorización al contactar con el servidor; no es un borrado remoto del dispositivo.

## Pendientes que no deben confundirse con funciones terminadas

1. Flujo accesible y probado de registro para terminales nuevos.
2. Firma definitiva, repositorio de versiones y distribución/actualización de flota.
3. Modo kiosco y arranque automático.
4. Recepción garantizada en segundo plano o con la app cerrada.
5. Cierre de rutas antiguas del POS web: la nueva API protegida no las elimina por sí sola.
6. Commit y push de los cambios desplegados directamente a Railway para evitar que otra publicación los sobrescriba.
7. Validación documentada de una segunda unidad, cambio de tienda y ciclo operativo completo por instalación.

El preset recoge lo aprendido; no certifica por sí mismo que esos pendientes estén resueltos.

## Referencias

- [Conexión a producción](../pos-conexion-produccion-2026-09-06.md)
- [Identidad y sesión: implementación inicial](../pos-identidad-y-sesion-piloto-2026-09-06.md) — histórico, anterior al cambio a HTTPS.
- [Ajustes de cocina, inventario y ticket](../pos-ajustes-cocina-ticket-2026-09-06.md)
- [Icono aprobado](../icono-volta-aprobado-2026-09-06.md)
