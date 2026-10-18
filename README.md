# cornerways.design

The shared shell for every Cornerways site: design tokens, fonts, the two
layout modes, the header and controls. Implemented once here and imported by
each app, so nothing is copied.

The rules for how the sites look and behave are in the
[style guide](docs/style-guide.md).

## Using it in an app

```sh
npm install "github:iocornerways/cornerways.design#vX.Y.Z"
```

Every app pins a tag this way (`"@cornerways/design": "github:iocornerways/cornerways.design#vX.Y.Z"`).
The repo is public so CI's `npm ci` can fetch it without credentials; it
holds no secrets (the session keys in `auth.ts` are public keys).

To ship a change:

1. Bump `version` in `package.json`, commit, then tag and push (`git tag vX.Y.Z && git push && git push --tags`).
2. In each app, run the install above with the new tag. Editing the tag in `package.json` by hand leaves the lockfile on the old commit.
3. Clear the app's `node_modules/.vite` before restarting its dev server.
4. Deploy the hub first, then the apps.

The package ships TypeScript and TSX source, not a build: each app's own
Vite and Wrangler compile it.

Then, at the top of the app's main stylesheet:

```css
@import "@cornerways/design/styles.css";
```

and in the page's `<head>`, the one Google Fonts request (the href is also
exported as `GOOGLE_FONTS_HREF`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet" />
```

That defines every `--cw-*` token. Nothing changes until the app uses them.

```tsx
import { Workspace, Reading, APPS, appUrl } from "@cornerways/design";
```

## What's here

| Import | File | Contents |
|---|---|---|
| `@cornerways/design` | `src/index.ts` | The client shell: `Header`, controls, layouts, `PageTitle`, `Mark`, `APP_ICONS`, `ICON_STROKE`, `THEMES`, `GOOGLE_FONTS_HREF`, the hooks below, and the app registry (`APPS`, `appUrl`, `hubUrl`, `familyHosts`) |
| `…/styles.css` | `src/styles.css` | Imports `fonts.css`, `tokens.css`, `base.css` and `components.css`; each is also importable alone |
| | `src/tokens.css` | Colours (light and dark), per-app accents, sizes, radii, shadows, z-index (`--cw-*`) |
| | `src/fonts.css`, `src/fonts.ts` | Font-family tokens for Figtree (UI) and Source Serif 4 (display), and the Google Fonts href |
| | `src/base.css` | `.cw-workspace` (and `--flush`, with no padding) and `.cw-reading` layout wrappers |
| | `src/components.css` | Styles for the header, menus, buttons, pills, segmented controls, toolbar, app chips and footer (`.cw-*`) |
| | `src/apps.ts`, `src/icons.tsx` | The app list: names, hosts, dev ports, accents, layout mode, and one line icon per app |
| | `src/Header.tsx`, `src/useMenu.ts` | `<Header>`, and the keyboard and outside-tap behaviour its menus share |
| | `src/controls.tsx`, `src/layout.tsx`, `src/PageTitle.tsx`, `src/Mark.tsx` | Buttons and other controls, `<Workspace>` / `<Reading>`, `<PageTitle>`, the mark |
| | `src/theme.ts`, `src/useTheme.ts`, `src/session.ts` | The theme names and `useTheme`; `useSession`, `useFamilyMembers` and `throwIfNotOk` |
| `…/auth` | `src/auth.ts` | Server-only. Sessions (verified with the hub's public key), the live check against the hub, roles and scope, device policy, the cross-site write guard (`originGuard`), the no-access page and `hubOrigin` |
| `…/agent` | `src/agent.ts` | Server-only. The shape of each app's agent tools and the checks every tool call goes through |
| `…/flags` | `src/flags.ts` | Server-only feature flags: `resolveFlags(env, context, names)` asks the Confidence resolver Worker (binding `CONFIDENCE`) and `flags.get("flag.property", fallback)` reads the answer; any failure gives the fallback, and `FLAG_OVERRIDES` (JSON) is the instant kill switch |
| `…/telemetry` | `src/telemetry.ts` | Server-only. Counts (never content) to the Analytics Engine dataset Mission Control reads |
| `…/install`, `…/install.css`, `…/pwa` | `src/install/` | Installing as an app: the install card, and a Vite plugin that writes `/sw.js` with the offline page built in |
| `…/landing` | `src/landing.ts` | Server-only. The page an app shows a signed-out visitor (below) |
| `…/return-bar` | `src/returnBar.ts` | `initReturnBar()`: a "← Back to …" bar when another family page opened this app with `?return_to=`, checked against the family's hosts |
| | `preview-site/` | The components in both themes plus a 390px frame: `npm run preview` |
| | `docs/` | The [style guide](docs/style-guide.md) and its visual copy |

Server-only entry points never import React, so Workers can use them; the
root entry is for client code.

## Components

```tsx
import { Header, Toolbar, Segmented, Button, IconButton, Pill, Footer, Workspace } from "@cornerways/design";
import { useTheme } from "@cornerways/design";

