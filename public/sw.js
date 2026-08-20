// Service Worker — Compromisso 360 Push Notifications
// Recebe push events do servidor (web-push) e exibe notificação OS estilo WhatsApp.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "Compromisso", body: event.data.text() };
  }

  const title = payload.title || "Compromisso";
  const options = {
    body: payload.body || "",
    // Apontavam para um JPEG de 1024x1024 renomeado para .png — 512 KB
    // baixados para desenhar um ícone de notificação, e um selo de 24 pixels.
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/badge-96.png",
    image: payload.image,
    tag: payload.tag || payload.type || "compromisso",
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || "/dashboard",
      type: payload.type || "info",
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
