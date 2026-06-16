// =============================================================================
// Router.gs — Choice Monitor: Web App Entry Point (doGet)
// =============================================================================

/**
 * Punto de entrada HTTP GET. Intercepta la carga, audita y sirve el shell HTML.
 */
function doGet(e) {
  const email = getCurrentUser();
  
  // 1. Auditar acceso silenciosamente en backend
  logUserAccess(email);
  SystemLogger.info('[Router] Sirviendo dashboard a: ' + email);
  
  // 2. Compilar e inyectar vistas
  const template = HtmlService.createTemplateFromFile('Index');
  
  return template.evaluate()
    .setTitle('Choice Monitor 📊')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Helper para inyectar archivos parciales (Styles/Scripts) dentro del Index.html.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}