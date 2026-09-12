# Avisos centrales de Volta

El backoffice incorpora un cartel amarillo `#FFB61C`, texto y acciones violeta `#3B008B` y el icono de Volta existente. `BackofficeNotifications` se monta tras iniciar sesión, con una clave por negocio. Usa un diálogo modal nativo, navegación con teclado, Escape y restauración del foco. El cartel se adapta a pantallas pequeñas y permite desplazamiento interno cuando es necesario.

El acceso **Avisos** permanece en la barra lateral con el número de avisos operativos pendientes y novedades sin leer. Los avisos de SMS enlazan al formulario original de compra. Se respetan los enlaces directos y los retornos de Stripe.

El backend sirve `GET /api/backoffice-notifications/:partnerId`. Consultar `volta-backend/docs/backoffice-notifications.md` en el workspace para los umbrales y el procedimiento de publicación de novedades en `data/backofficeAnnouncements.js`. Publicar ambos proyectos; no hay migración de base de datos.

Las lecturas se almacenan por negocio en el navegador. Una novedad marcada como leída no interrumpe otra vez, pero sigue en Avisos. Las alertas de saldo regresan al abrir el backoffice mientras el saldo siga bajo. No hay recibos de lectura compartidos entre dispositivos.

El selector de idioma también controla el centro de avisos, sus alertas SMS, botones, estados de error y fechas. Las traducciones generales se integran en `constants/i18n.js` mediante `constants/notificationTranslations.js`. Las novedades del catálogo tienen un objeto `translations` con EN, IT, FR y PT y conservan el español en sus campos raíz. Cambiar el idioma no vuelve a consultar la API ni modifica los identificadores de lectura.

Si la nueva ruta todavía no está activa o no responde, se consulta la ruta original de saldo SMS. El centro muestra la alerta operativa y distingue que las novedades no están disponibles temporalmente; no inventa un saldo ni indica que todo está al día cuando falta información. Los errores de autenticación y de negocio inexistente no activan esta alternativa.

Pruebas del componente en `src/components/Backoffice/Notifications/BackofficeNotifications.test.jsx`. Evidencia visual y recorrido de recarga con datos simulados en `output/backoffice-notifications` del workspace.
