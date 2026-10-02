/**
 * Service de recherche et géocodage de points d'intérêt (POI) via l'API Mapbox Geocoding v5
 * Inclut un fallback intelligent avec les lieux majeurs et l'API OSM Nominatim.
 */

export interface PoiResult {
  id: string;
  name: string;
  placeName: string;
  coordinates: [number, number]; // [lng, lat]
  category?: string;
}

// Points d'intérêt prédéfinis pour exploration rapide ou fallback
const POPULAR_PARIS_POIS: PoiResult[] = [
  {
    id: "poi-louvre",
    name: "Musée du Louvre",
    placeName: "Rue de Rivoli, 75001 Paris",
    coordinates: [2.3376, 48.8606],
    category: "🏛️ Musée",
  },
  {
    id: "poi-eiffel",
    name: "Tour Eiffel",
    placeName: "Champ de Mars, 5 Av. Anatole France, 75007 Paris",
    coordinates: [2.2945, 48.8584],
    category: "🗼 Monument",
  },
  {
    id: "poi-notredame",
    name: "Cathédrale Notre-Dame",
    placeName: "6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris",
    coordinates: [2.3499, 48.853],
    category: "⛪ Monument",
  },
  {
    id: "poi-arc",
    name: "Arc de Triomphe",
    placeName: "Pl. Charles de Gaulle, 75008 Paris",
    coordinates: [2.295, 48.8738],
    category: "🏛️ Monument",
  },
  {
    id: "poi-montmartre",
    name: "Sacré-Cœur de Montmartre",
    placeName: "35 Rue du Chevalier de la Barre, 75018 Paris",
    coordinates: [2.3431, 48.8867],
    category: "⛪ Basilique",
  },
  {
    id: "poi-luxembourg",
    name: "Jardin du Luxembourg",
    placeName: "75006 Paris",
    coordinates: [2.3372, 48.8462],
    category: "🌲 Parc & Quête",
  },
];

interface MapboxFeature {
  id: string;
  text?: string;
  place_name: string;
  center: [number, number];
  place_type?: string[];
  properties?: {
    category?: string;
  };
}

interface OsmNominatimItem {
  place_id: number;
  name?: string;
  display_name: string;
  lon: string;
  lat: string;
  type?: string;
}

/**
 * Recherche des points d'intérêt ou adresses
 */
export async function searchPointsOfInterest(
  query: string,
  token?: string,
  proximity?: [number, number],
): Promise<PoiResult[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  // 1. Tenter l'API Mapbox Geocoding officielle
  if (token) {
    try {
      const proximityParam = proximity
        ? `&proximity=${proximity[0]},${proximity[1]}`
        : "";
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        cleanQuery,
      )}.json?access_token=${encodeURIComponent(
        token,
      )}&types=poi,address,neighborhood,place&language=fr${proximityParam}&limit=6`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return (data.features as MapboxFeature[]).map((feat) => {
            const category =
              feat.properties?.category ||
              (feat.place_type && feat.place_type[0] === "poi"
                ? "📍 Lieu d'intérêt"
                : "🗺️ Adresse");
            return {
              id: feat.id,
              name: feat.text || feat.place_name,
              placeName: feat.place_name,
              coordinates: feat.center,
              category,
            };
          });
        }
      }
    } catch (e) {
      console.warn("Erreur requête Mapbox Geocoding :", e);
    }
  }

  // 2. Fallback Nominatim (OpenStreetMap) si hors-ligne ou sans token
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cleanQuery,
    )}&addressdetails=1&limit=6&accept-language=fr`;
    const res = await fetch(nominatimUrl, {
      headers: { "User-Agent": "StravaRpgQuest/1.0" },
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return (list as OsmNominatimItem[]).map((item) => ({
          id: `osm-${item.place_id}`,
          name: item.name || item.display_name.split(",")[0],
          placeName: item.display_name,
          coordinates: [parseFloat(item.lon), parseFloat(item.lat)],
          category: item.type ? `📍 ${item.type}` : "📍 Lieu",
        }));
      }
    }
  } catch (err) {
    console.warn("Erreur fallback OSM Nominatim :", err);
  }

  // 3. Fallback local sur les POIs populaires
  const lower = cleanQuery.toLowerCase();
  return POPULAR_PARIS_POIS.filter(
    (poi) =>
      poi.name.toLowerCase().includes(lower) ||
      poi.placeName.toLowerCase().includes(lower),
  );
}
