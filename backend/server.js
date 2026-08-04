require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const containerRoutes = require("./routes/containers");
const logRoutes = require("./routes/logs");
const symptomRoutes = require("./routes/symptoms");
const insightsRoutes = require("./routes/insights");
const pushRoutes = require("./routes/push");
const { startThirstNotificationScheduler } = require("./utils/pushScheduler");

const app = express();

// Detrás de un proxy (Nginx, como en el despliegue del README), Express ve
// siempre la IP del proxy en vez de la del visitante real. Sin esto,
// express-rate-limit cuenta a TODOS los usuarios como si fueran una sola
// IP y el límite anti fuerza bruta se vuelve un límite global del sitio.
// Actívalo con TRUST_PROXY=1 en el .env cuando despliegues detrás de Nginx.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

// CORS: si se define FRONTEND_ORIGIN (una o varias URLs separadas por
// coma) se restringe a esos orígenes. Sin configurar, queda abierto para
// no romper el desarrollo local — pero en producción conviene definirla.
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            const err = new Error("Origen no permitido por CORS");
            err.status = 403;
            return callback(err);
          },
        }
      : undefined
  )
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "hydrapp-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/containers", containerRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/symptoms", symptomRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/push", pushRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Error interno del servidor" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HydrApp backend corriendo en http://192.168.80.57:${PORT}`);
  startThirstNotificationScheduler();
});
