/* sw.js — csTimer clone offline service worker ([share] pack, item 91)
 * Cache-first for same-origin GET requests, network fallback.
 * Bump CACHE_VERSION on every deploy to invalidate old caches. */
'use strict';

var CACHE_VERSION = 'v1.1.0';
var CACHE_NAME = 'cstc-clone-' + CACHE_VERSION;

/* All URLs are RELATIVE so the app works under a GitHub Pages subpath. */
var PRECACHE = [
  './',
  './index.html',
  './style.css',
  './desktop.css',
  './mobile.css',
  './manifest.webmanifest',
  './js/mobile.js',
  './js/draw_nnn.js',
  './js/draw_pyra.js',
  './js/draw_skewb.js',
  './js/draw_sq1.js',
  './js/draw_clock.js',
  './js/draw_mega.js',
  './js/scramble.js',
  './js/stats.js',
  './js/app.js',
  './js/feat_stats.js',
  './js/feat_data.js',
  './js/feat_tools.js',
  './js/feat_share.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* add one-by-one so a single missing file cannot brick the install */
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url).catch(function () { /* skip missing asset */ });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('cstc-clone-') === 0 && k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; /* CDN fonts etc: browser default */

  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
      if (hit) return hit; /* cache-first: snappy loads */
      return fetch(req).then(function (res) {
        if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, clone).catch(function () { });
          }).catch(function () { });
        }
        return res;
      }).catch(function () {
        /* offline and not cached */
        if (req.mode === 'navigate') {
          return caches.match('./index.html').then(function (page) {
            return page || new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
          });
        }
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
