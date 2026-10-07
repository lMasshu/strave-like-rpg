import {
  IonAlert,
  IonContent,
  IonIcon,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  useIonViewDidEnter,
} from "@ionic/react";
import {
  closeCircleOutline,
  locateOutline,
  searchOutline,
  swapVerticalOutline,
  navigateOutline,
  walkOutline,
  bicycleOutline,
  carOutline,
  flagOutline,
  radioOutline,
  chevronDownOutline,
  chevronUpOutline,
  layersOutline,
  eyeOutline,
  eyeOffOutline,
  trendingUpOutline,
  diceOutline,
} from "ionicons/icons";
import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  fetchRoute,
  RouteResult,
  TransportProfile,
} from "../services/mapboxDirections";
import { searchPointsOfInterest, PoiResult } from "../services/mapboxGeocoding";
import QuestGeneratorModal from "../components/QuestGeneratorModal";
import { GeneratedQuest } from "../services/questGenerator";
import "./Map.css";

// Coordonnées par défaut : Paris Centre (Hôtel de Ville -> Musée du Louvre)
const INITIAL_POINT_A: [number, number] = [2.3522, 48.8566]; // [lng, lat]
const INITIAL_POINT_B: [number, number] = [2.3376, 48.8606]; // [lng, lat]

type MapTheme = "outdoors" | "dark" | "streets" | "satellite";

const MAP_STYLES: Record<MapTheme, string> = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

