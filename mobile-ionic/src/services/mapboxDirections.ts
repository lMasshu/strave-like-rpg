/**
 * Service de calcul d'itinéraire (Directions & Routing) pour Mapbox
 * Supporte les profils walking, cycling et driving avec fallback OSRM & hors-ligne.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface ElevationData {
  elevationGain: number; // D+ (dénivelé positif) en mètres
  elevationLoss: number; // D- (dénivelé négatif) en mètres
  minElevation: number; // Altitude minimale en mètres
  maxElevation: number; // Altitude maximale en mètres
  profile: number[]; // Altitudes successives échantillonnées
}

export interface RouteResult {
  coordinates: [number, number][]; // [lng, lat][] compatible GeoJSON
  distanceKm: number;
  durationMinutes: number;
  elevationGain: number; // D+ en mètres
  elevationLoss: number; // D- en mètres
  minElevation?: number;
  maxElevation?: number;
  elevationProfile?: number[];
  source: "mapbox" | "osrm-fallback" | "offline-line";
}

export type TransportProfile = "pedestrian" | "bicycle" | "auto";

/**
 * Mappe le mode de transport RPG vers le profil Mapbox Directions
 */
function getMapboxProfile(
  costing: TransportProfile,
): "walking" | "cycling" | "driving" {
  switch (costing) {
    case "bicycle":
      return "cycling";
    case "auto":
      return "driving";
    case "pedestrian":
    default:
      return "walking";
  }
}

/**
 * Raccorde rigoureusement et sans faille le tracé aux points A (origin) et B (destination)
 */
function snapRouteToPoints(
  rawCoordinates: [number, number][],
  origin: [number, number],
  destination: [number, number],
): [number, number][] {
  if (!rawCoordinates || rawCoordinates.length === 0) {
    return [origin, destination];
  }

  const coordinates: [number, number][] = [...rawCoordinates];

  // 1. Point de départ (A)
  const [firstLng, firstLat] = coordinates[0];
  const distOrigin = Math.hypot(firstLng - origin[0], firstLat - origin[1]);
  if (distOrigin > 0.0002) {
    coordinates.unshift(origin);
  } else {
    coordinates[0] = origin;
  }

  // 2. Point d'arrivée (B)
  const [lastLng, lastLat] = coordinates[coordinates.length - 1];
  const distDest = Math.hypot(
    lastLng - destination[0],
    lastLat - destination[1],
  );
  if (distDest > 0.0002) {
    coordinates.push(destination);
  } else {
    coordinates[coordinates.length - 1] = destination;
  }

  return coordinates;
}

/**
 * Récupère le profil altimétrique et calcule le dénivelé positif (D+) et négatif (D-)
 * Utilise l'API Open-Meteo Elevation (rapide, sans clé requise, CORS activé) avec échantillonnage optimisé.
 */
export async function fetchElevationForCoordinates(
  coordinates: [number, number][],
): Promise<ElevationData> {
  const fallback: ElevationData = {
    elevationGain: 0,
    elevationLoss: 0,
    minElevation: 0,
    maxElevation: 0,
    profile: [],
  };

  if (!coordinates || coordinates.length === 0) {
    return fallback;
  }

  try {
    // Échantillonnage à max 50 points pour garantir une réponse quasi-instantanée (< 250ms)
    const maxSamples = 50;
    const step = Math.max(1, Math.floor(coordinates.length / maxSamples));
    const sampled: [number, number][] = [];
    for (let i = 0; i < coordinates.length; i += step) {
      sampled.push(coordinates[i]);
    }
    const lastCoord = coordinates[coordinates.length - 1];
    if (sampled[sampled.length - 1] !== lastCoord) {
      sampled.push(lastCoord);
    }

    const lats = sampled.map((c) => c[1].toFixed(5)).join(",");
    const lngs = sampled.map((c) => c[0].toFixed(5)).join(",");

    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
    );
    if (!res.ok) {
      throw new Error(`Open-Meteo status ${res.status}`);
    }

    const data = await res.json();
    const rawElevations: number[] = Array.isArray(data.elevation)
      ? data.elevation
      : [];

    if (rawElevations.length === 0) {
      return fallback;
    }

    // Filtrage du bruit DEM / GPS (seuil hystérésis de 1.5 mètre)
    let gain = 0;
    let loss = 0;
    const threshold = 1.5;

    for (let i = 1; i < rawElevations.length; i++) {
      const diff = rawElevations[i] - rawElevations[i - 1];
      if (diff > threshold) {
        gain += diff;
      } else if (diff < -threshold) {
        loss += Math.abs(diff);
      }
    }

    const min = Math.min(...rawElevations);
    const max = Math.max(...rawElevations);

    return {
      elevationGain: Math.round(gain),
      elevationLoss: Math.round(loss),
      minElevation: Math.round(min),
      maxElevation: Math.round(max),
      profile: rawElevations.map((e) => Math.round(e)),
    };
  } catch (err) {
    console.warn("Calcul du dénivelé non disponible :", err);
    return fallback;
  }
}

