/**
 * The one implementation of Cornerways sign-in for every Worker: the
 * domain-wide session cookie, the live check of who it belongs to, the
 * household role rules, the cross-site write guard, and where the hub lives.
 *
 * Server-only: import from "@cornerways/design/auth", never the package root.
 *
 * Only the hub (cornerways.io) can create a session. It signs each one with
 * an Ed25519 private key that only it holds; every other site verifies the
 * signature with that environment's public key (below), so a bug or leak in
 * any app can't be turned into a session for someone else.
 *
 * A cookie only says who someone was when it was signed, so authenticate()
 * also asks the hub who they are *now*: it sends the cookie to the hub's
 * checkSession, which verifies it, looks up their current role and scope (or
 * that they've been removed, or the device revoked), and hands back a freshly
 * signed cookie when one is due. Answers are cached for a minute, so a change
 * on /household reaches every site within a minute.
 */
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { APPS, familyHosts, householdAppKeys } from "./apps.ts";

/** What a Worker needs in its env for any of this. */
export type AuthEnv = {
  /** "production" | "test" | "development"; anything else is treated as development. */
  ENVIRONMENT?: string;
  /** Hub only: the Ed25519 private key (JWK) that signs sessions. */
  SESSION_SIGNING_KEY?: string;
  /**
   * Hub only, during the changeover from shared-secret cookies: verifies an
   * old cookie once so it can be swapped for a signed one. No app needs it.
   */
  SESSION_SECRET?: string;
  /** Local dev only: overrides the hub's origin (default: this host on port 8787). */
  DEV_HUB_ORIGIN?: string;
};

type AuthContext = Context<any>;
type Environment = "production" | "test" | "development";

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

/**
 * The hub's answer to "who is this cookie?": the household-level session as
 * it stands now (what the cookie carries), their role and scope in the app
 * that asked, when it named one, and a renewed cookie when one is due.
 */
export type SessionCheck = { session: SessionPayload; app?: LiveSession; token?: string };

/**
 * The hub's lookup behind a check: the household-level role and scope (null
 * if removed or revoked), and, when an app is named, the effective role and
 * scope in that app: "none" if the app isn't switched on for the household,
 * otherwise the member's per-app override or else their household role.
 */
export type LiveLookup = (memberId: string, householdId: string, app?: string) => Promise<{ household: LiveSession; app?: LiveSession } | null>;

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, renewed at most daily
const RENEW_AFTER_SECONDS = 60 * 60 * 24;

/**
 * Each environment's session public key (Ed25519, base64url). Public by
 * design: anyone may verify a session, only the hub may sign one. The
 * private halves are the hub's SESSION_SIGNING_KEY secrets.
 */
const SESSION_PUBLIC_KEYS: Record<Environment, string> = {
  production: "xv-u-FQ0xOq5zikjEWIazXrY4B65rBAUZ2SbkxoEe4c",
  test: "yVkOED3bbjr9v_WFtem1BuliLPaaXCo3yqflS3skZ_A",
  development: "FdRYAJCWLavbVrvjYaBDVV_s20YQVT0VX38DMG8UUTI",
};

const TOKEN_PREFIX = "v2.";

function environmentOf(env: { ENVIRONMENT?: string }): Environment {
  const value = env.ENVIRONMENT ?? "development";
  return value === "production" || value === "test" ? value : "development";
}

/**
 * Production and test each have their own cookie (and their own keys), so a
 * session signed on test is never accepted by production, nor the reverse.
 * Both are scoped to .cornerways.io, so each reaches all of its
 * environment's sites. Local dev keeps the original name, host-only.
 */
export function sessionCookieName(env: { ENVIRONMENT?: string }): string {
  return environmentOf(env) === "test" ? "ch_session_test" : "ch_session";
}

// Keyed off ENVIRONMENT rather than the request hostname: wrangler dev
// simulates a configured custom-domain route for c.req.url even when served
// on localhost, so a hostname check would scope the cookie to .cornerways.io
// in local dev too, and the browser would refuse to send it back to
// localhost. Only development gets a host-only cookie.
function cookieDomain(env: { ENVIRONMENT?: string }): string | undefined {
  return environmentOf(env) === "development" ? undefined : ".cornerways.io";
}

