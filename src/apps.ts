/**
 * The Cornerways family, in one place: which apps exist, what they're called,
 * where they live and what colour they are. The hub's tiles, the header's app
 * switcher and each app's own breadcrumb all read from here, so adding an app
 * is one entry.
 */

export type AppKey = "home" | "calendar" | "todo" | "weather" | "trips" | "trains" | "food" | "finance" | "admin" | "agent";

export type LayoutMode = "workspace" | "reading";

export interface AppDefinition {
  key: AppKey;
  /** Display name, as it appears in the breadcrumb and on the hub tile. */
  name: string;
  /** One line for the hub tile. */
  description: string;
  /** Production hostname. The test deployment is test.<host>. */
  host: string;
  /** Local dev server port, or null for an app with no local dev build. */
  devPort: number | null;
  /** The app's own accent — for its icon and its data only. */
  accent: string;
  /** Which of the two layout modes its pages use. */
  mode: LayoutMode;
  /** True for a site outside *.cornerways.io; it opens with an outward arrow. */
  external?: boolean;
  /** Left out of the app switcher and hub tiles: an app only a few people can open (Mission Control), or one with no pages of its own (the agent connector). */
  hidden?: boolean;
}

export const APPS: readonly AppDefinition[] = [
  { key: "home", name: "Home", description: "Heating, lights, and everything smart under our roof.", host: "home.cornerways.io", devPort: 5174, accent: "#3f6b4f", mode: "reading" },
  { key: "calendar", name: "Calendar", description: "The household's shared calendar and planner.", host: "calendar.cornerways.io", devPort: 5179, accent: "#7a4e9e", mode: "workspace" },
  { key: "todo", name: "Todo", description: "Shared household lists and chores, for everyone to see.", host: "todo.cornerways.io", devPort: 5178, accent: "#8a6a12", mode: "workspace" },
  { key: "weather", name: "Weather", description: "Current conditions and the outlook for Fleet, at a glance.", host: "weather.cornerways.io", devPort: 5177, accent: "#1f6f8b", mode: "reading" },
  { key: "trips", name: "Trips", description: "Trip memories, and planning the next one together.", host: "travel.cornerways.io", devPort: 5176, accent: "#b4401e", mode: "workspace" },
  { key: "trains", name: "Trains", description: "Live train times and the daily commute, sorted.", host: "trains.cornerways.io", devPort: 5175, accent: "#2f5fc4", mode: "reading" },
  { key: "food", name: "Food", description: "Weekly meal planning, recipes, and what's in the fridge, freezer and cupboard.", host: "food.cornerways.io", devPort: 5180, accent: "#a33a2a", mode: "workspace" },
  { key: "admin", name: "Mission Control", description: "Platform usage, households and health, for platform admins.", host: "admin.cornerways.io", devPort: 5181, accent: "#4a5560", mode: "workspace", hidden: true },
  { key: "agent", name: "Agents", description: "Connects Claude and other agents to the household's apps, as the person who signed in.", host: "mcp.cornerways.io", devPort: 5182, accent: "#4a5560", mode: "reading", hidden: true },
  { key: "finance", name: "Finance", description: "Household finances and budgets to help us manage the pennies.", host: "countingthepennies.com", devPort: null, accent: "#2f6b3a", mode: "reading", external: true },
];

export const HUB_HOST = "cornerways.io";

export function getApp(key: AppKey): AppDefinition {
  const app = APPS.find((candidate) => candidate.key === key);
  if (!app) throw new Error(`Unknown Cornerways app: ${key}`);
  return app;
}

/** A phone or laptop on the household Wi-Fi reaching a dev server by LAN IP. */
const PRIVATE_LAN_HOSTNAME =
  /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

export type Deployment = "development" | "test" | "production";

/** Which deployment the page at `hostname` belongs to. */
export function deploymentFor(hostname: string): Deployment {
  if (hostname === "localhost" || hostname === "127.0.0.1" || PRIVATE_LAN_HOSTNAME.test(hostname)) return "development";
  if (hostname.startsWith("test.")) return "test";
  return "production";
}

/**
 * The URL of an app from wherever the current page is. In development that's
 * the dev server on the same hostname (so it works from a phone on the LAN),
 * on test it's the app's own test deployment, otherwise production.
 */
export function appUrl(app: AppDefinition, currentHostname: string): string {
  if (app.external) return `https://${app.host}`;
  const deployment = deploymentFor(currentHostname);
  if (deployment === "development" && app.devPort !== null) return `http://${currentHostname}:${app.devPort}`;
  if (deployment === "test") return `https://test.${app.host}`;
  return `https://${app.host}`;
}

/** The hub, by the same rule. The hub's dev server always runs on 8787. */
export function hubUrl(currentHostname: string): string {
  const deployment = deploymentFor(currentHostname);
  if (deployment === "development") return `http://${currentHostname}:8787`;
  if (deployment === "test") return `https://test.${HUB_HOST}`;
  return `https://${HUB_HOST}`;
}

/**
 * Every hostname in the family, production and test: the hub (with www) and
 * each app on *.cornerways.io. Where the hub may send someone back to after
 * sign-in, and which sites may make changes on the hub (see
 * @cornerways/design/auth's originGuard). External apps aren't included.
 */
export function familyHosts(): string[] {
  const hosts = [HUB_HOST, `www.${HUB_HOST}`, `test.${HUB_HOST}`];
  for (const app of APPS) {
    if (app.external) continue;
    hosts.push(app.host, `test.${app.host}`);
  }
  return hosts;
}

/**
 * The apps a household can have switched on (app_grants on the hub): every
 * family app on *.cornerways.io except hidden ones like Mission Control.
 */
export function householdAppKeys(): AppKey[] {
  return APPS.filter((app) => !app.external && !app.hidden).map((app) => app.key);
}
