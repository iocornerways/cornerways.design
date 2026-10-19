/**
 * Each household app as a tile: what a visitor reads about it, a small
 * sample picture of it, and (for members) its quick action. One source for
 * the hub's homepage now, and for an app switcher in the shell later.
 *
 * Server-only (plain strings, no React): import from
 * "@cornerways/design/tiles" in a Worker. Styles are in home.css.
 *
 * The pictures are decorative sample data, hidden from assistive tech, with
 * invented names and values. Finance's never shows a figure.
 */
import { APPS, appUrl, type AppDefinition, type AppKey } from "./apps.ts";
import { ChevronRight, Plus } from "lucide";
import { APP_ICON_NODES, escapeHtml, svg } from "./html.ts";

/** The nine apps a household uses, in the homepage's order. */
export type TileKey = Exclude<AppKey, "admin" | "agent">;

export interface AppTile {
  key: TileKey;
  /** For a visitor: what it does for a family. */
  description: string;
  /** A fact a visitor should know first. */
  badge?: string;
  /** A tiny sample of the app, as HTML (aria-hidden by the renderer). */
  preview: string;
  /** For members: a shortcut into the app's add screen, on its own site. */
  quickAction?: { label: string; ariaLabel: string; path: string };
}

const row = (left: string, right: string) => `<span class="tile-row"><span>${left}</span><strong>${right}</strong></span>`;
const box = (done: boolean) => `<span class="tile-box"${done ? " data-done" : ""}></span>`;

export const TILES: readonly AppTile[] = [
  {
    key: "home",
    description: "Heating, lights and everything smart under our roof.",
    badge: "Our own house only",
    preview: `<span class="tile-rows">${row("Living room", "19.5°")}${row("Lights", "3 on")}${row("Hot water", "On · schedule")}</span>`,
  },
  {
    key: "calendar",
    description: "Birthdays, plans and days off, shared by everyone at home.",
    preview: `<span class="tile-week">${[
      ["M", "19", []],
      ["T", "20", ["calendar"]],
      ["W", "21", []],
      ["T", "22", ["weather"]],
      ["F", "23", []],
      ["S", "24", ["trips", "calendar"]],
      ["S", "25", []],
    ]
      .map(
        ([d, n, dots]) =>
          `<span><span class="tile-week-d">${d}</span><strong>${n}</strong><span class="tile-week-dots">${(dots as string[])
            .map((a) => `<span style="background: var(--cw-accent-${a})"></span>`)
            .join("")}</span></span>`,
      )
      .join("")}</span>`,
    quickAction: { label: "Entry", ariaLabel: "Add a calendar entry", path: "/?new=1" },
  },
  {
    key: "todo",
    description: "Shared lists and chores that everyone can tick off.",
    preview: `<span class="tile-rows">${[
      [true, "Milk"],
      [false, "Bin bags"],
      [false, "Birthday card"],
    ]
      .map(([done, text]) => `<span class="tile-check"${done ? " data-done" : ""}>${box(done as boolean)}<span>${text}</span></span>`)
      .join("")}</span>`,
    quickAction: { label: "Item", ariaLabel: "Add a todo item", path: "/?add=1" },
  },
  {
    key: "weather",
    description: "What it’s like now and the days ahead, for where you live.",
    preview: `<span class="tile-weather"><strong>12°</strong><span><strong>Rain in 75 min</strong><span>Dry tomorrow</span></span></span>`,
  },
  {
    key: "trips",
    description: "From half-formed idea to plan, without four group chats.",
    preview: `<span class="tile-rows">${["Lisbon", "Seville", "Lake District"]
      .map((place, i) => `<span class="tile-rank"><strong>${i + 1}</strong><span>${place}</span></span>`)
      .join("")}</span>`,
  },
  {
    key: "trains",
    description: "Live departures for the two stations you actually use.",
    badge: "UK rail",
    preview: `<span class="tile-board">${["18:04", "18:19"]
      .map((time) => `<span><strong>${time}</strong><span>London Waterloo</span><span class="tile-plat">Plat 3</span></span>`)
      .join("")}</span>`,
  },
  {
    key: "food",
    description: "Meals, recipes and what’s in the fridge, all in one place.",
    preview: `<span class="tile-meal"><span class="tile-pill">Tonight</span><strong>Chicken traybake</strong><span>Tomorrow: lasagne</span></span>`,
    quickAction: { label: "Meal", ariaLabel: "Plan a meal", path: "/?add=1" },
  },
  {
    key: "notes",
    description: "The Wi-Fi password, gift ideas and how-tos, kept together.",
    preview: `<span class="tile-rows">${["Wi-Fi password", "Gift ideas", "Bathroom mood board"]
      .map((title) => `<span class="tile-note-row"><span class="tile-square"></span><span>${title}</span></span>`)
      .join("")}</span>`,
  },
  {
    key: "finance",
    description: "Every account in one place, and where the money goes.",
    // A line with no scale and no figures: the shape of things, nothing more.
    preview: `<span class="tile-spark"><svg viewBox="0 0 200 44" preserveAspectRatio="none"><polyline points="0,36 20,32 40,34 60,26 80,28 100,20 120,22 140,14 160,16 180,8 200,6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><span>Net worth over time</span></span>`,
  },
];

