// Service worker: primero red (para recibir siempre la última versión), caché como respaldo sin conexión.
const CACHE = 'findes-v0.1.0';
const SHELL = [
  './', 'index.html', 'css/styles.css?v=0.1.0', 'js/app.js?v=0.1.0', 'js/dates.js', 'js/holidays.js',
  'js/config.js', 'vendor/supabase.js', 'manifest.webmanifest', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase va directo
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
