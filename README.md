# HydrApp — Seguimiento inteligente de hidratación

App web (PWA) que calcula tu meta diaria de agua con criterios científicos,
la personaliza según tu perfil y clima, y te avisa *antes* de que tengas sed
en vez de mandarte alarmas cada hora.

## Estructura

```
hydrapp/
├── backend/     API en Node.js + Express + SQLite
└── frontend/    App React + Vite, PWA instalable
```

## 0. Arranque rápido (en un solo clic)

En el Escritorio hay un lanzador **`iniciar-hydrapp.bat`** que ahora levanta
todo automáticamente. El script:

1. Comprueba que Node y npm estén instalados.
2. Instala las dependencias de `backend/` y `frontend/` si falta `node_modules`
   (solo la primera vez).
3. Libera el puerto 4000 si quedó colgado de una sesión anterior.
4. Arranca el backend (`node server.js` → `http://localhost:4000`).
5. Arranca el frontend de Vite expuesto a la red local (`npm run dev -- --host`).

Verificado en funcionamiento: backend responde `GET /api/health` y Vite sirve
con HTTP 200 en `http://localhost:5173`.

> Nota: la API del frontend queda fijada por `VITE_API_URL` en `frontend/.env`
> (por defecto `http://192.168.80.57:4000/api`). Si tu IP de red cambia,
> actualiza esa URL antes de arrancar.

## 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # ajusta JWT_SECRET y PORT si quieres
node server.js             # o: npm run dev (con recarga automática)
```

Por defecto queda escuchando en `http://localhost:4000`. La base de datos es
un archivo SQLite (`backend/db/hydrapp.sqlite`) que se crea solo, no
necesitas instalar ningún motor de base de datos aparte.

### Endpoints principales

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/auth/register` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión |
| GET/PUT | `/api/profile` | Ver/guardar perfil (peso, **edad, sexo**, clima, horarios...) |
| GET/POST/DELETE | `/api/containers` | Recipientes calibrados por el usuario |
| POST | `/api/logs` | Registrar un consumo de agua |
| GET | `/api/logs/today` | Meta del día, consumido, predicción de ritmo, insumos usados |
| PUT | `/api/logs/context/today` | Ajustar actividad/clima del día puntual (update parcial) |
| GET | `/api/logs/history?days=14` | Historial agregado por día |
| GET | `/api/symptoms/catalog` | Lista de síntomas para el chequeo |
| POST | `/api/symptoms/check` | Evalúa síntomas reportados vs ritmo de consumo de hoy |

Todas menos `register`/`login` requieren header `Authorization: Bearer <token>`.

## Motor de cálculo (actualizado con tabla IOM y nivel de actividad)

La meta diaria ya no es solo peso × 35ml. Ahora:

- **Menores de 19 años**: se usa directamente la tabla de ingesta adecuada
  del Instituto de Medicina (IOM) según edad y sexo — la fórmula por peso
  no está validada para esas edades.
- **Adultos (19+)**: se usa peso × (30/35/40 ml/kg según nivel de actividad
  general: sedentario/moderado/alto), pero nunca por debajo del piso IOM
  para su sexo (3000ml hombres / 2200ml mujeres, solo líquidos).
- Sobre esa base se suman los modificadores de estado fisiológico, clima
  y minutos de ejercicio de HOY (concepto aparte del nivel de actividad
  general — uno es tu línea base, el otro es cuánto entrenaste hoy).
- Si defines una hora habitual de entreno, los checkpoints cercanos a esa
  hora se refuerzan (antes para pre-hidratar, después para reponer sudor).

Ver `backend/utils/iomTable.js` y `backend/utils/calculator.js`.

## Seguridad

- `JWT_SECRET`: si no está configurado (o sigue en el placeholder de
  `.env.example`), el servidor se niega a arrancar en producción
  (`NODE_ENV=production`); en desarrollo genera uno aleatorio efímero en
  cada arranque, nunca un valor fijo conocido.
- Rate limiting **separado** en `/api/auth/login` y `/api/auth/register`
  (10 intentos cada 15 min por IP cada uno) — agotar uno no bloquea el otro.
- **`TRUST_PROXY=1`**: actívalo en el `.env` si despliegas detrás de Nginx
  (como en la sección 3 de este README). Sin esto, el rate limiter ve la IP
  del proxy para todos los visitantes y el límite se vuelve global —
  cualquier abuso pequeño bloquearía el login/registro de todo el sitio.
- CORS restringible por `FRONTEND_ORIGIN` en `.env` (coma-separado si hay
  varios dominios). Sin configurar, queda abierto para no romper el
  desarrollo local. Un origen no permitido responde 403, no 500.
- Email normalizado a minúsculas, validado con regex y con tope de 254
  caracteres; contraseñas nunca se devuelven ni se loguean.
- Los tokens JWT se verifican contra la base: si la cuenta fue borrada, el
  token deja de servir aunque la firma siga siendo válida.

## Chequeo de síntomas (no es diagnóstico médico)

`backend/utils/symptomChecker.js` cruza los síntomas que el usuario reporta
con su ritmo de consumo del día para distinguir entre posible deshidratación
y posible sobrehidratación — ambas comparten casi los mismos síntomas. La
respuesta siempre incluye una nota aclarando que no reemplaza atención
médica, y recomienda buscar ayuda profesional si hay síntomas severos
(confusión, letargo, náuseas) que no mejoran.

## Clima real por ubicación

En el dashboard, el botón "Usar mi ubicación" pide permiso de geolocalización
al navegador y consulta **Open-Meteo** (gratis, sin API key) para traer la
temperatura y humedad reales del momento, que sobreescriben el clima
"promedio" del perfil solo para el día de hoy. Ver `frontend/src/weather.js`.

## Diseño (rediseño "Professional Wellness Dashboard")

- Paleta: azul profundo `#2F80ED` + turquesa `#3CCFCF`, fondo `#F7F9FC` (no
  blanco puro), estados verde/amarillo/coral para excelente/precaución/riesgo.
