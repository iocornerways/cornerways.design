# Cornerways Style Guide

**Current — Rev C, 2026-10-24**

How every Cornerways site looks and behaves. The rules are short because the shell is built once, in this package (`@cornerways/design`, v0.36.0), and imported by every app. The [README](../README.md) has the component API, and `npm run preview` shows the components in both themes.

> Visual copy: [Claude artifact AEbjBUxc](https://claude.ai/artifact/AEbjBUxcKrJu8ABMRbmraf) (source: `docs/style-guide.html`). Update both when the guide changes.

## 01 — Principles

- **One product.** Every app wears the same header, controls and footer from the shared shell. Don't copy shell code into an app; bump the package tag instead.
- **Neutral first.** Canvas and surfaces are warm neutrals. Colour is kept for meaning: one brand colour for actions, and each app's accent for its icon and data.
- **Big and simple on phones.** Controls are 40px tall with room between them. When a layout doesn't shrink well, build a separate phone layout (Calendar's month view) rather than squeeze the desktop one. Split long pages rather than densify them.
- **Change the look, not the behaviour.** Style work doesn't change what a page does. Note bugs you find; fix them separately.

## 02 — Layout

The header is always full-bleed: mark and wordmark on the left (linking to the hub), then `/` and the app name, which opens the app switcher. Page actions and the account menu are on the right. Pages line up with the header's gutter: **24px, or 16px below 640px**.

| Mode | Width | Apps |
|---|---|---|
| **Workspace** (`.cw-workspace`) | Full width, padded by the gutter | Calendar, Todo, Trips, Food, Notebook, Finance, Mission Control |
| **Reading** (`.cw-reading`) | Centred 880px column | Hub, Home, Weather, Trains |

Each app's mode is in the `APPS` registry (`src/apps.ts`). The header spans the full width in both modes.

| Element | Size |
|---|---|
| Header | 56px |
| Toolbar (the row under the header) | 60px |
| Controls and icon buttons | 40px (icon buttons 40×40) |
| Radius | 10 for controls, 12–16 for cards, fully round for pills |
| Breakpoint | 640px; below it the wordmark, account name and footer hide |

## 03 — Colour

| Use | Token | Rule |
|---|---|---|
| Canvas, surfaces, borders, text | `--cw-canvas`, `--cw-surface`, `--cw-border`, `--cw-ink`, `--cw-muted` | Warm neutrals, light and dark sets |
| Brand | `--cw-brand` (terracotta `#B4401E`) | Only for primary actions, "today" and the active tab. One primary button per page |
| App accents | `--cw-accent-<app>` | Only for that app's icon and its data (chart lines, calendar categories). Never for chrome |
| Member colours | From the hub | Owned by the hub and the same in every app; never computed locally |

| App | Accent |
|---|---|
| Home | `#3f6b4f` |
| Calendar | `#7a4e9e` |
| Todo | `#8a6a12` |
| Weather | `#1f6f8b` |
| Trips | `#b4401e` |
| Trains | `#2f5fc4` |
| Food | `#a33a2a` |
| Notebook | `#8c3f68` |
| Finance | `#2f6b3a` |
| Mission Control | `#4a5560` |

## 04 — Type and icons

- **Figtree** for the interface and **Source Serif 4** for display (page titles, the wordmark). Loaded from Google Fonts by a `<link>` in each page's `<head>` (the href is exported as `GOOGLE_FONTS_HREF`). Never use a CSS `@import url()`: Tailwind drops it.
- **Icons** are lucide at stroke 1.7 (`ICON_STROKE`), 18px in controls and 16–20px elsewhere. `APP_ICONS[key]` is each app's line icon.

## 05 — Components

All from `@cornerways/design`. Use these before writing your own.

