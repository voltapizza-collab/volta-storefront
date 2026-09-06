# Integración SUNMI POS — documentación versionada

El preset vigente está en [preparación y entrega](presets/preparacion-entrega-pos-sunmi-v3.md), con [ficha por terminal](presets/ficha-entrega-terminal.md).

Los documentos fechados son registros históricos: sus estados «pendiente de push», versiones anteriores o conexión USB describen ese momento. Esta entrega guarda los cambios en GitHub. El código Android canónico está en `native/sunmi-v3` de este repositorio. Compilar la UI desde la raíz con `node scripts/build-native-pos.cjs` y después ejecutar `build.ps1 -Connection https` allí. La clave de firma no se guarda en Git; restaurar la clave aprobada antes de construir un APK para terminales existentes.

La fuente del icono aprobado está en `design/volta-icon/approved.svg`. Mantener las claves y los códigos de alta fuera de Git. Las migraciones y herramientas administrativas se versionan en el repositorio volta-backend.

El preset no automatiza todavía el alta de nuevos equipos. Continúan pendientes el acceso guiado de aprovisionamiento, kiosco, inicio automático, recepción en segundo plano y distribución definitiva.
