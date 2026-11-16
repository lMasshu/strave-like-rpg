import React, { useState } from "react";
import { IonIcon, IonModal, IonSpinner } from "@ionic/react";
import {
  closeOutline,
  cloudUploadOutline,
  mailOutline,
  shieldCheckmarkOutline,
  trophyOutline,
} from "ionicons/icons";
import { useAuth0 } from "@auth0/auth0-react";
import "./LoginModal.css";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleIcon: React.FC = () => (
  <svg
    className="sq-login-google-icon"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithRedirect, loginWithPopup, isLoading } = useAuth0();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const isAuth0Configured =
    Boolean(auth0Domain) &&
    auth0Domain !== "ton-domaine.auth0.com" &&
    auth0Domain !== "dev-xyz.us.auth0.com";

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // Déclenche l'authentification sociale Google via Auth0
      if (typeof loginWithPopup === "function") {
        await loginWithPopup({
          authorizationParams: {
            connection: "google-oauth2",
          },
        });
        onClose();
      } else {
        await loginWithRedirect({
          authorizationParams: {
            connection: "google-oauth2",
          },
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erreur de connexion Google";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // Déclenche le formulaire universel Auth0 (inscription ou mot de passe)
      if (typeof loginWithPopup === "function") {
        await loginWithPopup();
        onClose();
      } else {
        await loginWithRedirect();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erreur d'authentification Auth0";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="sq-login-modal"
      data-testid="login-modal"
    >
      <div className="sq-login-card">
        {/* Bouton fermeture */}
        <div className="sq-login-header">
          <button
            type="button"
            className="sq-login-close-btn"
            onClick={onClose}
            aria-label="Fermer la fenêtre de connexion"
          >
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        {/* Marque et slogan */}
        <div className="sq-login-brand">
          <div className="sq-login-logo-container">
            <span className="sq-login-logo-symbol" role="img" aria-label="Épée">
              ⚔️
            </span>
          </div>
          <h1 className="sq-login-title">
            Stride <span className="sq-login-title-accent">Quest</span>
          </h1>
          <p className="sq-login-slogan">
            Transformez chaque sortie en quête épique
          </p>
        </div>

        {/* Avantages RPG */}
        <div className="sq-login-perks">
          <div className="sq-login-perk-item">
            <IonIcon icon={cloudUploadOutline} className="sq-login-perk-icon" />
            <span>
              Sauvegarde automatique de votre progression dans le cloud
            </span>
          </div>
          <div className="sq-login-perk-item">
            <IonIcon icon={trophyOutline} className="sq-login-perk-icon" />
            <span>Synchronisation de vos trophées et niveaux RPG</span>
          </div>
          <div className="sq-login-perk-item">
            <IonIcon
              icon={shieldCheckmarkOutline}
              className="sq-login-perk-icon"
            />
            <span>Participation aux raids de boss communautaires</span>
          </div>
        </div>

        {/* Avertissement informatif si les clés d'environnement sont par défaut */}
        {!isAuth0Configured && (
          <div className="sq-login-config-alert">
            <strong>Mode démo :</strong> Renseignez vos identifiants Auth0 dans{" "}
            <code>mobile-ionic/.env</code> pour activer la vraie
            authentification Google.
          </div>
        )}

        {errorMessage && (
          <div
            className="sq-login-config-alert"
            style={{
              borderColor: "var(--sq-danger-raid)",
              color: "var(--sq-danger-raid-tint)",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Boutons d'action */}
        <div className="sq-login-actions">
          <button
            type="button"
            className="sq-login-btn-google"
            onClick={handleGoogleLogin}
            disabled={submitting || isLoading}
            aria-label="Continuer avec Google"
          >
            {submitting ? (
              <IonSpinner name="crescent" />
            ) : (
              <>
                <GoogleIcon />
                <span>Continuer avec Google</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="sq-login-btn-email"
            onClick={handleEmailLogin}
            disabled={submitting || isLoading}
            aria-label="Se connecter par Email"
          >
            <IonIcon icon={mailOutline} />
            <span>Se connecter par Email</span>
          </button>
        </div>

        {/* Mentions légales */}
        <footer className="sq-login-footer">
          <p className="sq-login-legal-text">
            En continuant, vous acceptez nos{" "}
            <span className="sq-login-legal-link">
              Conditions d'utilisation
            </span>{" "}
            et notre{" "}
            <span className="sq-login-legal-link">
              Politique de confidentialité
            </span>
            .
          </p>
        </footer>
      </div>
    </IonModal>
  );
};

export default LoginModal;
