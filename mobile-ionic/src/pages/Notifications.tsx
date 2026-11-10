import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import LineMdIcon, { type LineMdIconName } from "../components/LineMdIcon";
import { useMemo, useState } from "react";
import {
  AppNotification,
  DEMO_NOTIFICATIONS,
  NotificationType,
} from "../data/demo";
import "./Notifications.css";

type NotificationCategory = "all" | "raids" | "succes" | "amis";

interface CategoryTab {
  id: NotificationCategory;
  label: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: "all", label: "Tous" },
  { id: "raids", label: "Raids" },
  { id: "succes", label: "Succès" },
  { id: "amis", label: "Amis" },
];

const ICONS: Record<NotificationType, LineMdIconName> = {
  follow: "account-add",
  kudos: "heart",
  raid: "alert",
  level: "star",
};

const CATEGORY_LABELS: Record<NotificationType, string> = {
  raid: "Raid",
  level: "Succès",
  follow: "Ami",
  kudos: "Félicitations",
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] =
    useState<AppNotification[]>(DEMO_NOTIFICATIONS);
  const [activeCategory, setActiveCategory] =
    useState<NotificationCategory>("all");

  const markAllAsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
  };

  const markAsRead = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  };

  const matchesCategory = (
    notification: AppNotification,
    category: NotificationCategory,
  ) => {
    switch (category) {
      case "raids":
        return notification.type === "raid";
      case "succes":
        return notification.type === "level";
      case "amis":
        return notification.type === "follow" || notification.type === "kudos";
      case "all":
      default:
        return true;
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => matchesCategory(n, activeCategory));
  }, [notifications, activeCategory]);

  const unreadCountByCategory = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      all: 0,
      raids: 0,
      succes: 0,
      amis: 0,
    };
    for (const n of notifications) {
      if (!n.read) {
        counts.all += 1;
        if (n.type === "raid") counts.raids += 1;
        if (n.type === "level") counts.succes += 1;
        if (n.type === "follow" || n.type === "kudos") counts.amis += 1;
      }
    }
    return counts;
  }, [notifications]);

  const hasUnread = notifications.some((notification) => !notification.read);

  return (
    <IonPage>
      <IonHeader className="top-bar" translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/accueil" text="" />
          </IonButtons>

          <IonTitle>Notifications</IonTitle>

          <IonButtons slot="end">
            <IonButton
              onClick={markAllAsRead}
              disabled={!hasUnread}
              className="notif-read-all-btn"
            >
              <LineMdIcon slot="start" name="confirm" />
              Tout lire
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="notif-page-content">
        <main className="notif-container">
          {/* Onglets de filtrage par catégorie */}
          <nav
            className="notif-filters"
            role="tablist"
            aria-label="Filtres des notifications"
          >
            {CATEGORY_TABS.map((tab) => {
              const unreadCount = unreadCountByCategory[tab.id];
              const isActive = activeCategory === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`notif-filter-chip ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveCategory(tab.id)}
                >
                  <span>{tab.label}</span>
                  {unreadCount > 0 && (
                    <span className="notif-filter-badge">{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Liste des notifications */}
          {filteredNotifications.length === 0 ? (
            <div className="sq-card notif-empty-card">
              <div className="notif-empty-icon-wrap">
                <LineMdIcon name="bell" />
              </div>
              <p className="notif-empty">
                Aucune notification dans la catégorie «{" "}
                {CATEGORY_TABS.find((t) => t.id === activeCategory)?.label} ».
              </p>
            </div>
          ) : (
            <div className="notif-list" role="list">
              {filteredNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`notif-card ${
                    notification.read ? "is-read" : "is-unread notif-unread"
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => markAsRead(notification.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div className={`notif-icon-wrap type-${notification.type}`}>
                    <LineMdIcon name={ICONS[notification.type]} />
                  </div>

                  <div className="notif-body">
                    <div className="notif-meta">
                      <span className="notif-tag">
                        {CATEGORY_LABELS[notification.type]}
                      </span>
                      <span className="notif-time">{notification.time}</span>
                    </div>
                    <p className="notif-message">{notification.message}</p>
                  </div>

                  {!notification.read && (
                    <span
                      className="notif-dot"
                      aria-label="Notification non lue"
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Notifications;
