# 🍔 Choice Monitor — Strategic Partner Observatory

## Visión General
**Choice Monitor** es un Orquestador Analítico e Histórico construido sobre Google Apps Script, Google Sheets y BigQuery. 

Evolucionando desde la arquitectura *Near Real-Time* de Data Wolf, este sistema está diseñado para monitorear tendencias históricas profundas (Sesiones, CVR, Tiempos de Operación y Salud del Partner) protegiendo estrictamente los costos de infraestructura. Al procesar más de 3GB por consulta en BigQuery, el sistema implementa un paradigma absoluto de **"Agrupar en BQ, Cachear en Sheets, Filtrar en la UI"**, garantizando que el frontend cargue de forma instantánea sin generar peticiones en vivo a la base de datos central.

## Arquitectura de Datos (Los 3 Cubos)
Para sortear los límites físicos de Google Sheets (10 millones de celdas) y de memoria RAM (Motor V8), la base de datos se fragmenta en tres cubos estratégicos:

1. **`CM_CUBE_SESSIONS` (Cubo de Tráfico):** Histórico macro de tráfico y embudos de conversión agrupado por Ciudad, Fecha y Hora.
2. **`CM_CUBE_TIMES_MACRO` (Cubo de Oferta Macro):** Histórico de disponibilidad operativa (Open/Closed times) agrupado por dimensiones de negocio (Categoría, Sistema de Recepción) para análisis de estacionalidad a largo plazo.
3. **`CM_CUBE_OPPORTUNITY` (Cubo Táctico Micro):** Ventana móvil efímera y granular a nivel `partner_id`. Contiene estrictamente la semana actual (CW), la semana pasada (LW) y la anterior (L2W), junto con sus espejos exactos del año anterior (YoY) para facilitar métricas de crecimiento interanual en la UI.

## Características Principales

* **Ingesta Diaria Incremental (Idempotente):** Un cron job diario (10:00 AM) extrae exclusivamente los datos de `CURRENT_DATE() - 1` y los concatena a la caché macro. Evalúa matemáticamente las últimas filas para prevenir duplicación de datos.
* **Integridad Matemática Estricta:** El backend (`BigQuery`) extrae únicamente contadores absolutos y sumas. El frontend (`Vanilla JS`) computa dinámicamente tasas de conversión (CVR), Share % y promedios según los cruces y resoluciones de tiempo del usuario. **Nunca se promedian porcentajes pre-calculados.**
* **Dynamic Data Cleansing (Active Partners):** Motor lógico en JS que clasifica el estado real del ecosistema para limpiar la base de datos de locales inactivos ("Zombies", "Activos sin ventas", "Activos con ventas", "Churned").
* **Telemetría y Auditoría (RBAC):** Todo acceso al tablero es registrado en un log inmutable utilizando la API corporativa (`Session.getActiveUser().getEmail()`) y protegido contra colisiones mediante `LockService`.
* **Cazador de Alertas Desacoplado:** Motor asíncrono que evalúa reglas JSON (CVR drops, Open Time thresholds) contra la caché local de Sheets y notifica a canales específicos de Slack vía Block Kit.

## Stack Tecnológico
* **Data Lake / DW:** Google BigQuery (SQL)
* **Backend & Orquestador:** Google Apps Script (ES6 JavaScript)
* **Base de Datos / Caché:** Google Sheets
* **Frontend:** Vanilla JS, HTML5, TailwindCSS (CDN), Chart.js
* **Integraciones:** Slack API (Block Kit Webhooks)

## Estructura de Capas
1. **Capa UI / Frontend:** `Index.html`, `Styles.html`, `Scripts.html`.
2. **Capa BFF / Controladores:** `Router.gs`, `Controller_Dashboard.gs`.
3. **Capa de Infraestructura (Ingesta):** `Controller_BQ_Bootstrap.gs`, `Controller_Scheduler.gs`.
4. **Capa de Alertas:** `Controller_Alerts.gs`, `Service_Slack.gs`.
5. **Capa Core / Persistencia:** `Config.gs`, `DB.gs`, `SystemLogger.gs`, `Auth.gs`, `Audit.gs`.