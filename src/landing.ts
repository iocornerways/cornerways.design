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
import { APP_ICON_NODES, escapeHtml, svg, type IconNode } from "./html.ts";
import { APPS, PRIVATE_LAN_HOSTNAME, appUrl, type AppDefinition, type AppKey } from "./apps.ts";
import { GOOGLE_FONTS_HREF } from "./fonts.ts";
import tokensCss from "./tokens.css?raw";
import fontsCss from "./fonts.css?raw";
import baseCss from "./base.css?raw";
import componentsCss from "./components.css?raw";
import homeCss from "./home.css?raw";

export type { IconNode } from "lucide";



export interface LandingFeature {
  title: string;
  text: string;
  /** A lucide icon, e.g. `import { Thermometer } from "lucide"`. */
  icon: IconNode;
}

/** A link on the page: text before it (optional), then the link. Same-site paths or https only. */
export interface LandingLink {
  text?: string;
  label: string;
  href: string;
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
  /** Quiet lines under the Sign in button, e.g. another way in during a changeover. */
  links?: LandingLink[];
  /** The footer's own words (e.g. a data credit) and links (e.g. Privacy), instead of the family's line. */
  footer?: { note?: string; links?: LandingLink[] };
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

/** A same-site path ("/privacy") or an https link; anything else isn't linked. */
function safeHref(value: string): string | null {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function linkHtml(link: LandingLink): string {
  const href = safeHref(link.href);
  const label = escapeHtml(link.label);
  const anchor = href ? `<a href="${escapeHtml(href)}">${label}</a>` : label;
  return link.text ? `${escapeHtml(link.text)} ${anchor}` : anchor;
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
  .landing-intro .landing-link { font-size: 14px; }
  .landing-intro .landing-link a, .cw-footer .landing-footer-links a { color: var(--cw-brand-text); }
  .landing-footer-links { display: inline-flex; gap: 16px; }
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

/** The document up to and including the shared header: the shell's CSS inlined, then the page's own. */
function documentStart(page: { app: AppDefinition; hub: string; href: string; dark: boolean; description: string; css: string }): string {
  const name = escapeHtml(page.app.name);
  return `<!doctype html>
<html lang="en-GB"${page.dark ? ' data-theme="dark"' : ""}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} — Cornerways</title>
<meta name="description" content="${escapeHtml(page.description)}" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="${page.dark ? "#1a1816" : "#f6f4f0"}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${GOOGLE_FONTS_HREF}" rel="stylesheet" />
<style>
${tokensCss}
${fontsCss}
${baseCss}
${componentsCss}
${page.css}
</style>
</head>
<body>
  <header class="cw-header">
    <div class="cw-header-left">
      <a class="cw-brand" href="${escapeHtml(page.hub)}" aria-label="Cornerways home">
        <span class="cw-brand-mark">${MARK}</span>
        <span class="cw-wordmark">Cornerways</span>
      </a>
      <span class="cw-crumb-sep" aria-hidden="true">/</span>
      <span class="cw-header-app">${name}</span>
    </div>
    <div class="cw-header-right">
      <a class="cw-button cw-button--ghost" href="${page.href}">Sign in</a>
    </div>
  </header>`;
}

function appChip(app: AppDefinition, icon: IconNode, size: number): string {
  return `<span class="cw-app-chip" style="--cw-app-accent: ${app.accent}">${svg(icon, size)}</span>`;
}

/** The whole page, as an HTML string, ready for `c.html(...)`. */
export function renderLandingPage(options: LandingPageOptions): string {
  const app = APPS.find((entry) => entry.key === options.app);
  if (!app) throw new Error(`Unknown Cornerways app: ${options.app}`);
  const signIn = safeSignIn(options.signInUrl);
  const hub = signIn.origin;
  const dark = options.theme === "dark";
  const chip = (icon: IconNode, size: number) => appChip(app, icon, size);
  const features = options.features
    .map(
      (feature) =>
        `<li class="landing-feature">${chip(feature.icon, 18)}<div><h2>${escapeHtml(feature.title)}</h2><p>${escapeHtml(feature.text)}</p></div></li>`,
    )
    .join("\n        ");
  const name = escapeHtml(app.name);
  const href = escapeHtml(signIn.toString());

  return `${documentStart({ app, hub, href, dark, description: options.intro, css: PAGE_CSS })}
  <main class="cw-reading">
    <section class="landing-intro">
      ${chip(APP_ICON_NODES[app.key], 28)}
      <h1>${escapeHtml(options.headline)}</h1>
      <p>${escapeHtml(options.intro)}</p>
      ${options.note ? `<p class="landing-note">${escapeHtml(options.note)}</p>` : ""}
      <a class="cw-button cw-button--primary" href="${href}">Sign in to ${name}</a>
      ${(options.links ?? []).map((link) => `<p class="landing-link">${linkHtml(link)}</p>`).join("\n      ")}
    </section>
    <ul class="landing-features" aria-label="What ${name} does">
        ${features}
    </ul>
  </main>
  <footer class="cw-footer cw-reading">
    <span>${options.footer?.note ? escapeHtml(options.footer.note) : "Cornerways &mdash; built for family and friends."}</span>
    <span class="landing-footer-links">${(options.footer?.links ?? []).map((link) => linkHtml(link)).join("")}<span>Est. 2026</span></span>
  </footer>
</body>
</html>`;
}

/* ---------- The fuller home page ---------- */

/** One of the "how it's used" blocks: a small picture, a heading and a paragraph. */
export interface AppHomeStory {
  title: string;
  text: string;
  /** A small illustrative picture, as HTML from the app's own code (never user input). Sample data only. */
  visual: string;
}

export interface AppHomePageOptions {
  app: AppKey;
  headline: string;
  /** Under the headline. */
  subtitle: string;
  /** One more, quieter line. */
  supporting?: string;
  /** The hub's sign-in, with a redirect back here; built by the app. */
  signInUrl: string;
  /** From the shared cw_theme cookie; light unless it says dark. */
  theme?: "light" | "dark";
  /** The hero's main action, usually a jump to the slot ("#try"). Sign in sits beside it. */
  action?: { label: string; href: string };
  /** The hero's other half, e.g. a live demo: HTML from the app's own code, given this id. */
  slot?: { id: string; html: string };
  stories: { heading: string; note?: string; items: AppHomeStory[] };
  /** Other apps this one passes things to, each with a line on what. */
  worksWith?: { heading: string; intro: string; apps: Array<{ app: AppKey; text: string }> };
  /** CSS for the slot and the pictures, from the app's own code. */
  css?: string;
  /** Same-site module scripts to load, e.g. the demo's. */
  scripts?: string[];
  /** Quiet lines under the beta line, e.g. another way in during a changeover. */
  links?: LandingLink[];
  /** A note for the footer (e.g. a data credit), and the app's own links in place of the hub's Privacy. */
  footer?: { note?: string; links?: LandingLink[] };
}

const HOME_CSS = homeCss;

/**
 * The fuller home page: a hero with a slot for something to try, how the app
 * is used, the apps it works with, and how to get Cornerways for your own
 * household. Built from the app's own words and pictures; the beta lines and
 * the footer are the family's, the same on every app.
 */
export function renderAppHomePage(options: AppHomePageOptions): string {
  const app = APPS.find((entry) => entry.key === options.app);
  if (!app) throw new Error(`Unknown Cornerways app: ${options.app}`);
  const signIn = safeSignIn(options.signInUrl);
  const hub = signIn.origin;
  const href = escapeHtml(signIn.toString());
  const name = escapeHtml(app.name);
  const hubLink = (path: string) => escapeHtml(`${hub}${path}`);
  // A jump within the page ("#try") or a same-site or https link.
  const actionHref = options.action && (/^#[\w-]+$/.test(options.action.href) ? options.action.href : safeHref(options.action.href));

  const hero = `<section class="home-hero cw-workspace home-inner" aria-labelledby="home-title">
      <div class="home-hero-text">
        ${appChip(app, APP_ICON_NODES[app.key], 30)}
        <h1 id="home-title">${escapeHtml(options.headline)}</h1>
        <p class="home-subtitle">${escapeHtml(options.subtitle)}</p>
        ${options.supporting ? `<p class="home-supporting">${escapeHtml(options.supporting)}</p>` : ""}
        <div class="home-actions">
          ${options.action && actionHref ? `<a class="cw-button cw-button--primary" href="${escapeHtml(actionHref)}">${escapeHtml(options.action.label)}</a>` : ""}
          <a class="cw-button${actionHref ? "" : " cw-button--primary"}" href="${href}">Sign in to ${name}</a>
        </div>
        <p class="home-beta-line">Want it for your own family? If you have a beta code, <a href="${hubLink("/signup/")}">create your household</a>. Otherwise, <a href="${hubLink("/signup/?request=1")}">ask for one</a>.</p>
        ${(options.links ?? []).map((link) => `<p class="home-beta-line">${linkHtml(link)}</p>`).join("\n        ")}
      </div>
      ${options.slot ? `<div class="home-slot" id="${escapeHtml(options.slot.id)}">${options.slot.html}</div>` : ""}
    </section>`;

  const stories = `<section class="home-band" aria-labelledby="home-stories">
      <div class="home-section cw-workspace home-inner">
        <h2 id="home-stories">${escapeHtml(options.stories.heading)}</h2>
        ${options.stories.note ? `<p class="home-section-intro">${escapeHtml(options.stories.note)}</p>` : ""}
        <ul class="home-cards">
          ${options.stories.items
            .map(
              (story) => `<li class="home-story">
            <div class="home-visual">${story.visual}</div>
            <div><h3>${escapeHtml(story.title)}</h3><p>${escapeHtml(story.text)}</p></div>
          </li>`,
            )
            .join("\n          ")}
        </ul>
      </div>
    </section>`;

  const worksWith = options.worksWith
    ? `<section class="home-section cw-workspace home-inner" aria-labelledby="home-works-with">
      <h2 id="home-works-with">${escapeHtml(options.worksWith.heading)}</h2>
      <p class="home-section-intro">${escapeHtml(options.worksWith.intro)}</p>
      <div class="home-cards">
        ${options.worksWith.apps
          .map(({ app: key, text }) => {
            const other = APPS.find((entry) => entry.key === key);
            if (!other) throw new Error(`Unknown Cornerways app: ${key}`);
            return `<a class="home-link-card" href="${escapeHtml(appUrl(other, signIn.hostname))}/">
          ${appChip(other, APP_ICON_NODES[other.key], 24)}
          <span><span class="home-link-name">${escapeHtml(other.name)}</span><span class="home-link-text">${escapeHtml(text)}</span><span class="home-link-go">See ${escapeHtml(other.name)} <span aria-hidden="true">&rarr;</span></span></span>
        </a>`;
          })
          .join("\n        ")}
      </div>
    </section>`
    : "";

  const beta = `<section class="cw-workspace home-inner" aria-labelledby="home-beta">
      <div class="home-beta" data-cw-theme="dark">
        <div>
          <h2 id="home-beta">Want this for your family?</h2>
          <p>Cornerways is in beta and built to a few simple <a href="${hubLink("/principles/")}">principles</a>. If you have a code, create your household. If not, ask for one.</p>
        </div>
        <div class="home-actions">
          <a class="cw-button cw-button--primary" href="${hubLink("/signup/")}">Create your household</a>
          <a class="cw-button" href="${hubLink("/signup/?request=1")}">Ask for a code</a>
        </div>
      </div>
    </section>`;

  const scripts = (options.scripts ?? [])
    .map((src) => safeHref(src))
    .filter((src): src is string => src !== null && src.startsWith("/"))
    .map((src) => `<script type="module" src="${escapeHtml(src)}"></script>`)
    .join("\n");
  // The app's CSS can't close the style element early.
  const appCss = (options.css ?? "").replace(/<\/style/gi, "<\\/style");

  return `${documentStart({ app, hub, href, dark: options.theme === "dark", description: options.subtitle, css: HOME_CSS + appCss })}
  <main class="home" style="--home-accent: ${app.accent}">
    ${hero}
    ${stories}
    ${worksWith}
    ${beta}
  </main>
  <footer class="home home-footer cw-footer cw-workspace" style="--home-accent: ${app.accent}">
    <span>Cornerways &mdash; built for family and friends.${options.footer?.note ? ` ${escapeHtml(options.footer.note)}` : ""}</span>
    <span class="home-footer-links">${options.footer?.links ? options.footer.links.map((link) => linkHtml(link)).join("") : `<a href="${hubLink("/privacy/")}">Privacy</a>`}<a href="mailto:hello@cornerways.io">hello@cornerways.io</a><span>Est. 2026</span></span>
  </footer>
${scripts}
</body>
</html>`;
}
