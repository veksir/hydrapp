# HydrApp — Contexto de sesión (notas de mano)

App web (PWA) de seguimiento inteligente de hidratación. Backend Node/Express/SQLite
en `backend/`, frontend React+Vite en `frontend/`. Sin repo git, sin suite de tests.

## Dónde están los informes QA (Escritorio)

- `C:/Users/user/Desktop/informe-QA-backend-hydrapp.txt` — QA del backend (hallazgos A1-A3, M1-M7, B1-B7 TODOS resueltos y re-verificados; ver sección 6 con los últimos cambios).
- `C:/Users/user/Desktop/pruebas de usuarios y observaciones.txt` — pruebas de usabilidad con 6 usuarios simulados. Este es el documento con las tareas PENDIENTES.

## Estado de los hallazgos de UX (informe de usuarios)

Resuelto en la 2ª tanda (2026-08-02):
- **M4** Actividad de HOY: tarjeta "Actividad" tocable → `ActivitySheet` → `PUT /logs/context/today` (activity_minutes + activity_is_live).

Resuelto en la 3ª tanda (2026-08-02 noche): **H1, H2, H5, M1, M2, M7, M9, B11** (+B3 vía `/perfil`).

Resuelto en la 4ª tanda (2026-08-03): **H3, M3, M5, M6, M8, H4**.
- **H3** auto-refresh: `Dashboard.jsx` refresca en visibility/focus + polling 60s.
- **M3** clima en onboarding: `Setup.jsx` guarda `climate_temp/humidity` reales por geolocalización.
- **M5** historial: barras vs meta de cada día (back: `utils/historicalGoal.js` + `routes/logs.js`); días con 0 visibles.
- **M6** insights: etiquetas "días con registro"; racha ≥80%.
- **M8** cola offline: `offlineQueue.js` (localStorage + reintento al `online`).
- **H4** push: backend `routes/push.js` + `utils/{push,pushScheduler}.js`; front `push.js` + `sw.js`; activable desde `/perfil`.

No quedan hallazgos de prioridad alta/media. El plan visual `MEJORA-UX-REGISTRO.md` (P1-P3)
también quedó EJECUTADO (conteo/animación del anillo, `today-logs` reubicado tras el hero
con colapso, animación de entrada/salida de tragos, vibración háptica) junto con los iconos
vectoriales y elevación/sombras (README §7). Pendientes: solo bajos (B1, B2, B4, B6, B7, B8,
B9) más deuda visual de producto: modo oscuro, skeletons de carga, gráficas/sparklines en
Historial e Insights, transiciones entre pantallas y contraste de verdes a WCAG AA.

## Cambios recientes ya aplicados

2ª tanda (2026-08-02):
- Detección de "ráfagas" de consumo: `logs.js:151-167` + `logFeedback.js:17-33` (>=1.2L en 10 min = danger).
- Columna `activity_is_live` en `daily_context` (init.js:48, 106-109) + PUT /context/today la marca.
- `parseUtcTimestamp` movido a `utils/time.js:34-36` (reutilizado en thirstPredictor y logs).
- Frontend: `ActivitySheet.jsx` (nuevo), `Dashboard.jsx` (handleActivity, activityIsLive), `StatusCards.jsx` (tarjeta Actividad clickeable), `CenterAlert.jsx` (sin auto-dismiss).

3ª tanda (2026-08-02 noche, solo frontend): `/perfil` (Profile.jsx: precarga + edición + recipientes + cerrar sesión), lista "Hoy registraste" con borrado, onboarding sin exigir recipiente, aviso de factor de hidratación visible, validación de cantidad/actividad, CenterAlert con auto-dismiss.

4ª tanda (2026-08-03): H3 auto-refresh, M3 clima onboarding, M5 historial vs meta (back `historicalGoal.js` + `/logs/history`), M6 etiquetas honestas, M8 cola offline (`offlineQueue.js`), H4 push (back `routes/push.js`, `utils/pushScheduler.js`; front `push.js`, `sw.js`).

5ª tanda (2026-08-03, pulido visual — MEJORA-UX P1-P3 + íconos): RingProgress con count-up de ml + fill animado + pulso/brillo al 100% (respeta `prefers-reduced-motion`); `TodayLogs.jsx` nuevo movido tras el hero (Dashboard.jsx:215) con colapso >5 ("Ver N más" + "Ver historial completo"); highlight del trago nuevo y colapso/fade al borrar; vibración háptica `navigator.vibrate(30)`; Lucide en BottomNav/drinkIcons/StatusCards/TodayLogs (Trash2)/Insights; sombras de elevación en `.card`, nav inferior y FAB.

- Lint frontend: `npx oxlint src` → 0 errores, 2 warnings preexistentes.

## Archivos clave

- Backend: `backend/server.js` (trust proxy por `TRUST_PROXY`, CORS por `FRONTEND_ORIGIN`, errores JSON), `routes/{auth,profile,logs,containers,symptoms,insights,push}.js`, `utils/{calculator,iomTable,predictor,dailyStatus,thirstPredictor,logFeedback,symptomChecker,time,drinkTypes,auth-middleware,historicalGoal,push,pushScheduler}.js`, `db/init.js`.
- Frontend: `pages/{Dashboard,Setup,History,Insights,SymptomCheck,Login,Register,Profile}.jsx`, `components/{BottomNav,LogDrinkSheet,ActivitySheet,StatusCards,RingProgress,CenterAlert,EducationCapsule,TodayLogs,WaveBottle}.jsx`, `drinkIcons.jsx` (Lucide), `offlineQueue.js`, `push.js`, `sw.js`, `api.js`, `weather.js`.
- Motor de cálculo: `calculator.js` (IOM para <19, piso adultos 3000/2200ml, clima >30°C +100ml/grado, humedad >70% +10%, actividad x12ml/min, checkpoints con refuerzo de entreno en `predictor.js`).

## Notas de verificación rápida

- Backend arranca: `cd backend && node server.js` (puerto 4000). Requiere `JWT_SECRET` real en producción (placeholder aborta).
- Frontend: `cd frontend && npm run dev` (5173). API por defecto `http://localhost:4000/api`.
- El login/registro tienen rate limit 10/15min por IP (separados entre sí).
