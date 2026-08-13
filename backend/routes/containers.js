const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { createWaterLog } = require("../utils/createWaterLog");
const { isValidDrinkType } = require("../utils/drinkTypes");
const { localDateStr } = require("../utils/time");

const router = express.Router();
router.use(requireAuth);

const CONTAINER_TYPES = ["custom", "thermos", "pitcher", "dispenser"];

function getProfileOrThrow(userId) {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  if (!profile) {
    const err = new Error("Perfil no configurado");
    err.status = 400;
    throw err;
  }
  return profile;
}

// Recipientes de gran capacidad: el volumen restante se reinicia solo al
// cambiar de día (se asume que al empezar el día el termo vuelve a estar
// lleno). Se aplica tanto al consultar como antes de interactuar, para no
// trabajar con un restante de ayer.
function ensureDailyReset(container, tzOffsetMinutes) {
  const today = localDateStr(tzOffsetMinutes);
  if (!container.last_reset_date || container.last_reset_date < today) {
    db.prepare("UPDATE containers SET current_volume = volume_ml, last_reset_date = ? WHERE id = ?").run(
      today,
      container.id
    );
    return { ...container, current_volume: container.volume_ml, last_reset_date: today };
  }
  return container;
}

router.get("/", (req, res) => {
  const profile = getProfileOrThrow(req.userId);
  const containers = db
    .prepare("SELECT * FROM containers WHERE user_id = ? ORDER BY created_at ASC")
    .all(req.userId)
    .map((c) => ensureDailyReset(c, profile.tz_offset_minutes));
  res.json(containers);
});

router.post("/", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const { name, volume_ml } = req.body;
    const containerType = CONTAINER_TYPES.includes(req.body.container_type)
      ? req.body.container_type
      : "custom";
    const drinkType = isValidDrinkType(req.body.drink_type) ? req.body.drink_type : "agua";
    const validVolume = volume_ml !== null && volume_ml !== undefined && Number.isFinite(Number(volume_ml));
    if (!name || typeof name !== "string" || !name.trim() || !validVolume || Number(volume_ml) <= 0) {
      return res.status(400).json({ error: "name y volume_ml (número positivo) son requeridos" });
    }
    if (Number(volume_ml) > 5000) {
      return res.status(400).json({ error: "Un recipiente de más de 5000ml no parece real — revisa el valor." });
    }
    const today = localDateStr(profile.tz_offset_minutes);
    const result = db
      .prepare(
        "INSERT INTO containers (user_id, name, volume_ml, container_type, drink_type, current_volume, last_reset_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        req.userId,
        name.trim().slice(0, 60),
        Number(volume_ml),
        containerType,
        drinkType,
        Number(volume_ml),
        today
      );
    const container = db.prepare("SELECT * FROM containers WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(container);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Edición de un recipiente (nombre, volumen, tipo, contenido). Al cambiar el
// volumen se escala el restante de hoy proporcionalmente para no "perder" el
// nivel real del líquido (ej. recalibrar un termo de 4000 a 3500 mantiene el
// mismo porcentaje de llenado), con clamp al nuevo rango.
router.put("/:id", (req, res) => {
  try {
    const container = db
      .prepare("SELECT * FROM containers WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.userId);
    if (!container) return res.status(404).json({ error: "Recipiente no encontrado" });

    const { name, volume_ml } = req.body;
    const containerType = CONTAINER_TYPES.includes(req.body.container_type)
      ? req.body.container_type
      : "custom";
    const drinkType = isValidDrinkType(req.body.drink_type) ? req.body.drink_type : "agua";
    const validVolume = volume_ml !== null && volume_ml !== undefined && Number.isFinite(Number(volume_ml));
    if (!name || typeof name !== "string" || !name.trim() || !validVolume || Number(volume_ml) <= 0) {
      return res.status(400).json({ error: "name y volume_ml (número positivo) son requeridos" });
    }
    if (Number(volume_ml) > 5000) {
      return res.status(400).json({ error: "Un recipiente de más de 5000ml no parece real — revisa el valor." });
    }

    const oldVolume = Number(container.volume_ml);
    const newVolume = Number(volume_ml);
    let currentVolume;
    if (container.last_reset_date === localDateStr(getProfileOrThrow(req.userId).tz_offset_minutes)) {
      const ratio = oldVolume > 0 ? Number(container.current_volume) / oldVolume : 1;
      currentVolume = Math.max(0, Math.min(newVolume, Math.round(ratio * newVolume)));
    } else {
      currentVolume = newVolume; // se reiniciará lleno al primer uso del día
    }

    db.prepare(
      "UPDATE containers SET name = ?, volume_ml = ?, container_type = ?, drink_type = ?, current_volume = ? WHERE id = ?"
    ).run(name.trim().slice(0, 60), newVolume, containerType, drinkType, currentVolume, container.id);

    const updated = db.prepare("SELECT * FROM containers WHERE id = ?").get(container.id);
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Toma parcial de un recipiente grande: descuenta del volumen restante y
// registra la toma en la lógica estándar de logs (feedback, ráfaga, meta,
// factor de hidratación del tipo de bebida) — exactamente como si hubiera
// entrado por POST /api/logs.
router.post("/:id/sip", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const container = db
      .prepare("SELECT * FROM containers WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.userId);
    if (!container) return res.status(404).json({ error: "Recipiente no encontrado" });

    const fresh = ensureDailyReset(container, profile.tz_offset_minutes);
    const amount = Number(req.body.amount_ml);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount_ml debe ser un número positivo" });
    }
    if (amount > Number(fresh.current_volume)) {
      return res.status(400).json({
        error: `Solo quedan ${Math.round(fresh.current_volume)}ml en ${fresh.name}. Rellénalo o registra una cantidad menor.`,
      });
    }

    // El tipo de bebida lo define el recipiente (su contenido configurado),
    // no la selección global del sheet. Si por migración quedó sin valor,
    // cae al del body y si no, agua.
    const drinkType = isValidDrinkType(fresh.drink_type)
      ? fresh.drink_type
      : isValidDrinkType(req.body.drink_type)
        ? req.body.drink_type
        : "agua";

    const { log, feedback, consumedMl, goalMl } = createWaterLog({
      userId: req.userId,
      profile,
      container_id: fresh.id,
      amount_ml: amount,
      drink_type: drinkType,
    });

    const remaining = Math.round(Number(fresh.current_volume) - amount);
    db.prepare("UPDATE containers SET current_volume = ? WHERE id = ?").run(remaining, fresh.id);

    res.status(201).json({ log, feedback, consumed_ml: consumedMl, goal_ml: goalMl, current_volume: remaining });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Rellenado manual: vuelve a dejar el recipiente lleno para hoy.
router.put("/:id/refill", (req, res) => {
  try {
    const profile = getProfileOrThrow(req.userId);
    const container = db
      .prepare("SELECT * FROM containers WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.userId);
    if (!container) return res.status(404).json({ error: "Recipiente no encontrado" });

    const today = localDateStr(profile.tz_offset_minutes);
    db.prepare("UPDATE containers SET current_volume = volume_ml, last_reset_date = ? WHERE id = ?").run(
      today,
      container.id
    );
    const updated = db.prepare("SELECT * FROM containers WHERE id = ?").get(container.id);
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM containers WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Recipiente no encontrado" });
  }
  res.status(204).send();
});

module.exports = router;
