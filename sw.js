// Definindo os arquivos para armazenar em cache
const CACHE_NAME = 'voz-livre-cache-v2';
const urlsToCache = [
  '/',
  'styles.css',
  'script.js',
  'logo.png',
  'https://cdn.jsdelivr.net/npm/daisyui@3.9.3/dist/full.css',
  'https://cdn.tailwindcss.com'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch para responder as requisições com os arquivos em cache quando disponíveis
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
