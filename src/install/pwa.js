/**
 * Build-time half of the install support (Node only, never in a client
 * bundle): renders /sw.js and /offline.html from the templates beside this
 * file. Plain JS, not TS, because Node won't strip types under node_modules
 * and both a Vite config and the hub's sync script load it directly.
 *
 *   import { cornerwaysPwa } from "@cornerways/design/pwa";
 *   plugins: [..., cornerwaysPwa({ appName: meta.name })]
 *
 * The plugin, in the client build only:
 *  - emits sw.js (versioned by a hash of the build's file names, so every
 *    deploy that changes anything replaces the old caches) and offline.html;
 *  - adds the standalone meta tags and a service worker registration to
 *    index.html.
 * Both paths must be in the site's PUBLIC_PATHS so the browser can fetch them
 * signed out. In `vite dev` nothing is registered, so dev never caches.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const SW_TEMPLATE = new URL("./sw-core.js", import.meta.url);
const OFFLINE_TEMPLATE = new URL("./offline.html", import.meta.url);

/** @param {{ version: string, importScripts?: string[] }} options */
export function renderServiceWorker({ version, importScripts = [] }) {
  return readFileSync(SW_TEMPLATE, "utf8")
    .replace("__CW_SW_VERSION__", version)
    .replace("__CW_SW_IMPORTS__", JSON.stringify(importScripts));
}

/** @param {{ appName: string }} options */
export function renderOfflinePage({ appName }) {
  const escaped = appName.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return readFileSync(OFFLINE_TEMPLATE, "utf8").replaceAll("__CW_APP_NAME__", escaped);
}

export function hashOf(...parts) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex").slice(0, 12);
}

const REGISTER_SW = `if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}`;

/**
 * @param {{ appName: string, importScripts?: string[] }} options
 *   importScripts: extra same-origin scripts the worker loads (Trains' push
 *   handlers live in /sw-push.js).
 * @returns {import("vite").Plugin}
 */
export function cornerwaysPwa({ appName, importScripts = [] }) {
  let isBuild = false;
  return {
    name: "cornerways-pwa",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    transformIndexHtml() {
      const tags = [
        { tag: "meta", attrs: { name: "mobile-web-app-capable", content: "yes" }, injectTo: "head" },
        { tag: "meta", attrs: { name: "apple-mobile-web-app-capable", content: "yes" }, injectTo: "head" },
      ];
      if (isBuild) tags.push({ tag: "script", children: REGISTER_SW, injectTo: "head" });
      return tags;
    },
    generateBundle(_options, bundle) {
      // The cloudflare plugin builds the Worker as its own environment; the
      // service worker belongs with the client assets only.
      if (this.environment && this.environment.name !== "client") return;
      const offline = renderOfflinePage({ appName });
      const version = hashOf(Object.keys(bundle).sort().join("\n"), offline, JSON.stringify(importScripts));
      this.emitFile({ type: "asset", fileName: "offline.html", source: offline });
      this.emitFile({ type: "asset", fileName: "sw.js", source: renderServiceWorker({ version, importScripts }) });
    },
  };
}
