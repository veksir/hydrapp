# HydrApp — Seguimiento inteligente de hidratación

App web (PWA) que calcula tu meta diaria de agua con criterios científicos, la personaliza según tu perfil y clima, y te avisa antes de que tengas sed en vez de mandarte alarmas cada hora.

## Estructura

```
hydrapp/
├── backend/     API en Node.js + Express + SQLite
└── frontend/    App React + Vite, PWA instalable
```

## 1. Backend

```
cd backend
npm install
cp .env.example .env      # ajusta JWT_SECRET y PORT si quieres
node server.js             # o: npm run dev (con recarga automática)
```

Por defecto queda escuchando en `http://localhost:4000`. La base de datos es un archivo SQLite (`backend/db/hydrapp.sqlite`) que se crea solo, no se necesita instalar ningún motor de base de datos aparte.

### Endpoints principales

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/auth/register` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión |
| GET/PUT | `/api/profile` | Ver/guardar perfil (peso, edad, sexo, clima, horarios...) |
| GET/POST/DELETE | `/api/containers` | Recipientes calibrados por el usuario |
| POST | `/api/logs` | Registrar un consumo de agua |
| GET | `/api/logs/today` | Meta del día, consumido, predicción de ritmo, insumos usados |
| PUT | `/api/logs/context/today` | Ajustar actividad/clima del día puntual (update parcial) |
| GET | `/api/logs/history?days=14` | Historial agregado por día |
| GET | `/api/symptoms/catalog` | Lista de síntomas para el chequeo |
| POST | `/api/symptoms/check` | Evalúa síntomas reportados vs ritmo de consumo de hoy |

Todas menos `register`/`login` requieren header `Authorization: Bearer <token>`.

### Motor de cálculo (tabla IOM y nivel de actividad)

La meta diaria no se calcula solo con peso × 35ml:

- **Menores de 19 años**: se usa directamente la tabla de ingesta adecuada del Instituto de Medicina (IOM) según edad y sexo — la fórmula por peso no está validada para esas edades.
- **Adultos (19+)**: se usa peso × (30/35/40 ml/kg según nivel de actividad general: sedentario/moderado/alto), sin bajar del piso IOM para su sexo (3000ml hombres / 2200ml mujeres, solo líquidos).
- Sobre esa base se suman los modificadores de estado fisiológico, clima y minutos de ejercicio de **hoy** (concepto aparte del nivel de actividad general: uno es la línea base, el otro es cuánto se entrenó ese día específico).
- Si se define una hora habitual de entreno, los checkpoints cercanos a esa hora se refuerzan (antes para pre-hidratar, después para reponer sudor).

Ver `backend/utils/iomTable.js` y `backend/utils/calculator.js`.

### Seguridad

- **JWT_SECRET**: si no está configurado (o sigue en el placeholder de `.env.example`), el servidor se niega a arrancar en producción (`NODE_ENV=production`); en desarrollo genera uno aleatorio efímero en cada arranque, nunca un valor fijo conocido.
- **Rate limiting** separado en `/api/auth/login` y `/api/auth/register` (10 intentos cada 15 min por IP cada uno) — agotar uno no bloquea el otro. Límite adicional **por cuenta** (10 intentos/15min, independiente de la IP) para cubrir ataques con IP rotativa.
- **TRUST_PROXY=1**: se activa en `.env` al desplegar detrás de Nginx (ver sección de despliegue). Sin esto, el rate limiter ve la IP del proxy para todos los visitantes y el límite se vuelve global — cualquier abuso pequeño bloquearía el login/registro de todo el sitio.
- **CORS** restringible por `FRONTEND_ORIGIN` en `.env` (coma-separado si hay varios dominios). Sin configurar, queda abierto para no romper el desarrollo local. Un origen no permitido responde 403, no 500.
- **Helmet** activo (HSTS, X-Content-Type-Options, X-Frame-Options, etc.).
- **Contraseña mínima de 8 caracteres** (backend y frontend sincronizados).
- Email normalizado a minúsculas, validado con regex y con tope de 254 caracteres; contraseñas nunca se devuelven ni se loguean.
- Los tokens JWT se verifican contra la base: si la cuenta fue borrada, el token deja de servir aunque la firma siga siendo válida. Duración reducida de 30 a 14 días para acotar la ventana de exposición de un token robado (deuda documentada: sin revocación real salvo borrar la cuenta).
- Suscripciones push: máximo 10 por usuario; al superarse se borran las más viejas.

**Decisiones documentadas, no modificadas:**
- Enumeración de cuentas (el registro informa si el email ya existe): se deja así a propósito — es mejor UX que ocultarlo, y el riesgo es bajo para esta app.
- Sin verificación de email / recuperación de contraseña: pendiente de v2.
- Logs con stack completo solo server-side (consola), nunca expuestos al cliente.

### Chequeo de síntomas (no es diagnóstico médico)

`backend/utils/symptomChecker.js` cruza los síntomas que el usuario reporta con su ritmo de consumo del día para distinguir entre posible deshidratación y posible sobrehidratación — ambas comparten casi los mismos síntomas. La respuesta siempre incluye una nota aclarando que no reemplaza atención médica, y recomienda buscar ayuda profesional si hay síntomas severos (confusión, letargo, náuseas) que no mejoran.

### Clima real por ubicación

En el dashboard, el botón "Usar mi ubicación" pide permiso de geolocalización al navegador y consulta Open-Meteo (gratis, sin API key) para traer la temperatura y humedad reales del momento, que sobreescriben el clima "promedio" del perfil solo para el día de hoy. Ver `frontend/src/weather.js`.

### Asistente conversacional (Groq)

1. Crear una key gratis en https://console.groq.com
2. Configurar en `backend/.env`: `GROQ_API_KEY=...` (opcional: `GROQ_MODEL`, por defecto `llama-3.3-70b-versatile`)
3. Sin esto configurado, la app funciona igual — el botón del asistente muestra un mensaje claro de que no está disponible, no un error genérico.

El asistente conoce el perfil del usuario y su estado del día (peso, edad, actividad, meta, consumo actual) para personalizar respuestas sin pedir que se repita esa información, está limitado a temas de hidratación (redirige si se le pregunta otra cosa), y aclara que no reemplaza a un médico. El historial de la conversación se envía completo en cada request, sin memoria persistente en el servidor. Ver `backend/routes/assistant.js` y `backend/utils/assistant.js`.

**Nota de validación:** la llamada real a la API de Groq requiere salida de red a `api.groq.com`, no siempre disponible en todos los entornos de desarrollo. El resto de la lógica que no depende de la API externa (validaciones, fallback sin key, construcción del contexto) está verificado de forma independiente.

## 2. Diseño

- **Paleta**: azul profundo `#2F80ED` + turquesa `#3CCFCF`, fondo `#F7F9FC` (no blanco puro), estados verde/amarillo/coral para excelente/precaución/riesgo.
- **Home**: anillo de progreso circular (no botella), tarjetas pequeñas de "Estado de hidratación" (concentración/rendimiento/clima/actividad), cápsula educativa diaria, y un mensaje que puede ser una predicción de sed real en vez de solo "vas al X%".
- **Registro en dos toques**: botón flotante central en el nav → bottom sheet → tipo de bebida → cantidad. Sin formularios.
- **Tipos de bebida** con factor de hidratación real (agua/deportiva/leche=1.0, té/café=0.95, jugo=0.9, refresco=0.85) — el café cuenta como líquido, con un descuento menor en bebidas azucaradas o con cafeína alta.
- **Insights**: promedio semanal/mensual, mejor día, racha, e insight dinámico tipo "cuando hace más de 30°C tomas X% menos".
- **Perfil real**: `/perfil` (`frontend/src/pages/Profile.jsx`) precarga los datos existentes del usuario, permite editarlos, gestionar recipientes (agregar/eliminar) y cerrar sesión — separado del flujo de onboarding inicial (`/configurar`, `Setup.jsx`), que ya no obliga a calibrar un recipiente para poder empezar.
- **Registros de hoy** visibles en el dashboard (hora + tipo + cantidad), con opción de borrar cada uno con confirmación.
- **Detección de ráfaga**: además de evaluar cada registro por separado, `backend/utils/logFeedback.js` suma el volumen bruto registrado en los últimos 10 minutos (`recentBurstMl`) para avisar de consumo alto acumulado en poco tiempo, sin importar el tamaño de cada registro individual.
- **Actividad de hoy**: la tarjeta "Actividad" del dashboard es tocable y abre un sheet para registrar los minutos de ejercicio del día (`PUT /logs/context/today`), que ajustan la meta. `activity_is_live` distingue si ese dato fue reportado hoy o es el promedio por defecto del perfil.
- **Predicción de sed**: `backend/utils/thirstPredictor.js` calcula el intervalo promedio entre tragos del día y, al acercarse o superar ese intervalo, reemplaza el mensaje genérico por algo como *"según tu patrón, probablemente sentirás sed en unos 15 minutos"* — el diferenciador central de la app.
- **Íconos vectoriales** (Lucide) en todo el frontend en vez de emojis, para consistencia entre sistemas operativos.
- **Sombras de elevación** en vez de bordes planos de 1px.
- **FAB de 46px** (cumple el mínimo de 44px de accesibilidad).
- **Feedback visual al registrar**: el número del anillo cuenta hacia arriba en vez de saltar al valor nuevo, con un pulso sutil al cruzar el 100% de la meta. La sección "Hoy registraste" se ubica justo debajo del anillo, con un destello breve al aparecer un registro nuevo y un colapso suave al eliminarlo. Con más de 5 registros, la lista se colapsa con "ver N más". Vibración háptica breve en dispositivos compatibles. Todo respeta `prefers-reduced-motion`.

