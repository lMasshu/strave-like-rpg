import {
  fetchMultiPointRoute,
  RouteResult,
  TransportProfile,
} from "./mapboxDirections";
import { searchPointsOfInterest, PoiResult } from "./mapboxGeocoding";

export type QuestType = "loop" | "poi" | "linear";
export type QuestDifficulty = "easy" | "medium" | "hard" | "epic";

export interface GeneratedQuest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  difficulty: QuestDifficulty;
  xpReward: number;
  origin: [number, number]; // [lng, lat]
  destination: [number, number]; // [lng, lat]
  waypoints: [number, number][]; // Liste ordonnée de points à parcourir
  targetPoiName?: string;
  route: RouteResult;
  createdAt: number;
}

export interface QuestGeneratorOptions {
  userLocation: [number, number]; // [lng, lat]
  preferredType?: QuestType | "any";
  targetDistanceKm?: number; // Distance cible (ex: 1.5, 3, 5, 10)
  profile?: TransportProfile;
  mapboxToken?: string;
}

// Banques de noms et histoires RPG pour la génération procédurale
const LORE_TEMPLATES: Record<
  QuestType,
  { prefixes: string[]; themes: string[]; actions: string[] }
> = {
  loop: {
    prefixes: ["La Ronde", "La Patrouille", "Le Circuit", "L'Entraînement", "La Veille"],
    themes: ["des Guetteurs", "des Arpenteurs", "du Soleil Couchant", "des Vents Vives", "des Sentinelles", "des Brumes"],
    actions: [
      "Patrouillez les environs pour sécuriser le périmètre et affûter votre endurance.",
      "Complétez ce circuit circulaire pour fortifier votre lien avec la cité.",
      "Une boucle tactique pour tester votre cadence et votre sens du repérage.",
    ],
  },
  poi: {
    prefixes: ["Pèlerinage vers", "Infiltration à", "Reconnaissance de", "Les Mystères de", "Visite de"],
    themes: ["l'Ancien Sanctuaire", "la Tour Céleste", "l'Édifice Sacré", "la Fontaine de Mana", "la Clairière Paisible"],
    actions: [
      "Rendez-vous à ce haut lieu d'intérêt pour débloquer ses secrets ancestraux.",
      "Explorez ce point stratégique et faites résonner votre présence.",
      "Un trésor de savoir vous attend auprès de cet édifice remarquable.",
    ],
  },
  linear: {
    prefixes: ["L'Expédition", "La Chevauchée", "L'Échappée", "La Traversée", "La Quête"],
    themes: ["vers l'Inconnu", "des Terres Libres", "du Voyageur Solitaire", "de l'Aventure", "des Horizons Lointains"],
    actions: [
      "Progressez d'un point à un autre en franchissant chaque étape avec détermination.",
      "Suivez ce cap audacieux et conquérez ce nouvel axe du monde.",
      "Une route directe vers l'aventure pour dépasser vos limites quotidiennes.",
    ],
  },
};

/**
 * Calcule la difficulté RPG en fonction de la distance
 */
export function getDifficultyFromDistance(distanceKm: number): QuestDifficulty {
  if (distanceKm <= 2.5) return "easy";
  if (distanceKm <= 5.5) return "medium";
  if (distanceKm <= 9.5) return "hard";
  return "epic";
}

/**
 * Calcule l'XP récompensé pour une quête
 */
export function computeQuestXp(
  distanceKm: number,
  elevationGain: number,
  type: QuestType,
): number {
  const baseRate = 120; // 120 XP par kilomètre
  const elevRate = 1.5; // 1.5 XP par mètre de D+
  const typeBonus = type === "loop" ? 50 : type === "poi" ? 40 : 20;

  const total = Math.round(distanceKm * baseRate + elevationGain * elevRate + typeBonus);
  return Math.max(80, total);
}

/**
 * Projette des coordonnées géographiques à partir d'un point, d'une distance (km) et d'un azimut (degrés)
 */
function projectPoint(
  origin: [number, number],
  distanceKm: number,
  bearingDeg: number,
): [number, number] {
  const [lng, lat] = origin;
  const rad = (bearingDeg * Math.PI) / 180;

  const deltaLat = (distanceKm / 111.32) * Math.cos(rad);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const deltaLng = (distanceKm / (111.32 * (cosLat || 1))) * Math.sin(rad);

  return [
    Number((lng + deltaLng).toFixed(6)),
    Number((lat + deltaLat).toFixed(6)),
  ];
}

/**
 * Génère des étapes pour une boucle fermée (départ = arrivée)
 */
export function generateLoopWaypoints(
  center: [number, number],
  targetDistanceKm = 3,
): [number, number][] {
  // Ajustement : la circonférence d'un cercle est 2*PI*R.
  // En ville avec le quadrillage des rues, le tracé réel fait ~1.3 à 1.4 fois le périmètre vol d'oiseau.
  const approximatedRadius = targetDistanceKm / (2 * Math.PI * 1.35);

  // Choisir un nombre d'étapes (3 ou 4 waypoints intermédiaires)
  const numWaypoints = targetDistanceKm > 4 ? 4 : 3;
  const initialAngle = Math.random() * 360;
  const clockwise = Math.random() > 0.5 ? 1 : -1;
  const angleStep = 360 / (numWaypoints + 1);

  const waypoints: [number, number][] = [center];

  for (let i = 1; i <= numWaypoints; i++) {
    // Ajout d'une variation aléatoire sur l'angle et le rayon pour un tracé naturel
    const angleNoise = (Math.random() - 0.5) * (angleStep * 0.4);
    const bearing = (initialAngle + clockwise * (i * angleStep) + angleNoise + 360) % 360;

    const radiusVariation = approximatedRadius * (0.8 + Math.random() * 0.4);
    const point = projectPoint(center, radiusVariation, bearing);
    waypoints.push(point);
  }

  // Fermeture de la boucle sur le point de départ
  waypoints.push(center);
  return waypoints;
}

