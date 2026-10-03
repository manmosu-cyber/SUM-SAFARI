const CACHE_NAME = "sum-safari-7f17d2bf8826e652";
const PRECACHE_URLS = [
  ".",
  "./game.js",
  "./img/SUMSAFARI_ICON.png",
  "./img/game_cheetah.png",
  "./img/game_falcon.png",
  "./img/game_rabbit.png",
  "./img/game_turtle.png",
  "./img/menu_1_cheetah.png",
  "./img/menu_1_falcon.png",
  "./img/menu_1_rabbit.png",
  "./img/menu_1_turtle.png",
  "./img/menu_2_cheetah.png",
  "./img/menu_2_falcon.png",
  "./img/menu_2_rabbit.png",
  "./img/menu_2_turtle.png",
  "./img/menu_3_cheetah.png",
  "./img/menu_3_falcon.png",
  "./img/menu_3_rabbit.png",
  "./img/menu_3_turtle.png",
  "./img/menu_4_cheetah.png",
  "./img/menu_4_falcon.png",
  "./img/menu_4_rabbit.png",
  "./img/menu_4_turtle.png",
  "./img/menu_5_cheetah.png",
  "./img/menu_5_falcon.png",
  "./img/menu_5_rabbit.png",
  "./img/menu_5_turtle.png",
  "./index.html",
  "./manifest.webmanifest",
  "./style.css"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('sum-safari-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(error => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then(fallback => fallback || Promise.reject(error));
        }
        throw error;
      });
    })
  );
});
