import {
  IonAlert,
  IonContent,
  IonIcon,
  IonPage,
  IonToast,
  useIonViewDidEnter,
} from "@ionic/react";
import {
  closeCircleOutline,
  locateOutline,
  buildOutline,
} from "ionicons/icons";
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { PoiResult } from "../services/mapboxGeocoding";
import QuestGeneratorModal from "../components/QuestGeneratorModal";
import QuestRunHud from "../components/QuestRunHud";
import GeolocationDebugConsole from "../components/GeolocationDebugConsole";
import LivePaceMetric from "../components/LivePaceMetric";
import {
  GeneratedQuest,
  generateRandomQuest,
} from "../services/questGenerator";
import { useActiveWorkout } from "../hooks/useActiveWorkout";
import { useThemeMode } from "../hooks/useThemeMode";
import { apiClient } from "../services/apiClient";
import { createQuestMarkerElement } from "../services/questMarker";
import { getLivePaceCaption } from "../services/livePacePresentation";
import "./Map.css";

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Coordonnées de repli initial si GPS indisponible (Paris Centre)
const DEFAULT_MAP_CENTER: [number, number] = [2.3522, 48.8566];

type MapTheme = "outdoors" | "dark" | "streets" | "satellite";

const MAP_STYLES: Record<MapTheme, string> = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

