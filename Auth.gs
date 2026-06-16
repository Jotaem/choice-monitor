// =============================================================================
// Auth.gs — Choice Monitor: Identity Management
// =============================================================================

/**
 * Retorna el correo electrónico del usuario activo.
 * Requiere que la Web App se despliegue con la opción:
 * "Ejecutar como: Usuario que accede a la aplicación web".
 * * @return {string} Email del usuario o 'unknown_user' en caso de error.
 */
function getCurrentUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || 'unknown_user';
  } catch (e) {
    SystemLogger.warn('[Auth] No se pudo obtener el correo del usuario.');
    return 'unknown_user';
  }
}