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
  compassOutline,
  fitnessOutline,
  flameOutline,
  mailOutline,
  peopleOutline,
  phonePortraitOutline,
  refreshOutline,
  ribbonOutline,
  shieldOutline,
  sparklesOutline,
  statsChartOutline,
  timeOutline,
  trophyOutline,
  walkOutline,
  watchOutline,
} from "ionicons/icons";
import { useAuth } from "../auth/authContext";
import TopBar from "../components/TopBar";
import StatMetric from "../components/StatMetric";
import RpgBadgeCard from "../components/RpgBadgeCard";
import ErrorBoundary from "../components/ErrorBoundary";
import { historyOutline } from "../components/customIcons";
import ProfileTabs, { ProfileTab } from "../components/ProfileTabs";
import { panelId, tabId } from "../components/profileTabIds";
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
import { importWatchWorkouts } from "../services/watchSync";
import "./Profile.css";

type ProfileTabId = "stats" | "activities" | "achievements";

const PROFILE_TABS: ProfileTab<ProfileTabId>[] = [
  { id: "stats", label: "Statistiques", icon: statsChartOutline },
  { id: "activities", label: "Activités", icon: historyOutline },
  { id: "achievements", label: "Accomplissements", icon: trophyOutline },
];

const TABS_PREFIX = "profile";

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
    ...activitySource(activity),
  };
}

/** Provenance affichée à côté de la date : téléphone, nom de la montre, ou « Montre connectée ». */
function activitySource(
  activity: Pick<ActivityDto, "external">,
): Pick<UserActivity, "source" | "fromWatch"> {
  if (!activity.external) return { source: "Téléphone", fromWatch: false };
  return {
    source: activity.external.deviceName ?? "Montre connectée",
    fromWatch: true,
  };
}

/** Plus récente en premier (l'API trie déjà ; on ne dépend pas de cet ordre). */
function newestFirst(activities: ActivityDto[]): ActivityDto[] {
  return [...activities].sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
  );
}

const Profile: React.FC = () => {
  const { player } = useAuth();
  const [apiActivities, setApiActivities] = useState<ActivityDto[] | null>(
    null,
  );
  const [apiPlayer, setApiPlayer] = useState<PlayerProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoOnly, setShowDemoOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabId>("stats");

  const panelProps = (id: ProfileTabId) => ({
    role: "tabpanel",
    id: panelId(TABS_PREFIX, id),
    "aria-labelledby": tabId(TABS_PREFIX, id),
    tabIndex: 0,
    className: "sq-profile-tab-panel",
  });

  const playerId = player?.id;

  const loadProfileData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Les séances de la montre rejoignent l'historique avant qu'on le relise.
      // Une montre non liée ou une API injoignable ne doit pas empêcher l'affichage du profil.
      if (playerId) {
        await importWatchWorkouts(playerId).catch((syncErr: unknown) => {
          console.warn("Synchronisation de la montre impossible :", syncErr);
        });
      }
      const [playerData, activitiesData] = await Promise.all([
        apiClient.getCurrentPlayer().catch(() => null),
        apiClient.getPlayerActivities().catch(() => null),
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
  }, [playerId]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useIonViewDidEnter(() => {
    loadProfileData();
  });

  // Pour l'instant, niveau, XP, statistiques et historique restent les valeurs de
  // démo tant qu'aucune vraie sortie n'existe ; seule l'identité vient du compte connecté.
  const accountPlayer = apiPlayer ?? player;
  const hasRealActivities = Boolean(
    !showDemoOnly && apiActivities && apiActivities.length > 0,
  );
  const realActivities = hasRealActivities ? apiActivities! : [];
  const level =
    hasRealActivities && accountPlayer
      ? accountPlayer.level
      : DEMO_USER_PROFILE.level;

  const profile = hasRealActivities
    ? {
        ...DEMO_USER_PROFILE,
        level,
        title: getAdventurerTitle(level),
        experience: accountPlayer?.experience ?? DEMO_USER_PROFILE.experience,
        nextLevelExperience: level * 1000,
        totalKm: Number(
          (
            realActivities.reduce((sum, a) => sum + a.distanceMeters, 0) / 1000
          ).toFixed(1),
        ),
        totalElevationMeters: Math.round(
          realActivities.reduce(
            (sum, a) => sum + (a.elevationGainMeters || 0),
            0,
          ),
        ),
        activitiesCount: realActivities.length,
      }
    : DEMO_USER_PROFILE;

  const activitiesToDisplay = hasRealActivities
    ? newestFirst(realActivities).map(formatApiActivityToUserActivity)
    : DEMO_USER_ACTIVITIES;

  const displayName = accountPlayer?.username ?? DEMO_USER_PROFILE.username;

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
                    <div className="sq-profile-avatar">
                      {displayAvatarLetter}
                    </div>
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
                  </div>

                  <h1 className="sq-profile-username">{displayName}</h1>

                  {accountPlayer?.email && (
                    <div className="sq-profile-email-chip">
                      <IonIcon icon={mailOutline} />
                      <span>{accountPlayer.email}</span>
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

            <ProfileTabs
              tabs={PROFILE_TABS}
              activeTab={activeTab}
              onChange={setActiveTab}
              idPrefix={TABS_PREFIX}
              label="Sections du profil"
            />

            {activeTab === "stats" && (
              <div {...panelProps("stats")}>
                {/* Grille de statistiques de carrière */}
                <section
                  className="sq-profile-section"
                  aria-label="Statistiques de carrière et exploration"
                >
                  <div className="sq-profile-section-header">
                    <div>
                      <h2 className="sq-section-title">
                        Statistiques de carrière
                      </h2>
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
              </div>
            )}

            {activeTab === "achievements" && (
              <div {...panelProps("achievements")}>
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
              </div>
            )}

            {activeTab === "activities" && (
              <div {...panelProps("activities")}>
                {/* Historique des sorties */}
                <section
                  className="sq-profile-section"
                  aria-label="Historique des sorties"
                >
                  <div className="sq-profile-section-header">
                    <div>
                      <h2 className="sq-section-title">
                        Historique des sorties
                      </h2>
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
                              {activity.source && (
                                <>
                                  <span aria-hidden="true">•</span>
                                  <span
                                    className="sq-activity-source"
                                    aria-label={`Enregistrée via ${activity.source}`}
                                  >
                                    <IonIcon
                                      icon={
                                        activity.fromWatch
                                          ? watchOutline
                                          : phonePortraitOutline
                                      }
                                      aria-hidden="true"
                                    />
                                    <span>{activity.source}</span>
                                  </span>
                                </>
                              )}
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
                            <span className="sq-activity-metric-label">
                              Durée
                            </span>
                            <span className="sq-activity-metric-value sq-tabular">
                              {activity.durationMinutes} min
                            </span>
                          </div>
                          <div className="sq-activity-metric">
                            <span className="sq-activity-metric-label">
                              Allure
                            </span>
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
                            <span>
                              Badge débloqué : {activity.badgeUnlocked}
                            </span>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </main>
        </ErrorBoundary>
      </IonContent>
    </IonPage>
  );
};

export default Profile;
