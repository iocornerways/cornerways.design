/**
 * The one implementation of Cornerways sign-in for every Worker: the
 * domain-wide session cookie, the live check of who that session belongs to,
 * the household role rules, and where the hub lives.
 *
 * Server-only: import from "@cornerways/design/auth", never the package root.
 *
 * The hub (cornerways.io) signs people in and issues the cookie; every other
 * site verifies it here. A cookie only says who someone was when they signed
 * in, so authenticate() also asks the hub who they are *now* (their current
 * role and scope, or that they've been removed or revoked) and caches the
 * answer briefly. A change on /household reaches every site within a minute.
 */
import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

/** What a Worker needs in its env for any of this. */
export type AuthEnv = {
  /** HMAC key for the session cookie. One value per environment: test's differs from production's. */
  SESSION_SECRET: string;
  /** "production" | "test" | "development"; anything else is treated as development. */
  ENVIRONMENT?: string;
  /** Local dev only: overrides the hub's origin (default: this host on port 8787). */
  DEV_HUB_ORIGIN?: string;
};

type AuthContext = Context<{ Bindings: AuthEnv }> | Context<any>;

export type SessionPayload = {
  /** mem_… for a person, dev_… for a paired device. */
  memberId: string;
  householdId: string;
  /** owner | editor | viewer | none */
  role: string;
  /** "household" (sees everyone's) or "self" (own data only); meaningless for owner and none. */
  scope: string;
  /** Epoch seconds. */
  exp: number;
};

/** Who a session belongs to right now, from the hub's database. */
export type LiveSession = { role: string; scope: string };

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, sliding

function environmentOf(env: { ENVIRONMENT?: string }): "production" | "test" | "development" {
  const value = env.ENVIRONMENT ?? "development";
  return value === "production" || value === "test" ? value : "development";
}

/**
 * Production and test each have their own cookie, so a session signed on test
 * (which runs whatever was last pushed) is never accepted by production, and
 * the reverse. Both are scoped to .cornerways.io, so each environment's
 * cookie reaches all of that environment's sites. Local dev keeps the
 * original name, host-only on localhost.
 */
export function sessionCookieName(env: { ENVIRONMENT?: string }): string {
  return environmentOf(env) === "test" ? "ch_session_test" : "ch_session";
}

// Keyed off ENVIRONMENT rather than the request hostname: wrangler dev
// simulates a configured custom-domain route for c.req.url even when served
// on localhost, so a hostname check would scope the cookie to .cornerways.io
// in local dev too, and the browser would refuse to send it back to
// localhost. Only development gets a host-only cookie; test is a real remote
// deployment and needs the domain-wide one.
function cookieDomain(env: { ENVIRONMENT?: string }): string | undefined {
  return environmentOf(env) === "development" ? undefined : ".cornerways.io";
}

