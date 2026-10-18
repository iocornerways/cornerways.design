import { useCallback, useSyncExternalStore } from "react";
import type { Theme } from "./theme.ts";

/**
 * The app's theme: Light, Dark or Auto (the device's setting), shared by
 * every *.cornerways.io site through the cw_theme cookie and applied as
 * <html data-theme>. Pass `theme` and `setTheme` to <Header>. Trains and
 * Weather keep their own, whose Auto follows the time of day for the
 * kitchen tablet.
 */

export type ResolvedTheme = "light" | "dark";

const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#f6f4f0",
  dark: "#1a1816",
};

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "auto" ? systemTheme() : theme;
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "auto";
}

const THEME_COOKIE = "cw_theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * A plain (unsigned, non-httpOnly) cookie scoped to .cornerways.io — shares
 * light/dark/auto across every *.cornerways.io site, the same domain-wide
 * pattern the household hub's session cookie uses, minus the signing (this
 * isn't sensitive). The domain attribute is only appended on a real
 * *.cornerways.io host: "Domain=.cornerways.io" is invalid on localhost and
 * the browser silently refuses to set the cookie at all if it's present
 * there, so local dev naturally falls back to a host-only cookie.
 */
function cookieDomainAttr(): string {
  return window.location.hostname.endsWith(".cornerways.io") ? "; domain=.cornerways.io" : "";
}

function readThemeCookie(): Theme | null {
  const match = document.cookie.match(/(?:^|; )cw_theme=([^;]*)/);
  const value = match ? decodeURIComponent(match[1]) : null;
  return isTheme(value) ? value : null;
}

function writeThemeCookie(theme: Theme): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax${cookieDomainAttr()}${secure}`;
}

// One store for the whole page: the header's account menu changes the theme
// while a page is on screen, and anything computed from resolvedTheme (say,
// a planner's entry colours) has to follow in the same render.
let currentTheme: Theme = readThemeCookie() ?? "auto";
let currentResolved: ResolvedTheme = resolveTheme(currentTheme);
const listeners = new Set<() => void>();
let started = false;

function applyTheme(): void {
  currentResolved = resolveTheme(currentTheme);
  document.documentElement.setAttribute("data-theme", currentResolved);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[currentResolved]);
  for (const listener of listeners) listener();
}

function start(): void {
  if (started) return;
  started = true;
  writeThemeCookie(currentTheme);
  applyTheme();
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (currentTheme === "auto") applyTheme();
  });
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setThemeValue(theme: Theme): void {
  currentTheme = theme;
  writeThemeCookie(theme);
  applyTheme();
}

export interface UseThemeResult {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  /** Pick one outright — what the account menu offers. */
  setTheme: (theme: Theme) => void;
  /** Step to the next — what a single toggle button does. */
  cycleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(subscribe, () => currentTheme, () => currentTheme);
  const resolvedTheme = useSyncExternalStore(subscribe, () => currentResolved, () => currentResolved);

  const setTheme = useCallback((next: Theme) => setThemeValue(next), []);
  const cycleTheme = useCallback(() => {
    setThemeValue(currentTheme === "light" ? "dark" : currentTheme === "dark" ? "auto" : "light");
  }, []);

  return { theme, resolvedTheme, setTheme, cycleTheme };
}
