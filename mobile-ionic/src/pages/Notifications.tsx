import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  flameOutline,
  heartOutline,
  personAddOutline,
  trophyOutline,
} from "ionicons/icons";
import { useState } from "react";
import {
  AppNotification,
  DEMO_NOTIFICATIONS,
  NotificationType,
} from "../data/demo";
import "./Notifications.css";

const ICONS: Record<NotificationType, string> = {
  follow: personAddOutline,
  kudos: heartOutline,
  raid: flameOutline,
  level: trophyOutline,
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] =
    useState<AppNotification[]>(DEMO_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
  };

  const hasUnread = notifications.some((notification) => !notification.read);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/accueil" text="" />
          </IonButtons>

          <IonTitle>Notifications</IonTitle>

          <IonButtons slot="end">
            <IonButton onClick={markAllAsRead} disabled={!hasUnread}>
              Tout lire
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {notifications.length === 0 ? (
          <p className="notif-empty">Aucune notification pour le moment.</p>
        ) : (
          <IonList lines="full">
            {notifications.map((notification) => (
              <IonItem
                key={notification.id}
                className={notification.read ? "" : "notif-unread"}
              >
                <IonIcon
                  slot="start"
                  icon={ICONS[notification.type]}
                  color={notification.read ? "medium" : "primary"}
                />

                <IonLabel className="ion-text-wrap">
                  <h3>{notification.message}</h3>
                  <p>{notification.time}</p>
                </IonLabel>

                {!notification.read && (
                  <span className="notif-dot" slot="end" aria-label="Non lue" />
                )}
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Notifications;
