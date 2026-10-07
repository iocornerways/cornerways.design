import type { Plugin } from "vite";

export type CornerwaysPwaOptions = {
  /** As it appears on the home screen and the offline page ("Todo"). */
  appName: string;
  /** Extra same-origin scripts for the service worker to load, e.g. ["/sw-push.js"]. */
  importScripts?: string[];
};

export function cornerwaysPwa(options: CornerwaysPwaOptions): Plugin;
export function renderServiceWorker(options: { appName: string; version: string; importScripts?: string[] }): string;
export function renderOfflinePage(options: { appName: string }): string;
export function hashOf(...parts: string[]): string;
