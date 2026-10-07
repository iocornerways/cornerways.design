/* Cornerways service worker. Built into each site's /sw.js by the
   cornerwaysPwa() Vite plugin (vite.js), or the hub's sync script, which
   replace the two placeholders below.

   Deliberately small: every page is live and behind sign-in, so nothing
   personal is cached. Page loads always go to the network, falling back to
   /offline.html only when there's no connection; sign-in redirects pass
   straight through. Vite's hashed /assets/* never change, so they're served
   from cache once seen. /api/* and other origins aren't touched. Each deploy
   gets a new VERSION, and activating it deletes the old caches. */

/* global self, caches, importScripts */

const VERSION = "__CW_SW_VERSION__";
const PRECACHE = `cw-precache-${VERSION}`;
const ASSETS = `cw-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

importScripts(...__CW_SW_IMPORTS__);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"]))
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
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        }
      })(),
    );
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
