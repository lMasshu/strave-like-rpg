import {
  IonBadge,
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { notificationsOutline, personAddOutline } from "ionicons/icons";
import { getUnreadCount } from "../data/demo";
import "./TopBar.css";

interface TopBarProps {
  title?: string;
  unreadCount?: number;
}

const TopBar: React.FC<TopBarProps> = ({
  title = "Stride Quest",
  unreadCount = getUnreadCount(),
}) => {
  return (
    <IonHeader className="top-bar">
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton
            routerLink="/amis"
            routerDirection="forward"
            aria-label="Trouver des amis"
          >
            <IonIcon slot="icon-only" icon={personAddOutline} />
          </IonButton>
        </IonButtons>

        <IonTitle>{title}</IonTitle>

        <IonButtons slot="end">
          <IonButton
            routerLink="/notifications"
            routerDirection="forward"
            aria-label="Notifications"
            className="top-bar-notif-btn"
          >
            <IonIcon slot="icon-only" icon={notificationsOutline} />

            {unreadCount > 0 && (
              <IonBadge color="danger" className="top-bar-badge">
                {unreadCount > 9 ? "9+" : unreadCount}
              </IonBadge>
            )}
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
};

export default TopBar;