// ---------- Encoding and keys ----------

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parsePayload(json: string): SessionPayload | null {
  try {
    const payload = JSON.parse(json) as Partial<SessionPayload>;
    if (
      typeof payload.memberId !== "string" ||
      typeof payload.householdId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { ...payload, scope: typeof payload.scope === "string" ? payload.scope : "household" } as SessionPayload;
  } catch {
    return null;
  }
}

const publicKeys = new Map<Environment, Promise<CryptoKey>>();
function publicKey(env: AuthEnv): Promise<CryptoKey> {
  const environment = environmentOf(env);
  let key = publicKeys.get(environment);
  if (!key) {
    key = crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: SESSION_PUBLIC_KEYS[environment] }, { name: "Ed25519" }, false, ["verify"]);
    publicKeys.set(environment, key);
  }
  return key;
}

let signingKey: { source: string; key: Promise<CryptoKey> } | null = null;
function privateKey(env: AuthEnv): Promise<CryptoKey> {
  if (!env.SESSION_SIGNING_KEY) throw new Error("Only the hub can sign sessions: SESSION_SIGNING_KEY isn't set");
  if (signingKey?.source !== env.SESSION_SIGNING_KEY) {
    signingKey = {
      source: env.SESSION_SIGNING_KEY,
      key: crypto.subtle.importKey("jwk", JSON.parse(env.SESSION_SIGNING_KEY) as JsonWebKey, { name: "Ed25519" }, false, ["sign"]),
    };
  }
  return signingKey.key;
}

/** Hub only: a signed session token, "v2.<payload>.<signature>". */
export async function signSession(env: AuthEnv, session: Omit<SessionPayload, "exp">): Promise<string> {
  const payload: SessionPayload = { ...session, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS };
  const body = TOKEN_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, await privateKey(env), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Verifies a signed token with this environment's public key. Anyone may call this; no secret needed. */
export async function verifySessionToken(env: AuthEnv, token: string): Promise<SessionPayload | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= TOKEN_PREFIX.length) return null;
  const body = token.slice(0, dot);
  try {
    const valid = await crypto.subtle.verify({ name: "Ed25519" }, await publicKey(env), fromBase64Url(token.slice(dot + 1)), new TextEncoder().encode(body));
    if (!valid) return null;
    return parsePayload(new TextDecoder().decode(fromBase64Url(body.slice(TOKEN_PREFIX.length))));
  } catch {
    return null;
  }
}

/**
 * A cookie from before signed sessions: "<payload>.<HMAC-SHA256, base64>",
 * as hono's setSignedCookie wrote it. Only the hub can check one (it holds
 * SESSION_SECRET), and only so it can swap it for a signed session.
 */
async function verifyLegacyToken(env: AuthEnv, token: string): Promise<SessionPayload | null> {
  if (!env.SESSION_SECRET || token.startsWith(TOKEN_PREFIX)) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = token.slice(0, dot);
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signature = Uint8Array.from(atob(token.slice(dot + 1)), (ch) => ch.charCodeAt(0));
    if (!(await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(value)))) return null;
    return parsePayload(new TextDecoder().decode(fromBase64Url(value)));
  } catch {
    return null;
  }
}

// ---------- The cookie ----------

function rawSessionCookie(c: AuthContext): string | undefined {
  return getCookie(c, sessionCookieName(c.env as AuthEnv)) || undefined;
}

