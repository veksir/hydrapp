const webpush = require("web-push");
const db = require("../db/init");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:soporte@hydrapp.local";

const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn(
    "[WARN] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configurados — las notificaciones push están desactivadas. " +
      "Genera un par con `npx web-push generate-vapid-keys` y ponlas en tu .env."
  );
}

async function sendPushToUser(userId, payload) {
  if (!pushEnabled) return { sent: 0 };

  const subscriptions = db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").all(userId);
  let sent = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      // Suscripción muerta (usuario desinstaló, permiso revocado, etc.) —
      // se borra en vez de seguir intentando para siempre.
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(sub.id);
      }
    }
  }

  return { sent };
}

module.exports = { pushEnabled, sendPushToUser, VAPID_PUBLIC_KEY };
