// =============================================================================
// Service_Slack.gs — Choice Monitor (Alerts Manager & Slack Integration)
// =============================================================================

const SHEET_ALERTS = 'SYS_ALERTS';
const ALERT_HEADERS = ['id','channel_id','channel_name','partner_keywords','reasons','frequency','active','created_at','last_run','emoji','name','time_from','time_until','days'];

// =============================================================================
// 1. SHEET CONFIGURATION (Motor de Auto-Reparación)
// =============================================================================
function _ensureAlertsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ALERTS);
  
  if (!sh) {
    sh = ss.insertSheet(SHEET_ALERTS);
    sh.getRange(1, 1, 1, ALERT_HEADERS.length).setValues([ALERT_HEADERS])
      .setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  } else {
    // Validar y reparar encabezado si fue corrompido
    const firstCell = String(sh.getRange(1, 1).getValue() || '').trim();
    if (firstCell !== ALERT_HEADERS[0]) {
      if (sh.getLastRow() > 0) sh.insertRowBefore(1);
      sh.getRange(1, 1, 1, ALERT_HEADERS.length).setValues([ALERT_HEADERS])
        .setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

// =============================================================================
// 2. FRONTEND CRUD API (Endpoints para Scripts.html)
// =============================================================================

function getAlertsConfig() {
  try {
    const sh = _ensureAlertsSheet();
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    const rows = sh.getRange(2, 1, lastRow - 1, ALERT_HEADERS.length).getValues();
    const alerts = [];

    rows.forEach(row => {
      const id = String(row[0] || '').trim();
      if (!id || id === 'id' || !id.startsWith('alert_')) return;

      const o = {};
      ALERT_HEADERS.forEach((key, i) => { o[key] = (row[i] !== undefined && row[i] !== null) ? row[i] : ''; });

      // Transformaciones seguras de JSON y booleanos
      try { o.partner_keywords = JSON.parse(o.partner_keywords || '[]'); } catch(_) { o.partner_keywords = []; }
      try { o.days = JSON.parse(o.days || '[]'); } catch(_) { o.days = []; }
      
      o.active = (o.active === true || String(o.active).toUpperCase() === 'TRUE');
      o.last_run = o.last_run ? String(o.last_run) : '';

      alerts.push(o);
    });

    return { success: true, data: alerts };
  } catch(e) {
    SystemLogger.error('[Service_Slack] getAlertsConfig Error: ' + e.message);
    return { success: false, error: e.message, data: [] };
  }
}

function saveAlertConfig(cfg) {
  try {
    const sh = _ensureAlertsSheet();
    if (!cfg.partner_keywords || cfg.partner_keywords.length === 0) {
      return { success: false, error: 'Debes ingresar al menos una palabra clave (keyword) de partner.' };
    }

    // Regla de Negocio: Una alerta por Canal
    const existing = getAlertsConfig().data;
    const clash = existing.find(a => a.channel_id === cfg.channel_id && String(a.id) !== String(cfg.id || ''));
    if (clash) return { success: false, error: 'Ya existe una alerta para este canal. Solo se permite una alerta por canal.' };

    const rowData = [
      cfg.id || '',
      cfg.channel_id,
      cfg.channel_name || cfg.channel_id,
      JSON.stringify(cfg.partner_keywords || []),
      JSON.stringify([]), // reasons
      cfg.frequency || '15',
      cfg.active !== false,
      '', // created_at
      '', // last_run
      '🚨', // emoji
      cfg.name || '',
      cfg.time_from || '',
      cfg.time_until || '',
      JSON.stringify(cfg.days || [])
    ];

    // Modo Actualización
    if (cfg.id) {
      const all = sh.getDataRange().getValues();
      for (let i = 1; i < all.length; i++) {
        if (String(all[i][0]).trim() === String(cfg.id).trim()) {
          rowData[ALERT_HEADERS.indexOf('created_at')] = all[i][ALERT_HEADERS.indexOf('created_at')];
          rowData[ALERT_HEADERS.indexOf('last_run')] = all[i][ALERT_HEADERS.indexOf('last_run')];
          sh.getRange(i + 1, 1, 1, ALERT_HEADERS.length).setValues([rowData]);
          SystemLogger.info(`[Service_Slack] Alerta actualizada: ${cfg.id}`);
          return { success: true, id: cfg.id };
        }
      }
    }

    // Modo Creación
    const newId = 'alert_' + Date.now();
    rowData[0] = newId;
    rowData[ALERT_HEADERS.indexOf('created_at')] = new Date().toISOString();
    sh.appendRow(rowData);
    SystemLogger.info(`[Service_Slack] Nueva alerta creada: ${newId}`);
    
    return { success: true, id: newId };

  } catch(e) {
    SystemLogger.error('[Service_Slack] saveAlertConfig Error: ' + e.message);
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