- Home: anillo de progreso circular (no botella), tarjetas pequeñas de
  "Estado de hidratación" (concentración/rendimiento/clima/actividad),
  cápsula educativa diaria, y un mensaje inteligente que puede ser una
  **predicción de sed real** en vez de solo "vas al X%".
- Registro en dos toques: botón flotante central en el nav → bottom sheet →
  tipo de bebida → cantidad. Nada de formularios.
- Tipos de bebida con factor de hidratación real (agua/deportiva/leche=1.0,
  té/café=0.95, jugo=0.9, refresco=0.85) — el café SÍ cuenta como líquido,
  solo se descuenta un poco en bebidas azucaradas/con cafeína alta.
- Insights: promedio semanal/mensual, mejor día, racha, y un insight
  dinámico tipo "cuando hace más de 30°C tomas X% menos".

### Perfil real (ya no reabre el onboarding vacío)

Antes, el ícono "Perfil" del nav llevaba al mismo formulario de onboarding,
que NO cargaba los datos existentes — así que tocar "Continuar" sin cambiar
nada sobrescribía el sexo a "F" y los horarios a los defaults, en silencio.
Ahora `/perfil` (`frontend/src/pages/Profile.jsx`) precarga tu perfil real,
permite editarlo, gestionar recipientes (agregar/eliminar) y cerrar sesión.
`/configurar` (Setup.jsx) sigue existiendo solo para el onboarding inicial,
y ya no obliga a calibrar un recipiente para poder empezar.

### Registros de hoy visibles y eliminables

El dashboard ahora lista lo que registraste hoy (hora + tipo + cantidad)
con opción de borrar cada uno (con confirmación) — antes ese dato existía
en la respuesta de la API pero no se mostraba en ningún lado, así que un
registro por error se quedaba ensuciando la meta todo el día sin forma de
corregirlo.

### Detección de ráfaga (no solo por registro individual)

Antes, el aviso de "eso es mucho de golpe" solo miraba cada registro por
separado — alguien podía tomar 4-5 registros de 500-600ml en dos minutos
(cada uno "normal") y no recibir ningún aviso hasta que el acumulado del
día cruzara un umbral alto. `backend/utils/logFeedback.js` ahora también
suma el volumen bruto registrado en los últimos 10 minutos
(`recentBurstMl`) y avisa desde ahí, sin importar el tamaño de cada
registro individual.

### Actividad de hoy (tarjeta con propósito real)

La tarjeta "Actividad" del dashboard es tocable: abre un sheet para
registrar los minutos de ejercicio de HOY (`PUT /logs/context/today`), que
sí ajustan la meta del día. `activity_is_live` distingue si ese dato es
algo que el usuario reportó hoy o solo el promedio por defecto del perfil.

### Predicción de sed (no alarmas fijas)

`backend/utils/thirstPredictor.js` calcula tu intervalo promedio entre
tragos de HOY y, si ya te acercas o pasaste ese intervalo, reemplaza el
mensaje genérico por algo como *"según tu patrón, probablemente sentirás
sed en unos 15 minutos"* — el diferenciador central de la app.

