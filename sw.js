const cacheName = 'tension-v1.2';

// 1. Listado de recursos esenciales para que la app funcione offline
const assets = [
  './',
  './index.html',
  './estilos.css',
  './script.js',
  './manifest.json',
  './icono.svg'
];

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
