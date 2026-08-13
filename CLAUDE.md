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

### 4. Tocar la gráfica de tendencia en Historial era casi imposible en el celular
- **Archivo:** `frontend/src/components/HistoryChart.jsx` (+`.css`). Hallazgo de
  `AUDITORIA-UX.md` (ítem 16, prioridad media).
- **Problema:** cada punto se dibujaba con `r=2.5` (diámetro real ~5px) y el
  tooltip solo se activaba con `onMouseEnter`/`onTouchStart` exactamente sobre
  ese punto. El dedo cubre varios días y el target era diminuto: el hint
  "Toca un punto para ver el detalle" fallaba en casi todos los toques en móvil.
- **Fix aplicado:** se reemplazó el tap-sobre-punto por pointer events con
  resolución del día por **coordenada X** (un dedo de ~48px siempre cae en el
  día más cercano aunque la columna mida solo ~10px con 30 días en la gráfica),
  **guía vertical** + punto agrandado en el día activo (feedback visual de qué
  día quedó seleccionado) y **scrub**: mantener y deslizar el dedo recorre el
  detalle día a día en vivo; al soltar, la selección queda fijada en ese día
  (el `pointerleave` al levantar el dedo no la borra, solo el mouse la limpia).
  `touch-action: none` en el SVG evita que el
  scroll de la página robe el gesto. El dibujo visual no cambió (punto de
  2.5px, 6px al activo) y el hover del mouse se conserva vía los mismos
  pointer events.
- **Commit:** `437068e`/`0f53348`/`e3b2365` — 2026-08-13 (mergeado a main;
  este archivo tenía el estado desactualizado como "pendiente de merge").
  `3949c7c` (timeout en fetch de Dashboard) es un fix aparte de la misma
  sesión, no relacionado al touch target.

### 5. Contraste de verdes por debajo de WCAG AA
- **Archivo:** `frontend/src/index.css` (solo bloque `:root`, modo claro).
- **Problema:** `--success` (`#49C27A`) usado como color de **texto** (valor
  en `StatusCards`, pill "OK", chips de meta cumplida en el dashboard,
  `--success-tint-ink` en el número del día en `HistoryCalendar`) daba
  ratios de 2.04–3.94:1 contra los fondos donde se usa (`--surface`,
  `--bg`, `--success-tint`). WCAG AA exige 4.5:1 para texto normal (los
  usos son 13–15px, ninguno califica como "texto grande"). El modo oscuro
  (`--success: #5FD895`) ya cumplía de sobra (8.2–10.5:1), no se tocó.
- **Fix aplicado:** se oscureció `--success` a `#2A7E4C` y
  `--success-tint-ink` a `#1B7E49` (mismo tono, luminosidad ajustada), sin
  tocar ningún componente — mismo patrón que el modo oscuro: la paleta
  vive centralizada en variables CSS, así que el fix es solo ahí. No
  quedaban hex sueltos del verde viejo fuera de `index.css` (se verificó
  con grep).
- **Verificado:** ratios recalculados (fórmula WCAG relative luminance):
  texto sobre `--surface` 5.02:1, sobre `--bg` 4.76:1, sobre
  `--success-tint` 4.53:1, `--success-tint-ink` sobre `--success-tint`
  4.59:1 — los 4 pasan AA. `npm run build` limpio, `oxlint` sin warnings
  nuevos (9 preexistentes, ninguno en archivos tocados — el cambio es
  puramente CSS). Pendiente: revisión visual manual de Kevin en
  Dashboard/Historial/Perfil en claro y oscuro.
- **Commit:** pendiente (branch `fix/wcag-contraste-verde`).

### 6. Botón "Registrar" estiraba la sección hacia la derecha en el sheet (y la vista quedaba "corrida")
- **Archivos:** `frontend/src/components/LogDrinkSheet.css`, `LogDrinkSheet.jsx`, `BottomSheet.jsx`.
- **Problema:** en el paso 2 del sheet de bebida, la fila `input + Registrar` podía desbordar el ancho del sheet hacia la derecha (el input flex no tenía `min-width: 0`, y el botón podía comprimirse). Además, al cambiar de paso el scroll del sheet se conservaba: si el paso 1 era largo (muchos recipientes) y el usuario estaba abajo, el paso 2 renderizaba "corrido" a la altura del scroll anterior.
- **Fix aplicado:** la fila `.amount-custom` ahora tiene `max-width: 100%` y `align-items: center`; el input gana `min-width: 0` (absorbe el espacio sobrante sin desbordar) y el botón `flex-shrink: 0` + `white-space: nowrap` (nunca se comprime ni empuja el input). En `LogDrinkSheet` se agrega un `useEffect` con ref al contenedor del sheet (`contentRef` nuevo en `BottomSheet`) que recoloca el scroll arriba al abrir y al cambiar de paso.
- **Commit:** `ab2c549` — 2026-08-13 (branch `fix/sheet-registrar-desborde`, mergeada a main).

