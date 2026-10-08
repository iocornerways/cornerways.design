/**
 * "← Back to setting up your household": a bar along the bottom of an app
 * opened from another family page that wants the person back, such as the
 * hub's /welcome, which sends a new household's owner into Trips or Food's
 * settings and expects them to return.
 *
 * The page that links here adds ?return_to=<its own URL>. That's checked
 * against the family's own hosts (familyHosts, plus the dev servers in
 * development), so it can't become a link to anywhere else, then kept for
 * the tab, so the bar stays while the person moves around the app, and
 * taken off the address so the app's own routing never sees it. Closing the
 * bar forgets it.
 *
 *   import { initReturnBar } from "@cornerways/design/return-bar";
 *   initReturnBar();
 *
 * Styles: .cw-return-bar in components.css.
 */
import { deploymentFor, familyHosts } from "./apps.ts";

const STORAGE_KEY = "cw-return-to";

function allowed(url: URL): boolean {
  if (familyHosts().includes(url.hostname)) return url.protocol === "https:";
  // Development: the hub and apps on their own ports of the same machine.
  return deploymentFor(location.hostname) === "development" && deploymentFor(url.hostname) === "development";
}

function labelFor(url: URL): string {
  if (url.pathname.startsWith("/welcome")) return "Back to setting up your household";
  if (url.pathname.startsWith("/household")) return "Back to household settings";
  return "Back to Cornerways";
}

function read(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(value: string | null): void {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // No storage: the bar lasts for this page only.
  }
}

export function initReturnBar(): void {
  if (typeof window === "undefined") return;

  const here = new URL(location.href);
  const asked = here.searchParams.get("return_to");
  let target: string | null = read();
  if (asked !== null) {
    here.searchParams.delete("return_to");
    history.replaceState(history.state, "", here.pathname + here.search + here.hash);
    try {
      const url = new URL(asked);
      target = allowed(url) ? url.toString() : null;
    } catch {
      target = null;
    }
    write(target);
  }
  if (!target) return;

  const url = new URL(target);
  const bar = document.createElement("nav");
  bar.className = "cw-return-bar";
  bar.setAttribute("aria-label", "Return");
  const link = document.createElement("a");
  link.className = "cw-return-bar-link";
  link.href = url.toString();
  link.textContent = `← ${labelFor(url)}`;
  link.addEventListener("click", () => write(null));
  const close = document.createElement("button");
  close.type = "button";
  close.className = "cw-return-bar-close";
  close.setAttribute("aria-label", "Stay here and hide this");
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>';
  close.addEventListener("click", () => {
    write(null);
    bar.remove();
    delete document.documentElement.dataset.cwReturning;
  });
  bar.append(link, close);

  const mount = () => {
    document.body.appendChild(bar);
    // The install card would sit in the same spot; it waits until this is gone.
    document.documentElement.dataset.cwReturning = "";
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
}
