const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db/init");

// Nunca usar un secreto por defecto predecible. En producción, si no está
// configurado JWT_SECRET, el servidor debe negarse a arrancar (fail closed)
// en vez de firmar tokens con un valor que cualquiera puede adivinar.
let JWT_SECRET = process.env.JWT_SECRET;

// Si alguien copia .env.example sin cambiar el placeholder, es tan
// predecible como no tener secreto — cualquiera puede leer el repo público
// y adivinarlo. Lo tratamos igual que "ausente".
const KNOWN_PLACEHOLDER = "cambia-esto-por-un-secreto-largo-y-aleatorio";
if (JWT_SECRET === KNOWN_PLACEHOLDER) {
  JWT_SECRET = undefined;
}

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[FATAL] JWT_SECRET no está configurado (o sigue en el valor de ejemplo de .env.example). " +
        "No se puede arrancar en producción sin un secreto real."
    );
    process.exit(1);
  }
  // Desarrollo: generamos un secreto aleatorio efímero (distinto cada
  // arranque) en vez de un valor fijo conocido públicamente.
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn(
    "[WARN] JWT_SECRET no configurado — usando un secreto aleatorio temporal solo para desarrollo. " +
      "Los tokens no sobrevivirán un reinicio del servidor. Define JWT_SECRET en .env para producción."
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // La firma válida solo prueba que el token es de este servidor, no que
    // la cuenta siga existiendo (ej. si se borró la cuenta, tokens viejos
    // seguirían "funcionando" hasta expirar).
    const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(payload.userId);
    if (!userExists) {
      return res.status(401).json({ error: "Cuenta no encontrada" });
    }
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = { requireAuth, JWT_SECRET };
