// ─────────────────────────────────────────────────────────────────
// SC Vianense SAD — Service Worker
// Versão: incrementa CACHE_NAME para forçar actualização
// ─────────────────────────────────────────────────────────────────
const CACHE_NAME = 'scv-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  // Firebase SDK (versionados — não mudam)
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
];

// ── INSTALL: pré-carrega app shell ───────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
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

// ── FETCH: cache-first para app shell, network-only para APIs ────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Deixa passar: Firestore, Storage, autenticação Firebase, radiogeice (logo)
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebasestorage.app') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('radiogeice.com')
  ) {
    return; // browser trata normalmente
  }

  // Para tudo o resto: cache-first, fallback para network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Só guarda em cache respostas válidas de origens conhecidas
        if (
          response &&
          response.status === 200 &&
          (event.request.url.startsWith(self.location.origin) ||
           event.request.url.includes('gstatic.com'))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
