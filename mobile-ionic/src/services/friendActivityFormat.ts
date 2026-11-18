import { formatActiveDuration, SportType } from "./activityStats";

const SPORT_LABELS: Record<SportType, string> = {
  run: "Course à pied",
  walk: "Marche",
  hike: "Randonnée",
  bike: "Vélo",
};

/** « Course à pied », « Vélo »… ; « Sortie » pour un type inconnu. */
export function sportLabel(type: string): string {
  return SPORT_LABELS[type as SportType] ?? "Sortie";
}

const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayMonthYear = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/**
 * Date et heure de départ, en heure locale :
 * « Aujourd'hui · 09:05 », « Hier · 18:00 », « lun. 16 nov. · 07:30 »,
 * ou avec l'année si elle diffère de l'année en cours.
 */
export function formatStartedAt(startedAt: string, now: Date): string {
  const date = new Date(startedAt);
  if (!Number.isFinite(date.getTime())) return "Date inconnue";

  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const hour = time.format(date);
  if (days === 0) return `Aujourd'hui · ${hour}`;
  if (days === 1) return `Hier · ${hour}`;
  const day =
    date.getFullYear() === now.getFullYear()
      ? dayMonth.format(date)
      : dayMonthYear.format(date);
  return `${day} · ${hour}`;
}

/** Distance en km avec une décimale : « 10.0 km ». */
export function formatDistanceKm(distanceMeters: number): string {
  return `${(Math.max(0, distanceMeters) / 1000).toFixed(1)} km`;
}

/**
 * Vitesse moyenne pour le vélo (« 20.0 km/h »), allure pour les autres sports (« 6'00"/km »).
 * « – » quand la distance ou la durée est nulle.
 */
export function formatPaceOrSpeed(
  type: string,
  distanceMeters: number,
  durationSeconds: number,
): string {
  if (distanceMeters <= 0 || durationSeconds <= 0) return "–";
  const km = distanceMeters / 1000;
  if (type === "bike") {
    return `${(km / (durationSeconds / 3600)).toFixed(1)} km/h`;
  }
  const secondsPerKm = Math.round(durationSeconds / km);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;
  return `${minutes}'${String(seconds).padStart(2, "0")}"/km`;
}

/** Durée active : « 1 h 00 », « 45 min ». */
export const formatDuration = formatActiveDuration;
