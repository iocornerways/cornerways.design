/**
 * "Install this app" for every Cornerways site, framework-free so the static
 * hub can load it as-is and the React apps can import it.
 *
 * Browsers never install without a tap, so this only makes the tap easy to
 * find:
 *  - Chromium (Android, desktop Chrome/Edge): catches beforeinstallprompt and
 *    shows a card with an Install button that opens the browser's own prompt.
 *  - iPhone/iPad: no prompt exists, so the card shows the Share → Add to Home
 *    Screen steps instead. Inside an in-app browser (Facebook, Instagram,
 *    Google app…) it says to open the page in Safari first.
 *
 * Shows nothing when already running as an installed app, in an iframe, or
 * on the kitchen tablet (opened with ?kiosk=1, remembered for the tab).
 * "Not now" is remembered per site for DISMISS_DAYS.
 *
 * Styles: install.css, themed through --cw-install-* custom properties.
 */

const DISMISS_KEY = "cw-install-dismissed-at";
const KIOSK_KEY = "cw-kiosk";
const DISMISS_DAYS = 30;

const SHARE_ICON =
  '<svg class="cw-install-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" /><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" /></svg>';
const ADD_ICON =
  '<svg class="cw-install-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M12 8.5v7M8.5 12h7" /></svg>';
const MORE_ICON =
  '<svg class="cw-install-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></svg>';
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>';

function safeGet(storage, key) {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    window[storage].setItem(key, value);
  } catch {
    // Private mode or blocked storage: the card just comes back next visit.
  }
}

/** Running as the installed app. Every manifest asks for standalone; not
 * fullscreen, which also matches an ordinary browser window in full screen. */
export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

/** iPhone, iPod, or an iPad, which reports itself as a Mac with a touchscreen. */
export function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** In-app browsers that can't add to the home screen. */
export function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|GSA\/|Snapchat|LinkedInApp|TikTok|musical_ly|WhatsApp/i.test(
    navigator.userAgent,
  );
}

function isKiosk() {
  if (new URLSearchParams(location.search).get("kiosk") === "1") {
    safeSet("sessionStorage", KIOSK_KEY, "1");
    return true;
  }
  return safeGet("sessionStorage", KIOSK_KEY) === "1";
}

function recentlyDismissed() {
  const at = Number(safeGet("localStorage", DISMISS_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/**
 * @param {{ appName: string, icon?: string }} options
 *   appName: as it appears on the home screen ("Todo").
 *   icon: the square icon to show in the card (default /icon-192.png).
 */
export function initInstallPrompt(options) {
  if (typeof window === "undefined" || window.__cwInstall) return;
  window.__cwInstall = true;

  const appName = options?.appName || document.title;
  const icon = options?.icon || "/icon-192.png";

  if (isStandalone() || window.top !== window.self || isKiosk()) return;

  /** @type {HTMLElement | null} */
  let card = null;
  let deferredPrompt = null;

  function remove() {
    card?.remove();
    card = null;
  }

  function dismiss() {
    safeSet("localStorage", DISMISS_KEY, String(Date.now()));
    remove();
  }

  function show(bodyHtml, actionsHtml) {
    remove();
    card = document.createElement("section");
    card.className = "cw-install";
    card.setAttribute("role", "region");
    card.setAttribute("aria-label", `Install ${appName}`);
    card.innerHTML = `
      <div class="cw-install-head">
        <img class="cw-install-icon" src="${escapeHtml(icon)}" alt="" width="44" height="44" />
        <div class="cw-install-text">
          <p class="cw-install-title">Get ${escapeHtml(appName)} on this device</p>
          ${bodyHtml}
        </div>
        <button type="button" class="cw-install-close" data-cw-install="dismiss" aria-label="Not now — hide install tips">${CLOSE_ICON}</button>
      </div>
      ${actionsHtml ? `<div class="cw-install-actions">${actionsHtml}</div>` : ""}
    `;
    card.addEventListener("click", (event) => {
      const action = event.target instanceof Element ? event.target.closest("[data-cw-install]")?.getAttribute("data-cw-install") : null;
      if (action === "dismiss") dismiss();
      if (action === "install") install();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Escape") dismiss();
    });
    document.body.appendChild(card);
  }

  async function install() {
    const promptEvent = deferredPrompt;
    if (!promptEvent) return;
    deferredPrompt = null;
    promptEvent.prompt();
    try {
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") remove();
      else dismiss();
    } catch {
      remove();
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (recentlyDismissed()) return;
    show(
      `<p class="cw-install-body">Install it to open ${escapeHtml(appName)} like an app, straight from your home screen or desktop.</p>`,
      `<button type="button" class="cw-install-primary" data-cw-install="install">Install ${escapeHtml(appName)}</button>
       <button type="button" class="cw-install-secondary" data-cw-install="dismiss">Not now</button>`,
    );
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    remove();
  });

  if (isIos() && !recentlyDismissed()) {
    const reveal = () =>
      isInAppBrowser()
        ? show(
            `<p class="cw-install-body">This page is open inside another app. Tap ${MORE_ICON}<span class="cw-install-sr">the menu</span> and choose <strong>Open in Safari</strong>, then add it to your Home Screen from there.</p>`,
            "",
          )
        : show(
            `<ol class="cw-install-steps">
               <li>Tap <span class="cw-install-key">${SHARE_ICON}<span>Share</span></span> <span class="cw-install-hint">(on newer iPhones it's under ${MORE_ICON}<span class="cw-install-sr">the More menu</span>)</span></li>
               <li>Choose <span class="cw-install-key">${ADD_ICON}<span>Add to Home Screen</span></span></li>
             </ol>`,
            `<button type="button" class="cw-install-secondary" data-cw-install="dismiss">Got it</button>`,
          );
    if (document.readyState === "complete") reveal();
    else window.addEventListener("load", reveal, { once: true });
  }
}
