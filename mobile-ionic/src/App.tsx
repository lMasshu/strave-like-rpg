import { Navigate, Route, useLocation } from "react-router-dom";
import {
  IonApp,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import LineMdIcon from "./components/LineMdIcon";
import Home from "./pages/Home";
import MapPage from "./pages/Map";
import Defis from "./pages/Defis";
import Parcours from "./pages/Parcours";
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
import "./theme/design-system.css";
import "./theme/navigation.css";

setupIonicReact();

// Pages "poussées" où la barre d'onglets est masquée
const ROUTES_WITHOUT_TAB_BAR = ["/notifications"];

const AppTabs: React.FC = () => {
  const { pathname } = useLocation();
  const hideTabBar = ROUTES_WITHOUT_TAB_BAR.includes(pathname);

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

        {/* Anciennes URLs de la carte */}
        <Route path="/map" element={<Navigate to="/enregistrer" replace />} />
        <Route path="/Map" element={<Navigate to="/enregistrer" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className={hideTabBar ? "tab-bar-hidden" : ""}>
        <IonTabButton tab="accueil" href="/accueil">
          <LineMdIcon name="home" />
          <IonLabel>Accueil</IonLabel>
        </IonTabButton>

        <IonTabButton tab="parcours" href="/parcours">
          <LineMdIcon name="map-marker-radius" />
          <IonLabel>Parcours</IonLabel>
        </IonTabButton>

        <IonTabButton tab="enregistrer" href="/enregistrer">
          <LineMdIcon name="circle" />
          <IonLabel>Enregistrer</IonLabel>
        </IonTabButton>

        <IonTabButton tab="defis" href="/defis">
          <LineMdIcon name="star" />
          <IonLabel>Défis</IonLabel>
        </IonTabButton>

        <IonTabButton tab="amis" href="/amis">
          <LineMdIcon name="account-add" />
          <IonLabel>Amis</IonLabel>
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