**Pendiente de esta pasada de diseño:**
- Onboarding paso a paso (el flujo actual sigue siendo un formulario en 2 pasos).
- Historial en vista calendario (hoy es una lista de barras).
- Modo oscuro.
- Skeletons/shimmer en estados de carga (hoy son mensajes de texto planos).
- Gráficas/sparklines reales en Historial e Insights.
- Transiciones entre pantallas.
- Contraste de verdes ajustado a WCAG AA.

## 3. Frontend

```
cd frontend
npm install
cp .env.example .env       # VITE_API_URL apuntando a tu backend
npm run dev                 # desarrollo, http://localhost:5173
npm run build                # genera dist/ listo para producción
```

`npm run build` genera una PWA completa en `frontend/dist/` (manifest, service worker, ícono). Ese `dist/` es lo único que se necesita subir a hosting estático.

## 4. Despliegue en producción

Se necesitan dos cosas corriendo:

**A. El backend (proceso Node persistente)**

```
cd backend
npm install --production
npm install -g pm2          # mantiene el proceso vivo y lo reinicia si falla
pm2 start server.js --name hydrapp-api
pm2 save
```

Exponer el puerto 4000 (o el definido en `.env`) detrás de un proxy, por ejemplo con Nginx:

```
location /api/ {
    proxy_pass http://localhost:4000/;
    proxy_set_header Host $host;
}
```

