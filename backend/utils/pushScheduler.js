const db = require("../db/init");
const { getTodayGoalAndStatus } = require("./dailyStatus");
const { sendPushToUser } = require("./push");

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos
const MIN_MINUTES_BETWEEN_NOTIFICATIONS = 45; // no saturar al usuario

async function checkAndNotifyUser(userId) {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  if (!profile) return;

  const subscriptionCount = db
    .prepare("SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?")
    .get(userId).c;
  if (subscriptionCount === 0) return;

  let status;
  try {
    status = getTodayGoalAndStatus(userId, profile).hydrationStatus;
  } catch {
    return;
  }

  if (status.is_past_bedtime) return;
  if (!status.thirst_prediction?.likely) return;

  const sub = db.prepare("SELECT last_notified_at FROM push_subscriptions WHERE user_id = ? ORDER BY last_notified_at DESC LIMIT 1").get(userId);
  if (sub?.last_notified_at) {
    const minutesSince = (Date.now() - new Date(sub.last_notified_at.replace(" ", "T") + "Z").getTime()) / 60000;
    if (minutesSince < MIN_MINUTES_BETWEEN_NOTIFICATIONS) return;
  }

  await sendPushToUser(userId, {
    title: "💧 Antes de que tengas sed",
    body: status.thirst_prediction.message,
  });

  db.prepare("UPDATE push_subscriptions SET last_notified_at = datetime('now') WHERE user_id = ?").run(userId);
}

function startThirstNotificationScheduler() {
  setInterval(async () => {
    try {
      const userIds = db.prepare("SELECT DISTINCT user_id FROM push_subscriptions").all().map((r) => r.user_id);
      for (const userId of userIds) {
        await checkAndNotifyUser(userId);
      }
    } catch (err) {
      console.error("[push-scheduler] error:", err.message);
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = { startThirstNotificationScheduler, checkAndNotifyUser };
