// Firebase Messaging Service Worker
// Recibe notificaciones push cuando la app está cerrada

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

async function initMessaging() {
  try {
    const response = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`init.json HTTP ${response.status}`);
    }
    const config = await response.json();
    firebase.initializeApp(config);
    return firebase.messaging();
  } catch (error) {
    console.error('[SW] No se pudo inicializar Firebase Messaging:', error);
    return null;
  }
}

// Maneja notificaciones en background (app cerrada o en segundo plano)
initMessaging().then((messaging) => {
  if (!messaging) return;

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notificación background recibida:', payload);

    const { title, body, icon, data } = payload.notification || {};

    self.registration.showNotification(title || 'PESSY', {
      body: body || 'Recordatorio de tu mascota',
      icon: icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data?.notificationId || 'pessy-reminder',
      data: data || {},
      actions: [
        { action: 'view', title: 'Ver detalles' },
        { action: 'dismiss', title: 'Descartar' }
      ],
      requireInteraction: true,
      vibrate: [200, 100, 200],
    });
  });
});

// Click en la notificación -> abre la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
