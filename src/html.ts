/**
 * Small HTML helpers for the pages drawn as strings in a Worker (landing.ts,
 * tiles.ts): escaping, and each app's line icon as SVG markup.
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
import type { AppKey } from "./apps.ts";

export type { IconNode } from "lucide";

/** Each app's line icon, as icons.tsx has it for React (keep the two in step). */
export const APP_ICON_NODES: Record<AppKey, IconNode> = {
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
export const STROKE = 1.7;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function svg(node: IconNode, size: number): string {
  const shapes = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeHtml(String(v))}"`).join(" ")}/>`)
    .join("");
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes}</svg>`;
}
