/**
 * Predictor de hidratación.
 *
 * En vez de recordatorios cada X horas, reparte la meta diaria en "checkpoints"
 * a lo largo de las horas despierto del usuario, con más peso en las primeras
 * horas del día (rehidratación tras dormir), bajando cerca de dormir, y con
 * un refuerzo real alrededor de la hora de ejercicio si el usuario reportó
 * actividad física para hoy. Luego compara el consumo real contra lo
 * esperado a esta hora para decidir si hay que avisar.
 */

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function buildCheckpoints({ wakeTime, sleepTime, totalMl, activityMinutes = 0, workoutTime = null }) {
  const wake = toMinutes(wakeTime);
  let sleep = toMinutes(sleepTime);
  if (sleep <= wake) sleep += 24 * 60; // cruza medianoche

  const awakeMinutes = Math.max(60, sleep - wake);
  const numCheckpoints = Math.max(6, Math.round(awakeMinutes / 90)); // ~cada 1.5h

  // La hora de ejercicio también se ancla en la numeración "despierto",
  // igual que los checkpoints, para poder comparar directamente.
  let workoutMinute = null;
  if (workoutTime && activityMinutes > 0) {
    const raw = toMinutes(workoutTime);
    workoutMinute = raw < wake ? raw + 24 * 60 : raw;
  }

  // Curva de peso: más alto al despertar, decae a media mañana, baja fuerte
  // cerca de dormir, y sube alrededor de la hora de ejercicio (antes para
  // pre-hidratar, después para reponer lo perdido en sudor).
  const weights = [];
  for (let i = 0; i < numCheckpoints; i++) {
    const progress = i / (numCheckpoints - 1); // 0..1
    const minuteOffset = Math.round((awakeMinutes * i) / (numCheckpoints - 1));
    const minuteOfDay = wake + minuteOffset;

    let w = 1;
    if (progress < 0.15) w = 1.6; // justo al despertar: rehidratación
    else if (progress > 0.85) w = 0.4; // cerca de dormir: bajar consumo

    if (workoutMinute != null) {
      const distance = Math.abs(minuteOfDay - workoutMinute);
      if (distance <= 60) w += 0.7; // justo antes/después de entrenar
      else if (distance <= 120) w += 0.3; // rango más amplio alrededor
    }

    weights.push(w);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const checkpoints = weights.map((w, i) => {
    const minuteOffset = Math.round((awakeMinutes * i) / (numCheckpoints - 1));
    const totalMinute = wake + minuteOffset;
    const displayMinute = totalMinute % (24 * 60);
    const hh = String(Math.floor(displayMinute / 60)).padStart(2, "0");
    const mm = String(displayMinute % 60).padStart(2, "0");
    return {
      time: `${hh}:${mm}`,
      expected_ml: Math.round((totalMl * w) / weightSum),
      minute_of_day: totalMinute, // ya anclado en la numeración "despierto" (puede pasar de 1440)
      near_workout: workoutMinute != null && Math.abs(totalMinute - workoutMinute) <= 60,
    };
  });

  // Acumulado esperado hasta cada checkpoint. El último absorbe el residuo
  // de redondeo para que la suma total cuadre exacto con totalMl (si no,
  // por redondear cada checkpoint por separado, el total podía quedar 1-2ml
  // desfasado de la meta real).
  let running = 0;
  checkpoints.forEach((c, i) => {
    if (i === checkpoints.length - 1) {
      c.expected_ml = Math.round(totalMl) - running;
    }
    running += c.expected_ml;
    c.expected_cumulative_ml = running;
  });

  return checkpoints;
}

/**
 * Dado el perfil, la meta total y los logs de hoy, determina si el usuario
 * va atrasado respecto al ritmo esperado y devuelve un mensaje sugerido.
 *
 * nowMinuteOfDay debe venir ya calculado en la hora LOCAL del usuario
 * (ver utils/time.js) — nunca se usa la hora del servidor directamente,
 * porque puede estar en una zona horaria distinta a la del usuario.
 */
function getHydrationStatus({
  wakeTime,
  sleepTime,
  totalMl,
  todayLogs,
  nowMinuteOfDay,
  activityMinutes = 0,
  workoutTime = null,
}) {
  const checkpoints = buildCheckpoints({ wakeTime, sleepTime, totalMl, activityMinutes, workoutTime });

  const wake = toMinutes(wakeTime);
  const adjNowMinute = nowMinuteOfDay < wake ? nowMinuteOfDay + 24 * 60 : nowMinuteOfDay;

  // Encuentra el último checkpoint ya pasado y el próximo por llegar,
  // ambos comparando por HORA (no por cuánta agua llevas acumulada).
  let expectedByNow = 0;
  let nextCheckpoint = null;
  for (const c of checkpoints) {
    if (c.minute_of_day <= adjNowMinute) {
      expectedByNow = c.expected_cumulative_ml;
    } else if (nextCheckpoint === null) {
      nextCheckpoint = c;
    }
  }

  const consumedToday = todayLogs.reduce((sum, l) => sum + l.effective_ml, 0);
  const deficit = expectedByNow - consumedToday;

  // Si ya pasó la hora de dormir, no tiene sentido urgir a tomar agua — el
  // déficit acumulado ya no importa, el usuario se está por dormir o ya
  // durmió parte de la noche.
  let sleep = toMinutes(sleepTime);
  if (sleep <= wake) sleep += 24 * 60;
  const isPastBedtime = adjNowMinute >= sleep;

  let status = "ok";
  let message = "Vas al ritmo. Sigue así.";

  if (isPastBedtime) {
    status = "ok";
    message = "Ya pasó tu hora de dormir. Descansa — retomamos mañana.";
  } else if (deficit > 0.25 * totalMl && deficit > 300) {
    status = "muy_atrasado";
    message = `Vas ${Math.round(deficit)}ml por detrás de tu ritmo esperado. Toma agua ahora.`;
  } else if (deficit > 150) {
    status = "atrasado";
    message = `Estás un poco atrasado (${Math.round(deficit)}ml). Un vaso de agua ahora te pone al día.`;
  } else if (deficit < -300) {
    status = "adelantado";
    message = "Vas muy bien, incluso adelantado a tu meta de este momento.";
  }

  return {
    checkpoints,
    next_checkpoint: nextCheckpoint,
    expected_by_now_ml: Math.round(expectedByNow),
    consumed_today_ml: Math.round(consumedToday),
    deficit_ml: Math.round(deficit),
    status,
    message,
    is_past_bedtime: isPastBedtime,
  };
}

module.exports = { buildCheckpoints, getHydrationStatus };
