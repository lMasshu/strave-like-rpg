import type mapboxgl from "mapbox-gl";
import {
  fetchMultiPointRoute,
  RouteResult,
  TransportProfile,
} from "./mapboxDirections";
import { searchPointsOfInterest } from "./mapboxGeocoding";

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
  mapInstance?: mapboxgl.Map | null;
}

// Banques de noms et histoires RPG pour la génération procédurale
const LORE_TEMPLATES: Record<
  QuestType,
  { prefixes: string[]; themes: string[]; actions: string[] }
> = {
  loop: {
    prefixes: [
      "La Ronde",
      "La Patrouille",
      "Le Circuit",
      "L'Entraînement",
      "La Veille",
    ],
    themes: [
      "des Guetteurs",
      "des Arpenteurs",
      "du Soleil Couchant",
      "des Vents Vives",
      "des Sentinelles",
      "des Brumes",
    ],
    actions: [
      "Patrouillez les environs pour sécuriser le périmètre et affûter votre endurance.",
      "Complétez ce circuit circulaire pour fortifier votre lien avec la cité.",
      "Une boucle tactique pour tester votre cadence et votre sens du repérage.",
    ],
  },
  poi: {
    prefixes: [
      "Pèlerinage vers",
      "Infiltration à",
      "Reconnaissance de",
      "Les Mystères de",
      "Visite de",
    ],
    themes: [
      "l'Ancien Sanctuaire",
      "la Tour Céleste",
      "l'Édifice Sacré",
      "la Fontaine de Mana",
      "la Clairière Paisible",
    ],
    actions: [
      "Rendez-vous à ce haut lieu d'intérêt pour débloquer ses secrets ancestraux.",
      "Explorez ce point stratégique et faites résonner votre présence.",
      "Un trésor de savoir vous attend auprès de cet édifice remarquable.",
    ],
  },
  linear: {
    prefixes: [
      "L'Expédition",
      "La Chevauchée",
      "L'Échappée",
      "La Traversée",
      "La Quête",
    ],
    themes: [
      "vers l'Inconnu",
      "des Terres Libres",
      "du Voyageur Solitaire",
      "de l'Aventure",
      "des Horizons Lointains",
    ],
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

  const total = Math.round(
    distanceKm * baseRate + elevationGain * elevRate + typeBonus,
  );
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
 * Calcule l'angle (bearing) initial entre deux points en degrés [0, 360[
 */
export function calculateBearing(
  from: [number, number],
  to: [number, number],
): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Génère des étapes pour une boucle fermée asymétrique garantissant l'absence d'aller-retour (Clean Loop).
 * Séparation stricte de la branche aller et retour avec écartement angulaire minimal pour éviter les demi-tours.
 */
export function generateLoopWaypoints(
  center: [number, number],
  targetDistanceKm = 3,
  scaleFactor = 1.0,
): [number, number][] {
  const effectiveDistance = targetDistanceKm * scaleFactor;
  // L'apex (point le plus éloigné) est situé à environ 38% de la distance cible
  const apexDistance = Math.max(0.35, effectiveDistance * 0.38);
  // Les points d'ailes latérales (aller et retour) sont situés à environ 22% de la distance
  const wingDistance = Math.max(0.22, effectiveDistance * 0.22);

  // Direction principale de la boucle (axe d'exploration)
  const mainAxis = Math.random() * 360;
  // Sens de rotation (horaire ou anti-horaire)
  const isClockwise = Math.random() > 0.5;
  const sign = isClockwise ? 1 : -1;

  // Écartement angulaire pour l'aller et le retour (entre 55° et 75° par rapport à l'axe)
  const wingAngle1 = (mainAxis - sign * (55 + Math.random() * 20) + 360) % 360;
  const wingAngle2 = (mainAxis + sign * (55 + Math.random() * 20) + 360) % 360;

  const waypoints: [number, number][] = [center];

  // Si distance > 4.5 km, affiner avec un point intermédiaire supplémentaire pour courber la trajectoire
  if (targetDistanceKm >= 4.5) {
    const quarterDist = wingDistance * 0.7;
    const preWingAngle =
      (mainAxis - sign * (80 + Math.random() * 15) + 360) % 360;
    waypoints.push(projectPoint(center, quarterDist, preWingAngle));
  }

  // Jalon 1 : Branche Aller (décalée latéralement)
  waypoints.push(projectPoint(center, wingDistance, wingAngle1));

  // Jalon 2 : Apex (point le plus éloigné dans l'axe)
  const apexNoiseAngle = (mainAxis + (Math.random() - 0.5) * 20 + 360) % 360;
  waypoints.push(projectPoint(center, apexDistance, apexNoiseAngle));

  // Jalon 3 : Branche Retour (décalée sur le flanc opposé)
  waypoints.push(projectPoint(center, wingDistance, wingAngle2));

  // Fermeture stricte sur le point de départ
  waypoints.push(center);
  return waypoints;
}

/**
 * Génère une boucle "Découverte" intégrant un POI réel en étape intermédiaire sans aller-retour direct.
 */
export function generatePoiLoopWaypoints(
  center: [number, number],
  poiCoords: [number, number],
  targetDistanceKm = 3,
): [number, number][] {
  // Calcul du cap et de la distance vers le POI
  const bearingToPoi = calculateBearing(center, poiCoords);
  const dLat = (poiCoords[1] - center[1]) * 111.32;
  const dLng =
    (poiCoords[0] - center[0]) * 111.32 * Math.cos((center[1] * Math.PI) / 180);
  const distToPoi = Math.sqrt(dLat * dLat + dLng * dLng);

  // Déterminer le sens de retour (latéral à ~75° de l'axe vers le POI)
  const sideSign = Math.random() > 0.5 ? 1 : -1;
  const returnAngle = (bearingToPoi + sideSign * 75 + 360) % 360;
  const returnDist = Math.max(
    0.3,
    Math.min(distToPoi * 0.8, targetDistanceKm * 0.25),
  );

  const returnWaypoint = projectPoint(center, returnDist, returnAngle);

  // Séquence : Centre -> POI -> Flanc de retour alternatif -> Centre
  return [center, poiCoords, returnWaypoint, center];
}

// Typologies riches de points d'intérêt : forêts, puits, sources, panoramas, patrimoine rural...
const POI_EXPLORATION_CATEGORIES = [
  // Nature & Forêts
  {
    query: "forêt",
    prefix: "Exploration de la",
    fallback: "Forêt des Murmures",
    category: "🌲 Forêt",
    action:
      "Pénétrez sous la canopée et explorez les sentiers boisés pour valider cette reconnaissance.",
  },
  {
    query: "bois",
    prefix: "Traversée du",
    fallback: "Bois des Chênes Anciens",
    category: "🌲 Bois",
    action:
      "Franchissez ce massif forestier pour affûter votre sens de l'orientation.",
  },
  {
    query: "clairière",
    prefix: "Halte à la",
    fallback: "Clairière du Repos",
    category: "🌿 Clairière",
    action: "Trouvez cette clairière paisible au cœur de la végétation.",
  },
  {
    query: "arbre",
    prefix: "Découverte de l'",
    fallback: "Arbre Remarquable",
    category: "🌳 Arbre remarquable",
    action:
      "Rejoignez ce végétal imposant qui veille sur les environs depuis des décennies.",
  },
  {
    query: "parc",
    prefix: "Visite du",
    fallback: "Parc Naturel",
    category: "🍃 Espace vert",
    action: "Parcourez les allées de ce havre de verdure.",
  },

  // Eau, Puits & Ouvrages ruraux
  {
    query: "puits",
    prefix: "Reconnaissance du",
    fallback: "Vieux Puits",
    category: "🪣 Puits",
    action:
      "Retrouvez ce puits historique, témoin séculaire des chemins ruraux.",
  },
  {
    query: "source",
    prefix: "À la recherche de la",
    fallback: "Source des Roches",
    category: "💧 Source d'eau",
    action: "Rendez-vous au point de jaillissement de cette source naturelle.",
  },
  {
    query: "fontaine",
    prefix: "Halte à la",
    fallback: "Fontaine des Sentiers",
    category: "⛲ Fontaine",
    action: "Marquez une étape auprès de ce point d'eau remarquable.",
  },
  {
    query: "lavoir",
    prefix: "Passage au",
    fallback: "Lavoir Historique",
    category: "🧺 Lavoir",
    action: "Contemplez ce vestige du patrimoine d'antan au bord de l'eau.",
  },
  {
    query: "étang",
    prefix: "Ronde de l'",
    fallback: "Étang des Brumes",
    category: "🦆 Étang",
    action: "Longez les berges paisibles de cette étendue d'eau.",
  },
  {
    query: "lac",
    prefix: "Cap vers le",
    fallback: "Lac Tranquille",
    category: "🌊 Lac",
    action:
      "Faites le tour de ce point d'eau majeur pour mesurer votre endurance.",
  },
  {
    query: "cascade",
    prefix: "Ascension vers la",
    fallback: "Cascade Sauvage",
    category: "💦 Cascade",
    action: "Approchez le fracas de cette chute d'eau vivifiante.",
  },

  // Reliefs & Panoramas
  {
    query: "point de vue",
    prefix: "Vue depuis le",
    fallback: "Belvédère du Couchant",
    category: "🔭 Point de vue",
    action:
      "Grimpez jusqu'à ce promontoire pour contempler le panorama alentour.",
  },
  {
    query: "belvédère",
    prefix: "Ascension au",
    fallback: "Belvédère Panoramique",
    category: "🏔️ Belvédère",
    action: "Gagnez les hauteurs et dominez le paysage environnant.",
  },
  {
    query: "colline",
    prefix: "Sommet de la",
    fallback: "Colline des Vents",
    category: "⛰️ Colline",
    action: "Rejoignez le faîte de ce relief pour braver le dénivelé.",
  },

  // Patrimoine & Curiosités
  {
    query: "moulin",
    prefix: "Recherche du",
    fallback: "Vieux Moulin",
    category: "🌾 Moulin",
    action: "Partez à la rencontre de cette silhouette remarquable du paysage.",
  },
  {
    query: "pont",
    prefix: "Franchissement du",
    fallback: "Pont Historique",
    category: "🌉 Pont",
    action: "Franchissez ce passage clé qui relie les deux rives.",
  },
  {
    query: "ruines",
    prefix: "Vestiges des",
    fallback: "Ruines Oubliées",
    category: "🧱 Ruines",
    action: "Explorez les pierres ancestrales de cet édifice d'autrefois.",
  },
  {
    query: "château",
    prefix: "Incursion au",
    fallback: "Château des Terres",
    category: "🏰 Château",
    categoryName: "Château",
    action: "Approchez les abords de cette bâtisse historique.",
  },
  {
    query: "chapelle",
    prefix: "Pèlerinage à la",
    fallback: "Chapelle du Sentier",
    category: "⛪ Chapelle",
    action: "Atteignez ce modeste sanctuaire perché au croisement des chemins.",
  },
  {
    query: "calvaire",
    prefix: "Étape au",
    fallback: "Calvaire des Croisées",
    category: "✝️ Calvaire",
    action: "Faites halte à cette croix marquant la croisée des sentiers.",
  },
  {
    query: "monument",
    prefix: "Hommage au",
    fallback: "Monument des Pionniers",
    category: "🏛️ Monument",
    action: "Rejoignez ce haut lieu mémoriel pour accomplir votre quête.",
  },
];

/**
 * Extrait les points d'intérêts réels rendus sur la carte Mapbox (bois, forêts, églises, mairies, collines, puits...)
 */
/**
 * Extrait les points d'intérêts réels rendus sur la carte Mapbox (bois, forêts, carrières, églises, mairies, collines, puits...)
 * Particulièrement adapté aux villages ruraux (ex: Cuignières) où les POIs sont les bois environnants, le patrimoine local, etc.
 */
export function extractPoisFromMapbox(
  map: mapboxgl.Map | null | undefined,
  userLocation: [number, number],
  preferredMaxKm = 4,
): {
  name: string;
  coordinates: [number, number];
  category?: string;
  customAction?: string;
}[] {
  if (!map) return [];

  const found: {
    name: string;
    coordinates: [number, number];
    category?: string;
    customAction?: string;
  }[] = [];
  const seenNames = new Set<string>();

  const RURAL_KEYWORDS = [
    "bois",
    "forêt",
    "foret",
    "carrière",
    "carriere",
    "terrier",
    "cailloux",
    "mairie",
    "église",
    "eglise",
    "chapelle",
    "calvaire",
    "croix",
    "cimetière",
    "cimetiere",
    "puits",
    "fontaine",
    "source",
    "lavoir",
    "étang",
    "etang",
    "mare",
    "bassin",
    "ruisseau",
    "colline",
    "butte",
    "mont",
    "moulin",
    "château",
    "chateau",
    "ferme",
    "fermette",
    "parc",
    "jardin",
    "verger",
    "haie",
    "bosquet",
    "clairière",
    "clairiere",
    "clos",
  ];

  try {
    const features = map.queryRenderedFeatures();
    for (const f of features) {
      const props = f.properties;
      const rawName =
        props?.name_fr || props?.name || props?.name_en || props?.title;
      if (!rawName || typeof rawName !== "string") continue;
      const name = rawName.trim();
      const lower = name.toLowerCase();

      if (name.length < 2 || seenNames.has(lower)) continue;

      // Ignorer les simples codes de routes ou autoroutes (ex: D916, N31, A1...)
      if (/^[A-Z]\s?\d+$/i.test(name)) continue;

      const layerId = (f.layer?.id || "").toLowerCase();
      const hasRuralKeyword = RURAL_KEYWORDS.some((kw) => lower.includes(kw));

      const isRelevant =
        hasRuralKeyword ||
        layerId.includes("poi") ||
        layerId.includes("natural") ||
        layerId.includes("park") ||
        layerId.includes("landuse") ||
        layerId.includes("water") ||
        layerId.includes("wood") ||
        layerId.includes("label") ||
        layerId.includes("place") ||
        props?.class === "wood" ||
        props?.class === "park" ||
        props?.class === "place" ||
        props?.type === "wood" ||
        props?.maki;

      if (!isRelevant) continue;

      let coords: [number, number] | null = null;
      if (f.geometry.type === "Point") {
        coords = f.geometry.coordinates as [number, number];
      } else if (f.geometry.type === "Polygon") {
        const polyCoords = f.geometry.coordinates as unknown as number[][][];
        const ring = polyCoords?.[0];
        if (Array.isArray(ring) && ring.length > 0) {
          let sumLng = 0;
          let sumLat = 0;
          for (const pt of ring) {
            sumLng += pt[0];
            sumLat += pt[1];
          }
          coords = [
            Number((sumLng / ring.length).toFixed(6)),
            Number((sumLat / ring.length).toFixed(6)),
          ];
        }
      } else if (f.geometry.type === "MultiPolygon") {
        const multiCoords = f.geometry.coordinates as unknown as number[][][][];
        const firstPolygon = multiCoords?.[0]?.[0];
        if (Array.isArray(firstPolygon) && firstPolygon.length > 0) {
          let sumLng = 0;
          let sumLat = 0;
          for (const pt of firstPolygon) {
            sumLng += pt[0];
            sumLat += pt[1];
          }
          coords = [
            Number((sumLng / firstPolygon.length).toFixed(6)),
            Number((sumLat / firstPolygon.length).toFixed(6)),
          ];
        }
      }

      if (
        coords &&
        typeof coords[0] === "number" &&
        typeof coords[1] === "number"
      ) {
        const dLat = (coords[1] - userLocation[1]) * 111;
        const dLng =
          (coords[0] - userLocation[0]) *
          111 *
          Math.cos((userLocation[1] * Math.PI) / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        // Garder les éléments à une distance réaliste pour l'activité (dès 50m jusqu'à max distance)
        if (dist >= 0.05 && dist <= preferredMaxKm * 2.2) {
          seenNames.add(lower);

          let category = "📍 Lieu remarquable";
          let action = `Rendez-vous à ${name} pour valider votre étape d'exploration.`;

          if (
            lower.includes("bois") ||
            lower.includes("forêt") ||
            lower.includes("foret")
          ) {
            category = "🌲 Bois & Forêts";
            action = `Pénétrez sous la canopée du ${name} et progressez le long des sentiers ombragés.`;
          } else if (
            lower.includes("église") ||
            lower.includes("eglise") ||
            lower.includes("chapelle")
          ) {
            category = "⛪ Patrimoine & Histoire";
            action = `Rejoignez l'édifice ${name}, repère séculaire du village.`;
          } else if (lower.includes("mairie")) {
            category = "🏛️ Cœur de bourg";
            action = `Atteignez la ${name} au centre de la commune pour valider votre passage.`;
          } else if (lower.includes("carrière") || lower.includes("carriere")) {
            category = "⛏️ Vestige du terroir";
            action = `Explorez les abords de l'ancien site de ${name}.`;
          } else if (
            lower.includes("terrier") ||
            lower.includes("cailloux") ||
            lower.includes("colline") ||
            lower.includes("mont")
          ) {
            category = "⛰️ Relief & Sentier";
            action = `Rejoignez les hauteurs de ${name} pour éprouver votre dénivelé.`;
          } else if (
            lower.includes("puits") ||
            lower.includes("fontaine") ||
            lower.includes("source") ||
            lower.includes("lavoir") ||
            lower.includes("mare") ||
            lower.includes("étang") ||
            lower.includes("etang")
          ) {
            category = "💧 Point d'eau & Ruralité";
            action = `Retrouvez ce point d'eau remarquable (${name}) au détour du chemin.`;
          }

          found.push({
            name,
            coordinates: coords,
            category,
            customAction: action,
          });
        }
      }
    }
  } catch (err) {
    console.warn("Erreur extraction features Mapbox :", err);
  }

  return found;
}

/**
 * Génère une quête vers un point d'intérêt proche (forêt, puits, source, belvédère, monument...)
 */
export async function findNearbyPoiTarget(
  origin: [number, number],
  mapboxToken?: string,
  preferredMaxKm = 3,
  mapInstance?: mapboxgl.Map | null,
): Promise<{
  coordinates: [number, number];
  name: string;
  category?: string;
  customAction?: string;
}> {
  // 1. PRIORITÉ ABSOLUE : Vérifier les éléments réellement visibles sur la carte (bois, églises, mairies, etc.)
  if (mapInstance) {
    const mapPois = extractPoisFromMapbox(mapInstance, origin, preferredMaxKm);
    if (mapPois.length > 0) {
      // Trier par pertinence de distance
      const picked = mapPois[Math.floor(Math.random() * mapPois.length)];
      return picked;
    }
  }

  // 2. Tirer au sort 2 ou 3 catégories d'exploration diversifiées en ligne
  const shuffled = [...POI_EXPLORATION_CATEGORIES].sort(
    () => 0.5 - Math.random(),
  );
  const selectedTypes = shuffled.slice(0, 3);

  // Recherche de lieux réels correspondants dans le rayon
  for (const poiType of selectedTypes) {
    try {
      const pois = await searchPointsOfInterest(
        poiType.query,
        mapboxToken,
        origin,
      );
      if (pois && pois.length > 0) {
        // Filtrer strictement les POI dans le rayon souhaité (entre 200m et distance cible * 1.35)
        const candidates = pois.filter((poi) => {
          const dLat = (poi.coordinates[1] - origin[1]) * 111;
          const dLng =
            (poi.coordinates[0] - origin[0]) *
            111 *
            Math.cos((origin[1] * Math.PI) / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          return dist >= 0.25 && dist <= preferredMaxKm * 1.35;
        });

        if (candidates.length > 0) {
          const picked =
            candidates[Math.floor(Math.random() * candidates.length)];
          return {
            coordinates: picked.coordinates,
            name: picked.name,
            category: poiType.category,
            customAction: poiType.action,
          };
        }
      }
    } catch (err) {
      console.warn(`Recherche POI "${poiType.query}" ignorée :`, err);
    }
  }

  // 3. Fallback géographique réaliste et contextualisé sur le terrain
  const chosenType = selectedTypes[0];
  const randomBearing = Math.random() * 360;
  const randomDist = Math.max(
    0.5,
    preferredMaxKm * (0.7 + Math.random() * 0.3),
  );
  const fallbackCoords = projectPoint(origin, randomDist, randomBearing);

  return {
    coordinates: fallbackCoords,
    name: chosenType.fallback,
    category: chosenType.category,
    customAction: chosenType.action,
  };
}

/**
 * Génère un titre et une description RPG dynamique
 */
function createQuestLore(
  type: QuestType,
  poiName?: string,
  poiCategory?: string,
  customAction?: string,
): { title: string; description: string } {
  const loreConfig = LORE_TEMPLATES[type];
  const action =
    customAction ||
    loreConfig.actions[Math.floor(Math.random() * loreConfig.actions.length)];

  let title = "";
  if (type === "poi" && poiName) {
    title = `Cap sur : ${poiName}`;
  } else if (type === "loop" && poiName) {
    const prefixes = [
      "Circuit Découverte du",
      "Boucle du",
      "La Ronde du",
      "Sentier du",
    ];
    title = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${poiName.replace(/^(le|la|les|l'|du|de la|des)\s+/i, "")}`;
  } else {
    const prefix =
      loreConfig.prefixes[
        Math.floor(Math.random() * loreConfig.prefixes.length)
      ];
    const theme =
      loreConfig.themes[Math.floor(Math.random() * loreConfig.themes.length)];
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
  const {
    userLocation,
    targetDistanceKm = 3,
    profile = "pedestrian",
    mapboxToken,
    mapInstance,
  } = options;

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
  let poiCategory: string | undefined;
  let customPoiAction: string | undefined;
  let isPoiLoop = false;

  switch (questType) {
    case "loop": {
      destination = userLocation;
      if (mapInstance) {
        const localPois = extractPoisFromMapbox(
          mapInstance,
          userLocation,
          targetDistanceKm,
        );
        // Si des POIs sont à proximité, 50% de chance d'intégrer le POI comme jalon de la boucle
        if (localPois.length > 0 && Math.random() > 0.4) {
          const picked =
            localPois[Math.floor(Math.random() * localPois.length)];
          targetPoiName = picked.name;
          poiCategory = picked.category;
          customPoiAction = `Gagnez ${picked.name} puis complétez la boucle par les sentiers alternatifs sans faire demi-tour.`;
          waypoints = generatePoiLoopWaypoints(
            userLocation,
            picked.coordinates,
            targetDistanceKm,
          );
          isPoiLoop = true;
          break;
        } else if (localPois.length > 0) {
          const picked =
            localPois[Math.floor(Math.random() * localPois.length)];
          targetPoiName = picked.name;
          poiCategory = picked.category;
        }
      }

      waypoints = generateLoopWaypoints(userLocation, targetDistanceKm);
      break;
    }

    case "poi": {
      const poiTarget = await findNearbyPoiTarget(
        userLocation,
        mapboxToken,
        targetDistanceKm,
        mapInstance,
      );
      targetPoiName = poiTarget.name;
      poiCategory = poiTarget.category;
      customPoiAction = poiTarget.customAction;
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
  let route = await fetchMultiPointRoute(waypoints, {
    accessToken: mapboxToken,
    costing: profile,
  });

  // Phase 3 : Calibration dynamique pour les boucles géométriques si l'écart dépasse 22%
  if (
    questType === "loop" &&
    !isPoiLoop &&
    targetDistanceKm >= 1.0 &&
    route.distanceKm > 0.3
  ) {
    const errorRatio =
      Math.abs(route.distanceKm - targetDistanceKm) / targetDistanceKm;
    if (errorRatio > 0.22) {
      const correction = targetDistanceKm / route.distanceKm;
      const clampedScale = Math.max(0.55, Math.min(1.85, correction));
      const calibratedWaypoints = generateLoopWaypoints(
        userLocation,
        targetDistanceKm,
        clampedScale,
      );

      try {
        const calibratedRoute = await fetchMultiPointRoute(
          calibratedWaypoints,
          {
            accessToken: mapboxToken,
            costing: profile,
          },
        );

        // Garder la nouvelle route si elle est plus proche de la distance demandée
        if (
          Math.abs(calibratedRoute.distanceKm - targetDistanceKm) <
          Math.abs(route.distanceKm - targetDistanceKm)
        ) {
          route = calibratedRoute;
          waypoints = calibratedWaypoints;
        }
      } catch (err) {
        console.warn("Recalibration de distance ignorée :", err);
      }
    }
  }

  const difficulty = getDifficultyFromDistance(route.distanceKm);
  const xpReward = computeQuestXp(
    route.distanceKm,
    route.elevationGain,
    questType,
  );
  const lore = createQuestLore(
    questType,
    targetPoiName,
    poiCategory,
    customPoiAction,
  );

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
