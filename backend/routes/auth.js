const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("../db/init");
const { JWT_SECRET } = require("../utils/auth-middleware");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fuerza bruta: máximo 10 intentos cada 15 minutos por IP — separados entre
// login y registro, para que un ataque/abuso de registro no deje sin poder
// iniciar sesión a usuarios legítimos (y viceversa).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo." },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de registro. Espera unos minutos e intenta de nuevo." },
});

// El rate limit de arriba es por IP — un atacante con IPs rotativas (proxy,
// botnet) lo evade fácilmente mientras sigue probando contraseñas contra
// LA MISMA cuenta. Este segundo control es por email, independiente de la
// IP, para cerrar ese hueco. Vive en memoria (se resetea si el proceso se
// reinicia) — suficiente para una app de este tamaño en un solo proceso;
// si el backend llegara a correr en varias instancias, habría que mover
// esto a la base de datos o a un store compartido (ej. Redis).
const MAX_ATTEMPTS_PER_ACCOUNT = 10;
const ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const failedAttemptsByEmail = new Map();

function isAccountLocked(email) {
  const entry = failedAttemptsByEmail.get(email);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > ACCOUNT_WINDOW_MS) {
    failedAttemptsByEmail.delete(email);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS_PER_ACCOUNT;
}

function registerFailedAttempt(email) {
  const entry = failedAttemptsByEmail.get(email);
  if (!entry || Date.now() - entry.firstAttemptAt > ACCOUNT_WINDOW_MS) {
    failedAttemptsByEmail.set(email, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearFailedAttempts(email) {
  failedAttemptsByEmail.delete(email);
}

router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Ingresa un email válido" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const safeName = name.trim().slice(0, 80);

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db
      .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)")
      .run(normalizedEmail, passwordHash, safeName);

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: "14d" });

    res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, email: normalizedEmail, name: safeName },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email y password son requeridos" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (isAccountLocked(normalizedEmail)) {
      return res.status(429).json({
        error: "Demasiados intentos fallidos para esta cuenta. Espera unos minutos e intenta de nuevo.",
      });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      registerFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    clearFailedAttempts(normalizedEmail);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "14d" });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
