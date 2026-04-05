// Firebase Messaging Service Worker
// Recibe notificaciones push cuando la app está cerrada

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBwyy3aPNQ392g69L6yheLxvR0IirgjpoE",
  authDomain: "pessy.app",
  projectId: "polar-scene-488615-i0",
  storageBucket: "polar-scene-488615-i0.firebasestorage.app",
  messagingSenderId: "842879609097",
  appId: "1:842879609097:web:b4fcb8fb0b04f316b68bd8"
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
      { action: 'view', title: '👁 Ver detalles' },
      { action: 'dismiss', title: 'Descartar' }
    ],
    requireInteraction: true, // No desaparece hasta que el usuario interactúa
    vibrate: [200, 100, 200],
  });
});

// Click en la notificación → abre la app
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
