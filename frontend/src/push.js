import { api } from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalonePWA() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Antes de intentar suscribir, diagnostica POR QUÉ no va a funcionar en este
// dispositivo/navegador específico — las notificaciones push tienen
// restricciones reales del sistema operativo que no dependen de la app:
// - Necesitan HTTPS de verdad (no sirve probar por IP local con http://).
// - En iPhone/iPad, Safari solo permite push si la app está instalada
//   ("Agregar a pantalla de inicio") y abierta desde ahí, nunca desde una
//   pestaña normal del navegador — aunque el usuario dé permiso, el
//   sistema operativo lo bloquea igual.
export function getPushUnavailableReason() {
  if (!window.isSecureContext) {
    return "Las notificaciones necesitan HTTPS. Si estás probando por IP local (http://), no van a funcionar hasta que la app esté en un dominio real con certificado.";
  }
  if (!pushSupported()) {
    return "Tu navegador no soporta notificaciones push.";
  }
  if (isIOS() && !isStandalonePWA()) {
    return "En iPhone/iPad, las notificaciones solo funcionan si instalas la app primero: toca Compartir → \"Agregar a pantalla de inicio\", y ábrela desde ese ícono (no desde Safari directo). Ese permiso de la app en Ajustes no sirve si no la abriste así.";
  }
  return null;
}

export async function getPushSubscriptionStatus() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return Boolean(sub);
}

export async function subscribeToPush() {
  const blockedReason = getPushUnavailableReason();
  if (blockedReason) {
    throw new Error(blockedReason);
  }

  const { enabled, publicKey } = await api.getPushPublicKey();
  if (!enabled) {
    throw new Error("Las notificaciones push no están configuradas en este servidor todavía");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Bloqueaste las notificaciones para este sitio. Actívalas manualmente desde el candado/ajustes del navegador y vuelve a intentar."
        : "No diste permiso de notificaciones."
    );
  }

  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await api.pushSubscribe(subscription.toJSON());
  return subscription;
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.pushUnsubscribe({ endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
