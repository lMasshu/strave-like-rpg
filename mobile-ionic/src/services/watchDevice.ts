/**
 * Applis constructeur qui écrivent dans Health Connect / Apple Santé, quand le
 * magasin santé ne fournit que l'identifiant technique de l'appli source.
 */
const KNOWN_SOURCES: [prefix: string, brand: string][] = [
  ["com.garmin.", "Garmin"],
  ["com.samsung.", "Samsung Galaxy Watch"],
  ["com.sec.android.app.shealth", "Samsung Galaxy Watch"],
  ["com.fitbit.", "Fitbit"],
  ["fi.polar.", "Polar"],
  ["com.coros.", "Coros"],
  ["com.suunto.", "Suunto"],
  ["com.huawei.health", "Huawei"],
  ["com.mi.health", "Xiaomi"],
  ["com.xiaomi.wearable", "Xiaomi"],
  ["com.google.android.apps.fitness", "Pixel Watch / Fitbit"],
  ["com.apple.health", "Apple Watch"],
];

/** Identifiant d'appli (« com.garmin.android… ») plutôt qu'un nom d'appareil lisible. */
function isPackageName(value: string): boolean {
  return /^[a-z][\w-]*(\.[\w-]+)+$/i.test(value) && !/\s/.test(value);
}

const MAX_LENGTH = 100;

/**
 * Nom de montre à afficher dans l'historique, ou `undefined` si inconnu
 * (l'appli affichera alors simplement « Montre connectée »).
 *
 * - « Garmin Forerunner 255 » (fabricant + modèle fournis) → tel quel
 * - « com.garmin.android.apps.connectmobile » → « Garmin »
 * - identifiant d'appli inconnu → `undefined`
 */
export function watchDeviceLabel(
  sourceName: string | null | undefined,
): string | undefined {
  const value = sourceName?.trim();
  if (!value) return undefined;

  if (isPackageName(value)) {
    const lower = value.toLowerCase();
    return KNOWN_SOURCES.find(([prefix]) => lower.startsWith(prefix))?.[1];
  }
  return value.slice(0, MAX_LENGTH);
}
