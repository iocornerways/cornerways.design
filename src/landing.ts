/// <reference path="./raw.d.ts" />
/**
 * The page an app shows a visitor who isn't signed in: what the app is for,
 * a few things it does, and Sign in. One page for every app, drawn with the
 * shell's own styles, so no app keeps its own copy to drift.
 *
 * Server-only: import from "@cornerways/design/landing" in a Worker. It
 * returns a whole HTML document; the app decides when to show it (usually a
 * signed-out page load of "/"), and builds the sign-in link to the hub.
 *
 * Not for search engines: app sites are noindex, and the hub's own pages are
 * the ones meant to be found.
 */
import {
  Bot,
  CalendarDays,
  CloudSun,
  Compass,
  Gauge,
  House,
  ListChecks,
  NotebookPen,
  PiggyBank,
  TrainFront,
  UtensilsCrossed,
  type IconNode,
} from "lucide";
import { APPS, PRIVATE_LAN_HOSTNAME, type AppKey } from "./apps.ts";
import { GOOGLE_FONTS_HREF } from "./fonts.ts";
import tokensCss from "./tokens.css?raw";
import fontsCss from "./fonts.css?raw";
import baseCss from "./base.css?raw";
import componentsCss from "./components.css?raw";

export type { IconNode } from "lucide";

/** Each app's line icon, as icons.tsx has it for React (keep the two in step). */
const APP_ICON_NODES: Record<AppKey, IconNode> = {
  home: House,
  calendar: CalendarDays,
  todo: ListChecks,
  weather: CloudSun,
  trips: Compass,
  trains: TrainFront,
  food: UtensilsCrossed,
  notes: NotebookPen,
  finance: PiggyBank,
  admin: Gauge,
  agent: Bot,
};

/** Stroke width for every icon, as ICON_STROKE (icons.tsx) has it. */
const STROKE = 1.7;

export interface LandingFeature {
  title: string;
  text: string;
  /** A lucide icon, e.g. `import { Thermometer } from "lucide"`. */
  icon: IconNode;
}

