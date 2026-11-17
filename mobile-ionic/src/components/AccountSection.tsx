import { IonIcon } from "@ionic/react";
import {
  keyOutline,
  logOutOutline,
  logoGoogle,
  mailOutline,
} from "ionicons/icons";
import type { PlayerProfileDto } from "../services/apiClient";
import "./AccountSection.css";

export interface AccountSectionProps {
  player: PlayerProfileDto | null;
  onLogout: () => void;
}

/** Partie « Profil » des Paramètres : identité du compte et déconnexion. */
const AccountSection: React.FC<AccountSectionProps> = ({
  player,
  onLogout,
}) => {
  const initial = player?.username.charAt(0).toUpperCase() ?? "?";

  return (
    <section aria-labelledby="account-heading" className="account-section">
      <div className="settings-section-heading">
        <h2 id="account-heading">Profil</h2>
        <p>Le compte avec lequel vous êtes connecté.</p>
      </div>

      <div className="account-card">
        <div className="account-identity">
          <span className="account-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="account-names">
            <strong>{player?.username ?? "Chargement…"}</strong>
            {player && (
              <span className="account-email">
                <IonIcon icon={mailOutline} aria-hidden="true" />
                {player.email}
              </span>
            )}
          </div>
        </div>

        {player && (
          <ul className="account-methods" aria-label="Moyens de connexion">
            {player.hasPassword && (
              <li>
                <IonIcon icon={keyOutline} aria-hidden="true" />
                E-mail et mot de passe
              </li>
            )}
            {player.googleLinked && (
              <li>
                <IonIcon icon={logoGoogle} aria-hidden="true" />
                Google
              </li>
            )}
          </ul>
        )}

        <button type="button" className="account-logout" onClick={onLogout}>
          <IonIcon icon={logOutOutline} aria-hidden="true" />
          Se déconnecter
        </button>
      </div>
    </section>
  );
};

export default AccountSection;
