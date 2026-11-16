import {
  IonBadge,
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  moonOutline,
  notificationsOutline,
  person,
  personAddOutline,
  personOutline,
  settingsOutline,
  sunnyOutline,
} from "ionicons/icons";
import { useAuth0 } from "@auth0/auth0-react";
import { getUnreadCount } from "../data/demo";
import { useThemeMode } from "../hooks/useThemeMode";
import "./TopBar.css";

interface TopBarProps {
  title?: string;
  unreadCount?: number;
}

const TopBar: React.FC<TopBarProps> = ({
  title = "Stride Quest",
  unreadCount = getUnreadCount(),
}) => {
  const { resolvedTheme, toggleTheme } = useThemeMode();
  const { isAuthenticated } = useAuth0();

  return (
    <IonHeader className="top-bar" translucent>
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton
            routerLink="/amis"
            routerDirection="forward"
            aria-label="Trouver des amis"
            className="top-bar-action-btn"
          >
            <IonIcon slot="icon-only" icon={personAddOutline} />
          </IonButton>
        </IonButtons>

        <IonTitle>{title}</IonTitle>

        <IonButtons slot="end">
          <IonButton
            routerLink="/parametres"
            routerDirection="forward"
            aria-label="Paramètres"
            className="top-bar-action-btn"
          >
            <IonIcon slot="icon-only" icon={settingsOutline} />
          </IonButton>

          <IonButton
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === "dark"
                ? "Activer le mode lumineux"
                : "Activer le mode sombre"
            }
            className="top-bar-action-btn top-bar-theme-btn"
          >
            <IonIcon
              slot="icon-only"
              icon={resolvedTheme === "dark" ? sunnyOutline : moonOutline}
            />
          </IonButton>

          <IonButton
            routerLink="/notifications"
            routerDirection="forward"
            aria-label="Notifications"
            className="top-bar-action-btn top-bar-notif-btn"
          >
            <IonIcon slot="icon-only" icon={notificationsOutline} />

            {unreadCount > 0 && (
              <IonBadge color="danger" className="top-bar-badge">
                {unreadCount > 9 ? "9+" : unreadCount}
              </IonBadge>
            )}
          </IonButton>

          <IonButton
            routerLink="/profil"
            routerDirection="forward"
            aria-label={
              isAuthenticated
                ? "Mon Profil (Connecté avec Auth0)"
                : "Mon Profil"
            }
            className={`top-bar-action-btn ${
              isAuthenticated ? "top-bar-profile-connected" : ""
            }`}
          >
            <IonIcon
              slot="icon-only"
              icon={isAuthenticated ? person : personOutline}
            />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
};

export default TopBar;
