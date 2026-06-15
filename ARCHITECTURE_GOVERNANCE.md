# 🏛️ SYSTEM RULES, CONTRACTS AND ARCHITECTURE GOVERNANCE

**Project:** Choice Monitor (Strategic & Operational Partner Observatory)
**Target Environment:** Google Apps Script (GAS) + BigQuery + Google Sheets
**Architecture Style:** Hub & Spoke Cache, Data-Driven UI, Event-Driven Alerts
**Primary Goal:** Build a highly responsive, historical analysis dashboard (Sessions, CVR, Open Times, Partner Status) with Slack alerting, strictly controlling massive BigQuery costs (queries exceed 3GB per run).

---

# 0. SYSTEM PHILOSOPHY

Choice Monitor is an **Analytical Orchestrator** for strategic decision-making. 
Unlike NRT systems, this monitors deep historical trends (from January to date). To prevent exorbitant BQ billing and guarantee UI speed, the system operates on the strict **"Group in BQ, Cache in Sheets, Filter in UI"** paradigm. The frontend UI must never trigger a live query to BigQuery.

# 1. THE 6 PILLARS OF CHOICE MONITOR ENGINEERING

1. **Daily Batch & Incremental Cache:** The massive historical payload (Jan to present) is extracted once. A Cron Trigger runs daily at 10:00 AM - 11:00 AM, extracting strictly `CURRENT_DATE() - 1` and appending it to the cache to prevent 3GB query costs.
2. **Rolling Window Tactics (Micro-Cube):** For granular partner-level data (`partner_id`), the system maintains an ephemeral rolling window strictly containing the current week (CW), last week (LW), and two weeks ago (L2W), along with their YoY equivalents. This prevents Google Sheets from exceeding the 10 million cell hard limit.
3. **Mathematical Integrity in Frontend:** BigQuery only extracts absolute counters and sums (e.g., total_sessions, total_orders, open_time_minutes). The JavaScript UI dynamically computes CVRs and Percentages based on user-selected timeframes (Month, ISO Week, Day). *Never average an average*.
4. **Decoupled Alerting Engine:** Slack alerts (CVR drops, Open Time thresholds) are evaluated locally against the cached Google Sheets data, independently of the UI.
5. **Absolute Auditability:** Every UI load is logged via `LockService` in a usage tracker to monitor adoption.
6. **Dynamic Data Cleansing (Active Partners Logic):** The system enforces strict business logic for partner categorization to filter out dirty DB records:
   * **Zombie:** `is_online = true` AND `open_time = 0`
   * **Activo sin ventas:** `is_online = true` AND `open_time > 0` AND `orders = 0`
   * **Activo con ventas:** `is_online = true` AND `open_time > 0` AND `orders > 0`
   * **Churned:** `is_online = false` (or any offline status) AND `orders > 0`
   * **Excluded (Dirty Data):** `is_online = false` AND `orders = 0` (MUST be filtered out).

---

# 2. DATA MODEL & CACHE REGISTRY

Google Sheets acts as the persistence and cache database. Mandatory sheets:

* `CM_CUBE_SESSIONS`: Granular historical cube for traffic and funnel (City, Date, Hour, Sessions, CVR steps).
* `CM_CUBE_TIMES_MACRO`: Macro historical cube for supply (City, Date, Reception System, Business, Category, Times, Orders) - Agnostic of `partner_id` to save space.
* `CM_CUBE_OPPORTUNITY`: Micro rolling window tactical cube (L2W, LW, CW + YoY equivalents) for granular partner analysis (`partner_id`, `partner_name`, `account_owner`).
* `CM_ALERTS_CONFIG`: JSON-stringified Alert configurations.
* `CM_ALERTS_LOG`: Immutable ledger of fired Slack alerts.
* `CM_USAGE_LOG`: Access tracker `[timestamp, user_email, session_id]`.

---

# 3. STRICT CODE CONTRACTS

* **Backend Response:** All `google.script.run` endpoints MUST return: `{ success: boolean, data: any, error: string }`.
* **Concurrency:** `LockService` MUST be used for all append operations (`USAGE_LOG`, `ALERTS_LOG`, and the daily BigQuery append).
* **Logging:** Native `Logger.log()` is forbidden; use `SystemLogger`.