function appOf(key: TileKey): AppDefinition {
  const app = APPS.find((entry) => entry.key === key);
  if (!app) throw new Error(`Unknown Cornerways app: ${key}`);
  return app;
}

function icon(app: AppDefinition, size: number): string {
  return `<span class="cw-app-chip tile-icon" aria-hidden="true">${svg(APP_ICON_NODES[app.key], size)}</span>`;
}

/**
 * The visitor's tiles: each one link to that app's own home page (its site's
 * root, which a visitor sees as the app's signed-out page). Its accessible
 * name is the app's name; its badge and description describe it.
 * `hostname` is the page's own, so links follow dev, test and production.
 */
export function renderSignedOutTiles(hostname: string): string {
  const tiles = TILES.map((tile) => {
    const app = appOf(tile.key);
    const id = `tile-${tile.key}`;
    return `<li><a class="app-tile" href="${escapeHtml(appUrl(app, hostname))}/" style="--tile-accent: var(--cw-accent-${tile.key})" aria-labelledby="${id}-name" aria-describedby="${tile.badge ? `${id}-badge ` : ""}${id}-text">
      <span class="tile-head">${icon(app, 24)}${tile.badge ? `<span class="tile-badge" id="${id}-badge">${escapeHtml(tile.badge)}</span>` : ""}</span>
      <span class="tile-name" id="${id}-name">${escapeHtml(app.name)}</span>
      <span class="tile-text" id="${id}-text">${escapeHtml(tile.description)}</span>
      <span class="tile-preview" aria-hidden="true">${tile.preview}</span>
      <span class="tile-go" aria-hidden="true">See how it works <span class="tile-arrow">→</span></span>
    </a></li>`;
  });
  return `<ul class="app-tiles">\n    ${tiles.join("\n    ")}\n  </ul>`;
}

/** The tiles a member sees: pinned (large, with any quick action) then the rest. */
export interface MemberTilesOptions {
  hostname: string;
  pinned: readonly TileKey[];
  more: readonly TileKey[];
}

function tileOf(key: TileKey): AppTile {
  const tile = TILES.find((entry) => entry.key === key);
  if (!tile) throw new Error(`No tile for ${key}`);
  return tile;
}

/**
 * Each tile is one stretched link on the app's name (its glance lines are
 * its description), with the quick action a separate link beside it, never
 * inside it. The glance lines start as the app's description and are filled
 * in later (data-glance / data-glance-sub); when nothing arrives the
 * description simply stays.
 */
export function renderMemberTiles(options: MemberTilesOptions): string {
  const large = (key: TileKey) => {
    const tile = tileOf(key);
    const app = appOf(key);
    const base = appUrl(app, options.hostname);
    const action = tile.quickAction
      ? `<a class="tile-action" href="${escapeHtml(base + tile.quickAction.path)}" aria-label="${escapeHtml(tile.quickAction.ariaLabel)}">${svg(Plus, 16)}${escapeHtml(tile.quickAction.label)}</a>`
      : "";
    return `<li class="member-tile member-tile--large" style="--tile-accent: var(--cw-accent-${key})">
        <span class="tile-head">${icon(app, 24)}${action}</span>
        <h3 class="tile-name"><a class="tile-link" href="${escapeHtml(base)}/" aria-describedby="glance-${key} glance-${key}-sub">${escapeHtml(app.name)}</a></h3>
        <p class="tile-glance" id="glance-${key}" data-glance="${key}" data-state="fallback">${escapeHtml(tile.description)}</p>
        <p class="tile-glance-sub" id="glance-${key}-sub" data-glance-sub="${key}"></p>
        <span class="tile-go" aria-hidden="true">Open <span class="tile-arrow">→</span></span>
      </li>`;
  };
  const compact = (key: TileKey) => {
    const tile = tileOf(key);
    const app = appOf(key);
    return `<li class="member-tile member-tile--compact" style="--tile-accent: var(--cw-accent-${key})">
        ${icon(app, 22)}
        <span class="tile-body"><span class="tile-name"><a class="tile-link" href="${escapeHtml(appUrl(app, options.hostname))}/" aria-describedby="glance-${key}">${escapeHtml(app.name)}</a></span>
        <span class="tile-glance" id="glance-${key}" data-glance="${key}" data-state="fallback">${escapeHtml(tile.description)}</span></span>
        <span class="tile-chevron" aria-hidden="true">${svg(ChevronRight, 20)}</span>
      </li>`;
  };
  const pinned = options.pinned.length
    ? `<section class="member-section" aria-labelledby="pinned-title">
    <div class="member-section-head"><h2 id="pinned-title">Pinned</h2></div>
    <ul class="member-tiles member-tiles--large">
      ${options.pinned.map(large).join("\n      ")}
    </ul>
  </section>`
    : "";
  const more = options.more.length
    ? `<section class="member-section" aria-labelledby="more-title">
    <h2 id="more-title">More</h2>
    <ul class="member-tiles member-tiles--compact">
      ${options.more.map(compact).join("\n      ")}
    </ul>
  </section>`
    : "";
  return [pinned, more].filter(Boolean).join("\n  ");
}
