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
import { ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, MapPin, Moon, Pencil, Plus, Sun, type IconNode } from "lucide";
import { APP_ICON_NODES, escapeHtml, STROKE, svg } from "./html.ts";
import { renderPanel, type Panel } from "./panel.ts";

export { renderPanel, sparkPoints, type Board, type Panel, type PanelRow, type RainStrip, type Spark, type WeatherIcon } from "./panel.ts";

/** The nine apps a household uses, in the homepage's order. */
export type TileKey = Exclude<AppKey, "admin" | "agent">;

export interface AppTile {
  key: TileKey;
  /** For a visitor: what it does for a family. */
  description: string;
  /** A fact a visitor should know first. */
  badge?: string;
  /** A tiny sample of the app, as HTML (aria-hidden by the renderer); or, for apps whose member tile has the same shape, a sample panel drawn exactly as the member's real one is. */
  preview: string | Panel;
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
    preview: {
      rows: [
        { label: "Maxine’s 60th", value: "today", today: true },
        { label: "Swim club", value: "Wednesday", dots: ["#C32C9B", "#513EE0"] },
        { label: "Parents’ evening", value: "Thursday", dots: ["#513EE0"] },
      ],
    },
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
    preview: {
      hero: { kind: "figure", value: "12°" },
      headline: { label: "Light rain", icon: "cloud-rain" },
      rows: [{ label: "Tomorrow", value: "Dry, 14°" }],
      strip: { hours: [["14", 70], ["15", 55], ["16", 30], ["17", 10], ["18", 5], ["19", 0]].map(([hour, chance]) => ({ hour: hour as string, chance: chance as number })) },
    },
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
    preview: {
      rows: [
        { label: "Chicken traybake", value: "Tonight", today: true },
        { label: "Lasagne", value: "Tomorrow" },
        { label: "Nothing planned", value: "Wednesday", muted: true },
      ],
    },
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
    // A line with no scale and no figures: the shape of things, nothing more. The same as a member's tile.
    preview: {
      hero: { kind: "spark", points: [0.1, 0.2, 0.15, 0.35, 0.3, 0.5, 0.45, 0.65, 0.6, 0.8, 0.78, 0.92, 1] },
      headline: { label: "Net worth", value: "↑ Rising" },
      rows: [
        { label: "Savings", value: "→ Steady" },
        { label: "Mortgage", value: "↓ Falling" },
      ],
    },
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
 * root, which a visitor sees as the app's signed-out page). As on a member's
 * tiles, the link is the app's name (a heading), stretched over the whole
 * tile, so its spoken name is exactly its visible words; the badge and
 * description describe it. `hostname` is the page's own, so links follow
 * dev, test and production.
 */
export function renderSignedOutTiles(hostname: string): string {
  const tiles = TILES.map((tile) => {
    const app = appOf(tile.key);
    const id = `tile-${tile.key}`;
    return `<li><div class="app-tile" style="--tile-accent: var(--cw-accent-${tile.key})">
      <span class="tile-head">${icon(app, 24)}${tile.badge ? `<span class="tile-badge" id="${id}-badge">${escapeHtml(tile.badge)}</span>` : ""}</span>
      <h3 class="tile-name"><a class="tile-link" href="${escapeHtml(appUrl(app, hostname))}/" aria-describedby="${tile.badge ? `${id}-badge ` : ""}${id}-text">${escapeHtml(app.name)}</a></h3>
      <span class="tile-text" id="${id}-text">${escapeHtml(tile.description)}</span>
      <span class="tile-preview" aria-hidden="true"${typeof tile.preview === "string" ? "" : " data-panel-sample"}>${typeof tile.preview === "string" ? tile.preview : renderPanel(tile.preview)}</span>
      <span class="tile-go" aria-hidden="true">See how it works <span class="tile-arrow">→</span></span>
    </div></li>`;
  });
  return `<ul class="app-tiles">\n    ${tiles.join("\n    ")}\n  </ul>\n  ${weatherSprite()}`;
}

/**
 * Weather's condition icons (the Weather app's own names), once per page as
 * symbols: the page shows one with <use href="#cw-wx-cloud-rain">, so a
 * glance only ever carries the icon's name, never markup. "locate" is the
 * pin on Trains' "Use location" button.
 */
const WEATHER_ICONS: Record<string, IconNode> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
  locate: MapPin,
};

function weatherSprite(): string {
  const symbols = Object.entries(WEATHER_ICONS).map(([name, node]) => {
    const shapes = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeHtml(String(v))}"`).join(" ")}/>`).join("");
    return `<symbol id="cw-wx-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${shapes}</symbol>`;
  });
  return `<svg class="cw-icon-sprite" width="0" height="0" aria-hidden="true" focusable="false">${symbols.join("")}</svg>`;
}

