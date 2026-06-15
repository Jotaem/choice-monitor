// =============================================================================
// SystemLogger.gs — Choice Monitor: Structured Logging Module
// =============================================================================
// Governance: Native Logger.log() is FORBIDDEN.
// All logging routes through this structured module.
// =============================================================================

/**
 * @fileoverview Centralized logging utility for the Choice Monitor platform.
 * Provides structured log levels (INFO, WARN, ERROR) with timestamps.
 */

const SystemLogger = Object.freeze({

  /**
   * Formats a log entry with ISO timestamp and level prefix.
   * @param {string} level - Log level (INFO, WARN, ERROR).
   * @param {string} message - Log message.
   * @return {string} Formatted log string.
   * @private
   */
  _format: function(level, message) {
    const timestamp = new Date().toISOString();
    return '[' + timestamp + '] [' + level + '] ' + message;
  },

  info: function(message) {
    console.log(SystemLogger._format('INFO', message));
  },

  warn: function(message) {
    console.warn(SystemLogger._format('WARN', message));
  },

  error: function(message) {
    console.error(SystemLogger._format('ERROR', message));
  }
});