import React from "react";
import { IonButton, IonContent, IonIcon, IonPage } from "@ionic/react";
import {
  bicycleOutline,
  compassOutline,
  fitnessOutline,
  flameOutline,
  peopleOutline,
  ribbonOutline,
  shieldOutline,
  sparklesOutline,
  timeOutline,
  trophyOutline,
  walkOutline,
} from "ionicons/icons";
import TopBar from "../components/TopBar";
import StatMetric from "../components/StatMetric";
import RpgBadgeCard from "../components/RpgBadgeCard";
import {
  DEMO_BADGES,
  DEMO_USER_ACTIVITIES,
  DEMO_USER_PROFILE,
  UserActivity,
} from "../data/demo";
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
  const paceMinutes = Math.floor(paceMinutesDecimal);
  const paceSeconds = Math.round((paceMinutesDecimal - paceMinutes) * 60);
  return `${paceMinutes}'${paceSeconds < 10 ? "0" : ""}${paceSeconds}"/km`;
}

function formatElevation(meters: number): string {
  return meters.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const Profile: React.FC = () => {
  const profile = DEMO_USER_PROFILE;
  const progressPercent = Math.min(
    100,
    Math.round((profile.experience / profile.nextLevelExperience) * 100),
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
                    {profile.username.charAt(0).toUpperCase()}
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
                    Niveau {profile.level}
                  </span>
                  <span className="sq-badge sq-badge-green">
                    <IonIcon icon={sparklesOutline} />
                    {profile.title}
                  </span>
                </div>

                <h1 className="sq-profile-username">{profile.username}</h1>

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
                {unlockedBadgesCount} / {DEMO_BADGES.length}
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
            </div>

            <div className="sq-profile-activities-list">
              {DEMO_USER_ACTIVITIES.map((activity) => (
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
                        <h3 className="sq-activity-title">{activity.title}</h3>
                        <span className="sq-activity-xp sq-tabular">
                          +{activity.xpEarned} XP
                        </span>
                      </div>
                      <div className="sq-activity-sub">
                        <span>{getActivityTypeLabel(activity.type)}</span>
                        <span>•</span>
                        <span className="sq-activity-date">
                          <IonIcon icon={timeOutline} />
                          {activity.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="sq-activity-metrics-row">
                    <div className="sq-activity-metric">
                      <span className="sq-activity-metric-label">Distance</span>
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
      </IonContent>
    </IonPage>
  );
};

export default Profile;