export interface LandingPageOptions {
  app: AppKey;
  /** The page's main heading. */
  headline: string;
  /** A sentence or two under it. */
  intro: string;
  /** Who it's for, or anything else a visitor should know before signing in. */
  note?: string;
  features: LandingFeature[];
  /** The hub's sign-in, with a redirect back here; built by the app. */
  signInUrl: string;
  /** From the shared cw_theme cookie; light unless it says dark. */
  theme?: "light" | "dark";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function svg(node: IconNode, size: number): string {
  const shapes = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeHtml(String(v))}"`).join(" ")}/>`)
    .join("");
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes}</svg>`;
}

const MARK =
  '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" stroke="currentColor" stroke-width="1.4"/><path d="M9.5 15V11C9.5 9.6193 10.6193 8.5 12 8.5H15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/**
 * Only an https link (or http to a local dev server) becomes the Sign in
 * button: the page links to it, and a "javascript:" address must never get
 * that far. Anything else falls back to the production hub's sign-in.
 */
function safeSignIn(value: string): URL {
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || PRIVATE_LAN_HOSTNAME.test(url.hostname);
    if (url.protocol === "https:" || (url.protocol === "http:" && local)) return url;
  } catch {
    // fall through
  }
  return new URL("https://cornerways.io/login");
}

const PAGE_CSS = `
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; background: var(--cw-canvas); color: var(--cw-ink); font-family: var(--cw-font-ui); -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .cw-header-app { font-size: 15px; font-weight: 600; white-space: nowrap; }
  main.cw-reading { flex: 1; padding-block: 48px 64px; }
  .landing-intro { display: grid; gap: 16px; max-width: 640px; margin-bottom: 44px; }
  .landing-intro .cw-app-chip { width: 56px; height: 56px; border-radius: 16px; }
  .landing-intro .cw-app-chip svg { width: 28px; height: 28px; }
  .landing-intro h1 { margin: 0; font-family: var(--cw-font-display); font-size: 42px; line-height: 1.15; font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; }
  .landing-intro p { margin: 0; color: var(--cw-muted); font-size: 18px; line-height: 1.55; }
  .landing-intro .landing-note { font-size: 15px; }
  .landing-intro .cw-button { justify-self: start; text-decoration: none; }
  .landing-features { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
  .landing-feature { display: flex; gap: 14px; min-width: 0; padding: 20px; border: 1px solid var(--cw-border-soft); border-radius: var(--cw-radius-card-lg); background: var(--cw-surface); box-shadow: var(--cw-shadow-1); }
  .landing-feature .cw-app-chip { flex: none; }
  .landing-feature h2 { margin: 2px 0 4px; font-size: 16px; font-weight: 600; }
  .landing-feature p { margin: 0; color: var(--cw-muted); font-size: 14.5px; line-height: 1.5; }
  @media (max-width: 639.98px) {
    main.cw-reading { padding-block: 28px 40px; }
    .landing-intro h1 { font-size: 32px; }
    .landing-intro p { font-size: 16.5px; }
    .landing-features { grid-template-columns: minmax(0, 1fr); }
  }
`;

/** The shared cw_theme cookie, for `theme`: dark only when it says so (Auto and unset get light). */
export function themeFromCookie(cookieHeader: string | null | undefined): "light" | "dark" {
  return /(?:^|;\s*)cw_theme=dark(?:;|$)/.test(cookieHeader ?? "") ? "dark" : "light";
}

/**
 * True for a browser loading a page, not a script, image or fetch: only
 * those should get the landing page. Browsers say so in Sec-Fetch-Dest;
 * without it, an Accept of text/html will do.
 */
export function isPageLoad(headers: { get(name: string): string | null }): boolean {
  const dest = headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (headers.get("accept") ?? "").includes("text/html");
}

/** The whole page, as an HTML string, ready for `c.html(...)`. */
export function renderLandingPage(options: LandingPageOptions): string {
  const app = APPS.find((entry) => entry.key === options.app);
  if (!app) throw new Error(`Unknown Cornerways app: ${options.app}`);
  const signIn = safeSignIn(options.signInUrl);
  const hub = signIn.origin;
  const dark = options.theme === "dark";
  const chip = (icon: IconNode, size: number) =>
    `<span class="cw-app-chip" style="--cw-app-accent: ${app.accent}">${svg(icon, size)}</span>`;
  const features = options.features
    .map(
      (feature) =>
        `<li class="landing-feature">${chip(feature.icon, 18)}<div><h2>${escapeHtml(feature.title)}</h2><p>${escapeHtml(feature.text)}</p></div></li>`,
    )
    .join("\n        ");
  const name = escapeHtml(app.name);
  const href = escapeHtml(signIn.toString());

  return `<!doctype html>
<html lang="en-GB"${dark ? ' data-theme="dark"' : ""}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} — Cornerways</title>
<meta name="description" content="${escapeHtml(options.intro)}" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="${dark ? "#1a1816" : "#f6f4f0"}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${GOOGLE_FONTS_HREF}" rel="stylesheet" />
<style>
${tokensCss}
${fontsCss}
${baseCss}
${componentsCss}
${PAGE_CSS}
</style>
</head>
<body>
  <header class="cw-header">
    <div class="cw-header-left">
      <a class="cw-brand" href="${escapeHtml(hub)}" aria-label="Cornerways home">
        <span class="cw-brand-mark">${MARK}</span>
        <span class="cw-wordmark">Cornerways</span>
      </a>
      <span class="cw-crumb-sep" aria-hidden="true">/</span>
      <span class="cw-header-app">${name}</span>
    </div>
    <div class="cw-header-right">
      <a class="cw-button cw-button--ghost" href="${href}">Sign in</a>
    </div>
  </header>
  <main class="cw-reading">
    <section class="landing-intro">
      ${chip(APP_ICON_NODES[app.key], 28)}
      <h1>${escapeHtml(options.headline)}</h1>
      <p>${escapeHtml(options.intro)}</p>
      ${options.note ? `<p class="landing-note">${escapeHtml(options.note)}</p>` : ""}
      <a class="cw-button cw-button--primary" href="${href}">Sign in to ${name}</a>
    </section>
    <ul class="landing-features" aria-label="What ${name} does">
        ${features}
    </ul>
  </main>
  <footer class="cw-footer cw-reading">
    <span>Cornerways &mdash; built for family and friends.</span>
    <span>Est. 2026</span>
  </footer>
</body>
</html>`;
}
