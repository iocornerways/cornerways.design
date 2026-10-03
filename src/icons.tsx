import {
  CalendarDays,
  CloudSun,
  Compass,
  House,
  ListChecks,
  PiggyBank,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { AppKey } from "./apps.ts";

/** Line icons, one per app, drawn in the app's accent. */
export const APP_ICONS: Record<AppKey, LucideIcon> = {
  home: House,
  calendar: CalendarDays,
  todo: ListChecks,
  weather: CloudSun,
  trips: Compass,
  trains: TrainFront,
  food: UtensilsCrossed,
  finance: PiggyBank,
};

/** Stroke width for every lucide icon in the shell. */
export const ICON_STROKE = 1.7;
