const cacheName = 'tension-v1.2.1';

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

// ==========================================
// RELOJ DE CONTROL DESDE SEGUNDO PLANO (SERVICE WORKER)
// ==========================================

const HORARIO_SW_MANANA = "19:10"; 
const HORARIO_SW_NOCHE  = "19:15";

setInterval(() => {
  // Comprobamos si el usuario dio permisos en la aplicación
  if (self.Notification && self.Notification.permission === 'granted') {
    
    const ahora = new Date();
    const horaActual = ahora.getHours().toString().padStart(2, '0') + ':' + ahora.getMinutes().toString().padStart(2, '0');

    // Control Alarma 1
    if (horaActual === HORARIO_SW_MANANA) {
      self.registration.showNotification("☀️ Control de la Mañana", {
        body: "Es hora de tu toma de tensión matutina. Recuerda reposar 5 minutos antes.",
        icon: './icono.svg',
        badge: './icono.svg',
        vibrate:,
        tag: 'recordatorio-tension-diario',
        renotify: true
      });
    }

    // Control Alarma 2
    if (horaActual === HORARIO_SW_NOCHE) {
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
}, 60000); // Revisa la hora del teléfono cada 60 segundos

