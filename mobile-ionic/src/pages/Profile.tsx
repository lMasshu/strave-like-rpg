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
import RpgBadgeCard from "../components/RpgBadgeCard";
import ErrorBoundary from "../components/ErrorBoundary";
import { historyOutline } from "../components/customIcons";
import ProfileTabs, { ProfileTab } from "../components/ProfileTabs";
import ProfileStatsPanel from "../components/ProfileStatsPanel";
import { levelProgress, XP_PER_LEVEL } from "../services/playerLevel";
import {
  periodRange,
  practicedSports,
  StatsPeriod,
} from "../services/activityStats";
import { panelId, tabId } from "../components/profileTabIds";
import { DEMO_BADGES, DEMO_USER_PROFILE, UserActivity } from "../data/demo";
import {
  ActivityDto,
  ActivitySummaryDto,
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
  const [friendsCount, setFriendsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabId>("stats");
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("week");
  const [periodActivities, setPeriodActivities] = useState<
    ActivitySummaryDto[]
  >([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsNow, setStatsNow] = useState(() => new Date());
  /** Incrémenté après chaque rechargement du profil (ex. import montre) pour relire les stats. */
  const [dataVersion, setDataVersion] = useState(0);

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
      const [playerData, activitiesData, friends] = await Promise.all([
        apiClient.getCurrentPlayer().catch(() => null),
        apiClient.getPlayerActivities().catch(() => null),
        apiClient.getFriends().catch(() => null),
      ]);
      if (friends) {
        setFriendsCount(friends.length);
      }
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
      setDataVersion((version) => version + 1);
    }
  }, [playerId]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Statistiques de la période choisie, recalculées à partir des vraies activités.
  useEffect(() => {
    if (dataVersion === 0) return; // attend le premier chargement (import montre compris)
    let cancelled = false;
    const now = new Date();
    const range = periodRange(statsPeriod, now);
    setStatsLoading(true);
    setStatsError(null);
    apiClient
      .getActivitySummaries(range.from, range.to)
      .then((summaries) => {
        if (cancelled) return;
        setPeriodActivities(summaries);
        setStatsNow(now);
      })
      .catch(() => {
        if (!cancelled) {
          setStatsError("Impossible de charger les statistiques.");
        }
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statsPeriod, dataVersion]);

  useIonViewDidEnter(() => {
    loadProfileData();
  });

  // Pour l'instant, niveau, XP, statistiques et historique restent les valeurs de
  // démo tant qu'aucune vraie sortie n'existe ; seule l'identité vient du compte connecté.
  const accountPlayer = apiPlayer ?? player;
  const hasRealActivities = Boolean(apiActivities && apiActivities.length > 0);
  const realActivities = hasRealActivities ? apiActivities! : [];
  // Niveau et XP viennent toujours du compte connecté (un nouveau compte est niveau 1, 0 XP).
  const progress = levelProgress(
    accountPlayer?.experience ?? DEMO_USER_PROFILE.experience,
  );
  const profile = {
    level: progress.level,
    title: getAdventurerTitle(progress.level),
  };

  const activitiesToDisplay = newestFirst(realActivities).map(
    formatApiActivityToUserActivity,
  );

  const displayName = accountPlayer?.username ?? DEMO_USER_PROFILE.username;

  const displayAvatarLetter =
    (displayName && displayName.charAt(0).toUpperCase()) || "A";

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
                      <span>
                        {friendsCount} compagnon{friendsCount > 1 ? "s" : ""}
                      </span>
                    </IonButton>
                  </div>
                </div>
              </div>

              {/* Jauge d'XP et progression */}
              <div className="sq-profile-xp-section">
                <div className="sq-profile-xp-header">
                  <span className="sq-profile-xp-label">Progression XP</span>
                  <span className="sq-profile-xp-val sq-tabular">
                    {progress.xpInLevel} / {XP_PER_LEVEL} XP
                  </span>
                </div>
                <div className="sq-progress">
                  <div
                    className="sq-progress-bar sq-progress-gold"
                    style={{ width: `${progress.percent}%` }}
                    role="progressbar"
                    aria-label="Progression vers le niveau suivant"
                    aria-valuenow={progress.xpInLevel}
                    aria-valuemin={0}
                    aria-valuemax={XP_PER_LEVEL}
                  />
                </div>
                <div className="sq-profile-xp-sub">
                  <span>{progress.percent}% complété</span>
                  <span>
                    {progress.xpToNextLevel} XP avant le rang{" "}
                    {profile.level + 1}
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

            {/* Toujours les vraies statistiques du compte (zéros s'il n'a pas encore de sortie) */}
            {activeTab === "stats" && (
              <div {...panelProps("stats")}>
                <ProfileStatsPanel
                  period={statsPeriod}
                  onPeriodChange={setStatsPeriod}
                  activities={periodActivities}
                  loading={statsLoading}
                  error={statsError}
                  now={statsNow}
                  sports={practicedSports(apiActivities ?? [])}
                />
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
                      {hasRealActivities && (
                        <span className="sq-profile-sync-badge">
                          <span>
                            ● {activitiesToDisplay.length} réelle
                            {activitiesToDisplay.length > 1 ? "s" : ""}
                          </span>
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

                  {!hasRealActivities && !isLoading && (
                    <p className="sq-stats-message">
                      Aucune sortie enregistrée pour l'instant.
                    </p>
                  )}

                  <div className="sq-profile-activities-list">
                    {activitiesToDisplay.map((activity) => (
                      <article
                        key={activity.id}
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
