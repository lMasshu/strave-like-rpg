/** Période des statistiques du profil. */
export type StatsPeriod = "week" | "month" | "year";

/** Ce dont le calcul a besoin : un résumé d'activité (pas de tracé). */
export interface StatsActivity {
  startedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
}

/** Intervalle [from, to[ en heure locale du téléphone. */
export interface PeriodRange {
  from: Date;
  to: Date;
}

export interface PeriodTotals {
  distanceKm: number;
  elevationMeters: number;
  activityCount: number;
  durationSeconds: number;
}

export interface DistanceBar {
  label: string;
  km: number;
  /** Le jour, la tranche de jours ou le mois en cours. */
  isCurrent: boolean;
}

/**
 * Bornes de la période en cours, en heure locale :
 * semaine du lundi 00:00 au lundi suivant, mois calendaire, année civile.
 */
export function periodRange(period: StatsPeriod, now: Date): PeriodRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "year") {
    return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
  }
  if (period === "month") {
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
  }
  const mondayOffset = (now.getDay() + 6) % 7; // lundi = 0 … dimanche = 6
  const from = new Date(y, m, now.getDate() - mondayOffset);
  return {
    from,
    to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function inRange(activity: StatsActivity, range: PeriodRange): Date | null {
  const start = new Date(activity.startedAt);
  const time = start.getTime();
  if (!Number.isFinite(time)) return null;
  return time >= range.from.getTime() && time < range.to.getTime()
    ? start
    : null;
}

/** Totaux des activités commencées dans la période (les autres sont ignorées). */
export function computeTotals(
  activities: StatsActivity[],
  range: PeriodRange,
): PeriodTotals {
  let meters = 0;
  let elevation = 0;
  let duration = 0;
  let count = 0;
  for (const activity of activities) {
    if (!inRange(activity, range)) continue;
    meters += Math.max(0, activity.distanceMeters);
    elevation += Math.max(0, activity.elevationGainMeters || 0);
    duration += Math.max(0, activity.durationSeconds);
    count += 1;
  }
  return {
    distanceKm: round1(meters / 1000),
    elevationMeters: Math.round(elevation),
    activityCount: count,
    durationSeconds: Math.round(duration),
  };
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Libellés et rattachement d'une date à une barre selon la période. */
function bucketsFor(
  period: StatsPeriod,
  range: PeriodRange,
): { labels: string[]; indexOf: (date: Date) => number } {
  if (period === "week") {
    return {
      labels: DAY_LABELS,
      indexOf: (date) => (date.getDay() + 6) % 7,
    };
  }
  if (period === "year") {
    return { labels: MONTH_LABELS, indexOf: (date) => date.getMonth() };
  }
  // Mois : tranches de 7 jours (1–7, 8–14, …) plutôt que 31 barres illisibles sur mobile.
  const days = daysInMonth(range.from.getFullYear(), range.from.getMonth());
  const labels: string[] = [];
  for (let first = 1; first <= days; first += 7) {
    labels.push(`${first}–${Math.min(first + 6, days)}`);
  }
  return { labels, indexOf: (date) => Math.floor((date.getDate() - 1) / 7) };
}

/** Distance par jour (semaine), par tranche de 7 jours (mois) ou par mois (année). */
export function distanceBars(
  period: StatsPeriod,
  range: PeriodRange,
  activities: StatsActivity[],
  now: Date,
): DistanceBar[] {
  const { labels, indexOf } = bucketsFor(period, range);
  const meters = labels.map(() => 0);
  for (const activity of activities) {
    const start = inRange(activity, range);
    if (start) meters[indexOf(start)] += Math.max(0, activity.distanceMeters);
  }
  const nowInRange =
    now.getTime() >= range.from.getTime() && now.getTime() < range.to.getTime();
  const current = nowInRange ? indexOf(now) : -1;
  return labels.map((label, index) => ({
    label,
    km: round1(meters[index] / 1000),
    isCurrent: index === current,
  }));
}

/** « 3 h 05 », « 45 min », « 0 min ». */
export function formatActiveDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0
    ? `${hours} h ${String(rest).padStart(2, "0")}`
    : `${rest} min`;
}

const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
});

/** Sous-titre de la période : « Du 16 au 22 novembre », « novembre 2026 », « 2026 ». */
export function periodLabel(period: StatsPeriod, range: PeriodRange): string {
  if (period === "year") return String(range.from.getFullYear());
  if (period === "month") return monthYear.format(range.from);
  const last = new Date(
    range.to.getFullYear(),
    range.to.getMonth(),
    range.to.getDate() - 1,
  );
  const sameMonth = last.getMonth() === range.from.getMonth();
  const start = sameMonth
    ? String(range.from.getDate())
    : dayMonth.format(range.from);
  return `Du ${start} au ${dayMonth.format(last)}`;
}
