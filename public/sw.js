/**
 * Service Worker para cache offline (PWA)
 * Estratégia: Cache First com fallback para rede
 */

const CACHE_NAME = 'team-queue-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
];

// Instalação: cacheia recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aberto, adicionando recursos...');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  // Ativa imediatamente sem esperar abas antigas
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: tenta cache primeiro, depois rede
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cacheia respostas válidas para futuras requisições
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});

