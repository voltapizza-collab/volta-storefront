export function nativeStartupError(error) {
  const code = error?.response?.data?.error;
  const known = {
    device_required: ['Falta el registro del terminal', 'Volta no reconoce el registro de este equipo. Contacta con soporte para revisar el alta; no borres los datos de la aplicación.'],
    device_not_authorized: ['Terminal no autorizado', 'Volta debe revisar la autorización de este equipo. No es un error de la contraseña de la tienda.'],
    invalid_device_proof: ['No se pudo comprobar el terminal', 'Comprueba que la fecha y hora de Android estén en automático y pulsa Reintentar. Si continúa, comunica este código a soporte.'],
    request_replayed: ['Repite la conexión', 'Pulsa Reintentar para iniciar una nueva comprobación.'],
    pos_service_error: ['El servicio de terminales no responde', 'Espera unos segundos y pulsa Reintentar.'],
    terminal_operation_failed: ['No se pudo conectar con Volta', 'Comprueba la conexión a internet y pulsa Reintentar. Si continúa, contacta con soporte.'],
  };
  const [title, message] = known[code] || ['No se pudo iniciar Volta', 'Pulsa Reintentar. Si continúa, comprueba la conexión y contacta con soporte.'];
  return { title, message, code: known[code] ? code : 'startup_unavailable' };
}
