const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../utils/auth-middleware");
const { SYMPTOM_CATALOG, assessSymptoms } = require("../utils/symptomChecker");
const { getTodayGoalAndStatus } = require("../utils/dailyStatus");

const router = express.Router();
router.use(requireAuth);

const VALID_SYMPTOM_IDS = new Set(SYMPTOM_CATALOG.map((s) => s.id));

router.get("/catalog", (req, res) => {
  res.json(SYMPTOM_CATALOG);
});

router.post("/check", (req, res) => {
  try {
    const rawIds = Array.isArray(req.body.symptom_ids) ? req.body.symptom_ids : [];
    const symptom_ids = rawIds.filter((id) => VALID_SYMPTOM_IDS.has(id));

    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(req.userId);
    if (!profile) {
      return res.status(400).json({ error: "Configura tu perfil primero" });
    }

    const { goal, consumedMl, hydrationStatus } = getTodayGoalAndStatus(req.userId, profile);

    const assessment = assessSymptoms({
      symptomIds: symptom_ids,
      consumedMl,
      goalMl: goal.total_ml,
      hydrationStatus: hydrationStatus.status,
    });

    res.json({
      assessment,
      consumed_ml: consumedMl,
      goal_ml: goal.total_ml,
      hydration_status: hydrationStatus.status,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
