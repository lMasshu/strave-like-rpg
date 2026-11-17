import React, { useCallback, useEffect, useState } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  useIonViewDidEnter,
} from "@ionic/react";
import {
  bicycleOutline,
  cloudUploadOutline,
  compassOutline,
  fitnessOutline,
  flameOutline,
  logOutOutline,
  mailOutline,
  peopleOutline,
  refreshOutline,
  ribbonOutline,
  shieldOutline,
  sparklesOutline,
  timeOutline,
  trophyOutline,
  walkOutline,
} from "ionicons/icons";
import { useAuth0 } from "@auth0/auth0-react";
import TopBar from "../components/TopBar";
import StatMetric from "../components/StatMetric";
import RpgBadgeCard from "../components/RpgBadgeCard";
import LoginModal from "../components/LoginModal";
import ErrorBoundary from "../components/ErrorBoundary";
import {
  DEMO_BADGES,
  DEMO_USER_ACTIVITIES,
  DEMO_USER_PROFILE,
  DEMO_WEEKLY_BARS,
  UserActivity,
} from "../data/demo";
import {
  ActivityDto,
  apiClient,
  PlayerProfileDto,
} from "../services/apiClient";
import "./Profile.css";

function getBadgeIcon(iconName: string): string {
  switch (iconName) {
    case "ribbon-outline":
      return ribbonOutline;
    case "flame-outline":
      return flameOutline;
    case "compass-outline":
      return compassOutline;
    case "shield-outline":
      return shieldOutline;
    case "trophy-outline":
      return trophyOutline;
    default:
      return ribbonOutline;
  }
}

function getActivityIcon(type: UserActivity["type"]): string {
  switch (type) {
    case "quest":
      return compassOutline;
    case "run":
      return fitnessOutline;
    case "walk":
      return walkOutline;
    case "cycle":
      return bicycleOutline;
    default:
      return fitnessOutline;
  }
}

function getActivityTypeLabel(type: UserActivity["type"]): string {
  switch (type) {
    case "quest":
      return "Quête GPS";
    case "run":
      return "Course à pied";
    case "walk":
      return "Marche active";
    case "cycle":
      return "Sortie vélo";
    default:
      return "Activité";
  }
}

function formatPace(distanceKm: number, durationMinutes: number): string {
  if (distanceKm <= 0) return "-";
  const paceMinutesDecimal = durationMinutes / distanceKm;
  let paceMinutes = Math.floor(paceMinutesDecimal);
  let paceSeconds = Math.round((paceMinutesDecimal - paceMinutes) * 60);
  if (paceSeconds >= 60) {
    paceMinutes += 1;
    paceSeconds = 0;
  }
  return `${paceMinutes}'${paceSeconds < 10 ? "0" : ""}${paceSeconds}"/km`;
}

