// =============================================================================
// Audit.gs — Choice Monitor: Access Telemetry & Security
// =============================================================================

/**
 * Registra el acceso de un usuario en la hoja DW_USAGE_LOG de forma segura.
 * Gobernanza: Uso obligatorio de LockService.
 * * @param {string} email - Correo del usuario
 */
function logUserAccess(email) {
  const lock = LockService.getScriptLock();
  
  // Intentamos obtener el bloqueo por 10 segundos
  if (!lock.tryLock(10000)) {
    SystemLogger.warn('[Audit] Timeout intentando loguear acceso para: ' + email);
    return;
  }
  
  try {
    const timestamp = new Date().toISOString();
    const sessionId = Utilities.getUuid(); // Genera un ID único de sesión
    
    // Agregamos la fila a la caché
    appendDataToSheet(SHEET_NAMES.USAGE_LOG, [[timestamp, email, sessionId]]);
    SystemLogger.info('[Audit] Acceso registrado para: ' + email);
    
  } catch (e) {
    SystemLogger.error('[Audit] Falla al registrar acceso: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}