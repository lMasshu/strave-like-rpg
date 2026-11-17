import { IonIcon, IonSpinner } from "@ionic/react";
import {
  checkmarkCircle,
  closeCircle,
  settingsOutline,
  watchOutline,
} from "ionicons/icons";
import type { WatchLinkStatus } from "../data/watchLink";
import "./WatchLinkSection.css";

export interface WatchLinkSectionProps {
  status: WatchLinkStatus | null;
  isBusy: boolean;
  error: string | null;
  onLink: () => void;
  onOpenSettings: () => void;
}

function storeName(status: WatchLinkStatus | null): string {
  return status?.platform === "ios" ? "Apple Santé" : "Health Connect";
}

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
      Vos séances sont importées depuis {storeName(status)} et apparaissent dans
      l’historique des activités de votre profil.
    </p>
  );
}

const WatchLinkSection: React.FC<WatchLinkSectionProps> = ({
  status,
  isBusy,
  error,
  onLink,
  onOpenSettings,
}) => {
  const isLinked = status?.state === "linked";
  const canLink = status?.state === "not-linked";

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
          {status?.platform === "android" && (
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
    </section>
  );
};

export default WatchLinkSection;
