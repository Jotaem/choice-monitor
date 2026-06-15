// =============================================================================
// Config.gs — Choice Monitor: Central Configuration Module
// =============================================================================

const SCRIPT_PROPS = PropertiesService.getScriptProperties();

const CM_SPREADSHEET_ID = SCRIPT_PROPS.getProperty('CM_SPREADSHEET_ID') || '';
const SLACK_BOT_TOKEN   = SCRIPT_PROPS.getProperty('SLACK_BOT_TOKEN') || '';

const SHEET_NAMES = Object.freeze({
  CUBE_SESSIONS:     'CM_CUBE_SESSIONS',
  CUBE_TIMES_MACRO:  'CM_CUBE_TIMES_MACRO',
  CUBE_OPPORTUNITY:  'CM_CUBE_OPPORTUNITY',
  ALERTS_CONFIG:     'CM_ALERTS_CONFIG',
  ALERTS_LOG:        'CM_ALERTS_LOG',
  USAGE_LOG:         'CM_USAGE_LOG',
});

const BQ_CONFIG = Object.freeze({
  PROJECT_ID: SCRIPT_PROPS.getProperty('BQ_PROJECT_ID') || '',
  USE_LEGACY_SQL: false
});

const CUBE_SESSIONS_HEADERS = Object.freeze([
  'ciudad', 'fecha', 'hora_del_dia', 'total_sessions', 'sessions_home',
  'sessions_shop_list', 'sessions_shop_details', 'sessions_checkout', 'sessions_with_orders'
]);

const CUBE_TIMES_MACRO_HEADERS = Object.freeze([
  'ciudad', 'fecha', 'reception_system', 'business_name', 'unified_category',
  'total_schedule_open_time', 'total_real_closed_time', 'total_orders',
  'confirmed_orders', 'commercial_failed_orders'
]);

const CUBE_OPPORTUNITY_HEADERS = Object.freeze([
  'ciudad', 'fecha', 'year_flag', 'partner_id', 'partner_name', 'partner_status',
  'account_owner', 'reception_system', 'business_name', 'unified_category',
  'total_schedule_open_time', 'total_real_closed_time', 'total_orders',
  'confirmed_orders', 'commercial_failed_orders'
]);

const ALERTS_CONFIG_HEADERS = Object.freeze([
  'alert_id', 'alert_name', 'metric', 'operator', 'threshold', 
  'scope_json', 'frequency', 'slack_channel_id', 'is_active', 
  'created_at', 'updated_at', 'version'
]);

const ALERTS_LOG_HEADERS = Object.freeze([
  'timestamp', 'alert_id', 'alert_name', 'metric_value', 
  'threshold', 'scope_snapshot', 'slack_response_status'
]);

const USAGE_LOG_HEADERS = Object.freeze([
  'timestamp', 'user_email', 'session_id'
]);

function buildResponse(success, data, error) {
  return { success: success, data: data, error: error || null };
}