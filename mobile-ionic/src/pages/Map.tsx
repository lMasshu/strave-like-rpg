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
type MapTheme = "mapatlas" | "dark" | "osm";

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapmetricsgl.Map | null>(null);
  const markerARef = useRef<mapmetricsgl.Marker | null>(null);
  const markerBRef = useRef<mapmetricsgl.Marker | null>(null);
  const currentCoordsRef = useRef<[number, number][]>([]);

  const [pointA, setPointA] = useState<[number, number]>(INITIAL_POINT_A);
  const [pointB, setPointB] = useState<[number, number]>(INITIAL_POINT_B);
  const [mode, setMode] = useState<TransportMode>("pedestrian");
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<"A" | "B" | null>(null);

  // Ergonomie & Visibilité
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [hideUiForImmersion, setHideUiForImmersion] = useState(false);
  const [activeTheme, setActiveTheme] = useState<MapTheme>("mapatlas");
  const [showStyleMenu, setShowStyleMenu] = useState(false);

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

  // Ajustement automatique de la vue pour cadrer le tracé
  const fitRouteBounds = useCallback((coords: [number, number][]) => {
    const map = mapInstance.current;
    if (!map || coords.length === 0) return;

    const bounds = new mapmetricsgl.LngLatBounds(coords[0], coords[coords.length - 1]);
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
    if (!map || !map.isStyleLoaded()) return;

    currentCoordsRef.current = coords;

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
  }, []);

  // Recalcul de l'itinéraire
  const updateRoute = useCallback(
    async (start: [number, number], end: [number, number], transport: TransportMode, autoZoom = true) => {
      setLoadingRoute(true);
      try {
        const result = await fetchRoute(start, end, {
          apiKey,
          gatewayOrigin,
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
    [apiKey, gatewayOrigin, renderRouteOnMap, fitRouteBounds]
  );

  // Résolution du style en fonction du thème sélectionné
  const getStyleForTheme = useCallback(
    (theme: MapTheme): string | StyleSpecification => {
      if (theme === "mapatlas") {
        if (customStyleUrl) return customStyleUrl;
        if (apiKey) return createMapAtlasStyle(apiKey);
        return "https://demotiles.maplibre.org/style.json";
      } else if (theme === "dark") {
        return "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
      } else {
        return "https://demotiles.maplibre.org/style.json";
      }
    },
    [apiKey, customStyleUrl]
  );

  // Initialisation de la carte
  useEffect(() => {
    if (!mapContainer.current) return;

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

    const initialStyle = getStyleForTheme(activeTheme);

    const map = new mapmetricsgl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: INITIAL_POINT_A,
      zoom: 14,
    });

    mapInstance.current = map;

    // Création de marqueurs 3D avec pointeurs et halo pulsant
    const elA = document.createElement("div");
    elA.className = "pin-marker-wrapper";
    elA.innerHTML = `
      <div class="pin-marker-head marker-a">
        <span>A</span>
      </div>
      <div class="pin-marker-pulse pulse-a"></div>
    `;

    const elB = document.createElement("div");
    elB.className = "pin-marker-wrapper";
    elB.innerHTML = `
      <div class="pin-marker-head marker-b">
        <span>B</span>
      </div>
      <div class="pin-marker-pulse pulse-b"></div>
    `;

    const markerA = new mapmetricsgl.Marker({ element: elA, draggable: true })
      .setLngLat(INITIAL_POINT_A)
      .setPopup(
        new mapmetricsgl.Popup({ offset: 25 }).setHTML(
          `<div class="map-popup-card"><h3>Point A (Départ)</h3><p>Glissez pour déplacer</p></div>`
        )
      )
      .addTo(map);

    const markerB = new mapmetricsgl.Marker({ element: elB, draggable: true })
      .setLngLat(INITIAL_POINT_B)
      .setPopup(
        new mapmetricsgl.Popup({ offset: 25 }).setHTML(
          `<div class="map-popup-card"><h3>Point B (Objectif)</h3><p>Glissez pour déplacer</p></div>`
        )
      )
      .addTo(map);

    markerARef.current = markerA;
    markerBRef.current = markerB;

    // Drag & drop des marqueurs
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

    // Clic sur la carte
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
          markerB.setLngLat(clicked);
          setPointB(clicked);
          return null;
        }
      });
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
      updateRoute(INITIAL_POINT_A, INITIAL_POINT_B, mode, true);
    });

    map.on("error", (e) => {
      console.error("MapAtlas error:", e);
      const errMsg = e.error?.message || "";
      if (errMsg.includes("404") || errMsg.includes("Failed to fetch") || errMsg.includes("Unauthorized")) {
        setLoadError(
          "Impossible de charger le style MapAtlas. Vérifiez votre clé ou activez le fond alternatif."
        );
      }
    });

    // Contrôles de navigation discrets en haut à droite
    map.addControl(new mapmetricsgl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

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
  }, [apiKey, gatewayOrigin, getStyleForTheme]);

  // Recalcul lorsque pointA, pointB ou mode change
  useEffect(() => {
    if (mapInstance.current && mapInstance.current.isStyleLoaded()) {
      updateRoute(pointA, pointB, mode, false);
    }
  }, [pointA, pointB, mode, updateRoute]);

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
  };

  // Position GPS actuelle
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
          mapInstance.current.flyTo({ center: myCoords, zoom: 15 });
        }
      },
      (err) => {
        console.warn("Erreur géolocalisation :", err);
        alert("Impossible de récupérer votre position GPS.");
      },
      { enableHighAccuracy: true }
    );
  };

  const xpReward = routeInfo ? Math.round(routeInfo.distanceKm * 100) : 0;

  return (
    <IonPage>
      <IonHeader className={hideUiForImmersion ? "ion-hide" : ""}>
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
          {/* Conteneur Plein Écran de la Carte */}
          <div ref={mapContainer} className="mapatlas-map-container" />

          {/* Boutons d'Action Flottants Latéraux (Visibilité & Contrôle) */}
          <div className="map-side-controls">
            <IonButton
              shape="round"
              className="action-fab immersion-btn"
              onClick={() => setHideUiForImmersion(!hideUiForImmersion)}
              title={hideUiForImmersion ? "Afficher les menus" : "Mode plein écran carte"}
            >
              <IonIcon slot="icon-only" icon={hideUiForImmersion ? eyeOutline : eyeOffOutline} />
            </IonButton>

            <IonButton
              shape="round"
              className="action-fab style-btn"
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              title="Changer le style de carte"
            >
              <IonIcon slot="icon-only" icon={layersOutline} />
            </IonButton>

            <IonButton
              shape="round"
              className="action-fab fit-btn"
              onClick={handleFitRoute}
              title="Recentrer et zoomer sur tout le tracé"
            >
              <IonIcon slot="icon-only" icon={navigateOutline} />
            </IonButton>

            <IonButton
              shape="round"
              className="action-fab location-btn"
              onClick={handleUseMyLocation}
              title="Définir départ à ma position GPS"
            >
              <IonIcon slot="icon-only" icon={locateOutline} />
            </IonButton>
          </div>

          {/* Sélecteur de Thème de Carte Flottant */}
          {showStyleMenu && (
            <div className="map-theme-dropdown">
              <div className="theme-title">Style de la Carte</div>
              <button
                className={`theme-option ${activeTheme === "mapatlas" ? "active" : ""}`}
                onClick={() => handleSelectTheme("mapatlas")}
              >
                🗺️ MapAtlas Classique
              </button>
              <button
                className={`theme-option ${activeTheme === "dark" ? "active" : ""}`}
                onClick={() => handleSelectTheme("dark")}
              >
                🌙 Dark Quest (Contraste élevé)
              </button>
              <button
                className={`theme-option ${activeTheme === "osm" ? "active" : ""}`}
                onClick={() => handleSelectTheme("osm")}
              >
                🌍 OSM Standard
              </button>
            </div>
          )}

          {/* Panneau Bas Ergonomique (Bottom Sheet Rétractable) */}
          {!hideUiForImmersion && (
            <div className={`rpg-bottom-hud ${isHudCollapsed ? "collapsed" : ""}`}>
              {/* Poignée pour Réduire / Agrandir */}
              <div className="hud-drag-handle" onClick={() => setIsHudCollapsed(!isHudCollapsed)}>
                <IonIcon icon={isHudCollapsed ? chevronUpOutline : chevronDownOutline} />
                <span className="hud-summary-badge">
                  {routeInfo?.distanceKm ? `${routeInfo.distanceKm} km • ${routeInfo.durationMinutes} min` : "Tracé A ➔ B"}
                </span>
                <span className="hud-badge-xp">+{xpReward} XP</span>
              </div>

              {/* Contenu Développé */}
              {!isHudCollapsed && (
                <div className="hud-expanded-body">
                  <div className="rpg-points-summary">
                    <span
                      className={`point-tag tag-a ${selectionTarget === "A" ? "targeting" : ""}`}
                      onClick={() => setSelectionTarget(selectionTarget === "A" ? null : "A")}
                    >
                      <IonIcon icon={radioOutline} /> Départ (A) {selectionTarget === "A" && "🎯"}
                    </span>

                    <IonButton
                      fill="clear"
                      size="small"
                      className="swap-btn"
                      onClick={handleSwapPoints}
                      title="Inverser départ et arrivée"
                    >
                      <IonIcon icon={swapVerticalOutline} />
                    </IonButton>

                    <span
                      className={`point-tag tag-b ${selectionTarget === "B" ? "targeting" : ""}`}
                      onClick={() => setSelectionTarget(selectionTarget === "B" ? null : "B")}
                    >
                      <IonIcon icon={flagOutline} /> Objectif (B) {selectionTarget === "B" && "🎯"}
                    </span>
                  </div>

                  {/* Mode de Transport */}
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

                  {/* Chiffres Clés */}
                  <div className="rpg-stats-grid">
                    <div className="rpg-stat-item">
                      <span className="stat-label">Distance</span>
                      <span className="stat-value">
                        {loadingRoute ? <IonSpinner name="dots" /> : `${routeInfo?.distanceKm ?? "--"} km`}
                      </span>
                    </div>
                    <div className="rpg-stat-item">
                      <span className="stat-label">Durée</span>
                      <span className="stat-value">
                        {loadingRoute ? <IonSpinner name="dots" /> : `${routeInfo?.durationMinutes ?? "--"} min`}
                      </span>
                    </div>
                    <div className="rpg-stat-item xp-item">
                      <span className="stat-label">Récompense</span>
                      <span className="stat-value xp-value">+{xpReward} XP</span>
                    </div>
                  </div>

                  <div className="hud-tip">
                    {selectionTarget
                      ? `👉 Touchez la carte pour placer le Point ${selectionTarget}`
                      : "💡 Glissez les marqueurs A et B ou touchez la carte pour modifier l'itinéraire"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notification d'erreur discrète */}
          {loadError && (
            <div className="mapatlas-error-pill" onClick={() => handleSelectTheme("osm")}>
              <span>⚠️ Style vectoriel indisponible. Cliquez pour basculer sur le fond de secours.</span>
            </div>
          )}
        </div>

        <IonAlert
          isOpen={showConfigNotice}
          onDidDismiss={() => setShowConfigNotice(false)}
          header="Configuration & Visibilité MapAtlas"
          subHeader={isConfigured ? "Configuration active" : "Mode autonome"}
          message={
            "Le tracé haute visibilité est actif. Vous pouvez changer le style de fond de carte, recentrer sur le tracé ou masquer l'interface pour une visibilité maximale."
          }
          buttons={["OK"]}
        />
      </IonContent>
    </IonPage>
  );
};

export default MapPage;


