export type InstallPromptOptions = {
  /** As it appears on the home screen ("Todo"). Defaults to document.title. */
  appName: string;
  /** Square icon shown in the card. Defaults to /icon-192.png. */
  icon?: string;
};

/** Shows the install card when this browser can install the site; a no-op otherwise. Safe to call more than once. */
export function initInstallPrompt(options: InstallPromptOptions): void;
export function isStandalone(): boolean;
export function isIos(): boolean;
export function isInAppBrowser(): boolean;
