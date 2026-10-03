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
| `src/apps.ts` | The app list: names, hosts, dev ports, accents, layout mode |
| `src/layout.tsx` | `<Workspace>` and `<Reading>` components |
| `preview-site/` | Token specimen page, both themes: `npm run preview` (serves the repo root and opens `/preview-site/`) |

## Layout modes

- **Workspace**: content is full width, padded by `--cw-gutter` (24px, 16px on phones) so it lines up with the header.
- **Reading**: a centred column of `--cw-reading-width` (880px). The header still spans the full width.

## Themes

Light is the default. Dark applies under `html[data-theme="dark"]`, which every app's theme script already sets from the shared `cw_theme` cookie.