function getElevationChartPaths(
  profile: number[],
  width = 300,
  height = 54,
  padding = 6,
) {
  if (!profile || profile.length < 2) return null;

  const min = Math.min(...profile);
  const max = Math.max(...profile);
  const range = max - min || 1;

  const points = profile.map((val, idx) => {
    const x = (idx / (profile.length - 1)) * (width - 2 * padding) + padding;
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), val };
  });

  const linePath = points.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`,
    "",
  );
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return { linePath, areaPath, points, min, max };
}

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markerARef = useRef<mapboxgl.Marker | null>(null);
  const markerBRef = useRef<mapboxgl.Marker | null>(null);
  const currentCoordsRef = useRef<[number, number][]>([]);
  const isDraggingMarkerRef = useRef(false);

  const [pointA, setPointA] = useState<[number, number]>(INITIAL_POINT_A);
  const [pointB, setPointB] = useState<[number, number]>(INITIAL_POINT_B);
  const pointARef = useRef<[number, number]>(INITIAL_POINT_A);
  const pointBRef = useRef<[number, number]>(INITIAL_POINT_B);

  const [mode, setMode] = useState<TransportProfile>("pedestrian");
  const modeRef = useRef<TransportProfile>("pedestrian");

  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<"A" | "B" | null>(
    null,
  );
  const selectionTargetRef = useRef<"A" | "B" | null>(null);

  // Gestion des quêtes aléatoires et procédurales
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [activeQuest, setActiveQuest] = useState<GeneratedQuest | null>(null);

  useEffect(() => {
    pointARef.current = pointA;
    if (markerARef.current) {
      const current = markerARef.current.getLngLat();
      if (current.lng !== pointA[0] || current.lat !== pointA[1]) {
        markerARef.current.setLngLat(pointA);
      }
    }
  }, [pointA]);

  useEffect(() => {
    pointBRef.current = pointB;
    if (markerBRef.current) {
      const current = markerBRef.current.getLngLat();
      if (current.lng !== pointB[0] || current.lat !== pointB[1]) {
        markerBRef.current.setLngLat(pointB);
      }
    }
  }, [pointB]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectionTargetRef.current = selectionTarget;
  }, [selectionTarget]);

  // Ergonomie & Visibilité
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [hideUiForImmersion, setHideUiForImmersion] = useState(false);
  const [activeTheme, setActiveTheme] = useState<MapTheme>("outdoors");
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const [showConfigNotice, setShowConfigNotice] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const token = (
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
    (import.meta.env.MAPBOX_TOKEN as string | undefined) ||
    ""
  ).trim();

  const isConfigured = Boolean(token);

  useIonViewDidEnter(() => {
    if (mapInstance.current) {
      mapInstance.current.resize();
    }
  });

  // Ajustement automatique de la vue pour cadrer le tracé
  const fitRouteBounds = useCallback((coords: [number, number][]) => {
    const map = mapInstance.current;
    if (!map || coords.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds(
      coords[0],
      coords[coords.length - 1],
    );
    for (const c of coords) {
      bounds.extend(c);
    }

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 200, left: 60, right: 60 },
      maxZoom: 16,
      duration: 900,
    });
  }, []);

  // Rendu du tracé avec triple couche à contraste élevé (casing sombre + glow + cœur vibrant)
  const renderRouteOnMap = useCallback((coords: [number, number][]) => {
    const map = mapInstance.current;
    if (!map) return;

    currentCoordsRef.current = coords;

    const render = () => {
      if (!map.isStyleLoaded()) return;

      const geojsonData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      };

      const existingSource = map.getSource("route-source") as
        mapboxgl.GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(geojsonData);
      } else {
        map.addSource("route-source", {
          type: "geojson",
          data: geojsonData,
        });

        // 1. Bordure sombre (Casing) pour détacher le tracé de tout fond de carte
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#090d16",
            "line-width": 9,
            "line-opacity": 0.95,
          },
        });

        // 2. Halo lumineux d'énergie RPG (Glow)
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#00f0ff",
            "line-width": 14,
            "line-opacity": 0.35,
            "line-blur": 3,
          },
        });

        // 3. Ligne intérieure vibrante haute visibilité (Cyan électrique)
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#00f0ff",
            "line-width": 5.5,
            "line-opacity": 1,
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once("style.load", render);
    }
  }, []);

  // Recalcul de l'itinéraire
  const updateRoute = useCallback(
    async (
      start: [number, number],
      end: [number, number],
      transport: TransportProfile,
      autoZoom = true,
    ) => {
      setLoadingRoute(true);
      try {
        const result = await fetchRoute(start, end, {
          accessToken: token,
          costing: transport,
        });

        setRouteInfo(result);
        renderRouteOnMap(result.coordinates);

        if (autoZoom && result.coordinates.length > 0) {
          fitRouteBounds(result.coordinates);
        }
      } catch (err) {
        console.error("Erreur de calcul du tracé :", err);
      } finally {
        setLoadingRoute(false);
      }
    },
    [token, renderRouteOnMap, fitRouteBounds],
  );

  // Résolution du style en fonction du thème sélectionné
  const getStyleForTheme = useCallback(
    (theme: MapTheme): string => {
      if (token) {
        return MAP_STYLES[theme] || MAP_STYLES.outdoors;
      }
      return "https://demotiles.maplibre.org/style.json";
    },
    [token],
  );

  // Initialisation de la carte Mapbox
  useEffect(() => {
    if (!mapContainer.current) return;

    if (token) {
      mapboxgl.accessToken = token;
    }

    const initialStyle = getStyleForTheme(activeTheme);

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: INITIAL_POINT_A,
      zoom: 14,
    });

    mapInstance.current = map;

    // Générateur unique et rigoureusement identique pour A et B
    const createMapPin = (
      type: "A" | "B",
      initialPos: [number, number],
      title: string,
    ): mapboxgl.Marker => {
      const isA = type === "A";
      const el = document.createElement("div");
      el.className = `pin-marker-wrapper marker-${type.toLowerCase()}-wrapper`;

      const startColor = isA ? "#34d399" : "#f87171";
      const endColor = isA ? "#059669" : "#dc2626";
      const gradId = `pinGrad${type}`;

      el.innerHTML = `
        <div class="pin-marker-pulse"></div>
        <div class="pin-marker-content">
          <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${startColor}" />
                <stop offset="100%" stop-color="${endColor}" />
              </linearGradient>
            </defs>
            <path d="M19 2 C10 2 3 9 3 18 C3 28 14 40 19 48 C24 40 35 28 35 18 C35 9 28 2 19 2 Z"
                  fill="url(#${gradId})" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" />
            <circle cx="19" cy="18" r="10.5" fill="#0f172a" fill-opacity="0.88" stroke="#ffffff" stroke-width="1" />
            <text x="19" y="19" font-family="'Segoe UI', -apple-system, sans-serif" font-size="12" font-weight="900" fill="${startColor}" text-anchor="middle" dominant-baseline="central">${type}</text>
          </svg>
        </div>
      `;
      el.addEventListener("click", (e) => e.stopPropagation());

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
        draggable: true,
      })
        .setLngLat(initialPos)
        .setPopup(
          new mapboxgl.Popup({ offset: [0, -48] }).setHTML(
            `<div class="map-popup-card"><h3>${title}</h3><p>Glissez pour déplacer</p></div>`,
          ),
        )
        .addTo(map);

      marker.on("dragstart", () => {
        isDraggingMarkerRef.current = true;
      });

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        const nextCoord: [number, number] = [lngLat.lng, lngLat.lat];
        if (type === "A") {
          pointARef.current = nextCoord;
          setPointA(nextCoord);
          updateRoute(nextCoord, pointBRef.current, modeRef.current, false);
        } else {
          pointBRef.current = nextCoord;
          setPointB(nextCoord);
          updateRoute(pointARef.current, nextCoord, modeRef.current, false);
        }
        setTimeout(() => {
          isDraggingMarkerRef.current = false;
        }, 120);
      });

      return marker;
    };

    const markerA = createMapPin("A", INITIAL_POINT_A, "Point A (Départ)");
    const markerB = createMapPin("B", INITIAL_POINT_B, "Point B (Objectif)");

    markerARef.current = markerA;
    markerBRef.current = markerB;

    // Clic sur la carte : positionnement précis selon le point ciblé (A ou B)
    map.on("click", (e) => {
      if (isDraggingMarkerRef.current) return;
      const clicked: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const target = selectionTargetRef.current;

      if (target === "A") {
        pointARef.current = clicked;
        markerARef.current?.setLngLat(clicked);
        setPointA(clicked);
        setSelectionTarget(null);
        updateRoute(clicked, pointBRef.current, modeRef.current, false);
      } else if (target === "B") {
        pointBRef.current = clicked;
        markerBRef.current?.setLngLat(clicked);
        setPointB(clicked);
        setSelectionTarget(null);
        updateRoute(pointARef.current, clicked, modeRef.current, false);
      }
    });

    // Rechargement des couches du tracé si le style de carte change
    map.on("style.load", () => {
      setLoadError(null);
      if (currentCoordsRef.current.length > 0) {
        renderRouteOnMap(currentCoordsRef.current);
      }
    });

    map.on("load", () => {
      setLoadError(null);
      map.resize();
      updateRoute(pointARef.current, pointBRef.current, modeRef.current, true);
    });

    map.on("error", (e) => {
      console.error("Mapbox error:", e);
      const errMsg = e.error?.message || "";
      if (
        errMsg.includes("401") ||
        errMsg.includes("403") ||
        errMsg.includes("Unauthorized") ||
        errMsg.includes("Forbidden")
      ) {
        setLoadError(
          "Jeton Mapbox invalide ou non autorisé. Vérifiez VITE_MAPBOX_TOKEN dans votre fichier .env.",
        );
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      markerA.remove();
      markerB.remove();
      map.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, getStyleForTheme]);

  // Recalcul lorsque le mode de transport change
  useEffect(() => {
    if (mapInstance.current) {
      updateRoute(pointARef.current, pointBRef.current, mode, false);
    }
  }, [mode, updateRoute]);

  // Changement de style de carte
  const handleSelectTheme = (theme: MapTheme) => {
    setActiveTheme(theme);
    setShowStyleMenu(false);
    if (mapInstance.current) {
      const nextStyle = getStyleForTheme(theme);
      mapInstance.current.setStyle(nextStyle);
    }
  };

  // Recentrage immédiat
  const handleFitRoute = () => {
    if (routeInfo?.coordinates && routeInfo.coordinates.length > 0) {
      fitRouteBounds(routeInfo.coordinates);
    } else {
      fitRouteBounds([pointA, pointB]);
    }
  };

  // Inverser Point A et Point B
  const handleSwapPoints = () => {
    const newA = pointB;
    const newB = pointA;

    setPointA(newA);
    setPointB(newB);

    if (markerARef.current) markerARef.current.setLngLat(newA);
    if (markerBRef.current) markerBRef.current.setLngLat(newB);

    updateRoute(newA, newB, mode, false);
  };

  // Position GPS actuelle
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myCoords: [number, number] = [
          pos.coords.longitude,
          pos.coords.latitude,
        ];
        setPointA(myCoords);
        if (markerARef.current) markerARef.current.setLngLat(myCoords);
        if (mapInstance.current) {
          mapInstance.current.flyTo({ center: myCoords, zoom: 15 });
        }
        updateRoute(myCoords, pointBRef.current, modeRef.current, false);
      },
      (err) => {
        console.warn("Erreur géolocalisation :", err);
        alert("Impossible de récupérer votre position GPS.");
      },
      { enableHighAccuracy: true },
    );
  };

  // Gestion de la recherche de points d'intérêt (POI)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PoiResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<PoiResult | null>(null);

  const handleSearchInput = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const list = await searchPointsOfInterest(
        query,
        token,
        pointARef.current,
      );
      setSearchResults(list);
    } catch (err) {
      console.warn("Erreur recherche POI :", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPoi = (poi: PoiResult) => {
    setSelectedPoi(poi);
    setSearchResults([]);
    setSearchQuery(poi.name);
    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center: poi.coordinates,
        zoom: 15,
        duration: 800,
      });
    }
  };

  const handleApplyPoi = (target: "A" | "B") => {
    if (!selectedPoi) return;
    const coords = selectedPoi.coordinates;
    if (target === "A") {
      pointARef.current = coords;
      markerARef.current?.setLngLat(coords);
      setPointA(coords);
      updateRoute(coords, pointBRef.current, modeRef.current, false);
    } else {
      pointBRef.current = coords;
      markerBRef.current?.setLngLat(coords);
      setPointB(coords);
      updateRoute(pointARef.current, coords, modeRef.current, false);
    }
    setSelectedPoi(null);
    setSearchQuery("");
  };

  // Gestion de l'acceptation d'une quête générée procéduralement
  const handleAcceptQuest = (quest: GeneratedQuest) => {
    setActiveQuest(quest);
    setPointA(quest.origin);
    setPointB(quest.destination);
    pointARef.current = quest.origin;
    pointBRef.current = quest.destination;

    if (markerARef.current) markerARef.current.setLngLat(quest.origin);
    if (markerBRef.current) markerBRef.current.setLngLat(quest.destination);

    setRouteInfo(quest.route);
    currentCoordsRef.current = quest.route.coordinates;

    if (mapInstance.current) {
      const map = mapInstance.current;
      const source = map.getSource("route-source") as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: quest.route.coordinates,
          },
        });
      }

      if (quest.route.coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds(
          quest.route.coordinates[0],
          quest.route.coordinates[0],
        );
        for (const coord of quest.route.coordinates) {
          bounds.extend(coord);
        }
        map.fitBounds(bounds, {
          padding: {
            top: 120,
            bottom: isHudCollapsed ? 90 : 380,
            left: 50,
            right: 50,
          },
          maxZoom: 16,
          duration: 1200,
        });
      }
    }
  };

  const xpReward = activeQuest
    ? activeQuest.xpReward
    : routeInfo
      ? Math.round(
          routeInfo.distanceKm * 100 + (routeInfo.elevationGain || 0) * 2,
        )
      : 0;

  return (
    <IonPage>
      <IonContent fullscreen className="map-page-content">
        <div className="map-shell">
          {/* Conteneur Plein Écran de la Carte Mapbox */}
          <div ref={mapContainer} className="map-mapbox-container" />

          {/* Top Bar Mobile Épurée (Navigation & Recherche) */}
          {!hideUiForImmersion && (
            <div className="map-mobile-top-bar">
              <div className="mobile-search-pill">
                <IonIcon icon={searchOutline} className="search-pill-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Rechercher un lieu, monument..."
                  className="search-pill-input"
                />
                {isSearching ? (
                  <IonSpinner
                    name="crescent"
                    style={{ width: 16, height: 16, color: "#38bdf8" }}
                  />
                ) : searchQuery ? (
                  <button
                    type="button"
                    className="clear-pill-btn"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setSelectedPoi(null);
                    }}
                  >
                    <IonIcon icon={closeCircleOutline} />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                className={`top-mobile-icon-btn ${showStyleMenu ? "active" : ""}`}
                onClick={() => setShowStyleMenu(!showStyleMenu)}
                title="Style de carte"
              >
                <IonIcon icon={layersOutline} />
              </button>
            </div>
          )}

          {/* Bannière de Quête Active */}
          {activeQuest && !hideUiForImmersion && (
            <div className="active-quest-banner">
              <div className="active-quest-content">
                <div className="active-quest-title-row">
                  <span className="active-quest-tag">
                    {activeQuest.type === "loop"
                      ? "🔄 Boucle"
                      : activeQuest.type === "poi"
                        ? "🎯 POI"
                        : "📍 Trajet"}
                  </span>
                  <span className="active-quest-title">{activeQuest.title}</span>
                </div>
                <span className="active-quest-sub">
                  +{activeQuest.xpReward} XP • {activeQuest.route.distanceKm} km • {activeQuest.route.durationMinutes} min
                </span>
              </div>
              <button
                type="button"
                className="active-quest-close"
                onClick={() => setActiveQuest(null)}
                title="Quitter la quête"
              >
                <IonIcon icon={closeCircleOutline} />
              </button>
            </div>
          )}

          {/* Menu déroulant de recherche */}
          {searchResults.length > 0 && !hideUiForImmersion && (
            <div className="search-results-dropdown">
              {searchResults.map((poi) => (
                <div
                  key={poi.id}
                  className="search-result-item"
                  onClick={() => handleSelectPoi(poi)}
                >
                  <div className="result-item-header">
                    <span className="result-title">{poi.name}</span>
                    {poi.category && (
                      <span className="result-badge">{poi.category}</span>
                    )}
                  </div>
                  <span className="result-address">{poi.placeName}</span>
                </div>
              ))}
            </div>
          )}

          {/* Carte d'action après sélection d'un POI */}
          {selectedPoi && !hideUiForImmersion && (
            <div className="poi-action-card">
              <div className="poi-card-header">
                <div className="poi-card-info">
                  <h4>{selectedPoi.name}</h4>
                  <p>{selectedPoi.placeName}</p>
                </div>
                <button
                  type="button"
                  className="close-card-btn"
                  onClick={() => setSelectedPoi(null)}
                >
                  <IonIcon icon={closeCircleOutline} />
                </button>
              </div>
              <div className="poi-card-actions">
                <button
                  type="button"
                  className="poi-action-btn btn-set-a"
                  onClick={() => handleApplyPoi("A")}
                >
                  🟢 Départ (A)
                </button>
                <button
                  type="button"
                  className="poi-action-btn btn-set-b"
                  onClick={() => handleApplyPoi("B")}
                >
                  🔴 Objectif (B)
                </button>
              </div>
            </div>
          )}

          {/* Sélecteur de Thème de Carte Flottant */}
          {showStyleMenu && !hideUiForImmersion && (
            <div className="map-theme-dropdown">
              <div className="theme-title">Style de carte</div>
              <button
                className={`theme-option ${activeTheme === "outdoors" ? "active" : ""}`}
                onClick={() => handleSelectTheme("outdoors")}
              >
                🌲 Outdoors (Sport & Quête)
              </button>
              <button
                className={`theme-option ${activeTheme === "dark" ? "active" : ""}`}
                onClick={() => handleSelectTheme("dark")}
              >
                🌙 Dark Quest (Sombre)
              </button>
              <button
                className={`theme-option ${activeTheme === "streets" ? "active" : ""}`}
                onClick={() => handleSelectTheme("streets")}
              >
                🗺️ Streets (Ville)
              </button>
              <button
                className={`theme-option ${activeTheme === "satellite" ? "active" : ""}`}
                onClick={() => handleSelectTheme("satellite")}
              >
                🛰️ Satellite (Aérien)
              </button>
            </div>
          )}

          {/* Boutons d'Action Flottants (Disposés au-dessus du HUD) */}
          <div
            className={`map-floating-actions ${isHudCollapsed ? "hud-min" : "hud-exp"} ${hideUiForImmersion ? "immersed" : ""}`}
          >
            <button
              type="button"
              className="fab-action-btn quest-btn"
              onClick={() => setShowQuestModal(true)}
              title="Générateur de quête aléatoire"
            >
              <IonIcon icon={diceOutline} />
            </button>

            <button
              type="button"
              className="fab-action-btn location-btn"
              onClick={handleUseMyLocation}
              title="Ma position GPS"
            >
              <IonIcon icon={locateOutline} />
            </button>

            <button
              type="button"
              className="fab-action-btn fit-btn"
              onClick={handleFitRoute}
              title="Recentrer le tracé"
            >
              <IonIcon icon={navigateOutline} />
            </button>

            <button
              type="button"
              className="fab-action-btn immersion-btn"
              onClick={() => setHideUiForImmersion(!hideUiForImmersion)}
              title={
                hideUiForImmersion ? "Afficher les menus" : "Mode plein écran"
              }
            >
              <IonIcon icon={hideUiForImmersion ? eyeOutline : eyeOffOutline} />
            </button>
          </div>

          {/* Bottom Sheet HUD Mobile Épuré */}
          {!hideUiForImmersion && (
            <div
              className={`rpg-bottom-hud ${isHudCollapsed ? "collapsed" : "expanded"}`}
            >
              {/* En-tête / Poignée de réduction */}
              <div
                className="hud-header-bar"
                onClick={() => setIsHudCollapsed(!isHudCollapsed)}
              >
                <div className="hud-drag-pill" />
                <div className="hud-header-content">
                  <div className="hud-chips-route">
                    <span className="dot dot-a">A</span>
                    <span className="route-arrow">➔</span>
                    <span className="dot dot-b">B</span>
                  </div>

                  <span className="hud-metric-text">
                    {loadingRoute ? (
                      <IonSpinner name="dots" />
                    ) : routeInfo?.distanceKm ? (
                      <span className="hud-metric-chips">
                        <span>{routeInfo.distanceKm} km</span>
                        <span className="metric-dot">•</span>
                        <span>{routeInfo.durationMinutes} min</span>
                        <span className="metric-dot">•</span>
                        <span
                          className="metric-elev"
                          title="Dénivelé positif (D+)"
                        >
                          ↗ {routeInfo.elevationGain ?? 0}m
                        </span>
                      </span>
                    ) : (
                      "Tracé A ➔ B"
                    )}
                  </span>

                  <span className="hud-badge-xp">+{xpReward} XP</span>

                  <IonIcon
                    icon={
                      isHudCollapsed ? chevronUpOutline : chevronDownOutline
                    }
                    className="hud-toggle-icon"
                  />
                </div>
              </div>

              {/* Contenu Développé */}
              {!isHudCollapsed && (
                <div className="hud-expanded-body">
                  <div className="rpg-points-summary">
                    <button
                      type="button"
                      className={`point-tag tag-a ${selectionTarget === "A" ? "targeting" : ""}`}
                      onClick={() =>
                        setSelectionTarget(selectionTarget === "A" ? null : "A")
                      }
                    >
                      <IonIcon icon={radioOutline} /> Départ (A){" "}
                      {selectionTarget === "A" && "🎯"}
                    </button>

                    <button
                      type="button"
                      className="swap-btn"
                      onClick={handleSwapPoints}
                      title="Inverser départ et arrivée"
                    >
                      <IonIcon icon={swapVerticalOutline} />
                    </button>

                    <button
                      type="button"
                      className={`point-tag tag-b ${selectionTarget === "B" ? "targeting" : ""}`}
                      onClick={() =>
                        setSelectionTarget(selectionTarget === "B" ? null : "B")
                      }
                    >
                      <IonIcon icon={flagOutline} /> Objectif (B){" "}
                      {selectionTarget === "B" && "🎯"}
                    </button>
                  </div>

                  {/* Mode de Transport */}
                  <div className="rpg-mode-selector">
                    <IonSegment
                      value={mode}
                      onIonChange={(e) =>
                        setMode(e.detail.value as TransportProfile)
                      }
                    >
                      <IonSegmentButton value="pedestrian">
                        <IonIcon icon={walkOutline} />
                        <IonLabel>À pied</IonLabel>
                      </IonSegmentButton>
                      <IonSegmentButton value="bicycle">
                        <IonIcon icon={bicycleOutline} />
                        <IonLabel>À vélo</IonLabel>
                      </IonSegmentButton>
                      <IonSegmentButton value="auto">
                        <IonIcon icon={carOutline} />
                        <IonLabel>Voiture</IonLabel>
                      </IonSegmentButton>
                    </IonSegment>
                  </div>

                  {/* Chiffres Clés */}
                  <div className="rpg-stats-grid">
                    <div className="rpg-stat-item">
                      <span className="stat-label">Distance</span>
                      <span className="stat-value">
                        {loadingRoute ? (
                          <IonSpinner name="dots" />
                        ) : (
                          `${routeInfo?.distanceKm ?? "--"} km`
                        )}
                      </span>
                    </div>
                    <div className="rpg-stat-item elev-stat-item">
                      <span className="stat-label">Dénivelé</span>
                      <span
                        className="stat-value elev-value"
                        title="Dénivelé positif (D+)"
                      >
                        {loadingRoute ? (
                          <IonSpinner name="dots" />
                        ) : routeInfo ? (
                          `+${routeInfo.elevationGain ?? 0} m`
                        ) : (
                          "-- m"
                        )}
                      </span>
                    </div>
                    <div className="rpg-stat-item">
                      <span className="stat-label">Durée</span>
                      <span className="stat-value">
                        {loadingRoute ? (
                          <IonSpinner name="dots" />
                        ) : (
                          `${routeInfo?.durationMinutes ?? "--"} min`
                        )}
                      </span>
                    </div>
                    <div className="rpg-stat-item xp-item">
                      <span className="stat-label">Récompense</span>
                      <span className="stat-value xp-value">
                        +{xpReward} XP
                      </span>
                    </div>
                  </div>

                  {/* Profil altimétrique dynamique façon Strava */}
                  {routeInfo?.elevationProfile &&
                    routeInfo.elevationProfile.length > 1 && (
                      <div className="rpg-elevation-profile-card">
                        <div className="elev-card-header">
                          <div className="elev-title-group">
                            <IonIcon
                              icon={trendingUpOutline}
                              className="elev-title-icon"
                            />
                            <span className="elev-title-text">
                              Profil de Dénivelé
                            </span>
                          </div>
                          <div className="elev-badges-group">
                            <span
                              className="elev-badge d-plus"
                              title="Dénivelé positif"
                            >
                              D+ +{routeInfo.elevationGain ?? 0}m
                            </span>
                            <span
                              className="elev-badge d-minus"
                              title="Dénivelé négatif"
                            >
                              D- -{routeInfo.elevationLoss ?? 0}m
                            </span>
                          </div>
                        </div>

                        {(() => {
                          const chart = getElevationChartPaths(
                            routeInfo.elevationProfile,
                          );
                          if (!chart) return null;
                          return (
                            <div className="elev-svg-wrapper">
                              <div className="elev-alt-label max-label">
                                Max: {routeInfo.maxElevation ?? chart.max} m
                              </div>
                              <svg
                                className="elev-svg-chart"
                                viewBox="0 0 300 54"
                                preserveAspectRatio="none"
                              >
                                <defs>
                                  <linearGradient
                                    id="elevAreaGrad"
                                    x1="0%"
                                    y1="0%"
                                    x2="0%"
                                    y2="100%"
                                  >
                                    <stop
                                      offset="0%"
                                      stopColor="#ea580c"
                                      stopOpacity="0.2"
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor="#ea580c"
                                      stopOpacity="0.0"
                                    />
                                  </linearGradient>
                                </defs>
                                <path
                                  d={chart.areaPath}
                                  fill="url(#elevAreaGrad)"
                                />
                                <path
                                  d={chart.linePath}
                                  fill="none"
                                  stroke="#f97316"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle
                                  cx={chart.points[0].x}
                                  cy={chart.points[0].y}
                                  r="3"
                                  fill="#10b981"
                                  stroke="#11141c"
                                  strokeWidth="1.5"
                                />
                                <circle
                                  cx={chart.points[chart.points.length - 1].x}
                                  cy={chart.points[chart.points.length - 1].y}
                                  r="3"
                                  fill="#ef4444"
                                  stroke="#11141c"
                                  strokeWidth="1.5"
                                />
                              </svg>
                              <div className="elev-footer-axis">
                                <span className="axis-node node-a">
                                  A ({chart.points[0].val}m)
                                </span>
                                <span className="axis-min">
                                  Min: {routeInfo.minElevation ?? chart.min} m
                                </span>
                                <span className="axis-node node-b">
                                  B ({chart.points[chart.points.length - 1].val}
                                  m)
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                  <div className="hud-tip">
                    {selectionTarget
                      ? `👉 Touchez la carte pour placer le Point ${selectionTarget}`
                      : "💡 Touchez la carte ou cherchez un lieu pour modifier l'itinéraire"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notification d'erreur discrète */}
          {loadError && (
            <div className="mapbox-error-pill">
              <span>⚠️ {loadError}</span>
            </div>
          )}
        </div>

        <IonAlert
          isOpen={showConfigNotice}
          onDidDismiss={() => setShowConfigNotice(false)}
          header="Configuration Mapbox"
          subHeader={
            isConfigured ? "Jeton Mapbox détecté" : "Mode autonome (fallback)"
          }
          message={
            isConfigured
              ? "Le rendu vectoriel Mapbox GL JS et le calcul d'itinéraires via l'API Mapbox Directions v5 sont actifs."
              : "Aucun jeton Mapbox n'est défini dans le fichier .env (VITE_MAPBOX_TOKEN). Ajoutez votre clé pour débloquer les styles Mapbox complets."
          }
          buttons={["OK"]}
        />

        {/* Modal Générateur de Quête Aléatoire */}
        <QuestGeneratorModal
          isOpen={showQuestModal}
          onDismiss={() => setShowQuestModal(false)}
          userLocation={pointA}
          currentMode={mode}
          mapboxToken={token}
          onAcceptQuest={handleAcceptQuest}
        />
      </IonContent>
    </IonPage>
  );
};

export default MapPage;