| Component | Use |
|---|---|
| `<Header>` | Every page. App switcher, page-actions slot, account menu |
| `<Toolbar>` | The 60px row under the header: children on the left, `end` on the right |
| `<Button>` | `primary` (terracotta, one per page), `secondary` (bordered, the default), `ghost` (quiet) |
| `<IconButton>` | 40×40; `active` for a toggle that is on |
| `<Pill>` | A fully rounded filter toggle, with an optional colour dot |
| `<Segmented>` / `<SegmentedMulti>` | Pick one view / switch several filters on |
| `<Footer>` | "Cornerways — built for family and friends." Hidden below 640px |
| `<Sheet>` / `<Field>` | A modal `<dialog>`: a card on wide screens, a sheet along the bottom on a phone. `Field` is a labelled 16px control with a hint or an error |
| `<FirstRunCard>` / `<EmptyState>` / `<Example>` | A first visit's intro, an empty screen, and the "Example" picture they share (see 07) |
| `<PlacePicker>` | Search for a town or postcode, over the app's `/api/places` |
| `useSession` / `useFamilyMembers` / `useFirstRun` | Who's signed in, who's in the household, and what this person has already seen or set up |
| Return bar | `@cornerways/design/return-bar`: the way back to the hub page that sent someone here |
| Install card + service worker | `@cornerways/design/install` and `/pwa`: every site installs as an app |

## 06 — Theme

- **Light, Dark or Auto**, chosen only in the account menu and stored in the shared `cw_theme` cookie. No app has its own theme toggle or a stray Log out link.
- Dark applies under `html[data-theme="dark"]`, set before first paint.
- **Auto** follows the system on most apps. Weather, Trains and Home follow the time of day in London instead, since they are what the kitchen tablet shows.
- **The hub is light-only.**

## 07 — First run and empty states

Each app asks for what it needs the first time someone opens it, never in one big form up front. The pieces are `useFirstRun`, `<FirstRunCard>`, `<EmptyState>` and `<PlacePicker>`, with the server side in `@cornerways/design/first-run` (`registerFirstRunRoutes`, `registerPlaceRoutes`). The hub keeps each person's progress.

- **Ask on the screen that needs it.** Leave allowances are asked on Leave, not on first launch. One or two questions at a time, and every one can be skipped. The app stays usable without the answer.
- **Household facts are asked once.** The town and the stations belong to the household: the first owner or editor to answer sets them for everyone. If the household already has the answer, show it with Change; don't ask again.
- **Never another household's data.** With no setting there's nothing to show yet, so ask. Never fall back to the original household's town or stations.
- **One action.** An intro card has one primary button and "Not now", and "Not now" counts as seen. An empty state has one way to start.
- **Examples say so.** Pictures of the app in use are built from the signed-out home page's `.v-*` pieces, carry an "Example" badge and are never saved as data.
- **Not on shared screens.** Nothing shows on a paired tablet or under `?kiosk=1`, and a viewer isn't asked household questions.
- **Copy** is short, warm and plain, saying what the app does for this household: "Add everyone's birthdays and Calendar reminds you a few weeks ahead." Not "Welcome to Calendar!".
- **Homepage tiles** for an app that isn't set up show a setup panel (`renderPanel`'s `setup`): what it needs and the action, never sales copy that looks like status.

## 08 — Kiosk tablet

`?kiosk=1` turns on kiosk mode; it is a mode, not a breakpoint. In kiosk mode the shared header and footer are hidden, and boards use large type, no hover and no scrolling. Installed home-screen apps keep the header. What each tablet shows, and when, is set per tablet on the hub (see [Kiosk tablets](https://github.com/iocornerways/cornerways/blob/main/docs/architecture/kiosk-tablets.md) in the hub repo).

## 09 — Changing the shell

1. Change `cornerways.design`, check it in the preview site, then tag it (`git tag vX.Y.Z && git push --tags`).
2. In each app: `npm install "@cornerways/design@git+https://github.com/iocornerways/cornerways.design.git#vX.Y.Z"`, then clear `node_modules/.vite` before restarting the dev server. Editing the tag in `package.json` by hand isn't enough.
3. Deploy the hub first, then the apps.

---
cornerways / style-guide / rev C / 2026-10-24
