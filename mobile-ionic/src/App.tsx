import { Navigate, Route, useLocation } from "react-router-dom";
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonSpinner,
  IonTabs,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import {
  flag,
  flagOutline,
  home,
  homeOutline,
  map,
  mapOutline,
  people,
  peopleOutline,
  radioButtonOn,
  radioButtonOnOutline,
} from "ionicons/icons";
import { Auth0Provider } from "@auth0/auth0-react";
import Home from "./pages/Home";
import MapPage from "./pages/Map";
import Defis from "./pages/Defis";
import Parcours from "./pages/Parcours";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import FriendSearch from "./pages/FriendSearch";
import Settings from "./pages/Settings";
import AuthPage from "./pages/AuthPage";
import AuthProvider from "./auth/AuthProvider";
import { useAuth } from "./auth/authContext";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";
import "@ionic/react/css/palettes/dark.system.css";

import "./theme/variables.css";
import "./theme/design-system.css";
import "./theme/navigation.css";

setupIonicReact();

// Pages "poussées" où la barre d'onglets est masquée
const ROUTES_WITHOUT_TAB_BAR = ["/notifications", "/parametres"];

const AppTabs: React.FC = () => {
  const { pathname } = useLocation();
  const hideTabBar = ROUTES_WITHOUT_TAB_BAR.includes(pathname);

  const isActive = (path: string) => pathname === path;

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/" element={<Navigate to="/accueil" replace />} />
        <Route path="/accueil" element={<Home />} />
        <Route path="/parcours" element={<Parcours />} />
        <Route path="/enregistrer" element={<MapPage />} />
        <Route path="/defis" element={<Defis />} />
        <Route path="/amis" element={<FriendSearch />} />
        <Route path="/profil" element={<Profile />} />

        <Route path="/notifications" element={<Notifications />} />
        <Route path="/parametres" element={<Settings />} />
        {/* Déjà connecté : les anciennes URLs de connexion ramènent à l'accueil */}
        <Route path="/login" element={<Navigate to="/accueil" replace />} />
        <Route path="/connexion" element={<Navigate to="/accueil" replace />} />
        <Route path="/callback" element={<Navigate to="/accueil" replace />} />

        {/* Anciennes URLs de la carte */}
        <Route path="/map" element={<Navigate to="/enregistrer" replace />} />
        <Route path="/Map" element={<Navigate to="/enregistrer" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className={hideTabBar ? "tab-bar-hidden" : ""}>
        <IonTabButton tab="accueil" href="/accueil">
          <IonIcon icon={isActive("/accueil") ? home : homeOutline} />
          <IonLabel>Accueil</IonLabel>
        </IonTabButton>

        <IonTabButton tab="parcours" href="/parcours">
          <IonIcon icon={isActive("/parcours") ? map : mapOutline} />
          <IonLabel>Parcours</IonLabel>
        </IonTabButton>

        <IonTabButton tab="enregistrer" href="/enregistrer">
          <IonIcon
            icon={
              isActive("/enregistrer") ? radioButtonOn : radioButtonOnOutline
            }
          />
          <IonLabel>Enregistrer</IonLabel>
        </IonTabButton>

        <IonTabButton tab="defis" href="/defis">
          <IonIcon icon={isActive("/defis") ? flag : flagOutline} />
          <IonLabel>Défis</IonLabel>
        </IonTabButton>

        <IonTabButton tab="amis" href="/amis">
          <IonIcon icon={isActive("/amis") ? people : peopleOutline} />
          <IonLabel>Amis</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

const auth0Domain =
  import.meta.env.VITE_AUTH0_DOMAIN || "dev-stridequest.us.auth0.com";
const auth0ClientId =
  import.meta.env.VITE_AUTH0_CLIENT_ID || "stride-quest-client-id";
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

const redirectUri =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:5173";

/**
 * Après une connexion ou une inscription, l'appli s'ouvre sur l'Accueil quelle que
 * soit la page affichée avant (ex. /parametres après une déconnexion).
 * L'URL est changée avant que le routeur ne soit monté, qui démarre donc sur /accueil.
 */
function goToHome(): void {
  window.history.replaceState(null, "", "/accueil");
}

/** Connexion obligatoire : l'appli n'est affichée qu'à un joueur connecté. */
export const AuthGate: React.FC = () => {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="sq-auth-splash" role="status" aria-label="Chargement">
        <IonSpinner name="crescent" />
      </div>
    );
  }
  if (status === "anonymous") return <AuthPage />;

  return (
    <IonReactRouter>
      <AppTabs />
    </IonReactRouter>
  );
};

const App: React.FC = () => (
  // Auth0 ne sert qu'au bouton « Continuer avec Google » ; les comptes sont gérés par l'API.
  <Auth0Provider
    domain={auth0Domain}
    clientId={auth0ClientId}
    authorizationParams={{
      redirect_uri: redirectUri,
      ...(auth0Audience ? { audience: auth0Audience } : {}),
    }}
  >
    <AuthProvider onSignIn={goToHome}>
      <IonApp>
        <AuthGate />
      </IonApp>
    </AuthProvider>
  </Auth0Provider>
);

export default App;