**B. El frontend (archivos estáticos)**

```
cd frontend
# antes del build, en .env:
# VITE_API_URL=https://tudominio.com/api
npm run build
```

Subir el contenido de `frontend/dist/` a la raíz web del hosting estático (Nginx, Apache, Vercel, etc.). Al ser una PWA, con HTTPS activo los usuarios pueden "instalarla" desde el navegador del celular.

> **Importante:** la Web Crypto / Service Worker de las PWA solo funcionan sobre **HTTPS** (o `localhost`). Si el dominio todavía no tiene certificado, Let's Encrypt/Certbot es gratis.

## 5. Notificaciones push

Permiten avisar aunque la app esté cerrada, no solo con el dashboard abierto:

1. Generar el par de llaves: `npx web-push generate-vapid-keys` (dentro de `backend/`).
2. Configurar en `backend/.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (un `mailto:` válido).
3. El usuario activa las notificaciones desde Perfil → "Activar notificaciones" (pide permiso del navegador y se suscribe).
4. Un planificador interno (`backend/utils/pushScheduler.js`) revisa cada 5 minutos a los usuarios suscritos: si `thirst_prediction.likely` es cierto y no pasó su hora de dormir, envía un push — sin repetir antes de 45 minutos para no saturar.

Requiere HTTPS real en producción (los navegadores no permiten push sobre HTTP salvo `localhost`). El service worker (`frontend/src/sw.js`) maneja los eventos `push` y `notificationclick`.

**Notas de compatibilidad:** en iPhone/iPad, Safari solo permite push si la app fue instalada ("Agregar a pantalla de inicio") y se abre desde ese ícono, nunca desde una pestaña normal, sin importar los permisos otorgados en Ajustes — es una restricción del sistema operativo, no de la app. Perfil muestra el motivo exacto cuando la función no está disponible en vez de fallar en silencio (`frontend/src/push.js`, `getPushUnavailableReason`).

## 6. Otras mejoras

- **Actualización automática del dashboard**: refresca al volver a la pestaña y hace polling cada 60s mientras está visible, para que la predicción de sed no se quede con datos viejos.
- **Clima real en el onboarding**: botón "Usar mi ubicación para tu clima" en Setup y en Perfil, que guarda la temperatura/humedad reales como base del perfil (antes quedaba fijo en 25°C hasta usar el botón diario).
- **Historial honesto**: las barras muestran el % contra la meta de cada día (reconstruida con el clima/actividad de ese día si existía), no contra el día de máximo consumo del período. Los días sin registro aparecen marcados como "sin dato".
- **Insights más claros**: las etiquetas aclaran que los promedios son "de los días con registro"; la racha bajó de exigir 100% a 80% de la meta.
- **Cola offline simplificada**: si falla la conexión al registrar, el trago se guarda en `localStorage` y se reintenta al volver la señal (evento `online` + al abrir la app). Es una versión más simple que una cola real en IndexedDB con Background Sync, pero resuelve el caso de uso real: no perder el registro por falta de señal.

## 7. Arreglos tras uso real

Bugs encontrados usando la app, no solo leyendo código:

**Primera vuelta**
- **Estado "Concentración/Rendimiento" casi nunca en verde**: el umbral de "atrasado" era un valor fijo de 150ml, sin importar el tamaño de la meta — para una meta de 3300ml eso es apenas 4.5% de margen. Ahora los umbrales son proporcionales a la meta (~10%/25%) y hay un margen de gracia de 30 minutos al despertar. Ver `backend/utils/predictor.js`.
- **Mensaje contradictorio al superar la meta**: si ya se había tomado más del objetivo del día pero llevaba rato sin registrar nada, la predicción de sed igual sugería tomar agua. Ahora, si la meta ya está cumplida/superada, ese mensaje no se muestra. Ver `backend/utils/dailyStatus.js`.
- **Input de volumen desbordaba la tarjeta** en "Tus recipientes calibrados" (Perfil): los inputs dentro de `.field` no tenían `width: 100%`. Corregido en `index.css`/`layout.css`.

**Segunda vuelta**
- **La app asumía una hora de despertar fija**: si el perfil decía 7am pero el usuario se levantaba a las 11am, los checkpoints ya "esperaban" ~4 horas de consumo antes de abrir la app, empujando a tomar mucha agua de golpe para "ponerse al día". Ahora la hora de despertar se recalibra sola: si pasan más de 90 minutos de la hora configurada sin ningún registro, la hora efectiva se ajusta a ~30 min antes del primer trago real en vez de acumular una deuda irreal. Validado en 4 escenarios (despertar normal, despertar tarde sin registrar, primer trago cerca de la hora normal, primer trago muy tarde). Ver `backend/utils/dailyStatus.js` (`effectiveWakeTime`).
- **Historial mostraba el día de hoy hasta abajo**: la lista se ordenaba igual que la respuesta del backend (más antiguo primero). El frontend ahora la invierte para mostrar hoy arriba, etiquetado como "Hoy".

**Tercera vuelta**
- **Notificaciones atascadas en "Procesando..." en PC**: Vite solo genera el service worker en el build de producción por defecto; en `npm run dev` no había ninguno registrado, así que `navigator.serviceWorker.ready` nunca se resolvía. Ahora `devOptions` está activado en `vite.config.js`, así que también funciona en desarrollo.
- **Despertar antes de la hora configurada generaba una "deuda" falsa**: efecto secundario del arreglo de la vuelta anterior (la recalibración por inicio tardío se disparaba también al despertar temprano). Corregido: ahora solo recalibra cuando efectivamente se despierta después de la hora configurada; si es antes, el día simplemente "no ha empezado" según el perfil, sin deuda. Validado en tres casos por separado (madrugador, horario normal, trasnochador). Ver `backend/utils/dailyStatus.js` y `backend/utils/predictor.js`.

## 8. Qué sigue (v2)

- Estimación de volumen del vaso por foto (visión por cámara).
- Balance de electrolitos (sodio/potasio/magnesio).
- Cola offline real con IndexedDB + Background Sync.
- Recuperación de contraseña.

## 9. Deuda técnica conocida (documentada a propósito)

- **JWT sin refresh ni rotación**: el token dura 14 días y no hay forma de revocarlo del lado del servidor si se roba. Aceptable para una app de este tamaño; si crece, valdría la pena una tabla de sesiones o tokens de corta duración + refresh token.
- **Estimador de volumen por altura** (`Setup.jsx`) usa un diámetro fijo de 7cm — es un puente documentado hacia la estimación por foto real (v2), no una medición precisa.
