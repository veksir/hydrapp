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

## Bugs pendientes (del audit de seguridad/calidad, sin corregir a la fecha)

Confirmados leyendo el código actual (no son solo hipótesis del audit):

### 2. Race condition en el borrado de logs desde la UI
- **Archivos:** `frontend/src/components/TodayLogs.jsx` (`handleDelete`) y
  `frontend/src/pages/Dashboard.jsx` (`handleDeleteLog`, línea ~163).
- **Problema:** `handleDelete` en TodayLogs marca el id como "removiendo"
  (para la animación CSS) y recién 240ms después llama a `onDelete(id)`,
  que en Dashboard hace `await api.deleteLog(id)` + `await load()`. No hay
  guard contra doble-click/doble-tap antes de que se dispare ese timeout —
  se puede llamar `api.deleteLog` dos veces con el mismo id (la segunda
  devuelve error y se muestra un mensaje de error aunque el borrado ya
  haya funcionado). Tampoco hay guard si el polling automático (cada 60s,
  ver README sección 6) recarga `data.logs` mientras la animación de 240ms
  está en curso.
- **Fix esperado:** deshabilitar el botón de borrar (o filtrar por
  `removingIds`) mientras un id ya está en proceso de borrado, y idealmente
  mover el `await onDelete(id)` real antes de la animación (optimistic UI)
  en vez de después.

### 3. Null handling en el override de clima
- **Estado real tras revisar el código:** esto parece **más resuelto de lo
  que sugería el audit**. `backend/routes/logs.js` (líneas ~42-50) ya valida
  `temp_override`/`humidity_override` como número finito o `null`/`undefined`
  explícitamente, y `dailyStatus.js`/`historicalGoal.js`/`insights.js` usan
  `??` (nullish coalescing) contra `profile.climate_temp` en todos los
  puntos de lectura. **Antes de asumir que sigue roto, re-verificar contra
  el hallazgo específico del audit** — puede que ya se haya corregido en un
  commit posterior y solo falte tacharlo de la lista, o puede que el bug
  esté en un caso más puntual (ej. `frontend/src/weather.js` no valida que
  `data.current` exista antes de leer `.temperature_2m` si Open-Meteo
  devuelve una respuesta sin ese campo — ahí sí falta un chequeo).

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
