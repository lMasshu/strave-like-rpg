import { useEffect, useRef } from "react";
import { IonAlert, IonIcon } from "@ionic/react";
import { flagOutline, timeOutline } from "ionicons/icons";
import { Haptics, NotificationType } from "@capacitor/haptics";
import mapboxgl from "mapbox-gl";
import type { GeneratedQuest } from "../services/questGenerator";
import { useQuestRun } from "../hooks/useQuestRun";
import type { TrackedPosition } from "../hooks/useGeolocationTracker";
import GeolocationDebugConsole from "./GeolocationDebugConsole";
import "./QuestRunHud.css";

interface QuestRunHudProps {
  quest: GeneratedQuest;
  map?: mapboxgl.Map | null;
  onFinish: () => void;
  currentPosition?: TrackedPosition | null;
  simulating?: boolean;
  showDebugConsole?: boolean;
  debugDefaultExpanded?: boolean;
}

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }

  return `${Math.round(meters)} m`;
}

const QuestRunHud: React.FC<QuestRunHudProps> = ({
  quest,
  map = null,
  onFinish,
  currentPosition,
  simulating = false,
  showDebugConsole = false,
  debugDefaultExpanded = true,
}) => {
  const {
    state,
    position,
    gpsStatus,
    gpsError,
    simulating: isSimulating,
  } = useQuestRun(quest, currentPosition, simulating);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Marqueur autonome si map est fourni directement (ex: tests ou mode isolé)
  useEffect(() => {
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map || !position) return;

    if (!userMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "quest-user-dot";

      userMarkerRef.current = new mapboxgl.Marker({ element })
        .setLngLat(position.coords)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(position.coords);
    }
  }, [map, position]);

  // Retour haptique à la fin de la quête
  useEffect(() => {
    if (state.status === "running") return;

    const type =
      state.status === "success"
        ? NotificationType.Success
        : NotificationType.Error;

    Haptics.notification({ type }).catch(() => undefined);
  }, [state.status]);

  const isUrgent = state.remainingSeconds <= 60;

  const gpsMessage = (() => {
    if (isSimulating) return "Marche simulée (Admin)";
    if (gpsStatus === "denied") return gpsError ?? "Localisation refusée";
    if (gpsStatus === "waiting") return "Recherche du signal GPS…";
    if (gpsError) return gpsError;
    if (state.remainingMeters === null) return "En attente d'une position…";

    return null;
  })();

  return (
    <>
      <div className="quest-run-hud-container">
        <div className="quest-run-hud">
          <div className="quest-run-stat">
            <IonIcon icon={timeOutline} />
            <span
              className={
                isUrgent ? "quest-run-value urgent" : "quest-run-value"
              }
            >
              {formatTime(state.remainingSeconds)}
            </span>
            <small>Temps restant</small>
          </div>

          <div className="quest-run-stat">
            <IonIcon icon={flagOutline} />
            <span className="quest-run-value">
              {state.remainingMeters === null
                ? "--"
                : formatDistance(state.remainingMeters)}
            </span>
            <small>
              Point{" "}
              {Math.min(state.checkpointIndex + 1, state.totalCheckpoints)}/
              {state.totalCheckpoints}
            </small>
          </div>

          {gpsMessage && <p className="quest-run-message">{gpsMessage}</p>}
        </div>

        {showDebugConsole && (
          <GeolocationDebugConsole
            position={position}
            status={gpsStatus}
            error={gpsError}
            simulating={isSimulating}
            defaultExpanded={debugDefaultExpanded}
          />
        )}
      </div>

      <IonAlert
        isOpen={state.status !== "running"}
        header={
          state.status === "success" ? "Quête réussie !" : "Quête échouée"
        }
        message={
          state.status === "success"
            ? `Bravo, vous avez terminé « ${quest.title} » à temps. Récompense : +${quest.xpReward} XP.`
            : `Le temps est écoulé avant la fin de « ${quest.title} ». Retentez une autre quête !`
        }
        buttons={[{ text: "OK", role: "confirm" }]}
        onDidDismiss={onFinish}
      />
    </>
  );
};

export default QuestRunHud;
