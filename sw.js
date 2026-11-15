// Doppelkopf Zähler – Service Worker
// Strategie: Netz zuerst (immer die neueste Version von GitHub), bei fehlendem
// oder zu langsamem Netz die zuletzt gespeicherte Kopie. Kein Versions-Pflegen nötig.
var CACHE = 'dk-offline';
var TIMEOUT = 3000;
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function fromNetwork(url) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, TIMEOUT);
    fetch(url, { cache: 'no-cache' }).then(function (r) { clearTimeout(t); resolve(r); },
                                           function (err) { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fromNetwork(req.url).then(function (res) {
      if (res && res.ok) {
        var copy1 = res.clone();
        var copy2 = req.mode === 'navigate' ? res.clone() : null;
        caches.open(CACHE).then(function (c) {
          c.put(req.url, copy1);
          if (copy2) c.put('index.html', copy2);
        }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req.url, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
