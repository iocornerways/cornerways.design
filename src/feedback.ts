/**
 * The page's recent errors, kept for "Send feedback" (FeedbackDialog): the
 * last few uncaught errors, unhandled rejections and console.error calls.
 * Header installs it once, so every app gets it. Mirrored to sessionStorage,
 * so a report sent after a reload still carries what went wrong before it.
 */

export interface RecentError {
  message: string;
  source: string | null;
  line: number | null;
  /** ISO time. */
  at: string;
}

const MAX_ERRORS = 10;
const MAX_MESSAGE = 500;
const STORAGE_KEY = "cw-recent-errors";

let errors: RecentError[] = [];
let installed = false;

function save(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
  } catch {
    // Storage blocked or full: the in-memory list still works.
  }
}

function restore(): RecentError[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as RecentError[]).slice(-MAX_ERRORS) : [];
  } catch {
    return [];
  }
}

function describe(value: unknown): string {
  if (value instanceof Error) return value.stack ? `${value.message}\n${value.stack}` : value.message || value.name;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function record(message: string, source: string | null = null, line: number | null = null): void {
  const trimmed = message.trim().slice(0, MAX_MESSAGE);
  if (!trimmed) return;
  errors = [...errors, { message: trimmed, source, line, at: new Date().toISOString() }].slice(-MAX_ERRORS);
  save();
}

/** Starts listening; safe to call more than once. Does nothing outside a browser. */
export function installErrorBuffer(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  errors = restore();
  window.addEventListener("error", (event) => {
    record(event.error ? describe(event.error) : event.message, event.filename || null, event.lineno || null);
  });
  window.addEventListener("unhandledrejection", (event) => {
    record(`Unhandled rejection: ${describe(event.reason)}`);
  });
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    record(args.map(describe).join(" "));
    original(...args);
  };
}

/** The errors seen so far, oldest first. */
export function recentErrors(): RecentError[] {
  return [...errors];
}
