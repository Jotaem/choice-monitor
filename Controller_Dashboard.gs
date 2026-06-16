// =============================================================================
// Controller_Dashboard.gs — Choice Monitor: API Data Provider
// =============================================================================

/**
 * Extrae los 3 cubos de memoria y los empaqueta en JSON para la SPA.
 * Gobernanza: NUNCA llama a BQ. Lee de Sheets.
 */
function getDashboardData() {
  try {
    SystemLogger.info('[Controller_Dashboard] Extrayendo cubos cacheados para la UI...');
    
    const payload = {
      sessions:    _sheetToJSON(SHEET_NAMES.CUBE_SESSIONS),
      timesMacro:  _sheetToJSON(SHEET_NAMES.CUBE_TIMES_MACRO),
      opportunity: _sheetToJSON(SHEET_NAMES.CUBE_OPPORTUNITY)
    };
    
    SystemLogger.info('[Controller_Dashboard] Datos empaquetados. Enviando al Frontend.');
    return buildResponse(true, payload, null);
    
  } catch (e) {
    SystemLogger.error('[Controller_Dashboard] Fallo al extraer datos: ' + e.message);
    return buildResponse(false, null, e.message);
  }
}

/**
 * Convierte un rango de Sheets en un Array de Objetos JSON.
 * @param {string} sheetName 
 * @private
 */
function _sheetToJSON(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  
  if (lastRow === 1) return []; // Solo hay cabeceras, sin datos
  
  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data.shift(); // Saca la fila 1 y la usa de llave
  
  return data.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      // Si la celda es una fecha nativa, forzamos formato String para evitar crashes en el Frontend
      if (val instanceof Date) {
         val = Utilities.formatDate(val, 'America/Santiago', 'yyyy-MM-dd');
      }
      obj[header] = val;
    });
    return obj;
  });
}