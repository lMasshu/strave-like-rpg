export type NotificationType = "follow" | "kudos" | "raid" | "level";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  time: string;
  read: boolean;
}

export interface Athlete {
  id: string;
  username: string;
  level: number;
  city: string;
}

// Données de démonstration, à remplacer par l'API quand elle existera.
export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    type: "follow",
    message: "Lucas_Run a commencé à vous suivre.",
    time: "Il y a 5 min",
    read: false,
  },
  {
    id: "n2",
    type: "kudos",
    message: "Emma_Trail a aimé votre sortie « Footing du matin ».",
    time: "Il y a 1 h",
    read: false,
  },
  {
    id: "n3",
    type: "raid",
    message: "Le Dragon de Somme a perdu 12 % de ses points de vie !",
    time: "Il y a 3 h",
    read: false,
  },
  {
    id: "n4",
    type: "level",
    message: "Bravo, vous passez au niveau 5.",
    time: "Hier",
    read: true,
  },
];

export const DEMO_ATHLETES: Athlete[] = [
  { id: "a1", username: "Lucas_Run", level: 12, city: "Amiens" },
  { id: "a2", username: "Emma_Trail", level: 8, city: "Lille" },
  { id: "a3", username: "Hugo_Bike", level: 15, city: "Paris" },
  { id: "a4", username: "Chloe_Hike", level: 6, city: "Arras" },
  { id: "a5", username: "Nathan_Sprint", level: 10, city: "Amiens" },
  { id: "a6", username: "Lea_Walk", level: 3, city: "Rouen" },
];

export function getUnreadCount(): number {
  return DEMO_NOTIFICATIONS.filter((notification) => !notification.read).length;
}
