import { useCallback, useEffect, useState } from "react";

/**
 * What every app's client asks its own worker: who's signed in
 * (GET /api/session) and who's in the household (GET /api/family-members),
 * plus the one way to turn an API error into a message.
 */

/** Who's signed in and what they may do here, from the app's GET /api/session. */
export interface Session {
  memberId: string;
  role: string;
  scope: string;
}

/** A household member as apps see them: colour comes from the hub and is the same in every app. */
export interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

/** Throws the server's own error message (from a JSON `{ error }` body) when present, else a fallback. */
export async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error || fallback);
}

/** Who's signed in and what role they hold. */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session")
      .then((res) => (res.ok ? (res.json() as Promise<Session>) : null))
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading };
}

export interface UseFamilyMembersResult {
  members: FamilyMember[];
  loading: boolean;
  error: string | null;
}

// The app's worker asks the hub over a service binding, a bigger surface for
// a passing hiccup than the app's own data. Without a retry, one bad hop
// drops anything that lists people (a member filter, say) for the rest of
// the page load, with nothing to say why.
const RETRY_DELAYS_MS = [500, 1500];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The household's members, from the app's GET /api/family-members, retried twice. */
export function useFamilyMembers(): UseFamilyMembersResult {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch("/api/family-members");
        if (!res.ok) throw new Error("Failed to load family members");
        const data = (await res.json()) as { members: FamilyMember[] };
        setMembers(data.members);
        setError(null);
        break;
      } catch (err) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await delay(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        const message = err instanceof Error ? err.message : "Failed to load family members";
        console.error("useFamilyMembers: giving up after retries:", message);
        setError(message);
        break;
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { members, loading, error };
}