const { theme, setTheme } = useTheme();

<Header
  app="calendar"                               // null renders the hub variant
  account={{ name: "Dave", color: "#4c8bf5" }} // null: menu without identity; omit: no menu
  theme={{ value: theme, onChange: setTheme }}
  settingsHref="/settings" onSettings={() => navigate("/settings")}
  logout={{ formAction: "/logout" }}           // or { onSelect: () => … }
  householdHref={null}                         // optional: null hides Household (a guest)
  actions={<IconButton label="Meetups"><Users size={18} strokeWidth={1.7} /></IconButton>}
/>
<Toolbar end={<Button variant="primary" icon={<Plus size={18} strokeWidth={1.7} />}>Add entry</Button>}>
  <Segmented label="View" value={view} onChange={setView} options={[{ value: "month", label: "Month" }]} />
  <Pill active={all} onClick={…}>Everyone</Pill>
</Toolbar>
<Workspace as="main">…</Workspace>
```

- **Header.** Left: mark + wordmark (to the hub), `/`, the app name. The app name opens the switcher: every app from `APPS` with its icon chip in its accent, the current one ticked, "All apps overview" at the bottom. Right: the `actions` slot, a divider when there are actions, then the account menu with avatar and name, Theme (Light / Dark / Auto), Household, Settings and Log out. Below 640px the wordmark, slash and account name hide. `app={null}` gives the hub's header: mark, wordmark and a Household button.
- **Buttons.** `variant="primary"` is terracotta with white text: one per page. `secondary` (default) is bordered. `ghost` is quiet. All 40px tall, radius 10. `<IconButton>` is 40×40 and takes `active` for a toggle that is on.
- **Pill.** Fully rounded filter toggle, 40px, optional colour `dot`.
- **Segmented.** Grey track, white active segment; `size="sm"` for inside menus. Options can be `disabled` with a `title`.
- **Toolbar.** The 60px row under the header, same gutter; children start left, `end` pins right. `<ToolbarDivider />` between groups.
- **SegmentedMulti.** The same track with any number of segments on at once, for filters (people, statuses); options take an optional colour `dot`.
- **Footer.** "Cornerways — built for family and friends." / "Est. 2026", in the reading column by default; hidden below 640px.
- **PageTitle.** A sub-page's heading (`.cw-page-title`), with an optional back button: `<PageTitle title="Settings" onBack={…} />`.
- **Icons.** lucide-react at `ICON_STROKE` (1.7), 18px in controls. `APP_ICONS[key]` is the app's line icon.

## Hooks and helpers

For an app's client, against its own worker's routes:

- `useTheme()`: `{ theme, resolvedTheme, setTheme, cycleTheme }`, shared across every site through the `cw_theme` cookie and applied as `<html data-theme>`.
- `useSession()`: who's signed in, from `GET /api/session` (`{ memberId, role, scope }`).
- `useFamilyMembers()`: the household's members, from `GET /api/family-members`, retried twice.
- `throwIfNotOk(res, fallback)`: throws the server's own `{ error }` message, else the fallback.
- `hubUrl(location.hostname)`: the hub for this deployment (dev server, test or production).

## The signed-out home page

`@cornerways/design/landing` (server-only) draws the page an app shows a visitor who isn't signed in: the app's name and icon, a headline, a few features and a Sign in button, in the shell's own styles. The app decides when to show it (usually a signed-out page load of `/`, after any kiosk redirect) and builds the hub sign-in link:

```ts
import { renderLandingPage } from "@cornerways/design/landing";
import { Thermometer } from "lucide";