### 7. Clima en Setup: tras detectar quedaba "Clima detectado ✓ (volver a detectar)"
- **Archivo:** `frontend/src/pages/Setup.jsx`.
- **Problema:** tras el primer uso de "Usar mi ubicación para tu clima", el botón cambiaba a "Clima detectado ✓ (volver a detectar)". Ese "(volver a detectar)" se leía como una instrucción de rehacerlo y confundía (parecía que faltaba algo).
- **Fix aplicado:** el estado detectado ahora dice "Clima detectado con tu ubicación ✓" — comunica que el dato quedó tomado, sin invitar a repetir. (El botón sigue permitiendo re-detectar si se toca; el hint de abajo ya avisa que se ajusta desde el dashboard.) De paso se limpiaron otras frases raras del mismo onboarding: el hint del sexo ("piso de referencia científico" → "calcular tu meta base según las guías científicas") y el hint de recipientes del paso 2 ("no usamos vasos 'estándar' predefinidos" era confuso y chocaba con el tipo "Recipiente normal" — se quedó solo con el mensaje de valor: calibrar una vez, usar siempre).
- **Commit:** `4dbb0dd` — 2026-08-13 (branch `fix/textos-onboarding`, mergeada a main).

### 8. Notificaciones "activadas por defecto" que nunca llegaban
- **Archivos:** `backend/routes/push.js`, `frontend/src/api.js`, `frontend/src/push.js`, `frontend/src/pages/Profile.jsx`.
- **Problema:** el estado del toggle se derivaba solo de `pushManager.getSubscription()` (lado navegador). Si el navegador conservaba una suscripción que el backend ya no tenía guardada (p.ej. al reiniciarse la base del servidor), la UI mostraba "activadas" y "Enviarme una de prueba" respondía "enviada" cuando en realidad `sendPushToUser` encontraba 0 suscripciones y no llegaba nada. Recién al desactivar/reactivar manualmente (que re-persistía en el backend) la prueba funcionaba.
- **Fix aplicado:** nuevo endpoint `GET /api/push/subscriptions` (backend) devuelve los endpoints guardados del usuario; `getPushSubscriptionStatus` exige que el endpoint del navegador exista TAMBIÉN en el backend para reportar "activado" (si no, muestra desactivado para re-activar sin fricción). `subscribeToPush` re-persiste la suscripción existente del navegador en vez de intentar crear otra (evita `InvalidStateError` por applicationServerKey distinto y cubre el caso de base reiniciada). `handleTestPush` ahora revisa `result.sent`: si es 0 avisa que la suscripción ya no está activa en el servidor en vez de decir que se envió.
- **Commit:** `3188fca` — 2026-08-13 (branch `fix/notif-estado-real`, mergeada a main).

### 9. Opción de recipiente que decía "Otro (vaso normal)" confundía
- **Archivo:** `frontend/src/components/ContainerForm.jsx`.
- **Problema:** la primera opción del dropdown "Tipo de recipiente" al agregar un recipiente era "Otro (vaso normal)". "Otro" como opción por defecto no comunica que es el caso más común, y "vaso normal" apuntaba a algo que la app no usa (la app no tiene vasos estándar).
- **Fix aplicado:** la opción `custom` ahora se llama "Recipiente normal".
- **Commit:** `4dbb0dd` — 2026-08-13 (branch `fix/textos-onboarding`, mergeada a main).

