/**
 * Service de calcul d'itinéraire (Directions & Routing) pour Mapbox
 * Supporte les profils walking, cycling et driving avec fallback OSRM & hors-ligne.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface RouteResult {
  coordinates: [number, number][]; // [lng, lat][] compatible GeoJSON
  distanceKm: number;
  durationMinutes: number;
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
  const distDest = Math.hypot(lastLng - destination[0], lastLat - destination[1]);
  if (distDest > 0.0002) {
    coordinates.push(destination);
  } else {
    coordinates[coordinates.length - 1] = destination;
  }

  return coordinates;
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
  const costing = options?.costing || "pedestrian";
  const accessToken = (options?.accessToken || "").trim();
  const mapboxProfile = getMapboxProfile(costing);

  // 1. Tenter l'API Mapbox Directions v5 officielle
  if (accessToken) {
    try {
      const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxProfile}/${coords}?geometries=geojson&overview=full&steps=true&access_token=${encodeURIComponent(
        accessToken,
      )}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const mainRoute = data.routes[0];
          const rawCoords = mainRoute.geometry.coordinates as [number, number][];
          const distanceKm = Number((mainRoute.distance / 1000).toFixed(2));
          const durationMinutes = Math.max(
            1,
            Math.round(mainRoute.duration / 60),
          );

          // Raccordement exact : le tracé doit démarrer à la pointe exacte de A et finir à celle de B
          const coordinates = snapRouteToPoints(rawCoords, origin, destination);

          return {
            coordinates,
            distanceKm,
            durationMinutes,
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
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?overview=full&geometries=geojson`;

    const res = await fetch(osrmUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const rawCoords = route.geometry.coordinates as [number, number][];
        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const durationMinutes = Math.max(1, Math.round(route.duration / 60));

        const coordinates = snapRouteToPoints(rawCoords, origin, destination);

        return {
          coordinates,
          distanceKm,
          durationMinutes,
          source: "osrm-fallback",
        };
      }
    }
  } catch (err) {
    console.error("Erreur fallback OSRM :", err);
  }

  // 3. Fallback géométrique direct (Ligne droite) si hors-ligne
  const straightLine: [number, number][] = [origin, destination];
  const dLat = (destination[1] - origin[1]) * 111;
  const dLng =
    (destination[0] - origin[0]) * 111 * Math.cos((origin[1] * Math.PI) / 180);
  const approxKm = Number(Math.sqrt(dLat * dLat + dLng * dLng).toFixed(2));

  return {
    coordinates: straightLine,
    distanceKm: approxKm,
    durationMinutes: Math.max(1, Math.round((approxKm / 4.5) * 60)),
    source: "offline-line",
  };
}
