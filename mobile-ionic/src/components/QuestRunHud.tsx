import { useEffect } from "react";
import { IonAlert, IonIcon } from "@ionic/react";
import {
  flagOutline,
  playOutline,
  stopOutline,
  timeOutline,
} from "ionicons/icons";
import { Haptics, NotificationType } from "@capacitor/haptics";
import mapboxgl from "mapbox-gl";
import type { GeneratedQuest } from "../services/questGenerator";
import { GPS_SIMULATION_AVAILABLE, useQuestRun } from "../hooks/useQuestRun";
import "./QuestRunHud.css";

interface QuestRunHudProps {
  quest: GeneratedQuest;
  map: mapboxgl.Map | null;
  onFinish: () => void;
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

const QuestRunHud: React.FC<QuestRunHudProps> = ({ quest, map, onFinish }) => {
  const { state, position, gpsStatus, gpsError, simulating, toggleSimulation } =
    useQuestRun(quest);

  // Pastille bleue de la position du joueur sur la carte
  useEffect(() => {
    if (!map || !position) return;

    const element = document.createElement("div");
    element.className = "quest-user-dot";

    const marker = new mapboxgl.Marker({ element })
      .setLngLat(position.coords)
      .addTo(map);

    return () => {
      marker.remove();
    };
  }, [map, position]);

  // Retour haptique à la fin de la quête (ignoré si indisponible)
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
    if (simulating) return "Marche simulée";
    if (gpsStatus === "denied") return gpsError ?? "Localisation refusée";
    if (gpsStatus === "waiting") return "Recherche du signal GPS…";
    if (gpsError) return gpsError;
    if (state.remainingMeters === null) return "En attente d'une position…";

    return null;
  })();

  return (
    <>
      <div className="quest-run-hud">
        <div className="quest-run-stat">
          <IonIcon icon={timeOutline} />
          <span
            className={isUrgent ? "quest-run-value urgent" : "quest-run-value"}
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
            Point {Math.min(state.checkpointIndex + 1, state.totalCheckpoints)}/
            {state.totalCheckpoints}
          </small>
        </div>

        {GPS_SIMULATION_AVAILABLE && (
          <button
            type="button"
            className="quest-run-sim-btn"
            onClick={toggleSimulation}
            title="Simuler la marche le long de l'itinéraire (test)"
          >
            <IonIcon icon={simulating ? stopOutline : playOutline} />
          </button>
        )}

        {gpsMessage && <p className="quest-run-message">{gpsMessage}</p>}
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
