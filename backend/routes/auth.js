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

router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Ingresa un email válido" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
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

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: "30d" });

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
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
