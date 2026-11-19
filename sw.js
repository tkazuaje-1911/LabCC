/* LabControl — service worker mínimo.
 * Solo guarda la propia app (HTML, iconos, manifiesto) para abrir rápido e instalarse.
 * Los datos NUNCA se guardan aquí: las consultas al servidor (Apps Script) pasan directo,
 * así el estado de los equipos siempre viene del servidor.
 * Estrategia: la página sale de la copia guardada y se actualiza en segundo plano (ver más abajo). */
const CACHE = 'labcontrol-v16';
const BASE = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './favicon.ico', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const PAGINA = new Request('./index.html');
/* v0.10.1: la página se muestra al instante desde la copia guardada y se actualiza en segundo plano
 * (antes esperaba a la red en cada apertura). Si en segundo plano llega una versión distinta, la app avisa
 * con «Hay una versión nueva» y se actualiza al tocar el aviso. Lo demás (iconos, manifiesto) sigue red primero. */
async function avisarNueva() {
  const cs = await self.clients.matchAll({ type: 'window' });
  cs.forEach(c => c.postMessage({ lc: 'nueva' }));
}
function esPagina(req, url) { return req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname); }
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // servidor, fuentes: sin tocar
  if (esPagina(req, url)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const guardada = await cache.match(PAGINA);
      const textoViejo = guardada ? guardada.clone().text() : null; // clonar antes de entregarla: el cuerpo se consume al responder
      const red = fetch(req.url, { cache: 'no-cache' }).then(async res => {
        if (res.ok) {
          try {
            const nuevo = await res.clone().text();
            if (guardada) {
              const viejo = await textoViejo;
              if (viejo !== nuevo) { await cache.put(PAGINA, res.clone()); await new Promise(ok => setTimeout(ok, 3000)); await avisarNueva(); }
            } else await cache.put(PAGINA, res.clone());
          } catch (_) { }
        }
        return res;
      });
      if (guardada) { e.waitUntil(red.catch(() => { })); return guardada; }
      return red.catch(() => caches.match('./index.html'));
    })());
    return;
  }
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
