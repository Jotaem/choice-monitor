// =============================================================================
// Controller_BQ_Bootstrap.gs — Choice Monitor
// =============================================================================

function _fetchAndAppendChunks(queryStr, targetSheetName) {
  SystemLogger.info('[Bootstrap] Ejecutando query para: ' + targetSheetName);
  
  const request = { query: queryStr, useLegacySql: BQ_CONFIG.USE_LEGACY_SQL };
  let queryResults = BigQuery.Jobs.query(request, BQ_CONFIG.PROJECT_ID);
  const jobId = queryResults.jobReference.jobId;

  while (!queryResults.jobComplete) {
    Utilities.sleep(2000);
    queryResults = BigQuery.Jobs.getQueryResults(BQ_CONFIG.PROJECT_ID, jobId, { maxResults: 5000 });
  }

  let rows = queryResults.rows;
  let totalRowsFetched = 0;

  while (rows && rows.length > 0) {
    let dataChunk = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      let cols = rows[i].f;
      dataChunk[i] = cols.map(col => col.v);
    }

    if (dataChunk.length > 0) {
      appendDataToSheet(targetSheetName, dataChunk);
      totalRowsFetched += dataChunk.length;
      SpreadsheetApp.flush(); // Previene el Memory Leak
    }

    if (queryResults.pageToken) {
      queryResults = BigQuery.Jobs.getQueryResults(BQ_CONFIG.PROJECT_ID, jobId, {
        pageToken: queryResults.pageToken, maxResults: 5000
      });
      rows = queryResults.rows;
    } else {
      rows = null;
    }
  }
  SystemLogger.info('[Bootstrap] Completado ' + targetSheetName + '. Filas: ' + totalRowsFetched);
}

function _runBootstrapForDateRange(startDate, endDate) {
  try {
    SystemLogger.info(`[Bootstrap] MACRO: Periodo ${startDate} al ${endDate}`);

    const sqlSessions = `
      WITH base_sessions AS (
        SELECT s.area.area_name AS ciudad, s.partition_date AS fecha,
          EXTRACT(HOUR FROM s.session_start_timestamp_local AT TIME ZONE 'America/Santiago') AS hora_del_dia, 
          s.session_sk, s.totals.orders AS orders_count, s.home_loaded, s.shop_list_loaded,
          s.shop_details_loaded, s.checkout_loaded
        FROM \`peya-bi-tools-pro.il_sessions.fact_perseus_sessions\` s
        WHERE s.country_id = 2 AND s.partition_date >= '${startDate}' AND s.partition_date <= '${endDate}'
      )
      SELECT ciudad, fecha, hora_del_dia,
        COUNT(DISTINCT session_sk) AS total_sessions,
        COUNT(DISTINCT CASE WHEN home_loaded THEN session_sk END) AS sessions_home,
        COUNT(DISTINCT CASE WHEN shop_list_loaded THEN session_sk END) AS sessions_shop_list,
        COUNT(DISTINCT CASE WHEN shop_details_loaded THEN session_sk END) AS sessions_shop_details,
        COUNT(DISTINCT CASE WHEN checkout_loaded THEN session_sk END) AS sessions_checkout,
        COUNT(DISTINCT CASE WHEN orders_count > 0 THEN session_sk END) AS sessions_with_orders
      FROM base_sessions GROUP BY 1, 2, 3 ORDER BY fecha ASC, hora_del_dia ASC
    `;
    _fetchAndAppendChunks(sqlSessions, SHEET_NAMES.CUBE_SESSIONS);

    const sqlTimesMacro = `
      WITH daily_partner AS (
        SELECT da.area_name AS ciudad, DATE(hp.full_date) AS fecha, hp.reception_system_name AS reception_system, hp.business_name,
          CASE WHEN hp.business_name = 'Restaurant' THEN COALESCE(NULLIF(dp.main_cousine_category_name, ''), 'Sin Especialidad')
               ELSE COALESCE(NULLIF(dp.businessCategory.name, ''), 'Sin Categoría') END AS unified_category,
          COALESCE(hp.schedule_open_time, 0) AS schedule_open_time, COALESCE(hp.closed_times, 0) AS real_closed_time,
          fo.order_id, fo.order_status, fo.fail_rate_owner_restaurant AS is_commercial_fail
        FROM \`peya-bi-tools-pro.il_core.dim_partner\` dp
        LEFT JOIN \`peya-bi-tools-pro.il_core.dim_area\` da ON dp.address.area_id = da.area_id
        LEFT JOIN \`peya-bi-tools-pro.il_core.dim_historical_partners\` hp ON dp.partner_id = hp.restaurant_id
        LEFT JOIN \`peya-bi-tools-pro.il_core.fact_orders\` fo ON dp.partner_id = fo.restaurant.id 
          AND fo.registered_date >= '${startDate}' AND fo.registered_date <= '${endDate}' AND DATE(fo.registered_date) = DATE(hp.full_date)
        WHERE dp.country_id = 2 AND hp.is_active = TRUE AND DATE(hp.full_date) >= '${startDate}' AND DATE(hp.full_date) <= '${endDate}'
      )
      SELECT ciudad, fecha, COALESCE(reception_system, 'Desconocido') AS reception_system, COALESCE(business_name, 'Desconocido') AS business_name, unified_category,
        SUM(schedule_open_time) AS total_schedule_open_time, SUM(real_closed_time) AS total_real_closed_time,
        COUNT(DISTINCT order_id) AS total_orders, COUNT(DISTINCT CASE WHEN order_status = 'CONFIRMED' THEN order_id END) AS confirmed_orders,
        SUM(COALESCE(is_commercial_fail, 0)) AS commercial_failed_orders
      FROM daily_partner GROUP BY 1, 2, 3, 4, 5 ORDER BY fecha ASC
    `;
    _fetchAndAppendChunks(sqlTimesMacro, SHEET_NAMES.CUBE_TIMES_MACRO);

  } catch (e) { SystemLogger.error('[Bootstrap] Failed MACRO: ' + e.message); }
}

