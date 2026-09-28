import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewDidEnter,
} from "@ionic/react";
import { arrowBackOutline, informationCircleOutline, locateOutline, refreshOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import mapmetricsgl, { StyleSpecification } from "@mapmetrics/mapmetrics-gl";
import "@mapmetrics/mapmetrics-gl/dist/mapmetrics-gl.css";
import { createMapAtlasStyle } from "../config/mapatlasStyle";
import "./Map.css";

const defaultCenter: [number, number] = [2.3522, 48.8566]; // Paris [lng, lat]

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapmetricsgl.Map | null>(null);
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

  useEffect(() => {
    if (!mapContainer.current) return;

    let style: string | StyleSpecification;

    if (customStyleUrl) {
      style = customStyleUrl;
    } else if (apiKey) {
      // Build the MapAtlas style dynamically using the user's API token
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
        console.warn("Erreur lors de la configuration de la session MapAtlas :", err);
      }
    }

    const map = new mapmetricsgl.Map({
      container: mapContainer.current,
      style,
      center: defaultCenter,
      zoom: 13,
    });

    mapInstance.current = map;

    // Listen to load and error events
    map.on("load", () => {
      setLoadError(null);
      map.resize();
    });

    map.on("error", (e) => {
      console.error("MapAtlas event error:", e);
      const errMsg = e.error?.message || "";
      if (errMsg.includes("404") || errMsg.includes("Failed to fetch") || errMsg.includes("Unauthorized")) {
        setLoadError(
          "Impossible de charger le style MapAtlas. Vérifiez que votre style existe sur le portail MapAtlas (portal.mapmetrics.org) ou collez l'URL complète dans VITE_MAPATLAS_STYLE_URL."
        );
      }
    });

    // Controls
    map.addControl(new mapmetricsgl.NavigationControl(), "top-right");
    map.addControl(
      new mapmetricsgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );

    // Initial marker & popup
    const popup = new mapmetricsgl.Popup({ offset: 25 }).setHTML(`
      <div class="map-popup-card">
        <h3>Quête en cours</h3>
        <p>Départ : Paris Centre</p>
        <span class="badge">Niveau 1</span>
      </div>
    `);

    const marker = new mapmetricsgl.Marker({ color: "#3880ff" })
      .setLngLat(defaultCenter)
      .setPopup(popup)
      .addTo(map);

    // Watch container size changes
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      marker.remove();
      map.remove();
      mapInstance.current = null;
    };
  }, [apiKey, customStyleUrl, gatewayOrigin]);

  const handleRecenter = () => {
    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center: defaultCenter,
        zoom: 13,
        essential: true,
      });
    }
  };

  const handleFallbackDemo = () => {
    if (mapInstance.current) {
      mapInstance.current.setStyle("https://demotiles.maplibre.org/style.json");
      setLoadError(null);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton routerLink="/" routerDirection="back">
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Carte RPG - Stride Quest</IonTitle>
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

          <div className="map-floating-actions">
            <IonButton shape="round" className="recenter-btn" onClick={handleRecenter}>
              <IonIcon slot="icon-only" icon={locateOutline} />
            </IonButton>
          </div>
        </div>

        <IonAlert
          isOpen={showConfigNotice}
          onDidDismiss={() => setShowConfigNotice(false)}
          header="Configuration MapAtlas Platform"
          subHeader={isConfigured ? "Configuration détectée" : "Clé API absente"}
          message={
            isConfigured
              ? "Si la carte reste vide, assurez-vous d'avoir créé et enregistré un style sur portal.mapmetrics.org dans l'onglet 'Studio / Map Styles', puis copiez l'URL complète dans VITE_MAPATLAS_STYLE_URL."
              : "Ajoutez VITE_MAPATLAS_API_KEY ou VITE_MAPATLAS_STYLE_URL dans votre fichier mobile-ionic/.env pour charger votre carte."
          }
          buttons={["OK"]}
        />
      </IonContent>
    </IonPage>
  );
};

export default MapPage;
