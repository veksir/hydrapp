# HydrApp

Seguimiento inteligente de hidratación: calcula tu meta diaria de agua con
criterios científicos, la personaliza según tu perfil y clima, y te avisa
*antes* de que tengas sed en lugar de mandarte alarmas cada hora.

Es una PWA (React + Vite) con API en Node.js + Express + SQLite.

## Estructura

```
hydrapp/
├── backend/     API en Node.js + Express + SQLite
└── frontend/    App React + Vite, PWA instalable
```

## Requisitos

- Node.js 18+ y npm.

## Puesta en marcha

```bash
# Backend (puerto 4000)
cd backend
npm install
cp .env.example .env      # configura JWT_SECRET (y PORT si quieres)
npm start                 # o: npm run dev (con recarga automática)

# Frontend (puerto 5173)
cd frontend
npm install
cp .env.example .env      # VITE_API_URL apuntando a tu backend
npm run dev
```

La base de datos SQLite (`backend/db/hydrapp.sqlite`) se crea sola en el primer
arranque; no hace falta instalar ningún motor de bases de datos.

### Arranque en un solo clic

En el Escritorio hay un lanzador `iniciar-hydrapp.bat` que instala dependencias
si faltan, libera el puerto 4000 y levanta backend y frontend (este último
expuesto a la red local con `--host`). Revisa `VITE_API_URL` en `frontend/.env`
para apuntar a tu backend.

## Funcionalidades destacadas

- Meta diaria con criterios científicos (tabla IOM para menores de 19, piso de
  adultos según sexo, nivel de actividad, clima, ejercicio de hoy y estado
  fisiológico).
- Registro en dos toques con factor de hidratación real por tipo de bebida.
- Predicción de sed según tu patrón de consumo (no alarmas fijas).
- Historial e insights honestos, con rachas y promedios por días con registro.
- Chequeo de síntomas con aclaración de que no reemplaza atención médica.
- Clima real por geolocalización (Open-Meteo, gratis y sin API key).
- Notificaciones push opcionales (requiere HTTPS real y llaves VAPID).
- Cola offline simplificada para no perder registros sin señal.
- PWA instalable.

## API (resumen)

Todas las rutas menos `register`/`login` requieren `Authorization: Bearer <token>`.

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/auth/register` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión |
| GET/PUT | `/api/profile` | Ver/guardar perfil |
| GET/POST/DELETE | `/api/containers` | Recipientes calibrados |
| POST | `/api/logs` | Registrar un consumo |
| GET | `/api/logs/today` | Meta, consumido, predicción e insumos del día |
| PUT | `/api/logs/context/today` | Ajustar actividad/clima del día |
| GET | `/api/logs/history?days=14` | Historial agregado por día |
| GET/POST | `/api/symptoms/catalog` y `/api/symptoms/check` | Chequeo de síntomas |
| GET | `/api/insights` | Promedios, mejor día, racha |

## Notas

- El frontend se construye como PWA completa: `cd frontend && npm run build`
  genera `dist/`, que es lo único que necesitas subir a un hosting estático.
- Los avisos push y el service worker solo funcionan sobre HTTPS (o
  `localhost`).