function createRasterStyle(
  tiles: string[],
  attribution: string,
): mapboxgl.Style {
  return {
    version: 8,
    sources: {
      "raster-tiles": {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: "raster-layer",
        type: "raster",
        source: "raster-tiles",
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
}

const FALLBACK_STYLES: Record<MapTheme, mapboxgl.Style> = {
  outdoors: createRasterStyle(
    [
      "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
    ],
    "&copy; OpenStreetMap contributors &copy; CARTO",
  ),
  dark: createRasterStyle(
    [
      "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
      "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
      "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
    ],
    "&copy; OpenStreetMap contributors &copy; CARTO",
  ),
  streets: createRasterStyle(
    ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    "&copy; OpenStreetMap contributors",
  ),
  satellite: createRasterStyle(
    [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    "&copy; Esri, USGS",
  ),
};

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const workoutPlayerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const poiMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const questDestinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const currentCoordsRef = useRef<[number, number][]>([]);

  // Synchronisation dynamique avec le thème Lime Frost (Clair / Sombre)
  const { resolvedTheme } = useThemeMode();
  const isDark = resolvedTheme === "dark";
  const [activeTheme, setActiveTheme] = useState<MapTheme>(() =>
    isDark ? "dark" : "outdoors",
  );
  const activeThemeRef = useRef<MapTheme>(isDark ? "dark" : "outdoors");

  // Navigation & Auto-Start depuis l'accueil
  const location = useLocation();

  // Quêtes procédurales & défis
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [activeQuest, setActiveQuest] = useState<GeneratedQuest | null>(null);

  // État de course & Télémétrie unifiée (avec quête ou libre)
  const workout = useActiveWorkout(activeQuest);
  const [workoutSegment, setWorkoutSegment] = useState<"map" | "stats">("map");
  const [workoutFinishedModal, setWorkoutFinishedModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSaveWorkout = useCallback(async () => {
    const startedAt = new Date(
      Date.now() - Math.max(1, workout.metrics.elapsedSeconds) * 1000,
    ).toISOString();
    const endedAt = new Date().toISOString();

    try {
      const res = await apiClient.saveActivity({
        activityType: "run",
        startedAt,
        endedAt,
        durationSeconds: Math.max(1, workout.metrics.elapsedSeconds),
        distanceMeters: Math.round(workout.metrics.distanceKm * 1000),
        elevationGainMeters: workout.metrics.elevationGainMeters,
        coordinates: workout.metrics.trackCoordinates,
      });

      const levelUpText = res.levelUp
        ? ` 🌟 NIVEAU SUPÉRIEUR : Niveau ${res.newLevel} !`
        : "";
      setToastMessage(
        `Course enregistrée sur l'API ! +${res.xpEarned} XP.${levelUpText}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur réseau";
      setToastMessage(`Enregistrement local (${msg})`);
    } finally {
      workout.resetWorkout();
      setWorkoutSegment("map");
    }
  }, [workout]);

  // Centrage & Suivi automatique du joueur (Follow-me)
  const hasInitialCenteredRef = useRef(false);
  const [isTrackingUser, setIsTrackingUser] = useState(true);

  // POI sélectionné
  const [selectedPoi, setSelectedPoi] = useState<PoiResult | null>(null);

  const [showConfigNotice, setShowConfigNotice] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const token = (
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
    (import.meta.env.MAPBOX_TOKEN as string | undefined) ||
    ""
  ).trim();

  const isConfigured = Boolean(token);

  // Auto-démarrage si l'utilisateur a cliqué sur "Démarrer une sortie" depuis l'accueil
  useEffect(() => {
    const state = location.state as { autoStart?: boolean } | null;
    if (state?.autoStart && workout.metrics.status === "idle") {
      workout.startWorkout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useIonViewDidEnter(() => {
    if (mapInstance.current) {
      mapInstance.current.resize();
      setTimeout(() => mapInstance.current?.resize(), 150);
      setTimeout(() => mapInstance.current?.resize(), 400);
    }
  });

  // Résolution du style Mapbox selon le thème
  const getStyleForTheme = useCallback(
    (theme: MapTheme): string | mapboxgl.Style => {
      if (token) {
        return MAP_STYLES[theme] || MAP_STYLES.outdoors;
      }
      return FALLBACK_STYLES[theme] || FALLBACK_STYLES.outdoors;
    },
    [token],
  );

  // Synchronisation dynamique avec le mode clair / sombre Lime Frost
  useEffect(() => {
    const nextTheme: MapTheme = isDark ? "dark" : "outdoors";
    setActiveTheme(nextTheme);
    activeThemeRef.current = nextTheme;
    if (mapInstance.current) {
      mapInstance.current.setStyle(getStyleForTheme(nextTheme));
    }
  }, [isDark, getStyleForTheme]);

  useEffect(() => {
    activeThemeRef.current = activeTheme;
  }, [activeTheme]);

  // Tracé GeoJSON dynamique pour l'itinéraire de quête
  const renderRouteOnMap = useCallback((coords: [number, number][]) => {
    const map = mapInstance.current;
    if (!map) return;

    const render = () => {
      if (!map) return;
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

        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#020617",
            "line-width": 8,
            "line-opacity": 0.95,
          },
        });

        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#aff33e",
            "line-width": 5,
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

  // Rendu du tracé en direct de la course du joueur (GeoJSON Lime Frost vert électrique)
  const renderWorkoutTrackOnMap = useCallback((coords: [number, number][]) => {
    const map = mapInstance.current;
    if (!map) return;

    const render = () => {
      if (!map) return;
      const geojsonData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coords.length > 1 ? coords : [],
        },
      };

      const existingSource = map.getSource("workout-live-source") as
        mapboxgl.GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(geojsonData);
      } else {
        map.addSource("workout-live-source", {
          type: "geojson",
          data: geojsonData,
        });

        // Casing sombre
        map.addLayer({
          id: "workout-live-casing",
          type: "line",
          source: "workout-live-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#020617",
            "line-width": 8,
            "line-opacity": 0.95,
          },
        });

        // Tracé principal Lime Frost
        map.addLayer({
          id: "workout-live-line",
          type: "line",
          source: "workout-live-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#aff33e",
            "line-width": 4.5,
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

  // Initialisation de Mapbox GL
  useEffect(() => {
    if (!mapContainer.current) return;

    if (token) {
      mapboxgl.accessToken = token;
    }

    const initialStyle = getStyleForTheme(activeTheme);
    const initialCenter =
      workout.metrics.currentPosition?.coords || DEFAULT_MAP_CENTER;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: initialCenter,
      zoom: 15,
      fadeDuration: 0,
      attributionControl: false,
    });

    mapInstance.current = map;

    // Si l'utilisateur manipule manuellement la carte, désactiver le suivi automatique
    map.on("dragstart", () => {
      setIsTrackingUser(false);
    });

    // Rechargement des sources de tracés lors d'un changement de style
    map.on("style.load", () => {
      setLoadError(null);
      if (currentCoordsRef.current.length > 0) {
        renderRouteOnMap(currentCoordsRef.current);
      }
      if (workout.metrics.trackCoordinates.length > 0) {
        renderWorkoutTrackOnMap(workout.metrics.trackCoordinates);
      }
    });

    map.on("load", () => {
      setLoadError(null);
      map.resize();
    });

    map.on("error", (e) => {
      console.warn("Mapbox error:", e);
      const errMsg = e.error?.message || "";
      if (
        errMsg.includes("401") ||
        errMsg.includes("403") ||
        errMsg.includes("Unauthorized") ||
        errMsg.includes("Forbidden") ||
        errMsg.includes("access token")
      ) {
        setLoadError("Mode carte libre actif (CARTO / OpenStreetMap).");
        setTimeout(() => setLoadError(null), 4500);
        const fallback =
          FALLBACK_STYLES[activeThemeRef.current] || FALLBACK_STYLES.outdoors;
        map.setStyle(fallback);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      if (workoutPlayerMarkerRef.current) {
        workoutPlayerMarkerRef.current.remove();
        workoutPlayerMarkerRef.current = null;
      }
      if (poiMarkerRef.current) {
        poiMarkerRef.current.remove();
        poiMarkerRef.current = null;
      }
      if (questDestinationMarkerRef.current) {
        questDestinationMarkerRef.current.remove();
        questDestinationMarkerRef.current = null;
      }
      map.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, getStyleForTheme]);

  // Centrage automatique initial et suivi en direct
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !workout.metrics.currentPosition) return;

    const coords = workout.metrics.currentPosition.coords;

    if (!hasInitialCenteredRef.current) {
      hasInitialCenteredRef.current = true;
      map.flyTo({
        center: coords,
        zoom: 15.5,
        duration: 1200,
      });
    } else if (isTrackingUser && workout.metrics.status === "recording") {
      map.easeTo({
        center: coords,
        duration: 600,
      });
    }
  }, [workout.metrics.currentPosition, isTrackingUser, workout.metrics.status]);

  // Mise à jour du tracé de course en direct sur la carte
  useEffect(() => {
    if (workout.metrics.trackCoordinates.length > 0) {
      renderWorkoutTrackOnMap(workout.metrics.trackCoordinates);
    }
  }, [workout.metrics.trackCoordinates, renderWorkoutTrackOnMap]);

  // Pastille du joueur animée en direct sur la carte
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const currentPos = workout.metrics.currentPosition;
    if (!currentPos) {
      if (workoutPlayerMarkerRef.current) {
        workoutPlayerMarkerRef.current.remove();
        workoutPlayerMarkerRef.current = null;
      }
      return;
    }

    if (!workoutPlayerMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "workout-player-marker";
      el.innerHTML =
        '<div class="workout-marker-pulse"></div><div class="workout-marker-dot"></div>';
      workoutPlayerMarkerRef.current = new mapboxgl.Marker({
        element: el,
        rotationAlignment: "map",
      })
        .setLngLat(currentPos.coords)
        .addTo(map);
    } else {
      workoutPlayerMarkerRef.current.setLngLat(currentPos.coords);
      if (typeof currentPos.heading === "number") {
        workoutPlayerMarkerRef.current.setRotation(currentPos.heading);
      }
    }
  }, [workout.metrics.currentPosition]);

  // Bouton "Me localiser / Suivre"
  const handleLocateMe = () => {
    setIsTrackingUser(true);
    if (workout.metrics.currentPosition && mapInstance.current) {
      mapInstance.current.flyTo({
        center: workout.metrics.currentPosition.coords,
        zoom: 15.5,
        duration: 800,
      });
    }
  };

  const handleClearPoi = () => {
    setSelectedPoi(null);
    if (poiMarkerRef.current) {
      poiMarkerRef.current.remove();
      poiMarkerRef.current = null;
    }
  };

  // Acceptation d'une quête générée
  const handleAcceptQuest = (quest: GeneratedQuest) => {
    setActiveQuest(quest);
    currentCoordsRef.current = quest.route.coordinates;

    if (mapInstance.current) {
      const map = mapInstance.current;
      renderRouteOnMap(quest.route.coordinates);

      if (quest.route.coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds(
          quest.route.coordinates[0],
          quest.route.coordinates[0],
        );
        for (const coord of quest.route.coordinates) {
          bounds.extend(coord);
        }
        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 200, left: 50, right: 50 },
          maxZoom: 16,
          duration: 1200,
        });
      }

      // Marqueur objectif POI de quête
      if (quest.type === "poi") {
        if (questDestinationMarkerRef.current) {
          questDestinationMarkerRef.current.remove();
        }
        const el = createQuestMarkerElement(quest.title);
        questDestinationMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat(quest.destination)
          .addTo(map);
      }
    }
  };

  // Génération rapide de quête sur commande depuis le panel Admin
  const [isGeneratingAdminQuest, setIsGeneratingAdminQuest] = useState(false);

  const handleAdminGenerateQuest = async (
    type: "loop" | "poi",
    distanceKm: number,
  ) => {
    setIsGeneratingAdminQuest(true);
    try {
      // 1. Suppression du chemin et de la quête précédente
      if (questDestinationMarkerRef.current) {
        questDestinationMarkerRef.current.remove();
        questDestinationMarkerRef.current = null;
      }
      if (mapInstance.current) {
        const source = mapInstance.current.getSource("route-source") as
          mapboxgl.GeoJSONSource | undefined;
        if (source) {
          source.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          });
        }
      }
      setActiveQuest(null);
      currentCoordsRef.current = [];
      workout.resetWorkout();

      // 2. Origine de départ : position du joueur (réelle ou simulée)
      const origin =
        workout.metrics.currentPosition?.coords || DEFAULT_MAP_CENTER;

      // 3. Génération procédurale
      const newQuest = await generateRandomQuest({
        userLocation: origin,
        preferredType: type,
        targetDistanceKm: distanceKm,
        mapboxToken: token,
        mapInstance: mapInstance.current,
      });

      // 4. Lancement direct
      handleAcceptQuest(newQuest);
    } catch (err) {
      console.error("Erreur génération quête admin :", err);
    } finally {
      setIsGeneratingAdminQuest(false);
    }
  };

  const handleAdminClearQuest = () => {
    if (questDestinationMarkerRef.current) {
      questDestinationMarkerRef.current.remove();
      questDestinationMarkerRef.current = null;
    }
    if (mapInstance.current) {
      const source = mapInstance.current.getSource("route-source") as
        mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        });
      }
    }
    setActiveQuest(null);
    currentCoordsRef.current = [];
    workout.resetWorkout();
  };

  return (
    <IonPage>
      <IonContent fullscreen className="map-page-content">
        <div className="map-shell">
          {/* Conteneur Plein Écran de la Carte Mapbox */}
          <div ref={mapContainer} className="map-mapbox-container" />

          {/* Barre Supérieure Épurée : Sélecteur Statistiques / Carte */}
          <div className="map-unified-header">
            <div className="map-workout-segment-bar" role="tablist">
              <button
                type="button"
                className={`map-workout-segment-btn ${workoutSegment === "stats" ? "is-active" : ""}`}
                onClick={() => setWorkoutSegment("stats")}
              >
                Statistiques
              </button>
              <button
                type="button"
                className={`map-workout-segment-btn ${workoutSegment === "map" ? "is-active" : ""}`}
                onClick={() => setWorkoutSegment("map")}
              >
                Carte GPS
              </button>
            </div>
          </div>

          {/* Fiche Point d'Intérêt sélectionné */}
          {selectedPoi && workoutSegment === "map" && (
            <div className="map-selected-poi-banner">
              <div className="selected-poi-text">
                <span className="selected-poi-badge">📍 Point d'intérêt</span>
                <strong>{selectedPoi.name}</strong>
                {selectedPoi.placeName && <span>{selectedPoi.placeName}</span>}
              </div>
              <button
                type="button"
                className="clear-pill-btn"
                onClick={handleClearPoi}
                title="Fermer"
              >
                <IonIcon icon={closeCircleOutline} />
              </button>
            </div>
          )}

          {/* Écran Plein Format Statistiques */}
          {workoutSegment === "stats" && (
            <div className="sq-workout-stats-screen">
              <div className="sq-workout-stats-header">
                <span className="sq-workout-activity-label">Course à pied</span>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  {workout.metrics.status === "recording" && (
                    <span
                      className={`sq-gps-quality-badge quality-${workout.metrics.gpsQuality}`}
                      title={
                        workout.metrics.currentPosition
                          ? `Précision GPS : ${Math.round(workout.metrics.currentPosition.accuracy)} m`
                          : "Recherche du signal GPS..."
                      }
                    >
                      <span className="sq-gps-dot-indicator" />
                      {workout.metrics.gpsQuality === "optimal"
                        ? "GPS Optimal"
                        : "GPS Faible"}
                    </span>
                  )}
                  <span
                    className={`sq-workout-status-badge ${
                      workout.metrics.status === "recording"
                        ? "status-recording"
                        : workout.metrics.status === "paused"
                          ? "status-paused"
                          : "status-idle"
                    }`}
                  >
                    {workout.metrics.status === "recording"
                      ? "En cours"
                      : workout.metrics.status === "paused"
                        ? "En pause"
                        : "Prêt"}
                  </span>
                </div>
              </div>

              <div className="sq-workout-realtime-pace">
                <span className="sq-workout-pace-label">Rythme réel</span>
                <div className="sq-workout-pace-value sq-tabular">
                  {workout.metrics.status !== "idle"
                    ? workout.metrics.paceMinPerKm
                    : "--:--"}
                </div>
                <span className="sq-workout-pace-unit">
                  {getLivePaceCaption(workout.metrics.paceState)}
                </span>
              </div>

              <div className="sq-workout-stats-grid">
                <div className="sq-card sq-workout-stat-card">
                  <span className="sq-workout-stat-val sq-tabular">
                    {workout.metrics.status !== "idle"
                      ? workout.metrics.distanceKm.toFixed(2).replace(".", ",")
                      : "0,00"}{" "}
                    km
                  </span>
                  <span className="sq-workout-stat-lbl">Distance</span>
                </div>
                <div className="sq-card sq-workout-stat-card">
                  <span className="sq-workout-stat-val sq-tabular">
                    {workout.metrics.status !== "idle"
                      ? formatDuration(workout.metrics.elapsedSeconds)
                      : "00:00"}
                  </span>
                  <span className="sq-workout-stat-lbl">Temps</span>
                </div>
                <div className="sq-card sq-workout-stat-card">
                  <span className="sq-workout-stat-val sq-tabular">
                    {workout.metrics.status !== "idle"
                      ? workout.metrics.elevationGainMeters
                      : 0}{" "}
                    m
                  </span>
                  <span className="sq-workout-stat-lbl">Dénivelé</span>
                </div>
                <div className="sq-card sq-workout-stat-card">
                  <span className="sq-workout-stat-val sq-tabular">
                    +
                    {workout.metrics.status !== "idle"
                      ? workout.metrics.xpEarned
                      : 0}
                  </span>
                  <span className="sq-workout-stat-lbl">Points gagnés</span>
                </div>
              </div>

              <div className="sq-workout-actions-row">
                {workout.metrics.status === "idle" ? (
                  <button
                    type="button"
                    className="sq-button-primary sq-workout-action-btn"
                    onClick={workout.startWorkout}
                    style={{ flex: 1 }}
                  >
                    Démarrer la course
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="sq-button-secondary sq-workout-action-btn"
                      onClick={
                        workout.metrics.status === "paused"
                          ? workout.resumeWorkout
                          : workout.pauseWorkout
                      }
                    >
                      {workout.metrics.status === "paused"
                        ? "Reprendre"
                        : "Pause"}
                    </button>
                    <button
                      type="button"
                      className="sq-button-primary sq-workout-action-btn"
                      onClick={() => {
                        workout.finishWorkout();
                        setWorkoutFinishedModal(true);
                      }}
                    >
                      Terminer
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Suivi HUD de Quête Active Unifié */}
          {activeQuest && (
            <QuestRunHud
              key={activeQuest.id}
              quest={activeQuest}
              map={mapInstance.current}
              currentPosition={workout.metrics.currentPosition}
              simulating={workout.metrics.simulating}
              showDebugConsole={false}
              onFinish={() => {
                setActiveQuest(null);
                if (questDestinationMarkerRef.current) {
                  questDestinationMarkerRef.current.remove();
                  questDestinationMarkerRef.current = null;
                }
              }}
            />
          )}

          {/* Panneau Admin & Debug Télémétrie Unique */}
          {showAdminPanel && (
            <div className="map-admin-panel-overlay">
              <GeolocationDebugConsole
                position={workout.metrics.currentPosition}
                status={workout.metrics.gpsStatus}
                error={workout.metrics.gpsError}
                simulating={workout.metrics.simulating}
                onToggleSimulation={workout.toggleSimulation}
                workoutMetrics={workout.metrics}
                activeQuest={activeQuest}
                onGenerateQuest={handleAdminGenerateQuest}
                onClearQuest={handleAdminClearQuest}
                isGeneratingQuest={isGeneratingAdminQuest}
                onClose={() => setShowAdminPanel(false)}
                defaultExpanded={true}
              />
            </div>
          )}

          {/* Actions Flottantes Latérales Essentielles */}
          <div
            className={`map-floating-actions ${
              workoutSegment === "map" ? "with-live-hud" : ""
            }`}
          >
            {import.meta.env.DEV && (
              <button
                type="button"
                className={`fab-action-btn admin-btn ${showAdminPanel ? "is-active" : ""}`}
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                title="Panneau Admin Télémétrie & Simulation"
                aria-label="Admin panel"
              >
                <IonIcon icon={buildOutline} />
              </button>
            )}

            <button
              type="button"
              className={`fab-action-btn locate-btn ${isTrackingUser ? "is-active" : ""}`}
              onClick={handleLocateMe}
              title={
                isTrackingUser
                  ? "Suivi GPS actif"
                  : "Recentrer et suivre ma position"
              }
            >
              <IonIcon icon={locateOutline} />
            </button>
          </div>

          {/* HUD d'enregistrement Live sur Carte */}
          {workoutSegment === "map" && (
            <div
              className="map-workout-live-hud"
              aria-label="Données d'enregistrement"
            >
              <div className="map-workout-live-metrics">
                <LivePaceMetric
                  state={workout.metrics.paceState}
                  paceMinPerKm={workout.metrics.paceMinPerKm}
                />

                <div className="live-metric-item">
                  <span className="live-metric-val sq-tabular">
                    {workout.metrics.status !== "idle"
                      ? workout.metrics.distanceKm.toFixed(2).replace(".", ",")
                      : "0,00"}{" "}
                    km
                  </span>
                  <span className="live-metric-lbl">Distance</span>
                </div>

                <div className="live-metric-item">
                  <span className="live-metric-val sq-tabular">
                    {workout.metrics.status !== "idle"
                      ? formatDuration(workout.metrics.elapsedSeconds)
                      : "00:00"}
                  </span>
                  <span className="live-metric-lbl">Temps</span>
                </div>
              </div>

              <div className="map-workout-live-actions">
                {workout.metrics.status === "idle" ? (
                  <button
                    type="button"
                    className="sq-button-primary live-action-btn"
                    onClick={workout.startWorkout}
                    style={{ flex: 1 }}
                  >
                    Démarrer
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="sq-button-secondary live-action-btn"
                      onClick={
                        workout.metrics.status === "paused"
                          ? workout.resumeWorkout
                          : workout.pauseWorkout
                      }
                    >
                      {workout.metrics.status === "paused"
                        ? "Reprendre"
                        : "Pause"}
                    </button>
                    <button
                      type="button"
                      className="sq-button-primary live-action-btn"
                      onClick={() => {
                        workout.finishWorkout();
                        setWorkoutFinishedModal(true);
                      }}
                    >
                      Terminer
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Notification d'information temporaire */}
          {loadError && (
            <div
              className="mapbox-error-pill"
              onClick={() => setLoadError(null)}
              role="button"
              tabIndex={0}
              style={{
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>ℹ️ {loadError}</span>
              <span style={{ marginLeft: 8, opacity: 0.7 }}>✕</span>
            </div>
          )}
        </div>

        <IonAlert
          isOpen={workoutFinishedModal}
          onDidDismiss={() => {
            setWorkoutFinishedModal(false);
          }}
          header="Sortie terminée !"
          subHeader={`${workout.metrics.distanceKm.toFixed(2)} km parcourus • +${workout.metrics.xpEarned} XP`}
          message={`Temps total : ${formatDuration(workout.metrics.elapsedSeconds)} • Allure : ${workout.metrics.paceMinPerKm} min/km • Dénivelé : +${workout.metrics.elevationGainMeters} m.`}
          buttons={[
            {
              text: "Annuler",
              role: "cancel",
              handler: () => {
                setWorkoutSegment("map");
                workout.resetWorkout();
              },
            },
            {
              text: "Enregistrer l'activité",
              handler: () => {
                handleSaveWorkout();
              },
            },
          ]}
        />

        <IonToast
          isOpen={Boolean(toastMessage)}
          message={toastMessage || ""}
          duration={4000}
          onDidDismiss={() => setToastMessage(null)}
          position="bottom"
          color="dark"
        />

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
          userLocation={
            workout.metrics.currentPosition
              ? workout.metrics.currentPosition.coords
              : DEFAULT_MAP_CENTER
          }
          currentMode="pedestrian"
          mapboxToken={token}
          mapInstance={mapInstance.current}
          onAcceptQuest={handleAcceptQuest}
        />
      </IonContent>
    </IonPage>
  );
};

export default MapPage;