/**
 * Calcule l'itinéraire passant par une série ordonnée de points (ex: boucles, étapes, POI)
 */
export async function fetchMultiPointRoute(
  points: [number, number][], // [[lng, lat], [lng, lat], ...]
  options?: {
    accessToken?: string;
    costing?: TransportProfile;
  },
): Promise<RouteResult> {
  if (!points || points.length < 2) {
    throw new Error("Au moins deux points sont nécessaires pour calculer un itinéraire.");
  }

  const origin = points[0];
  const destination = points[points.length - 1];
  const costing = options?.costing || "pedestrian";
  const accessToken = (options?.accessToken || "").trim();
  const mapboxProfile = getMapboxProfile(costing);
  const coordsStr = points.map((p) => `${p[0]},${p[1]}`).join(";");

  // 1. Tenter l'API Mapbox Directions v5 officielle
  if (accessToken) {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxProfile}/${coordsStr}?geometries=geojson&overview=full&steps=true&access_token=${encodeURIComponent(
        accessToken,
      )}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const mainRoute = data.routes[0];
          const rawCoords = mainRoute.geometry.coordinates as [
            number,
            number,
          ][];
          const distanceKm = Number((mainRoute.distance / 1000).toFixed(2));
          const durationMinutes = Math.max(
            1,
            Math.round(mainRoute.duration / 60),
          );

          // Raccordement exact : le tracé doit démarrer à origin et finir à destination
          const coordinates = snapRouteToPoints(rawCoords, origin, destination);

          // Calcul d'élévation
          const elev = await fetchElevationForCoordinates(coordinates);

          return {
            coordinates,
            distanceKm,
            durationMinutes,
            elevationGain: elev.elevationGain,
            elevationLoss: elev.elevationLoss,
            minElevation: elev.minElevation,
            maxElevation: elev.maxElevation,
            elevationProfile: elev.profile,
            source: "mapbox",
          };
        }
      } else {
        const errJson = await response.json().catch(() => null);
        console.warn(
          "Mapbox Directions API a retourné une erreur :",
          errJson || response.statusText,
        );
      }
    } catch (e) {
      console.warn("Erreur réseau Mapbox Directions :", e);
    }
  }

  // 2. Fallback de secours gratuit OpenStreetMap (OSRM)
  try {
    const osrmProfile =
      costing === "bicycle" ? "bike" : costing === "auto" ? "car" : "foot";
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsStr}?overview=full&geometries=geojson`;

    const res = await fetch(osrmUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const rawCoords = route.geometry.coordinates as [number, number][];
        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const durationMinutes = Math.max(1, Math.round(route.duration / 60));

        const coordinates = snapRouteToPoints(rawCoords, origin, destination);
        const elev = await fetchElevationForCoordinates(coordinates);

        return {
          coordinates,
          distanceKm,
          durationMinutes,
          elevationGain: elev.elevationGain,
          elevationLoss: elev.elevationLoss,
          minElevation: elev.minElevation,
          maxElevation: elev.maxElevation,
          elevationProfile: elev.profile,
          source: "osrm-fallback",
        };
      }
    }
  } catch (err) {
    console.error("Erreur fallback OSRM :", err);
  }

  // 3. Fallback géométrique direct (Ligne brisée reliant les points) si hors-ligne
  let totalApproxKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dLat = (p2[1] - p1[1]) * 111;
    const dLng = (p2[0] - p1[0]) * 111 * Math.cos((p1[1] * Math.PI) / 180);
    totalApproxKm += Math.sqrt(dLat * dLat + dLng * dLng);
  }
  const approxKm = Number(totalApproxKm.toFixed(2));

  const elev = await fetchElevationForCoordinates(points);

  return {
    coordinates: points,
    distanceKm: approxKm,
    durationMinutes: Math.max(1, Math.round((approxKm / 4.5) * 60)),
    elevationGain: elev.elevationGain,
    elevationLoss: elev.elevationLoss,
    minElevation: elev.minElevation,
    maxElevation: elev.maxElevation,
    elevationProfile: elev.profile,
    source: "offline-line",
  };
}

/**
 * Calcule l'itinéraire entre un point A et un point B via l'API Mapbox Directions v5
 */
export async function fetchRoute(
  origin: [number, number], // [lng, lat]
  destination: [number, number], // [lng, lat]
  options?: {
    accessToken?: string;
    costing?: TransportProfile;
  },
): Promise<RouteResult> {
  return fetchMultiPointRoute([origin, destination], options);
}
