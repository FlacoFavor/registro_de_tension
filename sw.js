const cacheName = 'tension-v1.2.3';

// Listado de recursos esenciales para que la app funcione 100% offline
const assets = [
  './',
  './index.html',
  './estilos.css',
  './script.js',
  './manifest.json'
];

// 1. INSTALACIÓN: Almacena los archivos estáticos en el dispositivo
self.addEventListener('install', e => {
  // Fuerza al Service Worker actual a convertirse en el activo de inmediato
  self.skipWaiting();
  
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('[Service Worker] Guardando recursos estáticos en caché');
      return cache.addAll(assets);
    })
  );
});

// 2. ACTIVACIÓN: Elimina cachés antiguas de versiones anteriores automáticamente
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== cacheName) {
            console.log('[Service Worker] Eliminando caché antigua obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Toma el control de las pestañas abiertas inmediatamente
  );
});

// 3. INTERCEPCIÓN DE PETICIONES: Estrategia Cache First (Offline)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      // Si el archivo está en la caché, lo sirve al instante sin usar internet
      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no está en caché, lo descarga de la red de forma normal
      return fetch(e.request).catch(() => {
        // Fallback de emergencia si falla la red e internet está desconectado del todo
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// 4. INTERACCIÓN CON NOTIFICACIONES
self.addEventListener('notificationclick', e => {
  e.notification.close(); // Cierra el banner visual flotante

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