function encodePayload(payload: SessionPayload): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as Partial<SessionPayload>;
    if (
      typeof payload.memberId === "string" &&
      typeof payload.householdId === "string" &&
      typeof payload.role === "string" &&
      typeof payload.exp === "number"
    ) {
      // scope is newer than the cookie format; default rather than reject,
      // so an older session isn't signed out.
      return { ...payload, scope: typeof payload.scope === "string" ? payload.scope : "household" } as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Verifies the session cookie's signature and expiry. No live check: use authenticate() for anything that grants access. */
export async function readSession(c: AuthContext): Promise<SessionPayload | null> {
  const env = c.env as AuthEnv;
  const raw = await getSignedCookie(c, env.SESSION_SECRET, sessionCookieName(env));
  if (!raw) return null;
  const payload = decodePayload(raw);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Sets (or renews) the session cookie. */
export async function setSessionCookie(
  c: AuthContext,
  member: { id: string; householdId: string; role: string; scope: string },
): Promise<void> {
  const env = c.env as AuthEnv;
  const payload: SessionPayload = {
    memberId: member.id,
    householdId: member.householdId,
    role: member.role,
    scope: member.scope,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  await setSignedCookie(c, sessionCookieName(env), encodePayload(payload), env.SESSION_SECRET, {
    httpOnly: true,
    // Remote deployments are always HTTPS; local dev is plain http://localhost,
    // where a Secure cookie would never come back.
    secure: environmentOf(env) !== "development",
    sameSite: "Lax",
    path: "/",
    domain: cookieDomain(env),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: AuthContext): void {
  const env = c.env as AuthEnv;
  deleteCookie(c, sessionCookieName(env), { path: "/", domain: cookieDomain(env) });
}

// ---------- Live check ----------

export type AuthenticateOptions = {
  /**
   * Asks the hub who this session belongs to now: their current role and
   * scope, or null if they've been removed from the household or the device
   * was revoked. Apps pass their HOUSEHOLD binding's checkSession; the hub
   * reads its own database.
   */
  check: (session: SessionPayload) => Promise<LiveSession | null>;
  /** How long a check's answer is reused in this isolate. Default 60; the hub uses 0. */
  cacheSeconds?: number;
};

const liveCache = new Map<string, { value: LiveSession | null; expires: number }>();
const LIVE_CACHE_MAX = 500;

async function liveSession(session: SessionPayload, options: AuthenticateOptions): Promise<LiveSession | null | undefined> {
  const ttl = (options.cacheSeconds ?? 60) * 1000;
  const key = `${session.memberId}|${session.householdId}`;
  const now = Date.now();
  if (ttl > 0) {
    const hit = liveCache.get(key);
    if (hit && hit.expires > now) return hit.value;
  }
  try {
    const value = await options.check(session);
    if (ttl > 0) {
      if (liveCache.size >= LIVE_CACHE_MAX) liveCache.clear();
      liveCache.set(key, { value, expires: now + ttl });
    }
    return value;
  } catch (err) {
    // The hub couldn't be asked. Fall back to what the cookie says rather
    // than signing everyone out while it's unreachable; the next request
    // tries again.
    console.warn("auth: live session check failed, using the cookie's role", err);
    return undefined;
  }
}

/**
 * Verifies the session, checks it against the hub, and renews the cookie
 * (sliding expiry) with the current role and scope. Returns null if there's
 * no valid session, or the person has been removed or the device revoked
 * (their cookie is cleared too); the caller responds 401 or redirects to
 * sign in.
 */
export async function authenticate(c: AuthContext, options: AuthenticateOptions): Promise<SessionPayload | null> {
  const session = await readSession(c);
  if (!session) return null;

  const live = await liveSession(session, options);
  if (live === null) {
    clearSessionCookie(c);
    return null;
  }
  const current: SessionPayload = live ? { ...session, role: live.role, scope: live.scope } : session;

  await setSessionCookie(c, {
    id: current.memberId,
    householdId: current.householdId,
    role: current.role,
    scope: current.scope,
  });
  return current;
}

// ---------- Roles ----------
// owner / editor / viewer / none (docs/household-platform.md §05 in the
// cornerways repo). No app has per-app overrides yet, so the household role
// is the effective role everywhere.

/**
 * Blocks a request outright on role, before any route logic runs. `none` has
 * no access; `viewer` is read-only, except for a `personalWrite`: a request
 * that can only change the caller's own answer about themselves (calendar's
 * meetup availability). Returns an error message, or null to allow it.
 */
export function roleGate(role: string, method: string, personalWrite = false): string | null {
  if (role === "none") return "No access to this app";
  if (role === "viewer" && !personalWrite && method !== "GET" && method !== "HEAD") return "Read-only access";
  return null;
}

/** Whether a session sees the whole household's member-tagged data rather than just its own. Owner always does. */
export function seesWholeHousehold(role: string, scope: string): boolean {
  return role === "owner" || scope === "household";
}

/**
 * A non-owner may only add or remove *themselves* on a member-tag list, not
 * tag or untag anyone else. Returns an error message, or null if the change
 * (or non-change, when `after` is undefined) is allowed.
 */
export function checkTagChange(
  role: string,
  memberId: string,
  before: string[] | undefined,
  after: string[] | undefined,
): string | null {
  if (role === "owner" || after === undefined) return null;
  const beforeSet = new Set(before ?? []);
  const afterSet = new Set(after);
  for (const id of beforeSet) {
    if (id !== memberId && !afterSet.has(id)) return "Can't remove another member's tag";
  }
  for (const id of afterSet) {
    if (id !== memberId && !beforeSet.has(id)) return "Can't tag another member";
  }
  return null;
}

// ---------- Where the hub is ----------

/** A phone or laptop on the household Wi-Fi reaching a dev server by LAN IP. */
export const PRIVATE_LAN_HOSTNAME =
  /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

/**
 * The hub's origin as seen from this Worker. Keyed off ENVIRONMENT, not the
 * request: test sends people to test.cornerways.io so the test stack stays
 * self-contained. In development the hub always runs on port 8787, so this
 * request's own hostname with that port finds it from localhost or a LAN IP;
 * DEV_HUB_ORIGIN overrides that guess.
 */
export function hubOrigin(env: { ENVIRONMENT?: string; DEV_HUB_ORIGIN?: string }, requestUrl: string): string {
  const environment = environmentOf(env);
  if (environment === "development") {
    if (env.DEV_HUB_ORIGIN) return env.DEV_HUB_ORIGIN;
    const hostname = new URL(requestUrl).hostname;
    if (hostname === "localhost" || PRIVATE_LAN_HOSTNAME.test(hostname)) return `http://${hostname}:8787`;
    return "http://localhost:8787";
  }
  return environment === "test" ? "https://test.cornerways.io" : "https://cornerways.io";
}
