/**
 * Service de calcul d'itinéraire (Routing) pour MapAtlas Platform
 * Supporte le costing pedestrian, bicycle et auto avec fallback automatique.
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
  source: "mapatlas" | "osrm-fallback";
}

/**
 * Décode une polyline encodée (algorithme Google / Valhalla avec précision 6)
 */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let byte: number;
    let shift = 0;
    let result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

/**
 * Calcule l'itinéraire entre un point A et un point B
 * Tente d'abord l'API MapAtlas Directions si un jeton avec le scope requis est présent,
 * puis bascule de manière transparente sur le routage piéton OpenStreetMap si nécessaire.
 */
export async function fetchRoute(
  origin: [number, number], // [lng, lat]
  destination: [number, number], // [lng, lat]
  options?: {
    apiKey?: string;
    gatewayOrigin?: string;
    costing?: "pedestrian" | "bicycle" | "auto";
  }
): Promise<RouteResult> {
  const costing = options?.costing || "pedestrian";
  const apiKey = (options?.apiKey || "").trim();
  const gateway = (options?.gatewayOrigin || "https://gateway.mapmetrics-atlas.net").replace(/\/$/, "");

  // 1. Tenter l'API Directions de MapAtlas
  if (apiKey) {
    try {
      const url = `${gateway}/directions/?token=${encodeURIComponent(apiKey)}`;
      const payload = {
        locations: [
          { lat: origin[1], lon: origin[0] },
          { lat: destination[1], lon: destination[0] },
        ],
        costing,
        directions_options: {
          units: "kilometers",
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.trip?.legs?.[0]?.shape) {
          const rawShape = data.trip.legs[0].shape;
          const coords = typeof rawShape === "string" ? decodePolyline(rawShape, 6) : rawShape;
          const summary = data.trip.summary || {};
          const distanceKm = summary.length ? Number(summary.length.toFixed(2)) : 0;
          const durationMinutes = summary.time ? Math.round(summary.time / 60) : 0;

          return {
            coordinates: coords,
            distanceKm,
            durationMinutes,
            source: "mapatlas",
          };
        }
      } else {
        const errJson = await response.json().catch(() => null);
        console.warn(
          "MapAtlas Directions API indisponible pour ce token (activez le scope navigation sur portal.mapmetrics.org) :",
          errJson || response.statusText
        );
      }
    } catch (e) {
      console.warn("Erreur réseau MapAtlas Directions :", e);
    }
  }

  // 2. Fallback de routage piéton / vélo (OSRM)
  try {
    const profile = costing === "bicycle" ? "bike" : costing === "auto" ? "car" : "foot";
    const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?overview=full&geometries=geojson`;

    const res = await fetch(osrmUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const coordinates = route.geometry.coordinates as [number, number][];
        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const durationMinutes = Math.round(route.duration / 60);

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

  // 3. Fallback géométrique direct (Ligne droite) si hors ligne
  const straightLine: [number, number][] = [origin, destination];
  const dLat = (destination[1] - origin[1]) * 111;
  const dLng = (destination[0] - origin[0]) * 111 * Math.cos((origin[1] * Math.PI) / 180);
  const approxKm = Number(Math.sqrt(dLat * dLat + dLng * dLng).toFixed(2));

  return {
    coordinates: straightLine,
    distanceKm: approxKm,
    durationMinutes: Math.round((approxKm / 4.5) * 60),
    source: "osrm-fallback",
  };
}
