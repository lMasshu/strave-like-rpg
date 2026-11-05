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

export interface RpgBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  category?: "distance" | "raid" | "exploration" | "streak";
}

export interface RaidBoss {
  id: string;
  name: string;
  location: string;
  currentHp: number;
  maxHp: number;
  endsIn: string;
  tier?: "local" | "regional" | "world";
  description?: string;
}

export interface UserActivity {
  id: string;
  title: string;
  type: "run" | "walk" | "cycle" | "quest";
  date: string;
  distanceKm: number;
  durationMinutes: number;
  elevationMeters: number;
  xpEarned: number;
  badgeUnlocked?: string;
}

export interface DailyQuest {
  id: string;
  title: string;
  targetDistanceKm: number;
  estimatedMinutes: number;
  elevationMeters: number;
  xpReward: number;
  difficulty: "Facile" | "Modéré" | "Épique";
}

export interface UserProfile {
  id: string;
  username: string;
  title: string;
  level: number;
  experience: number;
  nextLevelExperience: number;
  friendsCount: number;
  activitiesCount: number;
  totalKm: number;
  totalElevationMeters: number;
  totalQuestsCompleted?: number;
  weeklyStats: {
    distanceKm: number;
    durationMinutes: number;
    elevationMeters: number;
    questsCompleted: number;
  };
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

export const DEMO_BADGES: RpgBadge[] = [
  {
    id: "b1",
    name: "Pionnier 10K",
    description: "Parcourir 10km en une sortie",
    icon: "ribbon-outline",
    unlocked: true,
    unlockedAt: "12 Oct 2026",
    category: "distance",
  },
  {
    id: "b2",
    name: "Pourfendeur de Boss",
    description: "Infliger plus de 5 000 dégâts lors d'un raid régional",
    icon: "flame-outline",
    unlocked: true,
    unlockedAt: "28 Oct 2026",
    category: "raid",
  },
  {
    id: "b3",
    name: "Arpenteur Sylvestre",
    description: "Valider 5 POI en milieu boisé",
    icon: "compass-outline",
    unlocked: true,
    unlockedAt: "02 Nov 2026",
    category: "exploration",
  },
  {
    id: "b4",
    name: "Conquérant des Cimes",
    description: "Cumuler 1 000m de dénivelé positif",
    icon: "shield-outline",
    unlocked: false,
    category: "distance",
  },
  {
    id: "b5",
    name: "Marathonien Mythique",
    description: "Valider 42,2 km sur une semaine",
    icon: "trophy-outline",
    unlocked: false,
    category: "streak",
  },
];

export const DEMO_ACTIVE_RAID: RaidBoss = {
  id: "rb-1",
  name: "Gorgone des Marais",
  location: "Bassin de la Somme",
  currentHp: 64200,
  maxHp: 100000,
  endsIn: "2j 18h",
  tier: "regional",
  description:
    "Monstre colossal tapi dans les brumes fluviales. Sensible aux efforts d'endurance régulière.",
};

export const DEMO_DAILY_QUEST: DailyQuest = {
  id: "dq-1",
  title: "Boucle des Trois Moulins",
  targetDistanceKm: 6.2,
  estimatedMinutes: 40,
  elevationMeters: 45,
  xpReward: 350,
  difficulty: "Modéré",
};

export const DEMO_USER_ACTIVITIES: UserActivity[] = [
  {
    id: "act-1",
    title: "Reconnaissance des Remparts",
    type: "quest",
    date: "Hier à 18h30",
    distanceKm: 8.4,
    durationMinutes: 52,
    elevationMeters: 65,
    xpEarned: 420,
    badgeUnlocked: "Arpenteur Sylvestre",
  },
  {
    id: "act-2",
    title: "Frappe de Raid matinale",
    type: "run",
    date: "Il y a 3 jours",
    distanceKm: 10.2,
    durationMinutes: 58,
    elevationMeters: 90,
    xpEarned: 580,
  },
  {
    id: "act-3",
    title: "Randonnée d'exploration POI",
    type: "walk",
    date: "Dimanche dernier",
    distanceKm: 9.8,
    durationMinutes: 110,
    elevationMeters: 75,
    xpEarned: 310,
  },
];

export const DEMO_USER_PROFILE: UserProfile = {
  id: "u-1",
  username: "Alexis",
  title: "Éclaireur des Sentiers",
  level: 7,
  experience: 820,
  nextLevelExperience: 1200,
  friendsCount: 14,
  activitiesCount: 32,
  totalKm: 218.4,
  totalElevationMeters: 1450,
  totalQuestsCompleted: 18,
  weeklyStats: {
    distanceKm: 28.4,
    durationMinutes: 165,
    elevationMeters: 230,
    questsCompleted: 4,
  },
};

export function getUnreadCount(): number {
  return DEMO_NOTIFICATIONS.filter((notification) => !notification.read).length;
}
