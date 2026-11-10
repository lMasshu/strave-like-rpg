import type { UserActivity } from "../data/demo";
import type { LineMdIconName } from "./LineMdIcon";

const NOTIFICATION_ICONS: Record<string, LineMdIconName> = {
  follow: "account-add",
  kudos: "heart",
  raid: "alert",
  level: "star",
};

export function getNotificationIcon(type: string): LineMdIconName {
  return NOTIFICATION_ICONS[type] ?? "bell";
}

export function getBadgeIcon(iconName: string): LineMdIconName {
  switch (iconName) {
    case "ribbon-outline":
      return "star";
    case "flame-outline":
      return "sunny-loop";
    case "compass-outline":
      return "compass";
    case "shield-outline":
      return "security";
    case "trophy-outline":
      return "star";
    default:
      return "star";
  }
}

export function getActivityIcon(type: UserActivity["type"]): LineMdIconName {
  switch (type) {
    case "quest":
      return "compass";
    case "run":
      return "speed";
    case "walk":
      return "speed";
    case "cycle":
      return "speed";
    default:
      return "speed";
  }
}
