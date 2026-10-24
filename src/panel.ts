/**
 * A tile's panel: one shape for the household's own data (the hub's
 * glances, drawn in the browser by the hub's public/home-glance.js) and for
 * the visitor tiles' samples (drawn here, on the server). Both produce the
 * same markup, so a sample looks exactly like the real thing; the styles are
 * in home.css.
 *
 * Every panel is the same pieces: an optional headline, up to three rows (a
 * label, and a value on the right), and at most one hero. An app that
 * isn't set up yet shows a setup panel instead: what it needs, and the
 * action the tile's link leads to.
 */
import { escapeHtml } from "./html.ts";

export interface Panel {
  headline?: PanelRow;
  rows: PanelRow[];
  /** Tick boxes before the rows (Todo). */
  checks?: boolean;
  /** Small accent squares before the rows (Notebook's titles). */
  bullets?: boolean;
  /** The tile's one big element: Weather's temperature, Trains' departure board, or Finance's net worth line. */
  hero?: { kind: "figure"; value: string } | Board | Spark;
  /** Weather's next six hours of rain chance, as small bars. */
  strip?: RainStrip;
  /**
   * The app needs setting up before it has anything to show ("Tell us your
   * town to see your weather"), with the action as a chip ("Set your town").
   * The tile's own link opens the app, where its first run asks; the chip
   * isn't a second link. Shown instead of everything else.
   */
  setup?: { text: string; action: string };
  /** One bar split in proportion (Trips: been against want to go), keyed to the rows by their swatch. Decorative: the rows say the numbers. */
  bar?: Array<{ swatch: 1 | 2; value: number }>;
}

export interface PanelRow {
  /** User-given names (lists, trips, notes, entries) exactly as typed. */
  label: string;
  value?: string;
  /** Something happening today: the value shows as a chip. */
  today?: boolean;
  /** Placeholder-ish ("Untitled trip", "Nothing planned"): shown quieter. */
  muted?: boolean;
  /** Needs attention ("overdue"). */
  alert?: boolean;
  /** Who it's for, as their colours (Calendar): decorative, never the only way something is said. */
  dots?: string[];
  /** A condition icon before the label (Weather's headline). */
  icon?: WeatherIcon;
  /** A colour key to the panel's bar: 1 the app's colour, 2 a lighter shade. */
  swatch?: 1 | 2;
}

/** Trains' departure board: which way, when the times are from, and the next two trains. */
export interface Board {
  kind: "board";
  from: string;
  /** When Trains fetched the times (ISO), so the page can say "Updated 21:38" once they're old. */
  asOf?: string;
  /** One sentence for screen readers: "Next train: 21:40 to London Waterloo, platform 1, on time." */
  summary: string;
  trains: Array<{ time: string; destination: string; platform: string; status: string; state: "on-time" | "delayed" | "cancelled" | "unknown" }>;
}

/** A line with no scale (Finance's net worth over a year): points from 0 (lowest) to 1 (highest), oldest first. Decorative: the headline says which way in words. */
export interface Spark {
  kind: "spark";
  points: number[];
}

/** The line's SVG points in a 100 × 40 box, or null for anything that isn't 2–24 numbers from 0 to 1. */
export function sparkPoints(points: unknown): string | null {
  if (!Array.isArray(points) || points.length < 2 || points.length > 24) return null;
  if (!points.every((point) => typeof point === "number" && Number.isFinite(point) && point >= 0 && point <= 1)) return null;
  const step = 100 / (points.length - 1);
  return (points as number[]).map((point, i) => `${Math.round(i * step * 10) / 10},${Math.round((36 - point * 32) * 10) / 10}`).join(" ");
}

/** Chance of rain for the next few hours ("22" and 0–100). */
export interface RainStrip {
  hours: Array<{ hour: string; chance: number }>;
}

/** Weather's icons (the Weather app's own names), drawn from the sprite tiles.ts puts on the page. */
export type WeatherIcon = "sun" | "moon" | "cloud-sun" | "cloud-moon" | "cloud" | "cloud-fog" | "cloud-drizzle" | "cloud-rain" | "cloud-snow" | "cloud-lightning";

