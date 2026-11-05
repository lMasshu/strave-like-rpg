import React from "react";
import { IonButton, IonContent, IonIcon, IonPage } from "@ionic/react";
import { useNavigate } from "react-router-dom";
import {
  bicycleOutline,
  compassOutline,
  fitnessOutline,
  flameOutline,
  radioButtonOnOutline,
  ribbonOutline,
  sparklesOutline,
  timeOutline,
  walkOutline,
} from "ionicons/icons";
import TopBar from "../components/TopBar";
import StatMetric from "../components/StatMetric";
import RaidBossBanner from "../components/RaidBossBanner";
import {
  DEMO_ACTIVE_RAID,
  DEMO_DAILY_QUEST,
  DEMO_USER_ACTIVITIES,
  DEMO_USER_PROFILE,
  UserActivity,
} from "../data/demo";
import "./Home.css";

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  return `${hours}h${remainingMinutes > 0 ? String(remainingMinutes).padStart(2, "0") : ""}`;
}

function getActivityIcon(type: UserActivity["type"]) {
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

const Home: React.FC = () => {
  const navigate = useNavigate();

  const handleJoinRaid = () => {
    navigate("/enregistrer");
  };

  const formattedWeeklyDuration = formatDuration(
    DEMO_USER_PROFILE.weeklyStats.durationMinutes,
  );

  return (
    <IonPage>
      <TopBar title="Stride Quest" />

      <IonContent fullscreen className="sq-home-page-content">
        <main className="sq-home-container">
          {/* En-tête Aventurier */}
          <header className="sq-home-greeting">
            <div className="sq-home-greeting-text">
              <span className="sq-home-greeting-badge">
                <IonIcon icon={flameOutline} />
                Niveau {DEMO_USER_PROFILE.level} • {DEMO_USER_PROFILE.title}
              </span>
              <h1 className="sq-home-greeting-title">
                Bonjour, {DEMO_USER_PROFILE.username}
              </h1>
            </div>
          </header>

          {/* Hero Card : Quête du jour recommandée */}
          <section
            className="sq-card sq-home-hero"
            aria-label="Quête du jour recommandée"
          >
            <div className="sq-home-hero-header">
              <span className="sq-badge sq-badge-green">
                <IonIcon icon={compassOutline} />
                Quête du jour
              </span>
              <span className="sq-badge sq-badge-muted">
                {DEMO_DAILY_QUEST.difficulty}
              </span>
              <span className="sq-badge sq-badge-gold">
                <IonIcon icon={sparklesOutline} />+{DEMO_DAILY_QUEST.xpReward}{" "}
                XP
              </span>
            </div>

            <div className="sq-home-hero-content">
              <h2 className="sq-home-hero-title">{DEMO_DAILY_QUEST.title}</h2>
              <p className="sq-home-hero-desc">
                Boucle asymétrique optimisée pour votre secteur. Validez les
                points d'intérêt et cumulez de l'expérience.
              </p>
            </div>

            <div className="sq-home-hero-metrics">
              <div className="sq-hero-metric-chip">
                <span className="sq-hero-metric-label">Distance</span>
                <span className="sq-hero-metric-value sq-tabular">
                  {DEMO_DAILY_QUEST.targetDistanceKm} km
                </span>
              </div>
              <div className="sq-hero-metric-chip">
                <span className="sq-hero-metric-label">Durée est.</span>
                <span className="sq-hero-metric-value sq-tabular">
                  ~{DEMO_DAILY_QUEST.estimatedMinutes} min
                </span>
              </div>
              <div className="sq-hero-metric-chip">
                <span className="sq-hero-metric-label">Dénivelé</span>
                <span className="sq-hero-metric-value sq-tabular">
                  +{DEMO_DAILY_QUEST.elevationMeters} m
                </span>
              </div>
            </div>

            <IonButton
              routerLink="/enregistrer"
              expand="block"
              shape="round"
              className="sq-home-hero-cta"
            >
              <IonIcon slot="start" icon={radioButtonOnOutline} />
              Démarrer la sortie
            </IonButton>
          </section>

          {/* Section Raid Boss Communautaire */}
          <section className="sq-home-section" aria-label="Raid communautaire">
            <div className="sq-home-section-header">
              <div>
                <h2 className="sq-section-title">Raid en cours</h2>
                <p className="sq-home-section-sub">
                  Coopération asynchrone sur le terrain
                </p>
              </div>
            </div>

            <RaidBossBanner
              name={DEMO_ACTIVE_RAID.name}
              location={DEMO_ACTIVE_RAID.location}
              currentHp={DEMO_ACTIVE_RAID.currentHp}
              maxHp={DEMO_ACTIVE_RAID.maxHp}
              endsIn={DEMO_ACTIVE_RAID.endsIn}
              tier="Raid Régional"
              onJoinRaid={handleJoinRaid}
            />
          </section>

          {/* Section Synthèse Hebdomadaire */}
          <section
            className="sq-home-section"
            aria-label="Synthèse d'entraînement hebdomadaire"
          >
            <div className="sq-home-section-header">
              <div>
                <h2 className="sq-section-title">Cette semaine</h2>
                <p className="sq-home-section-sub">
                  Activité et progression athlétique
                </p>
              </div>
            </div>

            <div className="sq-home-stats-grid">
              <StatMetric
                label="Distance"
                value={DEMO_USER_PROFILE.weeklyStats.distanceKm}
                unit="km"
                trend="+12% vs sem. passée"
              />
              <StatMetric
                label="Temps actif"
                value={formattedWeeklyDuration}
                trend="3 séances"
              />
              <StatMetric
                label="Dénivelé"
                value={DEMO_USER_PROFILE.weeklyStats.elevationMeters}
                unit="m D+"
                trend="Parcours vallonné"
              />
              <StatMetric
                label="Quêtes validées"
                value={DEMO_USER_PROFILE.weeklyStats.questsCompleted}
                unit="succès"
                trend="Objectif 5"
              />
            </div>
          </section>

          {/* Section Dernières Expéditions */}
          <section
            className="sq-home-section"
            aria-label="Dernières expéditions"
          >
            <div className="sq-home-section-header">
              <div>
                <h2 className="sq-section-title">Dernières expéditions</h2>
                <p className="sq-home-section-sub">
                  Vos récentes sorties et points d'intérêt validés
                </p>
              </div>
            </div>

            <div className="sq-home-activities-list">
              {DEMO_USER_ACTIVITIES.map((activity) => (
                <article
                  key={activity.id}
                  className="sq-card sq-home-activity-card"
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

export default Home;
