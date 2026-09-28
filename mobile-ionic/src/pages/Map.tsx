import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewDidEnter,
} from "@ionic/react";
import {
  arrowBackOutline,
  informationCircleOutline,
  locateOutline,
  refreshOutline,
  swapVerticalOutline,
  navigateOutline,
  walkOutline,
  bicycleOutline,
  carOutline,
  flagOutline,
  radioOutline,
} from "ionicons/icons";
import { useEffect, useRef, useState, useCallback } from "react";
import mapmetricsgl, { StyleSpecification } from "@mapmetrics/mapmetrics-gl";
import "@mapmetrics/mapmetrics-gl/dist/mapmetrics-gl.css";
import { createMapAtlasStyle } from "../config/mapatlasStyle";
import { fetchRoute, RouteResult } from "../services/mapatlasDirections";
import "./Map.css";

// Coordonnées par défaut : Paris Centre (Hôtel de Ville -> Musée du Louvre)
const INITIAL_POINT_A: [number, number] = [2.3522, 48.8566]; // [lng, lat]
const INITIAL_POINT_B: [number, number] = [2.3376, 48.8606]; // [lng, lat]

type TransportMode = "pedestrian" | "bicycle" | "auto";

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapmetricsgl.Map | null>(null);
  const markerARef = useRef<mapmetricsgl.Marker | null>(null);
  const markerBRef = useRef<mapmetricsgl.Marker | null>(null);

  const [pointA, setPointA] = useState<[number, number]>(INITIAL_POINT_A);
  const [pointB, setPointB] = useState<[number, number]>(INITIAL_POINT_B);
  const [mode, setMode] = useState<TransportMode>("pedestrian");
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<"A" | "B" | null>(null);

  const [showConfigNotice, setShowConfigNotice] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = (import.meta.env.VITE_MAPATLAS_API_KEY || import.meta.env.VITE_MAPMETRICS_API_KEY || "").trim();
  const customStyleUrl = (import.meta.env.VITE_MAPATLAS_STYLE_URL || "").trim();
  const gatewayOrigin = import.meta.env.VITE_MAPATLAS_GATEWAY_ORIGIN || "https://gateway.mapmetrics-atlas.net";

  const isConfigured = Boolean(apiKey || customStyleUrl);

  useIonViewDidEnter(() => {
    if (mapInstance.current) {
      mapInstance.current.resize();
    }
  });

  // Met à jour la ligne de tracé sur la carte
  const renderRouteOnMap = useCallback(
    (coords: [number, number][]) => {
      const map = mapInstance.current;
      if (!map || !map.isStyleLoaded()) return;

      const geojsonData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      };

      const existingSource = map.getSource("route-source") as mapmetricsgl.GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(geojsonData);
      } else {
        map.addSource("route-source", {
          type: "geojson",
          data: geojsonData,
        });

        // 1. Couche de halo lumineux (glow RPG)
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 10,
            "line-opacity": 0.4,
            "line-blur": 2,
          },
        });

        // 2. Couche principale du tracé (cyan vibrant)
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#00d2ff",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });
      }
    },
    []
  );

  // Recalcule le tracé entre Point A et Point B
  const updateRoute = useCallback(
    async (start: [number, number], end: [number, number], transport: TransportMode) => {
      setLoadingRoute(true);
      try {
        const result = await fetchRoute(start, end, {
          apiKey,
          gatewayOrigin,
          costing: transport,
        });

        setRouteInfo(result);
        renderRouteOnMap(result.coordinates);
      } catch (err) {
        console.error("Erreur de calcul du tracé :", err);
      } finally {
        setLoadingRoute(false);
      }
    },
    [apiKey, gatewayOrigin, renderRouteOnMap]
  );

  // Initialisation de la carte MapAtlas
  useEffect(() => {
    if (!mapContainer.current) return;

    let style: string | StyleSpecification;

    if (customStyleUrl) {
      style = customStyleUrl;
    } else if (apiKey) {
      style = createMapAtlasStyle(apiKey);
    } else {
      style = "https://demotiles.maplibre.org/style.json";
    }

    if (apiKey) {
      try {
        mapmetricsgl.configureMapSession({
          apiKey,
          gatewayOrigin,
        });
      } catch (err) {
        console.warn("Erreur configuration session MapAtlas :", err);
      }
    }

    const map = new mapmetricsgl.Map({
      container: mapContainer.current,
      style,
      center: INITIAL_POINT_A,
      zoom: 13,
    });

    mapInstance.current = map;

    // Création des marqueurs personnalisés A et B
    const elA = document.createElement("div");
    elA.className = "custom-route-marker marker-a";
    elA.innerHTML = `<span>A</span>`;

    const elB = document.createElement("div");
    elB.className = "custom-route-marker marker-b";
    elB.innerHTML = `<span>B</span>`;

    const markerA = new mapmetricsgl.Marker({ element: elA, draggable: true })
      .setLngLat(INITIAL_POINT_A)
      .setPopup(
        new mapmetricsgl.Popup({ offset: 20 }).setHTML(
          `<div class="map-popup-card"><h3>Point A (Départ)</h3><p>Faites glisser pour déplacer</p></div>`
        )
      )
      .addTo(map);

    const markerB = new mapmetricsgl.Marker({ element: elB, draggable: true })
      .setLngLat(INITIAL_POINT_B)
      .setPopup(
        new mapmetricsgl.Popup({ offset: 20 }).setHTML(
          `<div class="map-popup-card"><h3>Point B (Objectif)</h3><p>Faites glisser pour déplacer</p></div>`
        )
      )
      .addTo(map);

    markerARef.current = markerA;
    markerBRef.current = markerB;

    // Déplacement par drag & drop des marqueurs
    markerA.on("dragend", () => {
      const lngLat = markerA.getLngLat();
      const newA: [number, number] = [lngLat.lng, lngLat.lat];
      setPointA(newA);
    });

    markerB.on("dragend", () => {
      const lngLat = markerB.getLngLat();
      const newB: [number, number] = [lngLat.lng, lngLat.lat];
      setPointB(newB);
    });

    // Clic sur la carte pour définir Point A ou Point B
    map.on("click", (e) => {
      const clicked: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setSelectionTarget((currentTarget) => {
        if (currentTarget === "A") {
          markerA.setLngLat(clicked);
          setPointA(clicked);
          return null;
        } else if (currentTarget === "B") {
          markerB.setLngLat(clicked);
          setPointB(clicked);
          return null;
        } else {
          // Par défaut, un clic déplace l'objectif (Point B)
          markerB.setLngLat(clicked);
          setPointB(clicked);
          return null;
        }
      });
    });

    // Événement après chargement du style
    map.on("load", () => {
      setLoadError(null);
      map.resize();
      updateRoute(INITIAL_POINT_A, INITIAL_POINT_B, mode);
    });

    map.on("error", (e) => {
      console.error("MapAtlas error:", e);
      const errMsg = e.error?.message || "";
      if (errMsg.includes("404") || errMsg.includes("Failed to fetch") || errMsg.includes("Unauthorized")) {
        setLoadError(
          "Impossible de charger le style MapAtlas. Vérifiez que votre style existe sur portal.mapmetrics.org ou renseignez VITE_MAPATLAS_STYLE_URL."
        );
      }
    });

    // Contrôles MapAtlas
    map.addControl(new mapmetricsgl.NavigationControl(), "top-right");

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
  }, [apiKey, customStyleUrl, gatewayOrigin]);

  // Recalcul lorsque pointA, pointB ou mode change
  useEffect(() => {
    if (mapInstance.current && mapInstance.current.isStyleLoaded()) {
      updateRoute(pointA, pointB, mode);
    }
  }, [pointA, pointB, mode, updateRoute]);

  // Recentrer la vue sur l'ensemble du tracé
  const handleFitRoute = () => {
    const map = mapInstance.current;
    if (!map) return;

    const bounds = new mapmetricsgl.LngLatBounds(pointA, pointB);
    if (routeInfo?.coordinates) {
      for (const coord of routeInfo.coordinates) {
        bounds.extend(coord);
      }
    }

    map.fitBounds(bounds, {
      padding: { top: 120, bottom: 90, left: 60, right: 60 },
      maxZoom: 16,
      duration: 1000,
    });
  };

  // Inverser Point A et Point B
  const handleSwapPoints = () => {
    const newA = pointB;
    const newB = pointA;

    setPointA(newA);
    setPointB(newB);

    if (markerARef.current) markerARef.current.setLngLat(newA);
    if (markerBRef.current) markerBRef.current.setLngLat(newB);
  };

  // Définir le Point A à la position GPS actuelle
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myCoords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setPointA(myCoords);
        if (markerARef.current) markerARef.current.setLngLat(myCoords);
        if (mapInstance.current) {
          mapInstance.current.flyTo({ center: myCoords, zoom: 14 });
        }
      },
      (err) => {
        console.warn("Erreur géolocalisation :", err);
        alert("Impossible de récupérer votre position GPS.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleFallbackDemo = () => {
    if (mapInstance.current) {
      mapInstance.current.setStyle("https://demotiles.maplibre.org/style.json");
      setLoadError(null);
    }
  };

  // Calcul du gain d'XP RPG en fonction de la distance
  const xpReward = routeInfo ? Math.round(routeInfo.distanceKm * 100) : 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton routerLink="/" routerDirection="back">
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Tracé de Quête (A ➔ B)</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowConfigNotice(true)}>
              <IonIcon slot="icon-only" icon={informationCircleOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="map-page-content">
        <div className="map-shell">
          <div ref={mapContainer} className="mapatlas-map-container" />

          {/* Panneau HUD de Quête RPG (Infos de Tracé) */}
          <div className="rpg-route-hud">
            <div className="rpg-hud-header">
              <div className="rpg-points-summary">
                <span className="point-tag tag-a" onClick={() => setSelectionTarget(selectionTarget === "A" ? null : "A")}>
                  <IonIcon icon={radioOutline} /> Point A : Départ {selectionTarget === "A" && "(Cliquez carte)"}
                </span>
                <IonButton fill="clear" size="small" className="swap-btn" onClick={handleSwapPoints} title="Inverser A et B">
                  <IonIcon icon={swapVerticalOutline} />
                </IonButton>
                <span className="point-tag tag-b" onClick={() => setSelectionTarget(selectionTarget === "B" ? null : "B")}>
                  <IonIcon icon={flagOutline} /> Point B : Objectif {selectionTarget === "B" && "(Cliquez carte)"}
                </span>
              </div>
            </div>

            {/* Sélecteur de mode de transport */}
            <div className="rpg-mode-selector">
              <IonSegment value={mode} onIonChange={(e) => setMode(e.detail.value as TransportMode)}>
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

            {/* Statistiques du tracé */}
            <div className="rpg-stats-grid">
              <div className="rpg-stat-item">
                <span className="stat-label">Distance</span>
                <span className="stat-value">
                  {loadingRoute ? <IonSpinner name="dots" /> : `${routeInfo?.distanceKm ?? "--"} km`}
                </span>
              </div>
              <div className="rpg-stat-item">
                <span className="stat-label">Temps estimé</span>
                <span className="stat-value">
                  {loadingRoute ? <IonSpinner name="dots" /> : `${routeInfo?.durationMinutes ?? "--"} min`}
                </span>
              </div>
              <div className="rpg-stat-item xp-item">
                <span className="stat-label">Récompense</span>
                <span className="stat-value xp-value">+{xpReward} XP</span>
              </div>
            </div>

            <div className="rpg-hud-footer">
              <span className="hud-tip">
                {selectionTarget
                  ? `👉 Cliquez sur la carte pour placer le Point ${selectionTarget}`
                  : "💡 Glissez les marqueurs A/B ou cliquez sur la carte pour modifier le tracé"}
              </span>
            </div>
          </div>

          {loadError && (
            <div className="mapatlas-error-card">
              <p>⚠️ {loadError}</p>
              <IonButton size="small" fill="outline" color="light" onClick={handleFallbackDemo}>
                <IonIcon slot="start" icon={refreshOutline} />
                Afficher le fond démo
              </IonButton>
            </div>
          )}

          {!isConfigured && !loadError && (
            <div className="mapatlas-config-banner" onClick={() => setShowConfigNotice(true)}>
              <span>⚠️ MapAtlas : aucune clé détectée. Cliquez pour configurer le .env</span>
            </div>
          )}

          {/* Boutons d'action flottants */}
          <div className="map-floating-actions">
            <IonButton shape="round" className="action-fab fit-btn" onClick={handleFitRoute} title="Ajuster sur le tracé">
              <IonIcon slot="icon-only" icon={navigateOutline} />
            </IonButton>
            <IonButton shape="round" className="action-fab location-btn" onClick={handleUseMyLocation} title="Départ à ma position">
              <IonIcon slot="icon-only" icon={locateOutline} />
            </IonButton>
          </div>
        </div>

        <IonAlert
          isOpen={showConfigNotice}
          onDidDismiss={() => setShowConfigNotice(false)}
          header="Configuration MapAtlas Platform"
          subHeader={isConfigured ? "Configuration active" : "Clé API absente"}
          message={
            isConfigured
              ? "Le tracé d'itinéraire entre le Point A et le Point B utilise la plateforme MapAtlas avec adaptation automatique selon les autorisations de votre clé API."
              : "Ajoutez VITE_MAPATLAS_API_KEY dans votre fichier mobile-ionic/.env pour charger votre carte MapAtlas."
          }
          buttons={["OK"]}
        />
      </IonContent>
    </IonPage>
  );
};

export default MapPage;

