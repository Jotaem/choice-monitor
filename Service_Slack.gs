// =============================================================================
// Service_Slack.gs — Choice Monitor (Alerts Manager & Slack Integration)
// =============================================================================

const SHEET_ALERTS = 'CM_ALERTS_CONFIG'; // Aseguramos que apunte a la hoja correcta según Config.gs
const ALERT_HEADERS = ['alert_id', 'alert_name', 'channel_id', 'filter_city', 'filter_business', 'filter_category', 'metric', 'operator', 'threshold_type', 'value', 'is_active', 'created_at'];

// =============================================================================
// 1. SHEET CONFIGURATION (Motor de Auto-Reparación)
// =============================================================================
function _ensureAlertsSheet() {
  // Usamos el ID del Spreadsheet definido en Config.gs
  const ss = SpreadsheetApp.openById(CM_SPREADSHEET_ID);
  let sh = ss.getSheetByName('CM_ALERTS_CONFIG');
  
  if (!sh) {
    // Si realmente no existe, la creamos en el archivo correcto
    sh = ss.insertSheet('CM_ALERTS_CONFIG');
  }

  // Si está vacía, ponemos los encabezados
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, ALERT_HEADERS.length).setValues([ALERT_HEADERS])
      .setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  
  return sh;
}

// =============================================================================
// 2. FRONTEND CRUD API (Endpoints para Scripts.html)
// =============================================================================

function getAlertsConfig() {
  try {
    const sh = _ensureAlertsSheet();
    const data = sh.getDataRange().getValues();
    const headers = data.shift(); // Saca los encabezados: ['alert_id', 'alert_name', ...]
    
    const results = data.map(row => {
      return {
        id: row[0],
        name: row[1],
        channel_id: row[2],
        filter_city: row[3],
        filter_business: row[4],
        filter_category: row[5],
        metric: row[6],
        operator: row[7],
        threshold_type: row[8],
        value: row[9],
        active: String(row[10]).toUpperCase() === 'TRUE'
      };
    }).filter(a => a.id); // Solo filas con ID
    
    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Asegúrate de que esta lógica esté en tu Service_Slack.gs
function saveAlertConfig(payload) {
  try {
    const sh = _ensureAlertsSheet();
    // Este orden debe ser idéntico a las columnas de tu hoja CM_ALERTS_CONFIG
    const rowData = [
      payload.id || Utilities.getUuid(),
      payload.name,
      payload.channel_id,
      payload.filter_city,
      payload.filter_business,
      payload.filter_category,
      payload.metric,
      payload.operator,
      payload.threshold_type,
      payload.value,
      payload.active ? 'TRUE' : 'FALSE',
      new Date().toISOString() // Fecha creación
    ];
    sh.appendRow(rowData);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function toggleAlertConfig(id, active) {
  try {
    const sh = _ensureAlertsSheet();
    const col = ALERT_HEADERS.indexOf('active') + 1;
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(id).trim()) {
        sh.getRange(i + 1, col).setValue(active);
        SystemLogger.info(`[Service_Slack] Alerta ${id} estado cambiado a: ${active}`);
        return { success: true };
      }
    }
    return { success: false, error: 'Alerta no encontrada.' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function deleteAlertConfig(id) {
  try {
    const sh = _ensureAlertsSheet();
    const data = sh.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(id).trim()) {
        sh.deleteRow(i + 1);
        SystemLogger.info(`[Service_Slack] Alerta eliminada: ${id}`);
        return { success: true };
      }
    }
    return { success: false, error: 'Alerta no encontrada.' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// =============================================================================
// 3. SLACK CLIENT API (Seguro & Aislado)
// =============================================================================

function sendSlackMessage(channelId, blocks, text) {
  // Consumimos el Token Secreto desde las variables de entorno de Google
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  
  if (!token) {
    SystemLogger.error('[Service_Slack] Falla Crítica: SLACK_BOT_TOKEN no configurado en Propiedades del Script.');
    throw new Error('Token de Slack no encontrado.');
  }

  const payload = {
    channel: channelId,
    blocks: blocks,
    text: text
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${token}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const resp = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
  const data = JSON.parse(resp.getContentText());
  
  if (!data.ok) {
    SystemLogger.error(`[Service_Slack] Error enviando a ${channelId}: ${data.error}`);
    throw new Error(`Slack API Error: ${data.error}`);
  }
  
  return data.ts;
}