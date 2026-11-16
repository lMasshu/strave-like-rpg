import React, { useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner } from "@ionic/react";
import {
  cloudUploadOutline,
  mailOutline,
  shieldCheckmarkOutline,
  trophyOutline,
} from "ionicons/icons";
import { useAuth0 } from "@auth0/auth0-react";
import TopBar from "../components/TopBar";
import "../components/LoginModal.css";
import "./Login.css";

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

const LoginPage: React.FC = () => {
  const {
    loginWithRedirect,
    loginWithPopup,
    isLoading,
    isAuthenticated,
    user,
    logout,
  } = useAuth0();
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
      if (typeof loginWithPopup === "function") {
        await loginWithPopup({
          authorizationParams: {
            connection: "google-oauth2",
          },
        });
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
      if (typeof loginWithPopup === "function") {
        await loginWithPopup();
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

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  return (
    <IonPage>
      <TopBar title="Connexion" />
      <IonContent fullscreen className="sq-login-page-content">
        <main className="sq-login-page-container">
          <div className="sq-login-card">
            <div className="sq-login-brand">
              <div className="sq-login-logo-container">
                <span
                  className="sq-login-logo-symbol"
                  role="img"
                  aria-label="Épée"
                >
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

            {isAuthenticated && user ? (
              <div className="sq-login-connected-section">
                <p className="sq-login-connected-msg">
                  Connecté en tant que{" "}
                  <strong>{user.name || user.email}</strong>
                </p>
                <button
                  type="button"
                  className="sq-login-btn-email"
                  onClick={handleLogout}
                >
                  Se déconnecter
                </button>
              </div>
            ) : (
              <>
                <div className="sq-login-perks">
                  <div className="sq-login-perk-item">
                    <IonIcon
                      icon={cloudUploadOutline}
                      className="sq-login-perk-icon"
                    />
                    <span>Sauvegarde cloud de votre progression</span>
                  </div>
                  <div className="sq-login-perk-item">
                    <IonIcon
                      icon={trophyOutline}
                      className="sq-login-perk-icon"
                    />
                    <span>Synchronisation des trophées RPG</span>
                  </div>
                  <div className="sq-login-perk-item">
                    <IonIcon
                      icon={shieldCheckmarkOutline}
                      className="sq-login-perk-icon"
                    />
                    <span>Participation aux raids communautaires</span>
                  </div>
                </div>

                {!isAuth0Configured && (
                  <div className="sq-login-config-alert">
                    <strong>Mode démo :</strong> Renseignez vos identifiants
                    Auth0 dans <code>mobile-ionic/.env</code> pour activer la
                    vraie authentification Google.
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

                <div className="sq-login-actions">
                  <button
                    type="button"
                    className="sq-login-btn-google"
                    onClick={handleGoogleLogin}
                    disabled={submitting || isLoading}
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
                  >
                    <IonIcon icon={mailOutline} />
                    <span>Se connecter par Email</span>
                  </button>
                </div>
              </>
            )}

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
        </main>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
