/* LabControl — service worker mínimo.
 * Solo guarda la propia app (HTML, iconos, manifiesto) para abrir rápido e instalarse.
 * Los datos NUNCA se guardan aquí: las consultas al servidor (Apps Script) pasan directo,
 * así el estado de los equipos siempre viene del servidor.
 * Estrategia: red primero para la página (siempre la versión más nueva si hay conexión),
 * copia guardada solo si no hay red. */
const CACHE = 'labcontrol-v9';
const BASE = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './favicon.ico', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // servidor, fuentes: sin tocar
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