/** Puts a hub-signed token in the cookie. */
export function writeSessionCookie(c: AuthContext, token: string): void {
  const env = c.env as AuthEnv;
  setCookie(c, sessionCookieName(env), token, {
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

/** Hub only: signs a session for someone who has just signed in, and sets it. */
export async function setSessionCookie(
  c: AuthContext,
  member: { id: string; householdId: string; role: string; scope: string },
): Promise<void> {
  const token = await signSession(c.env as AuthEnv, {
    memberId: member.id,
    householdId: member.householdId,
    role: member.role,
    scope: member.scope,
  });
  writeSessionCookie(c, token);
}

export function clearSessionCookie(c: AuthContext): void {
  const env = c.env as AuthEnv;
  deleteCookie(c, sessionCookieName(env), { path: "/", domain: cookieDomain(env) });
}

/**
 * What the cookie claims, if its signature holds (no live check: use
 * authenticate() for anything that grants access). The hub also reads
 * pre-signing cookies here; apps can't, and see those as signed out until
 * authenticate() has had the hub swap them.
 */
export async function readSession(c: AuthContext): Promise<SessionPayload | null> {
  const token = rawSessionCookie(c);
  if (!token) return null;
  const env = c.env as AuthEnv;
  return (await verifySessionToken(env, token)) ?? (await verifyLegacyToken(env, token));
}

// ---------- The hub's side of the live check ----------

/**
 * Hub only: verifies a session cookie (signed, or an old shared-secret one),
 * looks up who it belongs to now, and signs a renewed cookie when it's due:
 * old-style cookies always, signed ones once they're a day old or the role
 * or scope has changed. null if the cookie is invalid or the person has been
 * removed or the device revoked.
 */
export async function checkSessionToken(env: AuthEnv, token: string, live: LiveLookup, app?: string): Promise<SessionCheck | null> {
  const signed = await verifySessionToken(env, token);
  const session = signed ?? (await verifyLegacyToken(env, token));
  if (!session) return null;
  const found = await live(session.memberId, session.householdId, app);
  if (!found) return null;
  const current = found.household;

  const now = Math.floor(Date.now() / 1000);
  const changed = current.role !== session.role || current.scope !== session.scope;
  const due = !signed || changed || session.exp - now < SESSION_MAX_AGE_SECONDS - RENEW_AFTER_SECONDS;
  const updated = { memberId: session.memberId, householdId: session.householdId, role: current.role, scope: current.scope };
  if (!due) return { session: { ...updated, exp: session.exp }, app: found.app };
  return { session: { ...updated, exp: now + SESSION_MAX_AGE_SECONDS }, app: found.app, token: await signSession(env, updated) };
}

// ---------- authenticate ----------

export type AuthenticateOptions = {
  /**
   * Sends the session cookie to the hub and returns its answer: apps pass
   * their HOUSEHOLD binding's checkSession with their own app key, e.g.
   * (token) => c.env.HOUSEHOLD.checkSession(token, "todo"); the hub calls
   * checkSessionToken itself.
   */
  check: (token: string) => Promise<SessionCheck | null>;
  /** How long an answer is reused in this isolate. Default 60; the hub uses 0. */
  cacheSeconds?: number;
};

const checkCache = new Map<string, { value: SessionCheck | null; expires: number }>();
const CHECK_CACHE_MAX = 500;

async function cachedCheck(token: string, options: AuthenticateOptions): Promise<SessionCheck | null> {
  const ttl = (options.cacheSeconds ?? 60) * 1000;
  const now = Date.now();
  if (ttl > 0) {
    const hit = checkCache.get(token);
    if (hit && hit.expires > now) return hit.value;
  }
  const value = await options.check(token);
  if (ttl > 0) {
    if (checkCache.size >= CHECK_CACHE_MAX) checkCache.clear();
    checkCache.set(token, { value, expires: now + ttl });
  }
  return value;
}

/**
 * Who's signed in, as the hub sees them now. Verifies the cookie, asks the
 * hub (cached a minute), and sets the renewed cookie when the hub sends one.
 * Returns null if signed out, the cookie is forged or expired, or the person
 * has been removed or the device revoked (their cookie is cleared too); the
 * caller responds 401 or redirects to sign in.
 *
 * If the hub can't be reached, a properly signed cookie is trusted as it
 * stands rather than signing everyone out; an old-style cookie, which only
 * the hub can verify, counts as signed out until it can.
 */
export async function authenticate(c: AuthContext, options: AuthenticateOptions): Promise<SessionPayload | null> {
  const token = rawSessionCookie(c);
  if (!token) return null;
  const env = c.env as AuthEnv;
  const signed = await verifySessionToken(env, token);
  if (!signed && token.startsWith(TOKEN_PREFIX)) return null; // forged or expired

  let result: SessionCheck | null;
  try {
    result = await cachedCheck(token, options);
  } catch (err) {
    console.warn("auth: live session check failed", err);
    return signed;
  }
  if (!result) {
    clearSessionCookie(c);
    return null;
  }
  if (result.token) writeSessionCookie(c, result.token);
  // The cookie keeps the household-level role (it's shared by every app);
  // this request works with the role in this app, when the hub gave one.
  // "No access to this app" is role "none" here, so roleGate answers 403
  // in this app only, rather than signing anyone out everywhere.
  return result.app ? { ...result.session, role: result.app.role, scope: result.app.scope } : result.session;
}

// ---------- Cross-site write guard ----------

function isDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || PRIVATE_LAN_HOSTNAME.test(hostname);
}

export type OriginGuardOptions = {
  /**
   * Other sites whose pages may make changes here. Default: none, only this
   * site itself. The hub passes familyHosts(), since the apps' pages post to
   * it (kiosk commands and their acknowledgements).
   */
  allowHosts?: readonly string[];
};

/**
 * Refuses a change (anything but GET, HEAD or OPTIONS) that a browser sent
 * from a page on another site. The session cookie is SameSite=Lax, which
 * stops other websites, but every *.cornerways.io address counts as the same
 * site, test included; this closes that gap. Requests without an Origin
 * header (webhooks, scripts) aren't browsers riding a cookie and pass.
 */
export function originGuard(options: OriginGuardOptions = {}): MiddlewareHandler<any> {
  const allowed = new Set(options.allowHosts ?? []);
  return async (c, next) => {
    const method = c.req.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
    const origin = c.req.header("origin");
    if (!origin) return next();
    let from: URL | null = null;
    try {
      from = origin === "null" ? null : new URL(origin);
    } catch {
      from = null;
    }
    const here = new URL(c.req.url);
    const ok =
      from !== null &&
      (from.origin === here.origin ||
        (environmentOf(c.env as AuthEnv) === "development" && isDevHost(from.hostname)) ||
        (from.protocol === "https:" && allowed.has(from.hostname)));
    if (!ok) return c.json({ error: "Cross-site request refused" }, 403);
    return next();
  };
}

export { APPS, familyHosts, householdAppKeys };

// ---------- Roles ----------
// owner / editor / viewer / none (docs/household-platform.md §05 in the
// cornerways repo). No app has per-app overrides yet, so the household role
// is the effective role everywhere.

/** A paired kiosk tablet, signed in as itself rather than as a person (see the hub's device pairing). */
export function isDevice(session: { memberId: string }): boolean {
  return session.memberId.startsWith("dev_");
}

/**
 * What a paired tablet may do in an app. Every app declares one, in its
 * auth gate: "read-only" (a tablet is a household-wide viewer, the default
 * meaning of its role) or "full" (it may change things too, as on home,
 * where the kitchen tablet is how people switch the lights and heating).
 */
export type DevicePolicy = "read-only" | "full";

export type RoleGateOptions = {
  /** This app's device policy; see DevicePolicy. */
  devices: DevicePolicy;
  /**
   * A request that can only change the caller's own answer about themselves
   * (calendar's meetup availability): allowed for a viewer, since being
   * signed in shouldn't buy less than an anonymous guest with the link.
   */
  personalWrite?: boolean;
};

/**
 * Blocks a request outright on role, before any route logic runs: `none`
 * has no access; `viewer` is read-only unless it's a personalWrite, or a
 * device in an app whose policy is "full". Returns an error message, or
 * null to allow it.
 */
export function roleGate(session: { role: string; memberId: string }, method: string, options: RoleGateOptions): string | null {
  if (session.role === "none") return "No access to this app";
  const reading = method === "GET" || method === "HEAD";
  if (session.role !== "viewer" || reading || options.personalWrite) return null;
  if (isDevice(session) && options.devices === "full") return null;
  return "Read-only access";
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
