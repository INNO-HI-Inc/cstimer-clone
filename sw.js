/* sw.js — csTimer clone offline service worker ([share] pack, item 91)
 *
 * Strategy: stale-while-revalidate for same-origin GETs.
 *   - Serve the cached copy instantly (snappy loads, works offline).
 *   - ALWAYS revalidate in the background and write the fresh copy back,
 *     so a client heals itself on the next load even if CACHE_VERSION was
 *     never bumped. Cache-first-with-no-revalidate used to strand users on
 *     an old build forever; that is why this file must never go back to it.
 *   - The e.waitUntil() around the revalidate is LOAD-BEARING: without it the
 *     browser may kill the worker before cache.put() lands.
 *
 * Bumping CACHE_VERSION is still belt-and-braces (SWR can serve one mixed-version
 * load right after a deploy, and the bump is what triggers the SW_UPDATED toast).
 *
 * Update contract with js/feat_share.js: on activate, if we superseded an older
 * cache, postMessage({type:'SW_UPDATED', version}) to every window client; the
 * page shows a "reload to update" toast.
 *
 * All URLs are RELATIVE so the app works under a GitHub Pages subpath.
 */
'use strict';

var CACHE_VERSION = 'v1.10.0';
var CACHE_NAME = 'cstc-clone-' + CACHE_VERSION;
var CACHE_PREFIX = 'cstc-clone-';

/* CORE — the app shell. Cached ATOMICALLY with addAll(): if any one of these
 * fails, install rejects, the old SW stays in control and the browser retries.
 * A half-installed shell (e.g. a transient 502 on js/app.js) used to activate
 * anyway and boot a script-less, silently broken page offline. */
var CORE = [
  './',
  './index.html',
  './style.css',
  './desktop.css',
  './mobile.css',
  './fonts/pretendard.css',
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
  './js/vcube3d.js',
  './js/feat_vcube.js'
];

/* OPTIONAL — nice to have, never worth failing an install over.
 * Fonts: only the two boot-critical Pretendard subsets are precached
 * (91 = Latin + digits + most common Hangul, 90 = next Hangul band, ~59KB total).
 * The other 90 subsets are picked up on demand by the runtime SWR branch —
 * precaching all of them would cost ~2.8MB, and a missing subset only means
 * font-display:swap shows the system font. */
var OPTIONAL = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/PretendardVariable.subset.91.woff2',
  './fonts/PretendardVariable.subset.90.woff2'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* atomic: rejects install if ANY core asset is missing/errored */
      return cache.addAll(CORE).then(function () {
        return Promise.all(OPTIONAL.map(function (url) {
          return cache.add(url).catch(function () { /* non-fatal */ });
        }));
      });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      var old = keys.filter(function (k) {
        return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_NAME;
      });
      return Promise.all(old.map(function (k) { return caches.delete(k); }))
        .then(function () { return old.length > 0; });
    }).then(function (superseded) {
      return self.clients.claim().then(function () {
        /* Only tell the page on a real UPDATE. A first install has no old cache,
         * and a brand-new user must not be nagged to reload. */
        if (!superseded) return;
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(function (list) {
            list.forEach(function (c) {
              try { c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }); } catch (err) { /* ignore */ }
            });
          }).catch(function () { /* ignore */ });
      });
    })
  );
});

function offlineFallback(req) {
  if (req.mode === 'navigate') {
    return caches.match('./index.html').then(function (page) {
      return page || new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    });
  }
  return new Response('', { status: 504, statusText: 'offline' });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; /* cross-origin: browser default */

  /* Extend the worker's life synchronously — calling waitUntil later, from
   * inside a .then(), is only legal while respondWith is still pending. */
  var release;
  e.waitUntil(new Promise(function (resolve) { release = resolve; }));

  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
      var stored;
      var net = fetch(req).then(function (res) {
        if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
          var clone = res.clone();
          stored = caches.open(CACHE_NAME).then(function (cache) {
            return cache.put(req, clone);
          }).catch(function () { /* quota / opaque: ignore */ });
        }
        return res; /* respond as soon as the network answers; put lands in bg */
      }).catch(function () {
        return hit || offlineFallback(req);
      });

      /* release only after the revalidate AND the cache write finish */
      net.then(function () { return stored; }).then(release, release);

      return hit || net; /* stale-while-revalidate */
    }).catch(function () {
      release();
      return fetch(req).catch(function () { return offlineFallback(req); });
    })
  );
});
