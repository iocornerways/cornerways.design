import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getApp, type AppKey } from "./apps.ts";
import { Button } from "./controls.tsx";
import type { FirstRunAnswer, FirstRunState, FirstRunSteps, PlaceLocation } from "./first-run.ts";

/**
 * Each app's first run, in the page: what this person has already seen or
 * set up (from the app's own GET /api/first-run, see ./first-run), an intro
 * card for the first visit, empty states that show what the app will look
 * like, and a town search. The house rules are in docs/style-guide.md
 * ("First run and empty states"): one action, an example that says it's an
 * example, never on a paired tablet.
 */

export interface UseFirstRunResult {
  /** This person's steps ({} on a first visit); null while loading and on a tablet or kiosk screen, where nothing is shown. */
  steps: FirstRunSteps | null;
  /** Whether they may answer household questions (its town, say). */
  canSetHousehold: boolean;
  loading: boolean;
  /** Records a step; the page updates straight away. */
  mark: (step: string, state: FirstRunState) => void;
}

function isKioskScreen(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("kiosk") === "1";
}

export function useFirstRun(): UseFirstRunResult {
  const kiosk = isKioskScreen();
  const [answer, setAnswer] = useState<FirstRunAnswer | null>(null);
  const [loading, setLoading] = useState(!kiosk);

  useEffect(() => {
    if (kiosk) return;
    let cancelled = false;
    fetch("/api/first-run")
      .then((res) => (res.ok ? (res.json() as Promise<FirstRunAnswer>) : null))
      .then((data) => {
        if (!cancelled) setAnswer(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kiosk]);

  const mark = useCallback((step: string, state: FirstRunState) => {
    setAnswer((prev) => {
      if (!prev?.steps) return prev;
      // A step once done stays done, as the hub keeps it.
      if (prev.steps[step] === "done" && state !== "done") return prev;
      return { ...prev, steps: { ...prev.steps, [step]: state } };
    });
    void fetch("/api/first-run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step, state }) }).catch(() => {});
  }, []);

  return { steps: answer?.steps ?? null, canSetHousehold: answer?.canSetHousehold ?? false, loading, mark };
}

/**
 * A small picture of the app in use, made from the same pieces as its
 * signed-out home page (the .v-* styles), with an "Example" badge so
 * nobody takes it for their own data. `html` is the app's own static
 * markup, never anything a person typed. The picture is hidden from
 * screen readers; `label` says what it shows instead.
 */
export function Example({ app, html, label }: { app: AppKey; html: string; label: string }) {
  return (
    <div className="cw-example" style={{ "--home-accent": getApp(app).accent } as CSSProperties}>
      <span className="v-badge cw-example-badge" aria-hidden="true">
        Example
      </span>
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="cw-visually-hidden">Example: {label}</p>
    </div>
  );
}

export type FirstRunAction = { label: string; onClick: () => void; href?: undefined } | { label: string; href: string; onClick?: () => void };

function ActionButton({ action }: { action: FirstRunAction }) {
  return action.href !== undefined ? (
    <Button variant="primary" href={action.href} onClick={action.onClick}>
      {action.label}
    </Button>
  ) : (
    <Button variant="primary" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export interface FirstRunCardProps {
  app: AppKey;
  title: string;
  /** One sentence: what this app does for this household. */
  line: string;
  example?: { html: string; label: string };
  action: FirstRunAction;
  /** "Not now": counts as seen, so the card doesn't come back. */
  onLater: () => void;
  /** Anything else the step needs, such as a town search, under the line. */
  children?: ReactNode;
}

/** The intro on someone's first visit: a card at the top of the page, not a pop-up, with one action and "Not now". */
export function FirstRunCard({ app, title, line, example, action, onLater, children }: FirstRunCardProps) {
  return (
    <section className="cw-first-run" aria-labelledby={`cw-first-run-${app}`}>
      <div className="cw-first-run-text">
        <h2 className="cw-first-run-title" id={`cw-first-run-${app}`}>
          {title}
        </h2>
        <p className="cw-first-run-line">{line}</p>
        {children}
        <div className="cw-first-run-actions">
          <ActionButton action={action} />
          <Button variant="ghost" onClick={onLater}>
            Not now
          </Button>
        </div>
      </div>
      {example && <Example app={app} html={example.html} label={example.label} />}
    </section>
  );
}

export interface EmptyStateProps {
  app: AppKey;
  title: string;
  line?: string;
  example?: { html: string; label: string };
  /** The one obvious first step; leave it out for someone who can't add anything. */
  action?: FirstRunAction;
}

/** What an empty screen shows: what it'll look like once there's something here, and the way to start. */
export function EmptyState({ app, title, line, example, action }: EmptyStateProps) {
  return (
    <section className="cw-empty">
      {example && <Example app={app} html={example.html} label={example.label} />}
      <h2 className="cw-empty-title">{title}</h2>
      {line && <p className="cw-empty-line">{line}</p>}
      {action && <ActionButton action={action} />}
    </section>
  );
}

export interface PlacePickerProps {
  onPick: (place: PlaceLocation) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Read out for the search box; the placeholder isn't a label. */
  label?: string;
}

/** Search-as-you-type for a town or postcode, over the app's GET /api/places (see registerPlaceRoutes). */
export function PlacePicker({ onPick, placeholder = "Town or postcode", autoFocus, label = "Search for your town or postcode" }: PlacePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { places?: PlaceLocation[]; error?: string };
        if (cancelled) return;
        setResults(data.places ?? []);
        setError(res.ok ? (data.places?.length ? null : "Nothing found. Try a nearby town.") : (data.error ?? "Search failed"));
      } catch {
        if (!cancelled) setError("Search failed. Check your connection and try again.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="cw-place-picker">
      <input
        ref={inputRef}
        className="cw-input"
        type="search"
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {searching && <p className="cw-place-picker-note">Searching…</p>}
      {error && !searching && <p className="cw-place-picker-note">{error}</p>}
      {results.length > 0 && (
        <ul className="cw-place-picker-results">
          {results.map((place) => (
            <li key={`${place.lat},${place.lon}`}>
              <button type="button" className="cw-place-picker-choice" onClick={() => onPick(place)}>
                {place.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
