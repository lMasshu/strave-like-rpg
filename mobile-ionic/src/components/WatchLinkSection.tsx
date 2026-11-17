import { IonIcon, IonSpinner } from "@ionic/react";
import {
  checkmarkCircle,
  closeCircle,
  refreshOutline,
  settingsOutline,
  watchOutline,
} from "ionicons/icons";
import type {
  WatchActivityType,
  WatchLinkStatus,
  WatchWorkout,
} from "../data/watchLink";
import "./WatchLinkSection.css";

export interface WatchLinkSectionProps {
  status: WatchLinkStatus | null;
  workouts: WatchWorkout[];
  isBusy: boolean;
  error: string | null;
  onLink: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

const ACTIVITY_LABELS: Record<WatchActivityType, string> = {
  run: "Course",
  walk: "Marche",
  hike: "Randonnée",
  bike: "Vélo",
};

function storeName(status: WatchLinkStatus | null): string {
  return status?.platform === "ios" ? "Apple Santé" : "Health Connect";
}

function formatDistance(meters: number | null): string {
  if (meters === null) return "— km";
  return `${(meters / 1000).toFixed(2).replace(".", ",")} km`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0
    ? `${hours} h ${String(minutes).padStart(2, "0")}`
    : `${minutes} min`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function StatusMessage({ status }: { status: WatchLinkStatus | null }) {
  if (!status) return <p>Vérification de la liaison…</p>;

  if (status.state === "unavailable") {
    return status.platform === "web" || status.platform === null ? (
      <p>
        La liaison des montres fonctionne uniquement dans l’appli mobile
        installée sur le téléphone.
      </p>
    ) : (
      <p>
        Health Connect est introuvable sur ce téléphone. Installez-le depuis le
        Play Store ou mettez Android à jour.
      </p>
    );
  }

  if (status.state === "not-linked") {
    return (
      <p>
        Autorisez Stride Quest à lire vos séances dans {storeName(status)}.
        Activez aussi le partage vers {storeName(status)} dans l’appli de votre
        montre (Garmin Connect, Samsung Health…).
      </p>
    );
  }

  return (
    <p>
      Les séances de votre montre sont lues depuis {storeName(status)}
      {status.heartRateAuthorized ? ", fréquence cardiaque comprise." : "."}
    </p>
  );
}

const WatchLinkSection: React.FC<WatchLinkSectionProps> = ({
  status,
  workouts,
  isBusy,
  error,
  onLink,
  onRefresh,
  onOpenSettings,
}) => {
  const isLinked = status?.state === "linked";
  const canLink = status?.state === "not-linked";
  const isNative = status !== null && status.platform !== "web";

  return (
    <section aria-labelledby="watch-heading" className="watch-link-section">
      <div className="settings-section-heading">
        <h2 id="watch-heading">Montres connectées</h2>
        <p>
          Enregistrez avec votre montre : les séances arrivent ensuite dans
          Stride Quest.
        </p>
      </div>

      <div className="watch-link-card" aria-busy={isBusy}>
        <div className="watch-link-header">
          <span className="watch-link-icon" aria-hidden="true">
            <IonIcon icon={watchOutline} />
          </span>
          <div className="watch-link-title">
            <strong>{storeName(status)}</strong>
            <span
              className={`watch-link-badge ${isLinked ? "is-linked" : ""}`}
              role="status"
            >
              <IonIcon
                icon={isLinked ? checkmarkCircle : closeCircle}
                aria-hidden="true"
              />
              {isLinked ? "Connectée" : "Non connectée"}
            </span>
          </div>
          {isBusy && <IonSpinner name="crescent" aria-label="Chargement" />}
        </div>

        <StatusMessage status={status} />
        {error && (
          <p className="watch-link-error" role="alert">
            {error}
          </p>
        )}

        <div className="watch-link-actions">
          {canLink && (
            <button
              type="button"
              className="watch-link-primary"
              onClick={onLink}
              disabled={isBusy}
            >
              Connecter ma montre
            </button>
          )}
          {isLinked && (
            <button
              type="button"
              className="watch-link-secondary"
              onClick={onRefresh}
              disabled={isBusy}
            >
              <IonIcon icon={refreshOutline} aria-hidden="true" />
              Actualiser
            </button>
          )}
          {isNative && status?.platform === "android" && (
            <button
              type="button"
              className="watch-link-secondary"
              onClick={onOpenSettings}
              disabled={isBusy}
            >
              <IonIcon icon={settingsOutline} aria-hidden="true" />
              Gérer dans Health Connect
            </button>
          )}
        </div>
      </div>

      {isLinked && (
        <div className="watch-link-workouts">
          <h3>Séances détectées (7 derniers jours)</h3>
          {workouts.length === 0 ? (
            <p className="watch-link-empty">
              Aucune course, marche, randonnée ou sortie vélo trouvée. Vérifiez
              que votre montre a bien synchronisé.
            </p>
          ) : (
            <ul aria-label="Séances de la montre">
              {workouts.map((workout) => (
                <li key={workout.externalId}>
                  <div>
                    <strong>{ACTIVITY_LABELS[workout.activityType]}</strong>
                    <small>
                      {dateFormatter.format(new Date(workout.startedAt))}
                      {workout.sourceName ? ` · ${workout.sourceName}` : ""}
                    </small>
                  </div>
                  <span>
                    {formatDistance(workout.distanceMeters)} ·{" "}
                    {formatDuration(workout.durationSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default WatchLinkSection;