/**
 * Génère une quête vers un point d'intérêt proche
 */
export async function findNearbyPoiTarget(
  origin: [number, number],
  mapboxToken?: string,
  preferredMaxKm = 3,
): Promise<{ coordinates: [number, number]; name: string }> {
  // 1. Rechercher des POI autour de la position via Geocoding
  const sampleQueries = ["parc", "monument", "jardin", "château", "fontaine", "square", "musée"];
  const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];

  try {
    const pois = await searchPointsOfInterest(randomQuery, mapboxToken, origin);
    if (pois && pois.length > 0) {
      // Filtrer les POI situés à une distance raisonnable
      const candidates = pois.filter((poi) => {
        const dLat = (poi.coordinates[1] - origin[1]) * 111;
        const dLng = (poi.coordinates[0] - origin[0]) * 111 * Math.cos((origin[1] * Math.PI) / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        return dist >= 0.3 && dist <= preferredMaxKm * 1.5;
      });

      if (candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        return { coordinates: picked.coordinates, name: picked.name };
      }
    }
  } catch (err) {
    console.warn("Échec de la recherche de POIs en ligne pour la quête :", err);
  }

  // 2. Fallback géographique élégant : générer un repère imaginaire à la distance voulue
  const randomBearing = Math.random() * 360;
  const randomDist = Math.max(0.6, preferredMaxKm * (0.6 + Math.random() * 0.4));
  const fallbackCoords = projectPoint(origin, randomDist, randomBearing);
  const synthNames = [
    "Sanctuaire de l'Horizon",
    "Fontaine des Arcanes",
    "Belvédère du Couchant",
    "Mégalithe de la Forêt",
    "Borne des Pionniers",
  ];
  const name = synthNames[Math.floor(Math.random() * synthNames.length)];

  return { coordinates: fallbackCoords, name };
}

/**
 * Génère un titre et une description RPG dynamique
 */
function createQuestLore(
  type: QuestType,
  poiName?: string,
): { title: string; description: string } {
  const loreConfig = LORE_TEMPLATES[type];
  const prefix = loreConfig.prefixes[Math.floor(Math.random() * loreConfig.prefixes.length)];
  const action = loreConfig.actions[Math.floor(Math.random() * loreConfig.actions.length)];

  let title = "";
  if (type === "poi" && poiName) {
    title = `${prefix} ${poiName}`;
  } else {
    const theme = loreConfig.themes[Math.floor(Math.random() * loreConfig.themes.length)];
    title = `${prefix} ${theme}`;
  }

  return { title, description: action };
}

/**
 * Moteur principal : Génère une quête procédurale avec itinéraire complet
 */
export async function generateRandomQuest(
  options: QuestGeneratorOptions,
): Promise<GeneratedQuest> {
  const { userLocation, targetDistanceKm = 3, profile = "pedestrian", mapboxToken } = options;

  // Déterminer le type de quête
  let questType: QuestType;
  if (!options.preferredType || options.preferredType === "any") {
    const types: QuestType[] = ["loop", "poi", "linear"];
    questType = types[Math.floor(Math.random() * types.length)];
  } else {
    questType = options.preferredType;
  }

  let waypoints: [number, number][] = [];
  let destination: [number, number] = userLocation;
  let targetPoiName: string | undefined;

  switch (questType) {
    case "loop": {
      waypoints = generateLoopWaypoints(userLocation, targetDistanceKm);
      destination = userLocation;
      break;
    }

    case "poi": {
      const poiTarget = await findNearbyPoiTarget(userLocation, mapboxToken, targetDistanceKm);
      targetPoiName = poiTarget.name;
      destination = poiTarget.coordinates;
      waypoints = [userLocation, poiTarget.coordinates];
      break;
    }

    case "linear":
    default: {
      const bearing = Math.random() * 360;
      // Pour une route réelle, la distance à vol d'oiseau est ~0.75 de la distance de route
      const straightDist = targetDistanceKm * 0.75;
      destination = projectPoint(userLocation, straightDist, bearing);
      waypoints = [userLocation, destination];
      break;
    }
  }

  // Calcul du tracé réel via Mapbox Directions / OSRM
  const route = await fetchMultiPointRoute(waypoints, {
    accessToken: mapboxToken,
    costing: profile,
  });

  const difficulty = getDifficultyFromDistance(route.distanceKm);
  const xpReward = computeQuestXp(route.distanceKm, route.elevationGain, questType);
  const lore = createQuestLore(questType, targetPoiName);

  return {
    id: `quest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: lore.title,
    description: lore.description,
    type: questType,
    difficulty,
    xpReward,
    origin: userLocation,
    destination,
    waypoints,
    targetPoiName,
    route,
    createdAt: Date.now(),
  };
}