### 10. Recomendación de "ponerse al día" que empujaba a tomar mucha agua de golpe
- **Archivos:** `backend/utils/predictor.js`, `backend/utils/assistant.js` (solo el system prompt).
- **Problema:** la base científica SÍ estaba en el código — `logFeedback.js` y `symptomChecker.js` ya avisan que "el cuerpo absorbe mejor el agua en sorbos distribuidos que en una sola toma grande" y `dailyStatus.js`/`effectiveWakeTime` ya recalibran la hora de despertar para no acumular una deuda irreal. Pero las recomendaciones de "emparejarse" de `getHydrationStatus` la contradecían: al llevar mucho rato sin tomar agua, el déficit crecía y el mensaje reportaba el total como objetivo inmediato ("Vas 1800ml por detrás de tu ritmo esperado. Toma agua ahora." y "Estás un poco atrasado (400ml). Un vaso de agua ahora te pone al día."). Leído en el dashboard, invitaba a recuperar todo ese déficit de una sola vez — justo el atracón que la misma app desaconseja en otro lado. Los mensajes de `predictThirst` ("Buen momento para tomar agua") tampoco mencionaban la pauta de sorbos.
- **Fix aplicado:** se reescribieron, en español neutro, los dos mensajes que recomendaban "ponerse al día". `muy_atrasado`: reporta el déficit con honestidad, la recuperación la retoma la app (los checkpoints siguen) y la acción inmediata es un vaso — la unidad real que la app registra — con el único caveat científico de no intentar recuperar el total de una sola vez, sin tope para la sed ("Vas 1764ml por detrás de tu ritmo. Registra un vaso ahora y retoma tu ritmo normal — no intentes recuperar todo de una sola vez."). `atrasado`: se alineó al mismo marco de recuperación gradual, porque "Un vaso de agua ahora te pone al día" sobreprometía justo después del mensaje de no-atracón (el déficit puede superar el tamaño de un vaso y el mensaje insistía con "atrasado": "Estás un poco atrasado (518ml). Un vaso ahora te acerca — sigue registrando."). (Descartadas en el proceso: "repartir el resto en el día" — al no ser una unidad de la app podía incentivar subconsumo y atrasar más — y la pauta de "sorbos" en los mensajes — tampoco es una unidad que la app maneje.) `predictThirst` quedó sin cambios. Al asistente (Groq) se le agregó la regla de recuperarse de a poco cuando alguien está atrasado, para que no contradiga a la app. El detalle "el agua se absorbe mejor si no se toma en grandes cantidades" queda en la advertencia de no recuperar todo de una sola vez y en el aviso de cantidad/sobrehidratación de `logFeedback`.
- **Verificado:** escenarios forzados en local — muy atrasado (defícit 1764ml → "Registra un vaso ahora y retoma tu ritmo normal — no intentes recuperar todo de una sola vez."), atrasado (déficit 518ml → "Estás un poco atrasado (518ml). Un vaso ahora te acerca — sigue registrando.") y sed probable (mensaje original, sin cambios); backend carga sin errores.
- **Commit:** `0615039` — 2026-08-13 (branch `fix/ponerse-al-dia-sin-atracón`, mergeada a main). Ajuste posterior alinear `atrasado` (y español neutro): `de2c970` (branch `fix/alinear-atrasado-y-espacio-neutral`, mergeada a main).

## Features cerrados

### Modo oscuro
- **Archivos nuevos:** `frontend/src/context/ThemeContext.jsx` (Provider +
  hook `useTheme`, mismo patrón que `AuthContext.jsx`).
- **Archivos modificados:** `frontend/index.html` (script inline que aplica
  `data-theme` antes del primer render, evita flash de tema incorrecto),
  `frontend/src/main.jsx` (envuelve con `ThemeProvider`), `frontend/src/index.css`
  (bloque `:root[data-theme="dark"]` + variables "tint" nuevas para
  success/warning/danger/primary), `frontend/src/pages/Profile.jsx`
  (toggle Claro/Oscuro/Sistema, tarjeta "Apariencia"),
  `frontend/src/layout.css` (estilos del toggle) y todos los `.css` de
  componentes que tenían color hex hardcodeado en vez de variable
  (`CenterAlert.css`, `EducationCapsule.css`, `HistoryCalendar.css`,
  `LogDrinkSheet.css`, `StatusCards.css`, `TodayLogs.css`).
- **Qué hace:** tres opciones (Claro/Oscuro/Sistema), persistidas en
  `localStorage` (`hydrapp_theme`). En "Sistema" sigue en vivo
  `prefers-color-scheme` vía `matchMedia` con listener de `change`, no
  solo al cargar.
- **Decisión de implementación:** la paleta ya vivía centralizada en
  variables CSS en `index.css`, así que el modo oscuro se resolvió
  sobreescribiendo esas mismas variables bajo `[data-theme="dark"]`, sin
  tocar la lógica de ningún componente. El trabajo real fue encontrar y
  migrar ~20 colores hex sueltos (fondos "tint" de success/warning/danger,
  hovers de azul) que estaban hardcodeados fuera de `index.css` — esos sí
  quedaban rotos (colores claros fijos) si no se migraban a variable.
- **Backend:** sin cambios.
- **Verificado:** `npm run build` limpio; `oxlint` sin warnings nuevos
  (los 2 de `Profile.jsx` ya existían en main, y el de `ThemeContext.jsx`
  sigue el mismo patrón aceptado que `AuthContext.jsx`). Prueba manual de
  Kevin (12-ago) completa: toggle Claro/Oscuro/Sistema instántaneo,
  "Sistema" siguiendo al SO en vivo sin recargar, sin flash de tema claro
  al cargar en frío con oscuro activo, contraste de los "tint" correcto
  en HistoryCalendar/StatusCards, y revisión de todas las pantallas
  (Dashboard, Historial, Perfil, Insights, Login/Register).
