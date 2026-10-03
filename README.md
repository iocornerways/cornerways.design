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

That loads the fonts and defines every `--cw-*` token. Nothing changes until
the app uses them.

```tsx
import { Workspace, Reading, APPS, appUrl } from "@cornerways/design";
```

## What's here

| File | Contents |
|---|---|
| `src/fonts.css` | Figtree (UI) and Source Serif 4 (display) from Google Fonts, with system-ui and Georgia fallbacks |
| `src/tokens.css` | Colours (light and dark), per-app accents, sizes, radii, shadows, z-index |
| `src/base.css` | `.cw-workspace` and `.cw-reading` layout wrappers |
| `src/apps.ts` | The app list: names, hosts, dev ports, accents, layout mode |
| `src/layout.tsx` | `<Workspace>` and `<Reading>` components |
| `preview-site/` | Token specimen page, both themes: `npm run preview` |

## Layout modes

- **Workspace**: content is full width, padded by `--cw-gutter` (24px, 16px on phones) so it lines up with the header.
- **Reading**: a centred column of `--cw-reading-width` (880px). The header still spans the full width.

## Themes

Light is the default. Dark applies under `html[data-theme="dark"]`, which every app's theme script already sets from the shared `cw_theme` cookie.
