// ─────────────────────────────────────────────────────────────────
// SC Vianense SAD — Service Worker
// Estratégia: network-first para HTML, cache-first para assets estáticos
// ─────────────────────────────────────────────────────────────────
const CACHE_NAME = 'scv-v2';

const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
];

// ── INSTALL: pré-carrega apenas assets estáticos (não o HTML) ────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: remove caches antigos ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Deixa passar: Firebase APIs
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebasestorage.app') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('radiogeice.com')
  ) {
    return;
  }

  // HTML → network-first: garante que um refresh busca sempre a versão mais recente
  const isHTML = event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Guarda a versão mais recente em cache (para modo offline)
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // offline fallback
    );
    return;
  }

  // Assets estáticos (Firebase SDK, ícones) → cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response?.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
