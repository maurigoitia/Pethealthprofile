// Firebase Messaging Service Worker
// Recibe notificaciones push cuando la app está cerrada

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAzaoRnO1bH1aLEhwVQMv-NHhkTE4H-ClQ",
  authDomain: "gen-lang-client-0123805751.firebaseapp.com",
  projectId: "gen-lang-client-0123805751",
  storageBucket: "gen-lang-client-0123805751.firebasestorage.app",
  messagingSenderId: "1014436216914",
  appId: "1:1014436216914:web:98f94f55738c08a20b9f8b"
});

const messaging = firebase.messaging();

// Maneja notificaciones en background (app cerrada o en segundo plano)
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
