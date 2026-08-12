# Contexto de HydrApp para trabajar con Claude

Este archivo existe para que cualquier sesión nueva (Claude Code o chat) arranque
con el contexto real del proyecto, sin depender de un chat largo. Actualizarlo
cada vez que cambie algo estructural o se cierre un bug de la lista de abajo.

## Qué es

PWA de hidratación inteligente. Repo: github.com/veksir/hydrapp (autor: veksir / Kevin Sena Molina).

- `backend/` — Node.js + Express + SQLite (better-sqlite3, sync). Deploy en Render.
- `frontend/` — React + Vite PWA. Deploy en Vercel.
- Asistente conversacional vía Groq (llama-3.3-70b-versatile), sin memoria server-side.
- Push notifications con VAPID + web-push, scheduler interno cada 5 min.
- Clima real vía Open-Meteo (sin API key).

El README.md documenta con mucho detalle arquitectura, seguridad, motor de
cálculo de meta (tabla IOM) y el historial de bugs ya corregidos ("Arreglos
tras uso real", secciones 7). **Leer el README primero** — ya tiene la mayoría
del contexto de producto; este archivo es solo para lo operativo/pendiente.

## Cómo trabaja Kevin (para no tener que repetirlo)

- Rol: arquitecto y control de calidad. Delega implementación a IA, pero
  verifica todo como si fuera producción real antes de aceptarlo.
- Prefiere soluciones conservadoras y de bajo mantenimiento — sin
  over-engineering, sin dependencias/infra que no haga falta.
- Le gusta que se le señalen inconsistencias con lo dicho antes, no que se
  le siga la corriente.
- Comunicación directa y honesta, sin adornos.

## Bugs resueltos

### 1. Push notifications no revisaban si ya se cumplió la meta del día
- **Archivo:** `backend/utils/pushScheduler.js`, función `checkAndNotifyUser`.
- **Problema:** solo chequeaba `status.thirst_prediction?.likely`. En
  `backend/utils/dailyStatus.js`, cuando `alreadyMetGoal` es true, el código
  cambiaba `hydrationStatus.message` a uno distinto, pero **no** apagaba
  `thirst_prediction.likely` ni exponía `alreadyMetGoal` al resultado. El
  scheduler nunca veía ese flag, así que podía seguir mandando push de
  "vas a tener sed" a alguien que ya cumplió su meta.
- **Fix aplicado:** se expuso `hydrationStatus.goal_met = alreadyMetGoal` en
  `getTodayGoalAndStatus`, y `checkAndNotifyUser` ahora retorna antes de
  enviar si `status.goal_met` es true. Verificado con escenario forzado
  (meta cumplida + sed probable) en local: no se generó push.
- **Commit:** `bd4ab29` — 2026-08-11 (branch `fix/push-goal-met`, mergeada a main).

### 2. Race condition en el borrado de logs desde la UI
- **Archivos:** `frontend/src/components/TodayLogs.jsx` (`handleDelete`) y
  `frontend/src/pages/Dashboard.jsx` (`handleDeleteLog`).
- **Problema:** `handleDelete` en TodayLogs marcaba el id como "removiendo"
  (para la animación CSS) y recién 240ms después llamaba a `onDelete(id)`,
  que en Dashboard hace `await api.deleteLog(id)` + `await load()`. No había
  guard contra doble-click/doble-tap antes de que se dispare ese timeout —
  se podía llamar `api.deleteLog` dos veces con el mismo id (la segunda
  devolvía error y se mostraba un mensaje de error aunque el borrado ya
  hubiera funcionado). Tampoco había guard si el polling automático recargaba
  `data.logs` mientras la animación de 240ms estaba en curso.
- **Fix aplicado:** guard síncrono `removingRef` (useRef) que bloquea un
  segundo `handleDelete(id)` encolado por doble-click/tap (el `window.confirm`
  bloquea el hilo y podía dejar un segundo callback en cola antes del
  re-render). El botón además queda `disabled` mientras `isRemoving`. Si el
  borrado real falla, el catch libera el guard para permitir reintentar en vez
  de dejar la fila trabada. `handleDeleteLog` en Dashboard re-lanza el error
  para que el componente hijo sepa que falló.
- **Commit:** `6db65b8` — 2026-08-11 (branch `fix/delete-race-and-weather-nulls`, mergeada a main).

### 3. Null handling en el override de clima
- **Estado real tras revisar el código:** `backend/routes/logs.js` ya validaba
  `temp_override`/`humidity_override` como número finito o `null`/`undefined`
  explícitamente, y `dailyStatus.js`/`historicalGoal.js`/`insights.js` usan
  `??` (nullish coalescing) contra `profile.climate_temp` en todos los
  puntos de lectura. **El caso que sí faltaba** era `frontend/src/weather.js`:
  no validaba que `data.current` exista ni que `temperature_2m`/
  `relative_humidity_2m` sean números antes de leerlos.
- **Fix aplicado:** `getCurrentWeather` ahora valida que
  `data?.current?.temperature_2m` y `data?.current?.relative_humidity_2m` sean
  números; si no, lanza el mismo mensaje controlado
  ("No se pudo consultar el clima") en vez de un TypeError crudo. Verificado
  con mocks: respuesta sin `current`, sin `temperature_2m`, y HTTP error →
  siempre mensaje controlado; respuesta válida resuelve correctamente.
- **Commit:** `6db65b8` — 2026-08-11 (branch `fix/delete-race-and-weather-nulls`, mergeada a main).

## Features cerrados

### Historial en vista calendario
- **Archivos nuevos:** `frontend/src/components/HistoryCalendar.jsx` (+`.css`),
  `frontend/src/components/HistoryChart.jsx` (+`.css`).
- **Archivos modificados:** `frontend/src/pages/History.jsx` (toggle
  Calendario/Lista), `frontend/src/layout.css` (estilos del toggle).
- **Qué hace:** grid mensual tipo heatmap coloreado por % de meta cumplida
  por día, con detalle al tocar un día (reutiliza `BottomSheet`), más una
  gráfica de tendencia de los últimos 30 días. Ambos en SVG/CSS puro, sin
  librería de gráficas nueva (decisión consciente, documentada en el README
  sección de Historial).
- **Backend:** sin cambios — `GET /api/logs/history` ya soportaba hasta 90
  días; el frontend simplemente pide 90 en vez de 14 para el calendario.
- **Verificado:** `npm run build` limpio, `oxlint` sin warnings sobre los
  archivos nuevos/tocados. Prueba manual de Kevin (12-ago) completa:
  zona horaria (borde "hoy" de noche), límite de 90 días (deshabilitado
  correcto de los botones atrás/adelante), alineación del grid en meses
  que empiezan en días distintos, detalle del día con datos reales,
  toggle Calendario/Lista, y gráfica de tendencia (segmentos cortados en
  huecos, tooltip correcto).
- **Fix de sesión (12-ago):** `HistoryCalendar.jsx` marcaba "hoy" con
  `today.toISOString().slice(0,10)` (fecha UTC). Entre las 19:00 y 23:59
  en Colombia (UTC-5) resaltaba la celda del día SIGUIENTE. Se cambió a
  construir la fecha local (`getFullYear/getMonth/getDate`).
- **Estado:** merged a main vía fast-forward en `6e6a714` — 2026-08-12.

## Convenciones del repo (ya decididas, no re-discutir)

- Sin GitHub Actions ni widgets de mantenimiento pesado en el README/perfil.
- Deuda técnica se documenta explícitamente en el README en vez de
  esconderse (ver sección 9) — seguir ese patrón al cerrar bugs: si algo
  queda como decisión consciente, anotarlo ahí, no dejarlo implícito.
- Migraciones/cambios grandes van en branches nombradas, nunca directo a
  main si el sistema está en producción real (patrón usado en otros
  proyectos de Kevin, aplicar igual acá si aplica).

## Cómo usar este archivo

- Antes de empezar una sesión nueva, leer este archivo primero.
- Al cerrar un bug de la lista de arriba, moverlo a una sección "Resuelto"
  con el commit/fecha, no borrarlo (para no perder el rastro de qué se
  investigó).
- Si se toma una decisión nueva de arquitectura o convención, agregarla acá,
  no solo en el chat.
