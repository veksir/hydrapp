const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { pushEnabled, VAPID_PUBLIC_KEY, sendPushToUser } = require("../utils/push");

const router = express.Router();
router.use(requireAuth);

router.get("/vapid-public-key", (req, res) => {
  res.json({ enabled: pushEnabled, publicKey: pushEnabled ? VAPID_PUBLIC_KEY : null });
});

const MAX_SUBSCRIPTIONS_PER_USER = 10;

router.post("/subscribe", (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Suscripción inválida" });
  }

  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(req.userId, endpoint, keys.p256dh, keys.auth);

  // Sin tope, un usuario (o alguien abusando de una cuenta) podría inflar
  // la tabla con endpoints ilimitados. 10 alcanza de sobra para cualquier
  // combinación real de dispositivos de una persona; si se excede, se
  // borran las suscripciones más viejas.
  const count = db.prepare("SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?").get(req.userId).c;
  if (count > MAX_SUBSCRIPTIONS_PER_USER) {
    db.prepare(
      `DELETE FROM push_subscriptions WHERE id IN (
         SELECT id FROM push_subscriptions WHERE user_id = ?
         ORDER BY created_at ASC LIMIT ?
       )`
    ).run(req.userId, count - MAX_SUBSCRIPTIONS_PER_USER);
  }

  res.status(201).json({ ok: true });
});

router.post("/unsubscribe", (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "endpoint es requerido" });
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").run(endpoint, req.userId);
  res.status(204).send();
});

// Lista los endpoints que el servidor conoce del usuario. El frontend la usa
// para no mostrar "activado" cuando el navegador conserva una suscripción
// que el backend perdió (p.ej. tras reiniciar la base): sin esto el toggle
// queda en ON pero el push nunca llega.
router.get("/subscriptions", (req, res) => {
  const subs = db.prepare("SELECT endpoint FROM push_subscriptions WHERE user_id = ?").all(req.userId);
  res.json({ endpoints: subs.map((s) => s.endpoint) });
});

// Botón "enviarme una de prueba" para que el usuario confirme que sí llegan.
router.post("/test", async (req, res) => {
  if (!pushEnabled) {
    return res.status(400).json({ error: "Las notificaciones push no están configuradas en este servidor" });
  }
  const result = await sendPushToUser(req.userId, {
    title: "HydrApp",
    body: "¡Las notificaciones están funcionando! Te avisaremos antes de que tengas sed.",
  });
  res.json(result);
});

module.exports = router;
