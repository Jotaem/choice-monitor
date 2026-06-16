// =============================================================================
// Controller_Alerts.gs — Choice Monitor: Motor de Evaluación de Alertas
// =============================================================================

function runAlertEngine() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(300000)) {
    SystemLogger.warn('[AlertEngine] Motor ocupado, abortando ejecución.');
    return;
  }

  try {
    SystemLogger.info('[AlertEngine] Iniciando evaluación de reglas...');
    
    // 1. Obtener reglas activas
    const rules = getAlertsConfig().filter(r => r.is_active === true);
    if (rules.length === 0) return SystemLogger.info('[AlertEngine] No hay reglas activas.');

    // 2. Extraer cubos de caché (Sin llamar a BQ)
    const sessionsData = _sheetToJSON(SHEET_NAMES.CUBE_SESSIONS);
    const macroData = _sheetToJSON(SHEET_NAMES.CUBE_TIMES_MACRO);

    // 3. Evaluar cada regla
    rules.forEach(rule => {
      evaluateRule(rule, { sessions: sessionsData, macro: macroData });
    });

  } catch (e) {
    SystemLogger.error('[AlertEngine] Fallo crítico: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Evaluación de métricas dinámicas
 * Implementa la regla: SUM(numerator)/SUM(denominator)
 */
function evaluateRule(rule, dataContext) {
  let value = 0;
  
  if (rule.metric === 'cvr_global') {
    // Lógica dinámica: SUM(sessions_with_orders) / SUM(total_sessions)
    const total = dataContext.sessions.reduce((acc, curr) => acc + (curr.total_sessions || 0), 0);
    const success = dataContext.sessions.reduce((acc, curr) => acc + (curr.sessions_with_orders || 0), 0);
    value = total > 0 ? (success / total) * 100 : 0;
  }
  
  // Comparación lógica
  const triggered = (rule.operator === 'greater' && value > rule.value) || 
                    (rule.operator === 'less' && value < rule.value);

  if (triggered) {
    SystemLogger.info(`[AlertEngine] Alerta disparada: ${rule.alert_name}`);
    // Aquí invocamos la lógica de Slack existente
    sendSlackAlert(rule, value);
  }
}