/** Placeholder bars while a panel's glance is on its way: sized to a real panel, hidden from assistive tech. */
const SKELETON = `<span class="panel-skeleton" aria-hidden="true"><span></span><span></span><span></span></span>`;

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
 * Each tile is one stretched link on the app's name (its glance line is its
 * description), with the quick action a separate link beside it, never
 * inside it. A tile with no quick action has a status pill there instead
 * (data-glance-pill: text, never a control), filled in with the glance.
 *
 * A large tile's panel starts as the app's description; the page fills in
 * the glance line (data-glance) and builds the panel body (data-panel-body:
 * a headline, up to three rows, at most one hero) from it. When nothing
 * arrives the description simply stays. Never sample data: a member would
 * take it for theirs. The chevron is a quiet "this opens", for sight only:
 * the link's name is the app's.
 *
 * While the glances load, each large panel shows placeholder bars (sized to
 * the panel, so nothing shifts); if the page's script never says it's done,
 * the styles give way to the description on their own after a few seconds.
 *
 * With nothing left in More, the pinned tiles are simply "Your apps".
 */
export function renderMemberTiles(options: MemberTilesOptions): string {
  const large = (key: TileKey) => {
    const tile = tileOf(key);
    const app = appOf(key);
    const base = appUrl(app, options.hostname);
    const corner = tile.quickAction
      ? `<a class="tile-action" href="${escapeHtml(base + tile.quickAction.path)}" aria-label="${escapeHtml(tile.quickAction.ariaLabel)}">${svg(Plus, 16)}${escapeHtml(tile.quickAction.label)}</a>`
      : `<span class="tile-status" data-glance-pill="${key}" hidden></span>`;
    return `<li class="member-tile member-tile--large" style="--tile-accent: var(--cw-accent-${key})">
        <span class="tile-head">${icon(app, 24)}${corner}</span>
        <h3 class="tile-name"><a class="tile-link" href="${escapeHtml(base)}/" aria-describedby="glance-${key}">${escapeHtml(app.name)}</a></h3>
        <div class="tile-panel" data-panel="${key}" data-loading>
          ${SKELETON}
          <p class="tile-glance" id="glance-${key}" data-glance="${key}" data-state="fallback">${escapeHtml(tile.description)}</p>
          <div class="tile-panel-body" data-panel-body="${key}" hidden></div>
        </div>
        <span class="tile-chevron" aria-hidden="true">${svg(ChevronRight, 20)}</span>
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
  // "Edit tiles" needs the page's script (tile-editor.js), which shows it.
  const pinned = `<section class="member-section" aria-labelledby="pinned-title">
    <div class="member-section-head"><h2 id="pinned-title">${options.more.length ? "Pinned" : "Your apps"}</h2><button type="button" class="cw-button tile-edit-button" data-edit-tiles hidden>${svg(Pencil, 18)}Edit tiles</button></div>
    ${
      options.pinned.length
        ? `<ul class="member-tiles member-tiles--large">
      ${options.pinned.map(large).join("\n      ")}
    </ul>`
        : `<p class="member-empty">Nothing pinned yet. Pin the apps you use most and they’ll show here first.</p>`
    }
  </section>`;
  const more = options.more.length
    ? `<section class="member-section" aria-labelledby="more-title">
    <h2 id="more-title">More</h2>
    <ul class="member-tiles member-tiles--compact">
      ${options.more.map(compact).join("\n      ")}
    </ul>
  </section>`
    : "";
  return `<div class="member-tiles-area" data-tiles-area>
  ${[pinned, more].filter(Boolean).join("\n  ")}
  ${weatherSprite()}
  </div>`;
}

/**
 * The editor "Edit tiles" opens in place of the tiles: the pinned apps in
 * order, then the rest. Rows only; tile-editor.js (on the page) adds each
 * row's buttons (Move earlier, Move later, Unpin / Pin), dragging, and saving.
 */
export function renderTileEditor(options: { pinned: readonly TileKey[]; more: readonly TileKey[] }): string {
  const row = (key: TileKey) => {
    const app = appOf(key);
    return `<li class="editor-row" data-app="${key}" data-order="${TILES.findIndex((tile) => tile.key === key)}" style="--tile-accent: var(--cw-accent-${key})">${icon(app, 20)}<span class="editor-name">${escapeHtml(app.name)}</span><span class="editor-buttons"></span></li>`;
  };
  return `<section class="tile-editor" data-tile-editor hidden aria-labelledby="tile-editor-title">
    <h2 id="tile-editor-title" tabindex="-1">Edit tiles</h2>
    <p class="tile-editor-intro">Pin the apps you use most: they show first, with their quick action. Move them into the order you like, with the buttons or by dragging.</p>
    <h3 id="editor-pinned-title">Pinned</h3>
    <ol class="editor-list" data-list="pinned" aria-labelledby="editor-pinned-title">${options.pinned.map(row).join("")}</ol>
    <p class="editor-empty" data-empty-pinned${options.pinned.length ? " hidden" : ""}>Nothing pinned.</p>
    <h3 id="editor-more-title">Other apps</h3>
    <ul class="editor-list" data-list="more" aria-labelledby="editor-more-title">${options.more.map(row).join("")}</ul>
    <p class="editor-status" data-editor-status aria-live="polite"></p>
    <div class="editor-actions"><button type="button" class="cw-button cw-button--primary" data-editor-done>Done</button><button type="button" class="cw-button" data-editor-cancel>Cancel</button></div>
  </section>`;
}
