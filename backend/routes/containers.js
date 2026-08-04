const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const containers = db
    .prepare("SELECT * FROM containers WHERE user_id = ? ORDER BY created_at ASC")
    .all(req.userId);
  res.json(containers);
});

router.post("/", (req, res) => {
  const { name, volume_ml } = req.body;
  const validVolume = volume_ml !== null && volume_ml !== undefined && Number.isFinite(Number(volume_ml));
  if (!name || typeof name !== "string" || !name.trim() || !validVolume || Number(volume_ml) <= 0) {
    return res.status(400).json({ error: "name y volume_ml (número positivo) son requeridos" });
  }
  if (Number(volume_ml) > 5000) {
    return res.status(400).json({ error: "Un recipiente de más de 5000ml no parece real — revisa el valor." });
  }
  const result = db
    .prepare("INSERT INTO containers (user_id, name, volume_ml) VALUES (?, ?, ?)")
    .run(req.userId, name.trim().slice(0, 60), Number(volume_ml));
  const container = db.prepare("SELECT * FROM containers WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(container);
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
