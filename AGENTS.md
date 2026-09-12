# Novedades para los administradores de Volta

Escribir siempre «backoffice» en una sola palabra, también en las traducciones.

Cuando una entrega cambie una función visible para los usuarios del backoffice o de su negocio, incluir una nota breve para los administradores en el catálogo `../volta-backend/data/backofficeAnnouncements.js` de este workspace. Explicar qué cambió y cómo aprovecharlo; no usar mensajes de commit en bruto. Consultar `../volta-backend/docs/backoffice-notifications.md` para su formato y publicación.

Coordinar la publicación de la nota con la disponibilidad de la mejora. Si el repositorio del backend no está disponible, indicar en la entrega la nota pendiente y su texto. Las refactorizaciones internas sin cambios de comportamiento no necesitan un cartel.

Mantener el enlace de recarga de los avisos conectado al formulario de SMS existente. Las alertas operativas no se resuelven al cerrarlas: deben seguir el saldo real del negocio.

Conectar los textos de notificaciones al selector de idioma existente (ES, EN, IT, FR, PT). Incluir las traducciones de las novedades en el catálogo del backend; no cambiar los identificadores de lectura al traducir.
