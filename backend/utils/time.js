/**
 * El servidor puede correr en cualquier zona horaria (típicamente UTC en
 * hosting). Para que "hoy" y "ahora mismo" signifiquen lo que el usuario
 * espera, todo cálculo de día/hora debe ajustarse con el offset de su
 * propio dispositivo (capturado una vez con `new Date().getTimezoneOffset()`
 * y guardado en el perfil), no con la hora del servidor.
 */

function toShiftedDate(tzOffsetMinutes = 0, date = new Date()) {
  return new Date(date.getTime() - Number(tzOffsetMinutes || 0) * 60000);
}

// Cadena YYYY-MM-DD del día actual en la zona horaria del usuario.
function localDateStr(tzOffsetMinutes = 0, date = new Date()) {
  return toShiftedDate(tzOffsetMinutes, date).toISOString().slice(0, 10);
}

// Minutos transcurridos desde medianoche, en la hora local del usuario.
function localMinuteOfDay(tzOffsetMinutes = 0, date = new Date()) {
  const shifted = toShiftedDate(tzOffsetMinutes, date);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

// Modificador de SQLite para convertir un timestamp UTC a hora local del
// usuario dentro de una consulta, ej: date(logged_at, offsetModifier(300))
function offsetModifier(tzOffsetMinutes = 0) {
  const minutes = -Number(tzOffsetMinutes || 0);
  const sign = minutes >= 0 ? "+" : "-";
  return `${sign}${Math.abs(minutes)} minutes`;
}

// Convierte un timestamp de SQLite ('YYYY-MM-DD HH:MM:SS', guardado en UTC
// sin sufijo) a milisegundos epoch, para poder comparar contra Date.now().
function parseUtcTimestamp(sqliteTimestamp) {
  return new Date(sqliteTimestamp.replace(" ", "T") + "Z").getTime();
}

module.exports = { localDateStr, localMinuteOfDay, offsetModifier, parseUtcTimestamp };
