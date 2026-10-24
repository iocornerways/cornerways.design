/**
 * Each app's first run, server side: the routes an app adds so its page can
 * ask what this person has already seen or set up, record what they do, and
 * (for apps that need a town) search for places and set where the
 * household is. Everything is kept by the hub (HouseholdService), reached
 * over the app's existing HOUSEHOLD service binding; nothing is stored here.
 *
 * Mount after the app's auth gate, which sets c.get("session"). The gate's
 * roleGate call should pass `personalWrite: true` for FIRST_RUN_PATH, so a
 * viewer can still dismiss an intro: it only ever changes their own row.
 * A paired tablet gets no first run at all (steps: null).
 */
import type { Context, Hono } from "hono";
import { isDevice, type SessionPayload } from "./auth.ts";

export type FirstRunState = "done" | "skipped" | "seen";
export type FirstRunSteps = Record<string, FirstRunState>;
export type PlaceLocation = { name: string; lat: number; lon: number; timezone: string };

/** The slice of the hub's HouseholdService these routes use; an app's own HouseholdServiceRpc type extends it. */
export interface FirstRunRpc {
  firstRun(memberId: string, householdId: string, app: string): Promise<FirstRunSteps | null>;
  markFirstRun(memberId: string, householdId: string, app: string, step: string, state: FirstRunState): Promise<FirstRunSteps | null>;
}

export interface PlacesRpc {
  searchPlaces(query: string): Promise<PlaceLocation[]>;
  setLocation(
    memberId: string,
    householdId: string,
    location: PlaceLocation,
  ): Promise<{ ok: true; location: PlaceLocation } | { ok: false; error: string; code: "forbidden" | "invalid" }>;
}

/** GET for this person's steps, POST { step, state } to record one. */
export const FIRST_RUN_PATH = "/api/first-run";
/** GET ?q= to search for a town or postcode. */
export const PLACES_PATH = "/api/places";
/** PUT a place from the search to make it where the household is. */
export const HOUSEHOLD_LOCATION_PATH = "/api/household/location";

/** What GET /api/first-run answers: steps is null on a paired tablet, where nothing is ever shown. */
export interface FirstRunAnswer {
  steps: FirstRunSteps | null;
  /** Whether this person may answer household questions (its town, say); the hub has the final say. */
  canSetHousehold: boolean;
}

type AnyHono = Hono<any>;

function sessionOf(c: Context<any>): SessionPayload | undefined {
  return c.get("session") as SessionPayload | undefined;
}

function hub<T>(c: Context<any>): T {
  return (c.env as { HOUSEHOLD: T }).HOUSEHOLD;
}

export function registerFirstRunRoutes(app: AnyHono, options: { app: string }): void {
  app.get(FIRST_RUN_PATH, async (c) => {
    const session = sessionOf(c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const noStore = { "Cache-Control": "private, no-store" };
    if (isDevice(session)) return c.json({ steps: null, canSetHousehold: false } satisfies FirstRunAnswer, 200, noStore);
    const steps = await hub<FirstRunRpc>(c).firstRun(session.memberId, session.householdId, options.app);
    const answer: FirstRunAnswer = { steps, canSetHousehold: session.role === "owner" || session.role === "editor" };
    return c.json(answer, 200, noStore);
  });

  app.post(FIRST_RUN_PATH, async (c) => {
    const session = sessionOf(c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    if (isDevice(session)) return c.json({ error: "Not for shared screens" }, 403);
    const body = (await c.req.json().catch(() => null)) as { step?: unknown; state?: unknown } | null;
    const step = typeof body?.step === "string" ? body.step : "";
    const state = body?.state;
    if (state !== "done" && state !== "skipped" && state !== "seen") return c.json({ error: "state must be done, skipped or seen" }, 400);
    const steps = await hub<FirstRunRpc>(c).markFirstRun(session.memberId, session.householdId, options.app, step, state);
    if (!steps) return c.json({ error: "That step couldn't be recorded" }, 400);
    return c.json({ steps });
  });
}

/** For apps whose first run asks where the household is (Weather, Trips): a place search, and setting it. */
export function registerPlaceRoutes(app: AnyHono): void {
  app.get(PLACES_PATH, async (c) => {
    if (!sessionOf(c)) return c.json({ error: "Unauthorized" }, 401);
    const query = (c.req.query("q") ?? "").trim();
    if (query.length < 2) return c.json({ places: [] });
    try {
      return c.json({ places: await hub<PlacesRpc>(c).searchPlaces(query.slice(0, 80)) });
    } catch (error) {
      console.error("place search failed", error);
      return c.json({ error: "Couldn't search for places just now. Try again in a moment." }, 502);
    }
  });

  app.put(HOUSEHOLD_LOCATION_PATH, async (c) => {
    const session = sessionOf(c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const location = (await c.req.json().catch(() => null)) as PlaceLocation | null;
    if (!location) return c.json({ error: "Pick a place from the list" }, 400);
    const result = await hub<PlacesRpc>(c).setLocation(session.memberId, session.householdId, location);
    if (!result.ok) return c.json({ error: result.error }, result.code === "forbidden" ? 403 : 400);
    return c.json({ location: result.location });
  });
}
