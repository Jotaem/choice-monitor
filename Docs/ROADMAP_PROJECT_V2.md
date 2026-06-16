# 🗺️ ROADMAP DE IMPLEMENTACIÓN V2: CHOICE MONITOR 📊

**Objetivo del V2:** Transformar el MVP en una herramienta de grado Enterprise. Foco en rendimiento ultrarrápido, inteligencia geoespacial para expansión comercial (densidad de locales), estándares visuales UX/UI mundiales y operabilidad robusta.

**Regla de Oro Intocable:** La UI (Frontend) **NUNCA** ejecuta queries en vivo contra BigQuery. El problema de rendimiento se resuelve pre-agregando datos en el backend (BQ o GAS), reduciendo el payload JSON de miles de filas a solo cientos de objetos resumidos.

---

## FASE 7: Plan de Refactorización (Roadmap Etapa 2)
**Objetivo:** Generación de Roadmap V2. Buscamos eficientar el Backend y sistema de Cubos, añadir una capa de analisis geoespacial, mejorar la UX de visibilización de Gráficos y implementar sistema de telemetría.

## FASE 8: Refactorización de Rendimiento (Pre-Aggregation & Payload Optimization)
**Objetivo:** Reducir el tiempo de renderizado de la UI de "minutos" a "milisegundos".
* **Problema Actual:** El backend envía miles de filas crudas (`raw`) y el frontend realiza matemáticas pesadas en memoria cruzando arrays inmensos.
* **Solución Arquitectónica:** * Modificar `Controller_Dashboard.gs` para que consolide (reduzca) los datos en diccionarios antes de enviarlos, o modificar `Controller_BQ_Bootstrap.gs` para generar un *Summary Cube* directamente en Sheets.
* **Acciones para la IA:**
  1. Reescribir la función `_sheetToJSON` en `Controller_Dashboard.gs` para implementar un algoritmo de reducción/agrupación (Group By) por `ciudad`, `fecha` y `categoria`.
  2. El payload JSON devuelto a `window.CM` (Frontend) debe estar limitado estrictamente a los nodos necesarios para renderizar.
  3. Modificar `Scripts.html` para que Chart.js consuma directamente estas pre-agregaciones sin iterar múltiples veces el array global.

## FASE 9: Inteligencia Geoespacial (Mapa de Densidad y Cobertura)
**Objetivo:** Visualizar el Choice de manera física para que el equipo comercial identifique "zonas frías" y radios de entrega desaprovechados.
* **Componente Frontend:** Integrar `Leaflet.js` (mediante CDN) en `Index.html` dentro de la vista "Active Partners".
* **Tipos de Visualización Requeridos:** Capacidad de alternar entre Heatmap (densidad), Clústeres (Burbujas numéricas) y Polígonos de Radios de Entrega.
* **Acciones para la IA:**
  1. **Actualizar BQ Queries (`Controller_BQ_Bootstrap.gs`):** Modificar la extracción para incluir la query proporcionada:
     ```sql
     SELECT
       dim_area.area_name AS dim_area_area_name,
       (FORMAT_DATE('%Y-%m', date_lookup.date)) AS date_lookup_date_month,
       dim_partner.partner_status AS dim_partner_partner_status,
       IF(partner_delivery_areas.latitude IS NOT NULL AND partner_delivery_areas.longitude IS NOT NULL, 
          CONCAT(IFNULL(CAST(partner_delivery_areas.latitude AS STRING), ''),',',IFNULL(CAST(partner_delivery_areas.longitude AS STRING), '')), 
          NULL) AS partner_delivery_areas_location,
       partner_delivery_areas.polygon AS partner_delivery_areas_polygon
     ```
  2. **Tratamiento de Datos:** Parsear el campo `location` (Lat, Lng) y `polygon` en JS.
  3. **UI/UX:** Crear un div `<div id="choice-map"></div>` y renderizar los marcadores de locales activos y apagados por colores (usar la misma categorización de negocio: Zombie, Activo, Churned).

## FASE 10: Estandarización UX/UI y Corrección de Chart.js
**Objetivo:** Elevar los gráficos a estándares corporativos mundiales.
* **Acciones para la IA:**
  1. **Formato de Números (Compactación):** En `Scripts.html`, modificar todos los ejes Y y `tooltips` de Chart.js utilizando la API nativa de JS: `Intl.NumberFormat('es-CL', { notation: 'compact' })`. Los millones deben verse como "1,5M", miles como "10K".
  2. **Gráficos de Torta (Pie Charts):** Corregir la distribución. Si un Pie Chart muestra trozos iguales, es porque el Frontend está contando entidades (filas) en lugar de sumar métricas (`total_orders` o `sessions`). Reescribir el mapeo de datos del gráfico de torta.
  3. **Terminología Oficial:** Buscar y reemplazar en toda la capa UI (`Index.html` y `Scripts.html`) términos inventados.
     * *Incorrecto:* "Open Share % por Recepción" -> *Correcto:* "Open Time % por Sistema de Recepción".
     * Validar todo texto duro contra los estándares del negocio.
  4. **Modo Fullscreen:** Añadir un botón (icono "Expandir") en la esquina de cada tarjeta de gráfico. Conectarlo a una función JS que invoque `element.requestFullscreen()` para maximizar el canvas.

## FASE 11: Sistema de Alertas On-Demand (Testing)
**Objetivo:** Permitir simulaciones de alertas sin depender del Cron Job diario.
* **Acciones para la IA:**
  1. En `Controller_Alerts.gs`, crear una nueva función pública `runAlertTests()`.
  2. En `Index.html` (Vista de Alertas), añadir un botón secundario: "Probar Reglas Activas".
  3. Conectar el botón vía `google.script.run` a `runAlertTests()`. 
  4. *Regla:* Esta prueba debe ejecutarse en tiempo real, evaluar la caché actual y enviar el JSON a Slack *con un tag de [TEST]* en el mensaje, devolviendo un toast de éxito en la UI.

## FASE 12: Telemetría de Salud y Observabilidad Operativa
**Objetivo:** Garantizar que el sistema en sí (ingesta, APIs) sea estable y auto-reparable.
* **Acciones para la IA:**
  1. **System Health Board:** Crear una hoja oculta `CM_SYSTEM_HEALTH`.
  2. Modificar `Controller_Scheduler.gs` para registrar en esta hoja: Timestamp, Status (OK/FAIL), Rows Processed, y Execution Time.
  3. **Heartbeat Alert:** Si el status es FAIL por 2 ejecuciones consecutivas, usar `Service_Slack.gs` para enviar una alerta crítica al canal de administradores.
  4. **Audit.gs (Integridad):** Implementar la validación semanal que revisa que las cabeceras de los cubos (`CUBE_SESSIONS`, etc.) no hayan sido alteradas manualmente, forzando su reimpresión si no coinciden con `Config.gs`.