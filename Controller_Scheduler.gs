// =============================================================================
// Controller_Scheduler.gs — Choice Monitor: Ingesta Incremental
// =============================================================================
// Governance: Cron diario (10 AM). Extrae SOLO el día de ayer (CURRENT_DATE - 1).
// Idempotencia estricta para evitar duplicidad y LockService obligatorio.
// =============================================================================

/**
 * PUBLIC ENTRY POINT: Cron Job Triggered Function
 * Ejecuta la ingesta incremental protegiendo los límites de costos de BQ.
 */
function runDailyIncrementalSync() {
  const lock = LockService.getScriptLock();
  
  // Governance: Prevenir ejecuciones paralelas (Timeout de 5 minutos)
  if (!lock.tryLock(300000)) {
    SystemLogger.warn('[Scheduler] El proceso ya está en ejecución por otra instancia. Abortando.');
    return;
  }

  try {
    SystemLogger.info('[Scheduler] Iniciando Sincronización Diaria Incremental...');

    // 1. Calcular la fecha de AYER en formato YYYY-MM-DD
    const today = new Date();
    today.setDate(today.getDate() - 1);
    const yesterdayStr = Utilities.formatDate(today, 'America/Santiago', 'yyyy-MM-dd');

    // 2. Validación de Idempotencia para Cubos Históricos (Macro y Sesiones)
    const isSessionsSynced = _isDateAlreadyProcessed(SHEET_NAMES.CUBE_SESSIONS, yesterdayStr);
    const isMacroSynced    = _isDateAlreadyProcessed(SHEET_NAMES.CUBE_TIMES_MACRO, yesterdayStr);

    if (isSessionsSynced && isMacroSynced) {
      SystemLogger.info(`[Scheduler] Los datos para ${yesterdayStr} ya existen en caché. Saltando extracción a BigQuery.`);
    } else {
      SystemLogger.info(`[Scheduler] Extrayendo datos Macro/Sesiones para ${yesterdayStr}.`);
      // Reutilizamos el motor del Bootstrap para extraer exactamente 1 día
      _runBootstrapForDateRange(yesterdayStr, yesterdayStr);
    }

    // 3. Refrescar el Cubo Táctico Micro (Ventana Móvil)
    // Dado que es una ventana móvil (L2W, LW, CW + YoY), la forma más segura 
    // es sobreescribirla en lugar de purgar fila por fila.
    SystemLogger.info('[Scheduler] Refrescando ventana móvil Opportunity...');
    runBootstrapOpportunity();

    SystemLogger.info('[Scheduler] Sincronización Diaria completada con éxito.');
    
    // Ejecución segura posterior
    runAlertEngine();
  } catch (e) {
    SystemLogger.error('[Scheduler] Error crítico en sincronización: ' + e.message);
    // IMPORTANTE: Aquí podrías notificar a Slack que la ingesta falló
    // sendSlackMessage(ADMIN_CHANNEL, [{type:"section", text:{type:"plain_text", text:"ALERTA: Falló la ingesta diaria"}}], "Error de Ingesta");
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper de Idempotencia: Revisa las últimas filas de la hoja buscando la fecha objetivo.
 * @param {string} sheetName - Nombre de la hoja
 * @param {string} dateStr - Fecha en formato 'YYYY-MM-DD'
 * @return {boolean} True si la fecha ya fue ingeniada
 * @private
 */
function _isDateAlreadyProcessed(sheetName, dateStr) {
  const sheet = getSheet(sheetName);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow === 1) return false; // Solo están las cabeceras

  // Para eficiencia, revisamos solo las últimas 500 filas de la caché
  const startRow = Math.max(2, lastRow - 500);
  const numRows = lastRow - startRow + 1;
  
  // En nuestra arquitectura, la Columna B (índice 2) es SIEMPRE la 'fecha'
  const dates = sheet.getRange(startRow, 2, numRows, 1).getValues();

  for (let i = 0; i < dates.length; i++) {
    let cellValue = dates[i][0];
    let cellDateStr = '';

    // Normalización estricta: si es objeto Date, formatea; si es string, limpia
    if (cellValue instanceof Date) {
      cellDateStr = Utilities.formatDate(cellValue, 'America/Santiago', 'yyyy-MM-dd');
    } else {
      cellDateStr = String(cellValue).trim().split('T')[0]; // Maneja ISO strings o YYYY-MM-DD
    }

    if (cellDateStr === dateStr) return true;
  }
  return false;
}