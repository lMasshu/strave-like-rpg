import {
  IonBadge,
  IonButton,
  IonButtons,
  IonHeader,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import LineMdIcon from "./LineMdIcon";
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
            <LineMdIcon slot="icon-only" name="account-add" />
          </IonButton>
        </IonButtons>

        <IonTitle>{title}</IonTitle>

        <IonButtons slot="end">
          <IonButton
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === "dark"
                ? "Activer le mode lumineux"
                : "Activer le mode sombre"
            }
            className="top-bar-action-btn top-bar-theme-btn"
          >
            <LineMdIcon
              slot="icon-only"
              name={resolvedTheme === "dark" ? "sunny" : "moon"}
            />
          </IonButton>

          <IonButton
            routerLink="/notifications"
            routerDirection="forward"
            aria-label="Notifications"
            className="top-bar-action-btn top-bar-notif-btn"
          >
            <LineMdIcon slot="icon-only" name="bell" />

            {unreadCount > 0 && (
              <IonBadge color="danger" className="top-bar-badge">
                {unreadCount > 9 ? "9+" : unreadCount}
              </IonBadge>
            )}
          </IonButton>

          <IonButton
            routerLink="/profil"
            routerDirection="forward"
            aria-label="Mon Profil"
            className="top-bar-action-btn"
          >
            <LineMdIcon slot="icon-only" name="account" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
};

export default TopBar;
