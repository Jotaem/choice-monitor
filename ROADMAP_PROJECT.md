# 🗺️ ROADMAP DE IMPLEMENTACIÓN: CHOICE MONITOR 📊

**Arquitectura Base:** Hub & Spoke Cache (Historical Window)
**Backend:** Google Apps Script + BigQuery
**Caché/DB:** Google Sheets
**Frontend:** Vanilla JS + TailwindCSS + Chart.js

---

## FASE 1: Inicialización, Bootstrap y Carga Histórica Masiva
**Objetivo:** Crear la estructura de base de datos en Sheets y ejecutar la carga inicial de datos desde Enero hasta el día actual.
* **Acciones:**
  * Crear `Config.gs` y `DB.gs`.
  * Desarrollar `Controller_BQ_Bootstrap.gs`: Script de ejecución manual (one-off) que extraiga todo el histórico del año (~3GB) y lo fragmente en Sheets para crear el cubo base.
  * **Modificación:** Instanciar los 3 Cubos de Datos (`Sessions`, `Times_Macro`, `Opportunity`) en lugar de 2 para sortear el límite físico de Sheets y RAM.

## FASE 2: Motor de Ingesta Incremental (Cron Diario)
**Objetivo:** Proteger los costos de BQ automatizando una ingesta selectiva.
* **Acciones:**
  * Desarrollar `Controller_Scheduler.gs`.
  * Crear la función `appendYesterdaysData()`.
  * Configurar un Trigger en GAS para ejecutarse diariamente entre las 10:00 AM y 11:00 AM.
  * *Validación:* Implementar idempotencia verificando que la fecha de ayer no exista ya en la caché antes de hacer el `appendRow`.
  * **Motor de Purga:** Añadir un cron semanal auxiliar que limpie los datos más antiguos a L2W en la hoja `CM_CUBE_OPPORTUNITY`.

## FASE 3: Capa de Seguridad y BFF (Backend for Frontend)
**Objetivo:** Conectar el UI de manera segura y trackear adopción.
* **Acciones:**
  * Implementar `Auth.gs`, `Audit.gs` (LockService) y `Router.gs`.
  * Desarrollar `Controller_Dashboard.gs` para despachar todo el JSON histórico al frontend en un solo payload al inicio de la sesión.

## FASE 4: SPA, Gestión de Estado y Lógica JS Core
**Objetivo:** Construir el "cerebro" del dashboard en el navegador antes de pintar gráficos.
* **Acciones:**
  * Estructurar el HTML maestro (`Index.html`) con los 6 tabs: Home, Sessions & CVR, Open Times, Active Partners, **Opportunity**, Alerts.
  * En `Scripts.html`, programar el motor de filtros cruzados.
  * **Lógica Crítica:** Implementar la función clasificadora de *Active Partners* (Zombies, Activo con/sin ventas, Churned) iterando sobre la data de BQ en memoria y excluyendo la basura (Offline + 0 orders).

## FASE 5: UI/UX y Motor de Chart.js (Vistas de Negocio)
**Objetivo:** Renderizar los tableros analíticos según los requerimientos de la operación.
* **Vista 1: Home:** Scorecards agregados.
* **Vista 2: Sessions & CVR:**
  * *Filtros:* Ciudad, Tiempo.
  * *Gráficos:* Mensual (Top Left), ISO Week (Top Right), Day of Week (Bottom Left), Hour of Day (Bottom Right).
* **Vista 3: Open & Closed Times:**
  * *Filtros:* Ciudad, Tiempos, Business, Category, System Reception. *(Nota: Partner y Owner removidos de la vista macro)*.
  * *Gráficos Temporales:* Barras apiladas (Open/Closed netos) + Curva Lineal (% Open Share) en 4 resoluciones (Month, Week, Day, Hour).
  * *Rankings (Share Apilado 100%):* Por Ciudad, Business, Category, Sistema de Recepción. Gráfico de Torta de Estatus.
* **Vista 4: Active Partners:**
  * Mismos filtros y gráficos que Open Times, pero la data inyectada pasa primero por el filtro de la lógica categórica (Solo partners activos según regla estricta).
* **Vista 5: Opportunity (NUEVA):**
  * *Filtros:* Week (Current Week, Last Week), Ciudad, Ejecutivos.
  * *Métricas:* Tabla de análisis a nivel `partner_name` cruzando las métricas de Open Time vs CVR vs Orders con columnas calculadas de crecimiento `WoW` y `YoY`.

## FASE 6: Motor de Alertas Desacoplado
**Objetivo:** Notificación proactiva a Slack sobre anomalías en el choice.
* **Acciones:**
  * Crear el CRUD visual en el tab de *Alerts* para guardar reglas en `CM_ALERTS_CONFIG`.
  * Soportar umbrales por CVR y Open/Closed Times.
  * Desarrollar `Controller_Alerts.gs` y `Service_Slack.gs`.
  * El motor leerá la configuración y cruzará contra el consolidado diario, ejecutándose asíncronamente después del Cron de las 10:00 AM.