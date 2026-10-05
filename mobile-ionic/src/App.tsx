import { Navigate, Route, useLocation } from "react-router-dom";
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import {
  home,
  homeOutline,
  person,
  personOutline,
  radioButtonOn,
  radioButtonOnOutline,
} from "ionicons/icons";
import Home from "./pages/Home";
import MapPage from "./pages/Map";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import FriendSearch from "./pages/FriendSearch";

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
import "./theme/navigation.css";

setupIonicReact();

// Pages "poussées" : la barre d'onglets du bas y est masquée.
const ROUTES_WITHOUT_TAB_BAR = ["/notifications", "/amis"];

const AppTabs: React.FC = () => {
  const { pathname } = useLocation();
  const hideTabBar = ROUTES_WITHOUT_TAB_BAR.includes(pathname);

  const isActive = (path: string) => pathname === path;

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/" element={<Navigate to="/accueil" replace />} />
        <Route path="/accueil" element={<Home />} />
        <Route path="/enregistrer" element={<MapPage />} />
        <Route path="/profil" element={<Profile />} />

        <Route path="/notifications" element={<Notifications />} />
        <Route path="/amis" element={<FriendSearch />} />

        {/* Anciennes URLs de la carte */}
        <Route path="/map" element={<Navigate to="/enregistrer" replace />} />
        <Route path="/Map" element={<Navigate to="/enregistrer" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className={hideTabBar ? "tab-bar-hidden" : ""}>
        <IonTabButton tab="accueil" href="/accueil">
          <IonIcon icon={isActive("/accueil") ? home : homeOutline} />
          <IonLabel>Accueil</IonLabel>
        </IonTabButton>

        <IonTabButton tab="enregistrer" href="/enregistrer">
          <IonIcon
            icon={
              isActive("/enregistrer") ? radioButtonOn : radioButtonOnOutline
            }
          />
          <IonLabel>Enregistrer</IonLabel>
        </IonTabButton>

        <IonTabButton tab="profil" href="/profil">
          <IonIcon icon={isActive("/profil") ? person : personOutline} />
          <IonLabel>Profil</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <AppTabs />
    </IonReactRouter>
  </IonApp>
);

export default App;