return c.html(renderLandingPage({
  app: "home",
  headline: "The house, from your phone",
  intro: "Heating, lights, watering and more.",
  features: [{ title: "Heating", text: "Every room's temperature.", icon: Thermometer }],
  signInUrl: `${hubOrigin(c.env, c.req.url)}/login?redirect=${encodeURIComponent(c.req.url)}`,
}));
```

Optional extras: `links` (quiet lines under the Sign in button, each `{ text?, label, href }`) and `footer: { note?, links? }` (e.g. a data credit and a Privacy link). Links must be same-site paths or https. Two helpers go with it: `isPageLoad(c.req.raw.headers)` (only a browser loading a page should get it) and `themeFromCookie(c.req.header("cookie"))` (the visitor's Light or Dark). The page is `noindex`; app sites aren't meant to be found by search engines. It inlines the shell's CSS through Vite's `?raw`, so the app's Worker must build with Vite (`@cloudflare/vite-plugin`), as every app's does.

`renderAppHomePage` is the fuller version, piloted on Calendar: a hero with a slot for something to try (`action` jumps to it), three `stories` (each a heading, a paragraph and a small picture), `worksWith` link cards to other apps (their URLs follow the environment), then the family's beta band (Create your household, Ask for a code, principles) and footer (Privacy, hello@cornerways.io). The app supplies its words, plus trusted HTML for the slot and pictures, `css` for them, and same-site module `scripts`; everything else is escaped. Content sits in a centred column (the header's gutter on narrower screens), and the one layout works from phone to desktop.

## Installing as an app

Every family site installs to a home screen or desktop. Two halves:

```ts
// vite.config.ts: the service worker (offline page built in) and standalone meta tags (client build only)
import { cornerwaysPwa } from "@cornerways/design/pwa";
plugins: [react(), cloudflare(), cornerwaysPwa({ appName: meta.name })]

// src/client/main.tsx: the install card
import { initInstallPrompt } from "@cornerways/design/install";
import "@cornerways/design/install.css";
initInstallPrompt({ appName: "Todo" });
```

- **The card.** Chromium (Android, desktop Chrome/Edge) shows an Install button that opens the browser's own prompt. iPhone and iPad show the Share → Add to Home Screen steps, or "Open in Safari" inside an in-app browser. Hidden when already installed, in an iframe, or on the kiosk (`?kiosk=1`, remembered for the tab). "Not now" holds for 30 days. Theme it with the `--cw-install-*` properties in `install.css`.
- **The service worker.** Page loads go to the network, falling back to a friendly offline page (inside `sw.js`, so there's nothing to fetch) only with no connection; sign-in redirects pass through. Hashed `/assets/*` are cached once seen; `/api/*` and other origins are never touched. Each build gets a new version and clears the old caches.
- **Public paths.** Add `/sw.js` to the site's `PUBLIC_PATHS`, so the browser can fetch it signed out.
- **The hub** has no bundler: its sync script copies `install.js` and renders `sw.js` with the same function.

## Layout modes

- **Workspace**: content is full width, padded by `--cw-gutter` (24px, 16px on phones) so it lines up with the header.
- **Reading**: a centred column of `--cw-reading-width` (880px). The header still spans the full width.

## Themes

Light is the default. Dark applies under `html[data-theme="dark"]`, which every app's theme script sets from the shared `cw_theme` cookie. `html.dark` also works, for Home, which still sets the class. `[data-cw-theme="light|dark"]` scopes a theme to one part of a page.
