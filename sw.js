const cacheName = 'tension-v1.2.12';

// 1. Listado de recursos esenciales para que la app funcione offline
const assets = [
  './',
  './index.html',
  './estilos.css',
  './script.js',
  './manifest.json',
  './icono.svg'
];

// Configura AQUÍ las dos horas exactas de tus avisos (ÚNICO SITIO CENTRALIZADO)
const ALARMA_MANANA = "20:20";
const ALARMA_NOCHE  = "20:17";

// 2. INSTALACIÓN: Almacena los archivos estáticos en el dispositivo
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('[Service Worker] Guardando recursos estáticos en caché');
      return cache.addAll(assets);
    })
  );
});

// 3. ACTIVACIÓN: Elimina cachés antiguas automáticamente al actualizar versión
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== cacheName) {
            console.log('[Service Worker] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 4. INTERCEPCIÓN DE PETICIONES: Estrategia Cache First (Offline)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// 5. INTERACCIÓN CON NOTIFICACIONES: Abre la app al pulsar la alerta
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUnassigned: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});

// 6. RELOJ ÚNICO DE CONTROL EN SEGUNDO PLANO
setInterval(() => {
  if (self.Notification && self.Notification.permission === 'granted') {
    
    const ahora = new Date();
    const horaActual = ahora.getHours().toString().padStart(2, '0') + ':' + ahora.getMinutes().toString().padStart(2, '0');

    // Control Alarma 1 (Mañana)
    if (horaActual === ALARMA_MANANA) {
      self.registration.showNotification("☀️ Control de la Mañana", {
        body: "Es hora de tu toma de tensión matutina. Recuerda reposar 5 minutos antes.",
        icon: './icono.svg',
        badge: './icono.svg',
        vibrate: [200, 100, 200],
        tag: 'recordatorio-tension-diario',
        renotify: true
      });
    }

    // Control Alarma 2 (Noche)
    if (horaActual === ALARMA_NOCHE) {
      self.registration.showNotification("🌙 Control de la Noche", {
        body: "Momento de tu toma de tensión nocturna. No olvides registrar tus valores.",
        icon: './icono.svg',
        badge: './icono.svg',
        vibrate:,
        tag: 'recordatorio-tension-diario',
        renotify: true
      });
    }
  }
}, 60000); // Revisa la hora del teléfono cada 60 segundos de forma interna


