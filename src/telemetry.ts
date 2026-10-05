/**
 * Usage telemetry for every Cornerways Worker, written to one Workers
 * Analytics Engine dataset (`cornerways_events`) that Mission Control
 * (admin.cornerways.io) reads through the WAE SQL API.
 *
 * Server-only: import from "@cornerways/design/telemetry", never from the
 * package root, so client bundles don't pull in Hono.
 *
 * Counts only, never content: a data point records which app, feature and
 * household did something, never what the list, recipe or trip said.
 *
 * WAE columns are positional, so the order below IS the schema. Append new
 * fields at the end; never reorder or reuse a slot, because queries over old
 * rows would read the wrong column.
 *
 *   blob1  app          "todo", "hub", ...
 *   blob2  env          "production" | "test" | "development"
 *   blob3  kind         "request" | "page" | "event" | "cron"
 *   blob4  feature      "items", "lists", "auth", ... (first path segment after /api/), or the event's prefix
 *   blob5  name         "PATCH /api/items/:id" for requests, "item.created" for events
 *   blob6  householdId  "" when signed out
 *   blob7  actorId      mem_… or dev_…, "" when signed out
 *   blob8  actorKind    "member" | "device" | "anon"
 *   blob9  statusClass  "2xx" | "3xx" | "4xx" | "5xx" ("" for events)
 *   double1 latencyMs
 *   double2 status      HTTP status (0 for events)
 *   index1 householdId, or "anon" (the sampling key)
 */
import type { Context, MiddlewareHandler } from "hono";
import { routePath } from "hono/route";

/** The slice of AnalyticsEngineDataset we use, so this file needs no workers-types. */
export interface EventsDataset {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export type Actor = { householdId: string; memberId: string };

export type TrackPoint = {
  kind: "request" | "page" | "event" | "cron";
  feature: string;
  name: string;
  actor?: Actor | null;
  status?: number;
  latencyMs?: number;
};

export type TelemetryOptions = {
  /** Short app key, matching APPS in apps.ts where there is one ("hub" for cornerways.io). */
  app: string;
  /** Reads the dataset from env; undefined (local dev without the binding, or an old config) disables tracking. */
  dataset: (c: Context<any>) => EventsDataset | undefined;
  /** Who made the request, read after the handler runs. */
  actor: (c: Context<any>) => Actor | null | undefined | Promise<Actor | null | undefined>;
  environment: (c: Context<any>) => string | undefined;
};

function actorKind(actor: Actor | null | undefined): "member" | "device" | "anon" {
  if (!actor) return "anon";
  return actor.memberId.startsWith("dev_") ? "device" : "member";
}

function statusClass(status: number | undefined): string {
  return status ? `${Math.floor(status / 100)}xx` : "";
}

/** Writes one data point. Never throws: telemetry must not break a request. */
export function track(dataset: EventsDataset | undefined, app: string, env: string | undefined, point: TrackPoint): void {
  if (!dataset) return;
  try {
    const actor = point.actor ?? null;
    dataset.writeDataPoint({
      blobs: [
        app,
        env ?? "development",
        point.kind,
        point.feature,
        point.name,
        actor?.householdId ?? "",
        actor?.memberId ?? "",
        actorKind(actor),
        statusClass(point.status),
      ],
      doubles: [point.latencyMs ?? 0, point.status ?? 0],
      indexes: [actor?.householdId || "anon"],
    });
  } catch (err) {
    console.warn("telemetry: writeDataPoint failed", err);
  }
}

/** "item.created" → feature "item". */
export function trackEvent(
  dataset: EventsDataset | undefined,
  app: string,
  env: string | undefined,
  name: string,
  actor?: Actor | null,
): void {
  track(dataset, app, env, { kind: "event", feature: name.split(".")[0] ?? name, name, actor });
}

function featureFor(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "api" ? (parts[1] ?? "api") : "page";
}

/**
 * Hono middleware: one data point per API request (kind "request") and per
 * HTML page load (kind "page"). Static assets, icons and manifests are
 * skipped. Mount it first so latency covers auth too.
 */
export function telemetry(options: TelemetryOptions): MiddlewareHandler<any> {
  return async (c, next) => {
    const started = Date.now();
    try {
      await next();
    } finally {
      const pathname = new URL(c.req.url).pathname;
      const isApi = pathname.startsWith("/api/");
      const isPage = !isApi && c.req.method === "GET" && (c.req.header("accept") ?? "").includes("text/html");
      if (isApi || isPage) {
        let actor: Actor | null | undefined = null;
        try {
          actor = await options.actor(c);
        } catch {
          actor = null;
        }
        // The pattern the responding route was registered under, so
        // /api/items/abc and /api/items/xyz count as one route.
        let pattern = pathname;
        try {
          const registered = routePath(c);
          if (registered && registered !== "*" && registered !== "/*") pattern = registered;
        } catch {
          // keep the raw path
        }
        track(options.dataset(c), options.app, options.environment(c), {
          kind: isApi ? "request" : "page",
          feature: featureFor(pathname),
          name: isApi ? `${c.req.method} ${pattern}` : "page",
          actor,
          status: c.res?.status ?? 0,
          latencyMs: Date.now() - started,
        });
      }
    }
  };
}
