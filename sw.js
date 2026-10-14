// Network-first service worker: always fresh when online, still works offline
// (e.g. no signal in the garage) from the last cached copy.
// Bump CACHE whenever SHELL changes so installed copies pick up the new list.
const CACHE = 'train-v6';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/ui.js', './js/timer.js', './js/stats.js', './js/programme.js',
  './js/paces.js', './js/schedule.js', './js/progression.js', './js/store.js', './js/import.js',
  './js/backup.js', './js/wakelock.js', './js/exercises.js', './js/exercises-calisthenics.js', './js/ladders.js',
  './js/views/today.js', './js/views/plan.js', './js/views/session.js', './js/views/gym.js',
  './js/views/run.js', './js/views/progress.js', './js/views/settings.js',
  './js/views/welcome.js', './js/views/import-run.js', './js/views/extra.js', './js/views/skip.js',
  './icons/icon.svg', './icons/touch-icon-v2.png', './icons/app-192-v2.png', './icons/app-512-v2.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((cached) => cached ?? caches.match('./index.html'))),
  );
});