function formatElevation(meters: number): string {
  return meters.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function getAdventurerTitle(level: number): string {
  if (level >= 15) return "Légende des Cimes";
  if (level >= 10) return "Champion d'Endurance";
  if (level >= 7) return "Éclaireur des Sentiers";
  if (level >= 4) return "Arpenteur Aguerri";
  if (level >= 2) return "Aventurier Intrépide";
  return "Novice des Sentiers";
}

function formatApiActivityToUserActivity(activity: ActivityDto): UserActivity {
  const typeMap: Record<ActivityDto["activityType"], UserActivity["type"]> = {
    walk: "walk",
    run: "run",
    bike: "cycle",
    hike: "quest",
  };
  const titleMap: Record<ActivityDto["activityType"], string> = {
    walk: "Marche active",
    run: "Course d'endurance",
    bike: "Sortie vélo",
    hike: "Quête d'exploration",
  };

  const distanceKm = Number((activity.distanceMeters / 1000).toFixed(2));
  const durationMinutes = Math.max(
    1,
    Math.round(activity.durationSeconds / 60),
  );
  const elevationMeters = Math.round(activity.elevationGainMeters || 0);
  const xpEarned =
    Math.floor(activity.distanceMeters / 10) + Math.floor(elevationMeters * 2);

  const dateObj = new Date(activity.startedAt);
  const dateStr = isNaN(dateObj.getTime())
    ? "Aujourd'hui"
    : dateObj.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

  return {
    id: activity.id,
    title: titleMap[activity.activityType] || "Sortie Stride Quest",
    type: typeMap[activity.activityType] || "run",
    date: dateStr,
    distanceKm,
    durationMinutes,
    elevationMeters,
    xpEarned,
  };
}

const Profile: React.FC = () => {
  const { user, isAuthenticated, logout, getAccessTokenSilently } = useAuth0();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [apiActivities, setApiActivities] = useState<ActivityDto[] | null>(
    null,
  );
  const [apiPlayer, setApiPlayer] = useState<PlayerProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoOnly, setShowDemoOnly] = useState(false);

  const loadProfileData = useCallback(async () => {
    setIsLoading(true);
    try {
      let token: string | undefined;
      if (isAuthenticated) {
        try {
          token = await getAccessTokenSilently();
        } catch (authErr) {
          console.warn(
            "Impossible de récupérer l'access token Auth0 :",
            authErr,
          );
        }
      }
      const [playerData, activitiesData] = await Promise.all([
        apiClient.getCurrentPlayer(undefined, token).catch(() => null),
        apiClient.getPlayerActivities(undefined, token).catch(() => null),
      ]);
      if (playerData) {
        setApiPlayer(playerData);
      }
      if (activitiesData) {
        setApiActivities(activitiesData);
      }
    } catch (error) {
      console.warn("Impossible de synchroniser les données du profil :", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useIonViewDidEnter(() => {
    loadProfileData();
  });

  const hasRealActivities = Boolean(
    !showDemoOnly && apiActivities && apiActivities.length > 0,
  );

  const realTotalKm = hasRealActivities
    ? Number(
        (
          apiActivities!.reduce((sum, a) => sum + a.distanceMeters, 0) / 1000
        ).toFixed(1),
      )
    : DEMO_USER_PROFILE.totalKm;

  const realTotalElevation = hasRealActivities
    ? Math.round(
        apiActivities!.reduce(
          (sum, a) => sum + (a.elevationGainMeters || 0),
          0,
        ),
      )
    : DEMO_USER_PROFILE.totalElevationMeters;

  const realActivitiesCount = hasRealActivities
    ? apiActivities!.length
    : DEMO_USER_PROFILE.activitiesCount;

  const realLevel =
    hasRealActivities && apiPlayer ? apiPlayer.level : DEMO_USER_PROFILE.level;

  const realExperience =
    hasRealActivities && apiPlayer
      ? apiPlayer.experience
      : DEMO_USER_PROFILE.experience;

  const realNextLevelExperience =
    hasRealActivities && apiPlayer
      ? apiPlayer.level * 1000
      : DEMO_USER_PROFILE.nextLevelExperience;

  const realTitle = hasRealActivities
    ? getAdventurerTitle(realLevel)
    : DEMO_USER_PROFILE.title;

  const profile = {
    ...DEMO_USER_PROFILE,
    level: realLevel,
    title: realTitle,
    experience: realExperience,
    nextLevelExperience: realNextLevelExperience,
    totalKm: realTotalKm,
    totalElevationMeters: realTotalElevation,
    activitiesCount: realActivitiesCount,
  };

  const activitiesToDisplay = hasRealActivities
    ? apiActivities!.map(formatApiActivityToUserActivity)
    : DEMO_USER_ACTIVITIES;

  const displayName =
    isAuthenticated && (user?.name || user?.nickname)
      ? user.name || user.nickname
      : profile.username;

  const displayAvatarLetter =
    (displayName && displayName.charAt(0).toUpperCase()) || "A";

  const progressPercent =
    profile.nextLevelExperience <= 0
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (profile.experience / profile.nextLevelExperience) * 100,
            ),
          ),
        );
  const remainingXp = Math.max(
    0,
    profile.nextLevelExperience - profile.experience,
  );
  const unlockedBadgesCount = DEMO_BADGES.filter((b) => b.unlocked).length;

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  return (
    <IonPage>
      <TopBar title="Profil" />

      <IonContent fullscreen className="sq-profile-page-content">
        <ErrorBoundary fallbackTitle="Erreur d'affichage du profil">
          <main className="sq-profile-container">
            {/* En-tête Aventurier */}
            <header
              className="sq-card sq-profile-hero"
              aria-label="Fiche de l'aventurier"
            >
              <div className="sq-profile-avatar-row">
                <div className="sq-profile-avatar-container">
                  <div className="sq-profile-avatar-ring">
                    {isAuthenticated && user?.picture ? (
                      <img
                        src={user.picture}
                        alt={displayName}
                        className="sq-profile-avatar-img"
                      />
                    ) : (
                      <div className="sq-profile-avatar">
                        {displayAvatarLetter}
                      </div>
                    )}
                  </div>
                  <span className="sq-profile-avatar-level-chip">
                    Niv. {profile.level}
                  </span>
                </div>

                <div className="sq-profile-identity">
                  <div className="sq-profile-identity-tags">
                    <span className="sq-badge sq-badge-gold">
                      <IonIcon icon={flameOutline} />
                      <span>Niveau {profile.level}</span>
                    </span>
                    <span className="sq-badge sq-badge-green">
                      <IonIcon icon={sparklesOutline} />
                      <span>{profile.title}</span>
                    </span>
                    {isAuthenticated && (
                      <span className="sq-badge sq-badge-cyan">
                        Auth0 Cloud
                      </span>
                    )}
                  </div>

                  <h1 className="sq-profile-username">{displayName}</h1>

                  {isAuthenticated && user?.email && (
                    <div className="sq-profile-email-chip">
                      <IonIcon icon={mailOutline} />
                      <span>{user.email}</span>
                    </div>
                  )}

                  <div className="sq-profile-social-row">
                    <IonButton
                      routerLink="/amis"
                      fill="clear"
                      size="small"
                      className="sq-profile-friends-chip"
                    >
                      <IonIcon slot="start" icon={peopleOutline} />
                      <span>{profile.friendsCount} compagnons</span>
                    </IonButton>
                  </div>
                </div>
              </div>

              {/* Bannière de connexion ou bouton de déconnexion */}
              {isAuthenticated ? (
                <div className="sq-profile-auth-actions">
                  <button
                    type="button"
                    className="sq-profile-logout-btn"
                    onClick={handleLogout}
                    aria-label="Se déconnecter"
                  >
                    <IonIcon icon={logOutOutline} />
                    <span>Déconnexion</span>
                  </button>
                </div>
              ) : (
                <div className="sq-profile-cloud-banner">
                  <div className="sq-profile-cloud-text">
                    <IonIcon
                      icon={cloudUploadOutline}
                      className="sq-profile-cloud-icon"
                    />
                    <span>Sauvegardez votre progression dans le cloud</span>
                  </div>
                  <button
                    type="button"
                    className="sq-profile-login-btn"
                    onClick={() => setIsLoginModalOpen(true)}
                    aria-label="Se connecter"
                  >
                    Se connecter
                  </button>
                </div>
              )}

              {/* Jauge d'XP et progression */}
              <div className="sq-profile-xp-section">
                <div className="sq-profile-xp-header">
                  <span className="sq-profile-xp-label">Progression XP</span>
                  <span className="sq-profile-xp-val sq-tabular">
                    {profile.experience} / {profile.nextLevelExperience} XP
                  </span>
                </div>
                <div className="sq-progress">
                  <div
                    className="sq-progress-bar sq-progress-gold"
                    style={{ width: `${progressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={profile.experience}
                    aria-valuemin={0}
                    aria-valuemax={profile.nextLevelExperience}
                  />
                </div>
                <div className="sq-profile-xp-sub">
                  <span>{progressPercent}% complété</span>
                  <span>
                    {remainingXp} XP avant le rang {profile.level + 1}
                  </span>
                </div>
              </div>
            </header>

            {/* Grille de statistiques de carrière */}
            <section
              className="sq-profile-section"
              aria-label="Statistiques de carrière et exploration"
            >
              <div className="sq-profile-section-header">
                <div>
                  <h2 className="sq-section-title">Statistiques de carrière</h2>
                  <p className="sq-profile-section-sub">
                    Entraînement et exploration cumulés
                  </p>
                </div>
              </div>

              <div className="sq-profile-stats-grid">
                <StatMetric
                  label="Distance totale"
                  value={profile.totalKm}
                  unit="km"
                  trend="Cumul de carrière"
                />
                <StatMetric
                  label="Dénivelé cumulé"
                  value={formatElevation(profile.totalElevationMeters)}
                  unit="m D+"
                  trend="Ascensions totales"
                />
                <StatMetric
                  label="Sorties totales"
                  value={profile.activitiesCount}
                  unit="sorties"
                  trend="Expéditions"
                />
                <StatMetric
                  label="Quêtes réussies"
                  value={profile.totalQuestsCompleted ?? 18}
                  unit="succès"
                  trend="100% complétées"
                />
              </div>
            </section>

            {/* Histogramme de Distance par semaine (km) */}
            <section
              className="sq-card sq-profile-barchart-card"
              aria-label="Distance par semaine"
            >
              <div className="sq-profile-section-header">
                <div>
                  <h2 className="sq-section-title">Distance par semaine</h2>
                  <p className="sq-profile-section-sub">
                    Volume d'entraînement en kilomètres
                  </p>
                </div>
              </div>

              <div className="sq-profile-barchart">
                {DEMO_WEEKLY_BARS.map((bar) => {
                  const maxKm = 30;
                  const heightPercent = Math.min(
                    100,
                    Math.round((bar.km / maxKm) * 100),
                  );
                  return (
                    <div key={bar.label} className="sq-barchart-col">
                      <span className="sq-barchart-val sq-tabular">
                        {bar.km}
                      </span>
                      <div className="sq-barchart-bar-track">
                        <div
                          className={`sq-barchart-bar-fill ${bar.isCurrent ? "is-current" : ""}`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="sq-barchart-label">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Étagère de trophées & accomplissements */}
            <section
              className="sq-profile-section"
              aria-label="Accomplissements et trophées"
            >
              <div className="sq-profile-section-header">
                <div>
                  <h2 className="sq-section-title">
                    Accomplissements & Trophées
                  </h2>
                  <p className="sq-profile-section-sub">
                    Badges débloqués et jalons de progression RPG
                  </p>
                </div>
                <span className="sq-badge sq-badge-gold">
                  <IonIcon icon={trophyOutline} />
                  <span>
                    {unlockedBadgesCount} / {DEMO_BADGES.length}
                  </span>
                </span>
              </div>

              <div className="sq-profile-badges-grid">
                {DEMO_BADGES.map((badge) => (
                  <RpgBadgeCard
                    key={badge.id}
                    name={badge.name}
                    description={badge.description}
                    icon={getBadgeIcon(badge.icon)}
                    unlocked={badge.unlocked}
                    unlockedAt={badge.unlockedAt}
                    category={badge.category}
                  />
                ))}
              </div>
            </section>

            {/* Historique des sorties */}
            <section
              className="sq-profile-section"
              aria-label="Historique des sorties"
            >
              <div className="sq-profile-section-header">
                <div>
                  <h2 className="sq-section-title">Historique des sorties</h2>
                  <p className="sq-profile-section-sub">
                    Vos récentes expéditions et quêtes
                  </p>
                </div>

                <div className="sq-profile-header-actions">
                  {apiActivities && apiActivities.length > 0 && (
                    <button
                      type="button"
                      className="sq-profile-toggle-btn"
                      onClick={() => setShowDemoOnly(!showDemoOnly)}
                      title={
                        showDemoOnly
                          ? "Afficher mes vraies sorties enregistrées"
                          : "Afficher les données de démonstration"
                      }
                    >
                      {showDemoOnly ? "Voir mes sorties" : "Voir démo"}
                    </button>
                  )}
                  {hasRealActivities ? (
                    <span className="sq-profile-sync-badge">
                      <span>
                        ● {activitiesToDisplay.length} réelle
                        {activitiesToDisplay.length > 1 ? "s" : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="sq-badge sq-badge-cyan">
                      <span>Mode Démo</span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="sq-profile-refresh-btn"
                    onClick={() => loadProfileData()}
                    title="Rafraîchir les activités"
                    aria-label="Rafraîchir"
                  >
                    <IonIcon
                      icon={refreshOutline}
                      className={isLoading ? "sq-spin" : ""}
                    />
                  </button>
                </div>
              </div>

              <div
                key={
                  hasRealActivities
                    ? "real-activities-container"
                    : "demo-activities-container"
                }
                className="sq-profile-activities-list"
              >
                {activitiesToDisplay.map((activity) => (
                  <article
                    key={`${hasRealActivities ? "real" : "demo"}-${activity.id}`}
                    className="sq-card sq-profile-activity-card"
                  >
                    <div className="sq-activity-card-header">
                      <div className="sq-activity-type-icon">
                        <IonIcon icon={getActivityIcon(activity.type)} />
                      </div>
                      <div className="sq-activity-identity">
                        <div className="sq-activity-title-row">
                          <h3 className="sq-activity-title">
                            {activity.title}
                          </h3>
                          <span className="sq-activity-xp sq-tabular">
                            +{activity.xpEarned} XP
                          </span>
                        </div>
                        <div className="sq-activity-sub">
                          <span>{getActivityTypeLabel(activity.type)}</span>
                          <span>•</span>
                          <span className="sq-activity-date">
                            <IonIcon icon={timeOutline} />
                            <span>{activity.date}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="sq-activity-metrics-row">
                      <div className="sq-activity-metric">
                        <span className="sq-activity-metric-label">
                          Distance
                        </span>
                        <span className="sq-activity-metric-value sq-tabular">
                          {activity.distanceKm} km
                        </span>
                      </div>
                      <div className="sq-activity-metric">
                        <span className="sq-activity-metric-label">Durée</span>
                        <span className="sq-activity-metric-value sq-tabular">
                          {activity.durationMinutes} min
                        </span>
                      </div>
                      <div className="sq-activity-metric">
                        <span className="sq-activity-metric-label">Allure</span>
                        <span className="sq-activity-metric-value sq-tabular">
                          {formatPace(
                            activity.distanceKm,
                            activity.durationMinutes,
                          )}
                        </span>
                      </div>
                      <div className="sq-activity-metric">
                        <span className="sq-activity-metric-label">D+</span>
                        <span className="sq-activity-metric-value sq-tabular">
                          +{activity.elevationMeters} m
                        </span>
                      </div>
                    </div>

                    {activity.badgeUnlocked && (
                      <div className="sq-activity-badge-pill">
                        <IonIcon icon={ribbonOutline} />
                        <span>Badge débloqué : {activity.badgeUnlocked}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </main>
        </ErrorBoundary>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Profile;
