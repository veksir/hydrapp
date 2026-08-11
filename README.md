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