const HEX = /^#[0-9a-f]{6}$/i;

function labelled(tag: "p" | "li", className: string, part: PanelRow, before = ""): string {
  const flags = (["today", "muted", "alert"] as const).filter((flag) => part[flag]).map((flag) => ` data-${flag}`).join("");
  const icon = part.icon ? `<svg class="panel-icon" aria-hidden="true" focusable="false"><use href="#cw-wx-${escapeHtml(part.icon)}"></use></svg>` : "";
  const swatch = part.swatch ? `<span class="panel-swatch" data-swatch="${part.swatch}" aria-hidden="true"></span>` : "";
  const dots = part.dots?.filter((dot) => HEX.test(dot)).slice(0, 3) ?? [];
  const dotsHtml = dots.length ? `<span class="panel-dots" aria-hidden="true">${dots.map((dot) => `<span style="background: ${dot}"></span>`).join("")}</span>` : "";
  const value = part.value ? `<span class="${part.today ? "panel-value panel-chip" : "panel-value"}">${escapeHtml(part.value)}</span>` : "";
  return `<${tag}${className ? ` class="${className}"` : ""}${flags}>${before}${icon}${swatch}${dotsHtml}<span class="panel-label">${escapeHtml(part.label)}</span>${value}</${tag}>`;
}

/**
 * A panel's markup, the same as the hub's page script draws (drawPanel in
 * public/home-glance.js). Every string is escaped. Trains' board isn't drawn
 * here: the visitor tile keeps its own sample.
 */
export function renderPanel(panel: Panel): string {
  if (panel.setup) {
    return `<div class="tile-panel-body" data-setup><div class="panel-main"><p class="panel-setup">${escapeHtml(panel.setup.text)}</p><span class="panel-setup-action">${escapeHtml(panel.setup.action)}</span></div></div>`;
  }
  const hero = panel.hero?.kind === "figure" ? panel.hero : null;
  const line = panel.hero?.kind === "spark" ? sparkPoints(panel.hero.points) : null;
  const spark = line
    ? `<div class="panel-spark" aria-hidden="true"><svg viewBox="0 0 100 40" preserveAspectRatio="none" focusable="false"><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline></svg></div>`
    : "";
  const headline = panel.headline ? labelled("p", "panel-headline", panel.headline) : "";
  const listFlag = panel.checks ? " data-checks" : panel.bullets ? " data-bullets" : "";
  const rows = panel.rows.length
    ? `<ul class="panel-rows"${listFlag}>${panel.rows
        .slice(0, 3)
        .map((row) => labelled("li", "", row, panel.checks ? `<span class="tile-box"></span>` : ""))
        .join("")}</ul>`
    : "";
  const bar = panel.bar?.length
    ? `<div class="panel-bar" aria-hidden="true">${panel.bar.map((segment) => `<span data-swatch="${segment.swatch}" style="flex-grow: ${Number(segment.value)}"></span>`).join("")}</div>`
    : "";
  const main = `<div class="panel-main">${headline}${rows}${bar}</div>`;
  const strip = panel.strip
    ? `<div class="panel-strip-wrap"><p class="cw-visually-hidden">Chance of rain: ${escapeHtml(panel.strip.hours.map((hour) => `${hour.hour}:00 ${hour.chance}%`).join(", "))}.</p><div class="panel-strip" aria-hidden="true">${panel.strip.hours
        .map((hour) => `<span><span class="strip-bar"><span style="--chance: ${Number(hour.chance)}%"></span></span><span class="strip-hour">${escapeHtml(hour.hour)}</span></span>`)
        .join("")}</div></div>`
    : "";
  return `<div class="tile-panel-body"${hero ? " data-hero" : ""}>${hero ? `<div class="panel-hero">${escapeHtml(hero.value)}</div>` : ""}${spark}${main}${strip}</div>`;
}
