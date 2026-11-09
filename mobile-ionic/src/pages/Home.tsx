import React from "react";
import { IonContent, IonPage } from "@ionic/react";
import { useNavigate } from "react-router-dom";
import LineMdIcon from "../components/LineMdIcon";
import TopBar from "../components/TopBar";
import QuestTracePreview from "../components/QuestTracePreview";
import {
  DEMO_ACTIVE_RAID,
  DEMO_USER_ACTIVITIES,
  DEMO_USER_PROFILE,
} from "../data/demo";
import "./Home.css";

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  return `${hours} h ${remainingMinutes > 0 ? String(remainingMinutes).padStart(2, "0") : ""}`;
}

const Home: React.FC = () => {
  const navigate = useNavigate();

  const handleStartWorkout = () => {
    navigate("/enregistrer", { state: { autoStart: true } });
  };

  const formattedWeeklyDuration = formatDuration(
    DEMO_USER_PROFILE.weeklyStats.durationMinutes,
  );

  const lastActivity = DEMO_USER_ACTIVITIES[0];

  return (
    <IonPage>
      <TopBar title="Stride Quest" />

      <IonContent fullscreen className="sq-home-page-content">
        <main className="sq-home-container">
          {/* En-tête : Salutation & Niveau (Maquette Page 1) */}
          <header className="sq-home-greeting">
            <div className="sq-home-greeting-text">
              <span className="sq-home-greeting-sub">
                Bonjour {DEMO_USER_PROFILE.username}
              </span>
              <h1 className="sq-home-greeting-title">Prêt à bouger ?</h1>
            </div>
            <div className="sq-home-level-badge">
              N{DEMO_USER_PROFILE.level}
            </div>
          </header>

          {/* Grand Bouton Hero : Démarrer une sortie (Maquette Page 1) */}
          <div
            className="sq-home-start-hero"
            onClick={handleStartWorkout}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleStartWorkout();
              }
            }}
          >
            <div className="sq-start-hero-text">
              <h2 className="sq-start-hero-title">Démarrer une sortie</h2>
              <p className="sq-start-hero-sub">Enregistrement en un geste</p>
            </div>
            <LineMdIcon name="play" className="sq-start-hero-play-icon" />
          </div>

          {/* Section Cette Semaine (Maquette Page 1 : 3 métriques) */}
          <section
            className="sq-card sq-home-week-card"
            aria-label="Cette semaine"
          >
            <div className="sq-week-header">
              <h2 className="sq-week-title">Cette semaine</h2>
            </div>
            <div className="sq-week-grid">
              <div className="sq-week-metric">
                <span className="sq-week-val sq-tabular">
                  {DEMO_USER_PROFILE.weeklyStats.distanceKm
                    .toString()
                    .replace(".", ",")}{" "}
                  km
                </span>
                <span className="sq-week-lbl">Distance</span>
              </div>
              <div className="sq-week-metric">
                <span className="sq-week-val sq-tabular">
                  {formattedWeeklyDuration}
                </span>
                <span className="sq-week-lbl">Temps</span>
              </div>
              <div className="sq-week-metric">
                <span className="sq-week-val sq-tabular">
                  {DEMO_USER_PROFILE.weeklyStats.elevationMeters} m
                </span>
                <span className="sq-week-lbl">Dénivelé</span>
              </div>
            </div>
          </section>

          {/* Dernière sortie (Maquette Page 1) */}
          {lastActivity && (
            <section
              className="sq-card sq-card-interactive sq-home-last-activity-card"
              aria-label="Dernière sortie"
              onClick={handleStartWorkout}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleStartWorkout();
                }
              }}
            >
              <div className="sq-last-activity-header">
                <span className="sq-last-activity-name">
                  Dernière sortie • Course à pied
                </span>
                <span className="sq-last-activity-pts">
                  +{lastActivity.xpEarned} pts
                </span>
              </div>

              <QuestTracePreview
                distanceKm={lastActivity.distanceKm}
                elevationMeters={lastActivity.elevationMeters}
                className="sq-home-last-trace"
              />

              <div className="sq-last-activity-stats-row">
                <div className="sq-last-stat">
                  <span className="sq-last-stat-val sq-tabular">
                    {lastActivity.distanceKm.toString().replace(".", ",")} km
                  </span>
                  <span className="sq-last-stat-lbl">Distance</span>
                </div>
                <div className="sq-last-stat">
                  <span className="sq-last-stat-val sq-tabular">
                    {Math.floor(lastActivity.durationMinutes)}:
                    {String(
                      Math.round((lastActivity.durationMinutes % 1) * 60),
                    ).padStart(2, "0")}
                  </span>
                  <span className="sq-last-stat-lbl">Temps</span>
                </div>
                <div className="sq-last-stat">
                  <span className="sq-last-stat-val sq-tabular">5:23</span>
                  <span className="sq-last-stat-lbl">min/km</span>
                </div>
              </div>
            </section>
          )}

          {/* Boss en cours (Maquette Page 1) */}
          <section
            className="sq-card sq-home-boss-preview"
            aria-label="Raid en cours"
          >
            <div className="sq-home-boss-header">
              <span className="sq-home-boss-title">
                Boss en cours • {DEMO_ACTIVE_RAID.name}
              </span>
              <span className="sq-home-boss-percent sq-tabular">58 %</span>
            </div>
            <div className="sq-home-boss-bar">
              <div className="sq-home-boss-fill" style={{ width: "58%" }} />
            </div>
            <span className="sq-home-boss-sub">Points de vie restants</span>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Home;
