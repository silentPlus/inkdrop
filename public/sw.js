// Ink Drop Service Worker — 离线缓存策略
const CACHE = 'inkdrop-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  (self as any).skipWaiting();
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event: any) => {
  // 对 JS/CSS/图片 使用 Cache-First
  const url = new URL(event.request.url);
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }
  // HTML/API 使用 Network-First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
