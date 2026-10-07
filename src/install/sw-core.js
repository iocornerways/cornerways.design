/* Cornerways service worker. Built into each site's /sw.js by the
   cornerwaysPwa() Vite plugin (pwa.js), or the hub's sync script, which
   fill in the __CW_*__ placeholders below.

   Deliberately small: every page is live and behind sign-in, so nothing
   personal is cached. Page loads always go to the network, falling back to
   the offline page only when there's no connection; sign-in redirects pass
   straight through. The offline page is built into this file, so there's
   nothing to fetch for it (and no clean-URL redirect from /offline.html to
   trip over); its icon is the one file precached. Vite's hashed /assets/*
   never change, so they're served from cache once seen. /api/* and other origins aren't touched. Each deploy
   gets a new VERSION, and activating it deletes the old caches. */

/* global self, caches, importScripts */

const VERSION = "__CW_SW_VERSION__";
const PRECACHE = `cw-precache-${VERSION}`;
const OFFLINE_ICON = "/icon-192.png";
const ASSETS = `cw-assets-${VERSION}`;
const OFFLINE_HTML = __CW_OFFLINE_HTML__;

importScripts(...__CW_SW_IMPORTS__);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      // The icon on the offline page; nothing else is worth keeping.
      .then((cache) => cache.add(OFFLINE_ICON))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, ASSETS]);
      for (const key of await caches.keys()) {
        if (key.startsWith("cw-") && !keep.has(key)) await caches.delete(key);
      }
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          return preloaded || (await fetch(request));
        } catch {
          return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
      })(),
    );
    return;
  }

  if (url.pathname === OFFLINE_ICON) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_ICON)) || Response.error()));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
