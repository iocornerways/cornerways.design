/**
 * Feature flags for every Cornerways Worker, resolved by Spotify Confidence.
 *
 * Server-only: import from "@cornerways/design/flags". Browsers never talk to
 * Confidence; an app hands its pages the values they need from its own API.
 *
 * Flags are evaluated by Confidence's open-source resolver Worker running in
 * our own Cloudflare account (spotify/confidence-resolver), reached through a
 * service binding named CONFIDENCE. Its rules are baked in when it's
 * deployed, so a change made in Confidence takes effect after the deployer
 * next runs (the hub's "Confidence resolver" workflow).
 *
 * Never on the critical path: no binding, no secret, a slow or failing
 * resolver, or a flag with no matching rule all give the caller's default.
 * FLAG_OVERRIDES (a JSON var or secret, e.g. {"food-ai.enabled": false})
 * wins over everything, as the instant kill switch: `wrangler secret put`
 * applies it in seconds, without waiting for a resolver deploy.
 *
 * What Confidence is told: opaque ids (mem_…, hh_…), the app, the
 * environment and a few booleans or labels the caller adds. Never names,
 * emails or anything an app stores.
 *
 * Paths are "flag.property", Confidence's own convention: a flag is a
 * struct, so "signup.beta_code_required" is the beta_code_required field of
 * the flag named "signup". Nested fields go deeper ("food-ai.limits.daily").
 */

/** The slice of a service binding (Fetcher) we use, so this file needs no workers-types. */
export interface FlagResolver {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export type FlagEnv = {
  /** Service binding to the Confidence resolver Worker for this environment. */
  CONFIDENCE?: FlagResolver;
  /** Confidence client secret, type BACKEND, for this environment. */
  CONFIDENCE_CLIENT_SECRET?: string;
  /** JSON object of path → value that beats Confidence: the instant kill switch. */
  FLAG_OVERRIDES?: string;
  ENVIRONMENT?: string;
};

type ContextValue = string | number | boolean | null | undefined;

export type FlagContext = {
  /** Short app key, as in APPS ("hub" for cornerways.io). */
  app: string;
  /** mem_… (or dev_… for a paired device); the targeting key when present. */
  memberId?: string | null;
  /** hh_…; the targeting key when there's no member (household-wide features, signed-out pages get "anon"). */
  householdId?: string | null;
  /** Anything else to target on: isOriginalHousehold, cohort (a beta code label), role. Opaque values only. */
  [attribute: string]: ContextValue;
};

export type Flags = {
  /** The value at "flag.property", or the fallback when unset, unresolved or of a different type. */
  get<T extends string | number | boolean>(path: string, fallback: T): T;
  /** "resolver" when Confidence answered, "defaults" when it couldn't be asked. */
  source: "resolver" | "defaults";
  /**
   * Why a flag gave what it gave, for debugging: Confidence's reason
   * ("RESOLVE_REASON_MATCH", "RESOLVE_REASON_NO_SEGMENT_MATCH", …),
   * "NOT_RETURNED" when Confidence left it out (not enabled for this
   * client?), or "DEFAULTS" when Confidence couldn't be asked.
   */
  reason(flag: string): string;
  /** The top-level field names a matched flag's value has, to spot a misspelt property. */
  fields(flag: string): string[];
};

const DEFAULT_TIMEOUT_MS = 1000;
const RESOLVE_URL = "https://confidence-resolver/v1/flags:resolve";

/**
 * Resolves the named flags for one request. Ask for every flag the request
 * needs in one call; each get() then reads from the answer.
 */
export async function resolveFlags(
  env: FlagEnv,
  context: FlagContext,
  flagNames: readonly string[],
  options: { timeoutMs?: number } = {},
): Promise<Flags> {
  const overrides = parseOverrides(env.FLAG_OVERRIDES);
  if (!env.CONFIDENCE || !env.CONFIDENCE_CLIENT_SECRET || flagNames.length === 0) {
    return flagsFrom(new Map(), overrides, "defaults");
  }

  const { app, memberId, householdId, ...rest } = context;
  const evaluationContext: Record<string, ContextValue> = {
    targeting_key: memberId || householdId || "anon",
    app,
    environment: env.ENVIRONMENT ?? "development",
    ...(memberId ? { member_id: memberId } : {}),
    ...(householdId ? { household_id: householdId } : {}),
  };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) evaluationContext[key] = value;
  }

  try {
    const response = await withTimeout(
      env.CONFIDENCE.fetch(RESOLVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSecret: env.CONFIDENCE_CLIENT_SECRET,
          evaluationContext,
          flags: flagNames.map((name) => `flags/${name}`),
          apply: true,
        }),
      }),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (!response.ok) {
      console.warn("flags: resolver answered", response.status);
      return flagsFrom(new Map(), overrides, "defaults");
    }
    const body = (await response.json()) as { resolvedFlags?: { flag?: string; reason?: string | number; value?: unknown }[] };
    const values = new Map<string, unknown>();
    const reasons = new Map<string, string>();
    for (const resolved of body.resolvedFlags ?? []) {
      if (resolved.flag) reasons.set(resolved.flag.replace(/^flags\//, ""), String(resolved.reason ?? "UNKNOWN"));
      // Only a matched rule carries a value worth using; anything else (no
      // segment matched, archived, targeting key error) means "use the default".
      // (Protobuf JSON names the enum; 1 is the same value sent as a number.)
      if (!resolved.flag || (resolved.reason !== "RESOLVE_REASON_MATCH" && resolved.reason !== 1)) continue;
      values.set(resolved.flag.replace(/^flags\//, ""), resolved.value);
    }
    return flagsFrom(values, overrides, "resolver", reasons);
  } catch (err) {
    console.warn("flags: resolver unavailable", err instanceof Error ? err.message : err);
    return flagsFrom(new Map(), overrides, "defaults");
  }
}

/** Defaults (and overrides) only: for code paths with nothing to target on, or tests. */
export function defaultFlags(env: Pick<FlagEnv, "FLAG_OVERRIDES"> = {}): Flags {
  return flagsFrom(new Map(), parseOverrides(env.FLAG_OVERRIDES), "defaults");
}

function flagsFrom(
  values: Map<string, unknown>,
  overrides: Map<string, unknown>,
  source: Flags["source"],
  reasons: Map<string, string> = new Map(),
): Flags {
  return {
    source,
    reason: (flag) => (source === "defaults" ? "DEFAULTS" : (reasons.get(flag) ?? "NOT_RETURNED")),
    fields: (flag) => {
      const value = values.get(flag);
      return value && typeof value === "object" ? Object.keys(value) : [];
    },
    get<T extends string | number | boolean>(path: string, fallback: T): T {
      const overridden = overrides.get(path);
      if (overridden !== undefined && typeof overridden === typeof fallback) return overridden as T;
      const [flag, ...fields] = path.split(".");
      let value: unknown = values.get(flag);
      for (const field of fields) {
        value = value && typeof value === "object" ? (value as Record<string, unknown>)[field] : undefined;
      }
      return value !== undefined && value !== null && typeof value === typeof fallback ? (value as T) : fallback;
    },
  };
}

function parseOverrides(raw: string | undefined): Map<string, unknown> {
  if (!raw) return new Map();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return new Map(Object.entries(parsed));
  } catch {
    // fall through
  }
  console.warn("flags: FLAG_OVERRIDES isn't a JSON object; ignoring it");
  return new Map();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