- **Estado:** merged a main vía fast-forward en `a3bbce1` — 2026-08-12.

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

### Recipientes de gran capacidad con tomas parciales
- **Qué hace:** un recipiente marcado como termo/jarra/botellón
  (`container_type` ≠ `custom`) o con volumen >3000ml ya no registra toda
  su capacidad de una sola vez: abre una tarjeta (`LargeContainerCard`) con
  nivel de líquido restante, toma parcial (decanta del `current_volume`) y
  rellenado manual. Cada recipiente tiene su propio contenido (`drink_type`
  con factor de hidratación) que manda sobre la selección global del sheet.
- **Backend:** columna `drink_type` en `containers` (+migración ALTER en
  `backend/db/init.js`); `PUT /api/containers/:id` para editar (al cambiar
  volumen **escala `current_volume` proporcionalmente** si el recipiente se
  reseteó hoy); `POST /:id/sip` usa el `drink_type` del recipiente con
  fallback a body y luego "agua". El registro de logs se extrajo a
  `backend/utils/createWaterLog.js` (compartido por `logs.js` y el sip),
  manteniendo meta, factor de hidratación y detector de ráfagas intactos.
- **Frontend:** `ContainerForm.jsx` (tipo + contenido siempre visibles, modo
  edición), `Profile` con botones Editar/Eliminar y tag "toma parcial",
  `LogDrinkSheet` con pasos 1/2/3 y acceso directo a recipientes en el paso
  1, `LargeContainerCard` con confirmación **dentro de los botones** (no
  desplaza el layout), `Dashboard` con `handleSip`/`handleRefill` inline.
- **Extras transversales del branch:** `ConfirmDialog` propio reemplaza al
  `window.confirm` del navegador al eliminar registros; `BottomSheet` ganó
  botón de cierre "×" (visible en todos los pasos, no dependía solo del
  backdrop, que en celular con muchos recipientes cubría toda la pantalla).
- **Backend verificado:** PUT 1500→2000 con restante 1000 → 1333; sip sin
  drink en body usa el del recipiente; PUT inválido → 400; sip > restante →
  400. **Frontend:** `npm run build` limpio, `oxlint` sin warnings nuevos
  (10 pre-existentes). Prueba manual de Kevin: pendiente de sesión final en
  celular (layout del Perfil y sheet con >2 recipientes).
- **Estado:** en branch `feat/recipientes-gran-capacidad` (5 commits,
  sin mergear a main): `f48bbf7` (backend), `c26600b` (edición frontend),
  `68fe55c` (styles), `2279a8a` (tomas parciales sheet), `2c0de99`
  (ConfirmDialog + cierre sheet) — 2026-08-13.

## Pendiente

Consolidado desde el README (que tenía ítems ya cerrados mezclados con
pendientes reales — ver commit de limpieza). Actualizar esta lista al
cerrar cada ítem, moviéndolo a "Bugs resueltos" o "Features cerrados".

### Funcional (mayor impacto)
- Recuperación de contraseña — no existe, es la única brecha funcional
  real del backlog (todo lo demás es pulido visual o deuda técnica de
  bajo impacto).
- Cola offline real con IndexedDB + Background Sync — hoy es una versión
  simplificada con `localStorage` (decisión consciente, documentada en
  README sección 5, M8).

### Diseño / UX
- Onboarding paso a paso (6 pasos cortos) — hoy sigue siendo un
  formulario largo en 2 pasos.
- Pantalla "Perfil" como resumen — hoy el ícono de perfil en el nav va
  directo al formulario de edición, no a una vista de resumen.
- Confeti/anillo que cambia de color al completar la meta (la vibración
  háptica ya está implementada, ver README sección 7).
- Sparklines/gráficas reales en **Insights** (Historial ya las tiene desde
  el feature de calendario/gráfica de tendencia).
- Skeletons/shimmer en estados de carga (hoy son mensajes de texto plano
  tipo "Cargando...").
- Transiciones entre pantallas de la navegación.
- Estimador de volumen por altura (`Setup.jsx`) usa diámetro fijo de 7cm.

### Exploratorio (v2, sin comprometer fecha)
- Estimación de volumen del vaso por foto (visión por cámara).
- Balance de electrolitos (sodio/potasio/magnesio).

### Deuda técnica (documentada, no urgente)
- JWT sin refresh ni rotación (dura 14 días, sin revocación server-side
  salvo borrar la cuenta).

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