### Pendiente de esta pasada de diseño (siguiente iteración)

- Onboarding paso a paso (el flujo actual sigue siendo un formulario largo
  en 2 pasos, no los 6 pasos cortos del concepto).
- Historial en vista calendario (hoy sigue siendo una lista de barras).
- Pantalla de "Perfil" como resumen (hoy el ícono de perfil en el nav va
  directo al formulario de edición, no a una vista de resumen).
- Microinteracciones más elaboradas (vibración, confeti/anillo que cambia
  de color al completar la meta más allá del color base).

## 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL apuntando a tu backend
npm run dev                 # desarrollo, http://localhost:5173
npm run build                # genera dist/ listo para producción
```

`npm run build` genera una **PWA completa** en `frontend/dist/` (manifest,
service worker, ícono). Ese `dist/` es lo único que necesitas subir a
hosting estático.

## 3. Desplegar en el dominio de tu amigo

Necesitas dos cosas corriendo:

**A. El backend (proceso Node persistente)**

En el servidor:
```bash
cd backend
npm install --production
npm install -g pm2          # mantiene el proceso vivo y lo reinicia si falla
pm2 start server.js --name hydrapp-api
pm2 save
```
Expón el puerto 4000 (o el que definas en `.env`) detrás de un proxy, por
ejemplo con Nginx:

```nginx
location /api/ {
    proxy_pass http://localhost:4000/;
    proxy_set_header Host $host;
}
```

**B. El frontend (archivos estáticos)**

```bash
cd frontend
# antes del build, en .env pon la URL real:
# VITE_API_URL=https://tudominio.com/api
npm run build
```
Sube el contenido de `frontend/dist/` a la raíz web que sirva tu amigo
(Nginx, Apache, o cualquier hosting estático). Como es una PWA, con HTTPS
activo los usuarios podrán "instalarla" desde el navegador del celular.

> Importante: la Web Crypto / Service Worker de las PWA solo funcionan sobre
> **HTTPS** (o `localhost`). Si el dominio de tu amigo no tiene certificado
> todavía, usa Let's Encrypt/Certbot — es gratis.

## 4. Notificaciones push reales (H4)

Ahora sí se puede avisar aunque la app esté cerrada, no solo con el
dashboard abierto:

1. Genera tu par de llaves: `npx web-push generate-vapid-keys` (dentro de
   `backend/`).
2. Ponlas en `backend/.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT` (un `mailto:` tuyo).
3. El usuario activa las notificaciones desde Perfil → "Activar
   notificaciones" (pide permiso del navegador y se suscribe).
4. Un planificador interno (`backend/utils/pushScheduler.js`) revisa cada 5
   minutos a los usuarios suscritos: si `thirst_prediction.likely` es cierto
   y no pasó su hora de dormir, manda un push — sin repetir antes de 45
   minutos para no saturar.

Requiere HTTPS real en producción (los navegadores no permiten push sobre
HTTP salvo `localhost`). El service worker (`frontend/src/sw.js`) maneja los
eventos `push` y `notificationclick`.

## 5. Otras mejoras de esta vuelta

- **H3 — el dashboard se actualiza solo**: refresca al volver a la pestaña y
  hace polling cada 60s mientras está visible, para que la predicción de sed
  no se quede con datos viejos.
- **M3 — clima real en el onboarding**: botón "Usar mi ubicación para tu
  clima" en Setup y en Perfil, que guarda la temperatura/humedad reales como
  base del perfil (ya no se queda fijo en 25°C hasta usar el botón diario).
- **M5 — historial honesto**: las barras ahora muestran el % contra la meta
  de CADA día (reconstruida con el clima/actividad de ese día si existía),
  no contra el día de máximo consumo del período. Los días sin registro
  también aparecen, marcados como "sin dato".
- **M6 — insights más claros**: las etiquetas aclaran que los promedios son
  "de los días con registro"; la racha bajó de exigir 100% a 80% de la meta.
- **M8 — cola offline simplificada**: si falla la conexión al registrar, el
  trago se guarda en `localStorage` y se reintenta solo al volver la señal
  (evento `online` + al abrir la app). Es una versión más simple que una
  cola real en IndexedDB con Background Sync, pero resuelve el caso de uso
  real: "no perder el registro por no tener señal".

## 7. Pulido visual (íconos vectoriales + percepción de progreso)

- **Íconos vectoriales (Lucide)** en vez de emojis en todo el frontend: nav
  inferior, tipos de bebida, tarjetas de estado, botones de ubicación,
  papelera. Se ven consistentes entre sistemas operativos.
- **Sombras de elevación** (`.card`, nav inferior) en vez de bordes planos de
  1px — estética más cercana a Material 3.
- **FAB de 46px** (antes 42px, ya cumple el mínimo de 44px de accesibilidad).
- **El progreso es el protagonista al registrar** (`MEJORA-UX-REGISTRO.md`,
  P1-P3): el número del anillo cuenta hacia arriba en vez de saltar directo
  al valor nuevo, con un pulso/brillo sutil al cruzar el 100% de la meta.
  "Hoy registraste" se movió justo debajo del anillo (antes al fondo de la
  página) para que el registro recién creado forme parte de la misma
  recompensa visual, con un destello verde breve al aparecer y un colapso
  suave al eliminarlo — nunca aparece/desaparece en seco. Con más de 5
  registros, la lista se colapsa con "ver N más" en vez de crecer sin
  límite. Vibración háptica breve al registrar en dispositivos compatibles.
  Todo respeta `prefers-reduced-motion`.

### Pendiente de pulido visual (siguiente iteración)

- Modo oscuro.
- Skeletons/shimmer en los estados de carga (hoy son mensajes de texto
  planos tipo "Cargando...").
- Gráficas/sparklines reales en Historial e Insights (hoy son listas/grids
  numéricos, aunque ya con base de cálculo honesta).
- Transiciones entre pantallas de la navegación.
- Contraste de verdes ajustado a WCAG AA.

## 9. Arreglos tras uso real (primera vuelta de retroalimentación de usuario)

Estos son los primeros bugs encontrados usando la app de verdad, no leyendo
código — por eso valen más que los informes anteriores:

- **Estado "Concentración/Rendimiento" casi nunca en verde**: el umbral de
  "atrasado" era un valor FIJO de 150ml, sin importar el tamaño de la meta
  — para una meta de 3300ml eso es apenas 4.5% de margen, prácticamente
  imposible de no disparar. Ahora los umbrales son proporcionales a la meta
  (~10%/25%) y hay un margen de gracia de 30 minutos justo al despertar
  (antes el primer checkpoint ya "esperaba" ~15% de la meta literalmente al
  minuto de abrir los ojos). Ver `backend/utils/predictor.js`.
- **Mensaje contradictorio al superar la meta**: si ya tomaste más de tu
  meta del día pero llevabas rato sin registrar nada, la predicción de sed
  igual decía "ya deberías sentir sed, toma agua" — no tenía en cuenta que
  ya habías cumplido. Ahora, si la meta ya está cumplida/superada, ese
  mensaje no se muestra (usa el mensaje de ritmo normal, que reconoce que
  vas "adelantado"). Ver `backend/utils/dailyStatus.js`.
- **Input de volumen desbordaba la tarjeta** en "Tus recipientes calibrados"
  (Perfil): los inputs dentro de `.field` no tenían `width: 100%`, así que
  el navegador les daba un ancho mínimo propio que no respetaba el
  contenedor angosto. Arreglado en `index.css`/`layout.css`.

### Nota sobre "Ver historial completo"

Hoy sigue mostrando solo barras de cantidad vs. meta por día — es una
limitación conocida y ya documentada (sección "Pendiente de pulido visual"),
no un bug nuevo. La vista calendario/gráficas queda para la siguiente
iteración de diseño.

## 8. Qué sigue (v2)

- Asistente conversacional de dudas sobre hidratación (Groq API, gratis)
- Estimación de volumen del vaso por foto (visión por cámara)
- Balance de electrolitos (sodio/potasio/magnesio)
- Cola offline real con IndexedDB + Background Sync (la actual es una
  versión simplificada con localStorage, suficiente pero no tan robusta)
- Microinteracciones (vibración, confeti al completar meta)
- Recuperación de contraseña

## 5. Deuda técnica conocida (baja prioridad, documentada a propósito)

- **JWT sin refresh ni rotación**: el token dura 30 días y no hay forma de
  revocarlo del lado del servidor si se roba. Aceptable para una app
  pequeña; si crece, valdría la pena una tabla de sesiones o tokens de
  corta duración + refresh token.
- **Estimador de volumen por altura** (`Setup.jsx`) usa un diámetro fijo de
  7cm — es un puente documentado hacia la estimación por foto real (v2),
  no una medición precisa.
- **`.gitignore`** ya excluye `node_modules`, `dist` y `.env`; si en algún
  momento generas un `repomix-output.xml` u otro volcado del repo para
  compartirlo, agrégalo también al `.gitignore` antes de subirlo.