function runBootstrapOpportunity() {
  try {
    SystemLogger.info('[Bootstrap] MICRO: Ejecutando cubo Opportunity (L2W + YoY)');
    clearSheetData(SHEET_NAMES.CUBE_OPPORTUNITY); // Siempre reescribe
    
    const sqlOpportunity = `
      WITH time_boundaries AS (
        SELECT DATE_SUB(DATE_TRUNC(CURRENT_DATE(), ISO_WEEK), INTERVAL 14 DAY) AS start_l2w, CURRENT_DATE() AS end_cw,
               DATE_SUB(DATE_SUB(DATE_TRUNC(CURRENT_DATE(), ISO_WEEK), INTERVAL 14 DAY), INTERVAL 1 YEAR) AS start_yoy, DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR) AS end_yoy
      ),
      daily_partner_health AS (
        SELECT da.area_name AS ciudad, dp.partner_id, dp.partner_name, dp.partner_status, fpm.account_owner, DATE(hp.full_date) AS fecha,
          CASE WHEN DATE(hp.full_date) >= t.start_l2w THEN 'CURRENT_YEAR' ELSE 'PREVIOUS_YEAR' END AS year_flag,
          hp.reception_system_name AS reception_system, hp.business_name,
          CASE WHEN hp.business_name = 'Restaurant' THEN COALESCE(NULLIF(dp.main_cousine_category_name, ''), 'Sin Especialidad') ELSE COALESCE(NULLIF(dp.businessCategory.name, ''), 'Sin Categoría') END AS unified_category,
          COALESCE(hp.schedule_open_time, 0) AS schedule_open_time, COALESCE(hp.closed_times, 0) AS real_closed_time,
          fo.order_id, fo.order_status, fo.fail_rate_owner_restaurant AS is_commercial_fail
        FROM time_boundaries t
        CROSS JOIN \`peya-bi-tools-pro.il_core.dim_partner\` dp
        LEFT JOIN \`peya-bi-tools-pro.il_core.dim_area\` da ON dp.address.area_id = da.area_id
        LEFT JOIN \`peya-bi-tools-pro.il_core.dim_historical_partners\` hp ON dp.partner_id = hp.restaurant_id
        LEFT JOIN \`peya-bi-tools-pro.il_core.fact_partners_monthly\` fpm ON dp.partner_id = fpm.restaurant_id AND DATE(fpm.full_date) = DATE_TRUNC(CURRENT_DATE(), MONTH)
        LEFT JOIN \`peya-bi-tools-pro.il_core.fact_orders\` fo ON dp.partner_id = fo.restaurant.id 
          AND ((fo.registered_date >= t.start_l2w AND fo.registered_date <= t.end_cw) OR (fo.registered_date >= t.start_yoy AND fo.registered_date <= t.end_yoy)) AND DATE(fo.registered_date) = DATE(hp.full_date)
        WHERE dp.country_id = 2 AND hp.is_active = TRUE AND ((DATE(hp.full_date) >= t.start_l2w AND DATE(hp.full_date) <= t.end_cw) OR (DATE(hp.full_date) >= t.start_yoy AND DATE(hp.full_date) <= t.end_yoy))
      )
      SELECT ciudad, fecha, year_flag, partner_id, partner_name, partner_status, COALESCE(account_owner, 'Sin Ejecutivo') AS account_owner,
        COALESCE(reception_system, 'Desconocido') AS reception_system, COALESCE(business_name, 'Desconocido') AS business_name, unified_category,
        MAX(schedule_open_time) AS total_schedule_open_time, MAX(real_closed_time) AS total_real_closed_time,
        COUNT(DISTINCT order_id) AS total_orders, COUNT(DISTINCT CASE WHEN order_status = 'CONFIRMED' THEN order_id END) AS confirmed_orders, SUM(COALESCE(is_commercial_fail, 0)) AS commercial_failed_orders
      FROM daily_partner_health GROUP BY 1,2,3,4,5,6,7,8,9,10 ORDER BY fecha DESC
    `;
    _fetchAndAppendChunks(sqlOpportunity, SHEET_NAMES.CUBE_OPPORTUNITY);
  } catch (e) { SystemLogger.error('[Bootstrap] Failed MICRO: ' + e.message); }
}

function purgeAllData() {
  clearSheetData(SHEET_NAMES.CUBE_SESSIONS);
  clearSheetData(SHEET_NAMES.CUBE_TIMES_MACRO);
  clearSheetData(SHEET_NAMES.CUBE_OPPORTUNITY);
  SystemLogger.info('[Bootstrap] BD limpia.');
}

function load_January()  { _runBootstrapForDateRange('2026-01-01', '2026-01-31'); }
function load_February() { _runBootstrapForDateRange('2026-02-01', '2026-02-28'); }
function load_March()    { _runBootstrapForDateRange('2026-03-01', '2026-03-31'); }
function load_April()    { _runBootstrapForDateRange('2026-04-01', '2026-04-30'); }
function load_May()      { _runBootstrapForDateRange('2026-05-01', '2026-05-31'); }
function load_June()     { _runBootstrapForDateRange('2026-06-01', '2026-06-14'); }