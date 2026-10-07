# cornerways.design

The shared shell for every Cornerways site: design tokens, fonts, the two
layout modes, and (from Step 2) the header and controls. Implemented once here
and imported by each app, so nothing is copied.

## Using it in an app

```sh
npm install ../cornerways.design      # file: dependency while this repo is local
```

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

| File | Contents |
|---|---|
| `src/fonts.css`, `src/fonts.ts` | Font-family tokens for Figtree (UI) and Source Serif 4 (display) with system-ui and Georgia fallbacks, and the Google Fonts href |
| `src/tokens.css` | Colours (light and dark), per-app accents, sizes, radii, shadows, z-index |
| `src/base.css` | `.cw-workspace` and `.cw-reading` layout wrappers |
| `src/components.css` | Styles for the header, menus, buttons, pills, segmented control, toolbar and footer (`.cw-*`) |
| `src/apps.ts`, `src/icons.tsx` | The app list: names, hosts, dev ports, accents, layout mode, and one line icon per app |
| `src/layout.tsx` | `<Workspace>` and `<Reading>` components |
| `src/Header.tsx` | `<Header>`: breadcrumb app switcher, page-actions slot, account menu |
| `src/controls.tsx` | `<Button>`, `<IconButton>`, `<Pill>`, `<Segmented>`, `<Toolbar>`, `<Footer>` |
| `src/install/` | Install support: `install.js` + `install.css` (the "Install app" card, framework-free), `pwa.js` (Vite plugin emitting `/sw.js`, with the offline page built in), `sw-core.js` and `offline.html` (its templates) |
| `preview-site/` | Every component in both themes plus a 390px frame: `npm run preview` |

## Components

```tsx
import { Header, Toolbar, Segmented, Button, IconButton, Pill, Footer, Workspace } from "@cornerways/design";
import { useTheme } from "./hooks/useTheme.ts";

const { theme, setTheme } = useTheme();

<Header
  app="calendar"                               // null renders the hub variant
  account={{ name: "Dave", color: "#4c8bf5" }} // null: menu without identity; omit: no menu
  theme={{ value: theme, onChange: setTheme }}
  settingsHref="/settings" onSettings={() => navigate("/settings")}
  logout={{ formAction: "/logout" }}           // or { onSelect: () => … }
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
- **Icons.** lucide-react at `ICON_STROKE` (1.7), 18px in controls. `APP_ICONS[key]` is the app's line icon.

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

## Consuming the TSX from an app

The package ships source, not a build. While it is a `file:` link, the app's Vite needs `resolve.dedupe: ["react", "react-dom", "lucide-react"]` so the linked source resolves React from the app, not from this repo's `node_modules`. A git dependency has no such need.

## Layout modes

- **Workspace**: content is full width, padded by `--cw-gutter` (24px, 16px on phones) so it lines up with the header.
- **Reading**: a centred column of `--cw-reading-width` (880px). The header still spans the full width.

## Themes

Light is the default. Dark applies under `html[data-theme="dark"]`, which every app's theme script already sets from the shared `cw_theme` cookie.
