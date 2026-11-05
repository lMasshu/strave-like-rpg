import React, { useState } from "react";
import { IonContent, IonIcon, IonPage } from "@ionic/react";
import { useNavigate } from "react-router-dom";
import { chevronForwardOutline, skullOutline } from "ionicons/icons";
import TopBar from "../components/TopBar";
import { DEMO_NEARBY_QUESTS } from "../data/demo";
import "./Defis.css";

type BossScope = "local" | "national" | "mondial";

const Defis: React.FC = () => {
  const navigate = useNavigate();
  const [scope, setScope] = useState<BossScope>("local");

  const handleLaunchQuest = () => {
    navigate("/enregistrer");
  };

  return (
    <IonPage>
      <TopBar title="Défis" />

      <IonContent fullscreen className="sq-defis-content">
        <main className="sq-defis-container">
          <header className="sq-defis-header">
            <h1 className="sq-defis-title">Défis</h1>
            <p className="sq-defis-subtitle">
              Tes sorties te donnent des points. Utilise-les ici.
            </p>
          </header>

          {/* Carte Boss de Raid */}
          <section
            className="sq-card sq-defis-boss-card"
            aria-label="Boss de raid"
          >
            <div className="sq-defis-boss-top">
              <span className="sq-defis-boss-meta">
                Boss{" "}
                {scope === "local"
                  ? "local"
                  : scope === "national"
                    ? "national"
                    : "mondial"}{" "}
                • Fin dans 2 jours
              </span>
              <IonIcon icon={skullOutline} className="sq-defis-boss-icon" />
            </div>

            <h2 className="sq-defis-boss-name">Titan de la ville</h2>

            {/* Jauge de vie */}
            <div className="sq-defis-hp-wrap">
              <div
                className="sq-defis-hp-bar"
                role="progressbar"
                aria-valuenow={58}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="sq-defis-hp-fill" style={{ width: "58%" }} />
              </div>
              <div className="sq-defis-hp-labels">
                <span className="sq-tabular">580 000 / 1 000 000 PV</span>
                <span className="sq-tabular sq-defis-hp-percent">58 %</span>
              </div>
            </div>

            <div className="sq-defis-contribution">
              Ta contribution : <strong>860 points</strong>
            </div>
          </section>

          {/* Filtres de portée */}
          <div className="sq-defis-scope-tabs" role="tablist">
            <button
              type="button"
              className={`sq-defis-scope-tab ${scope === "local" ? "is-active" : ""}`}
              onClick={() => setScope("local")}
            >
              Local
            </button>
            <button
              type="button"
              className={`sq-defis-scope-tab ${scope === "national" ? "is-active" : ""}`}
              onClick={() => setScope("national")}
            >
              National
            </button>
            <button
              type="button"
              className={`sq-defis-scope-tab ${scope === "mondial" ? "is-active" : ""}`}
              onClick={() => setScope("mondial")}
            >
              Mondial
            </button>
          </div>

          {/* Quêtes près de toi */}
          <section className="sq-defis-quests-section">
            <h2 className="sq-defis-section-title">Quêtes près de toi</h2>

            <div className="sq-defis-quests-list">
              {DEMO_NEARBY_QUESTS.map((quest) => (
                <article
                  key={quest.id}
                  className="sq-card sq-card-interactive sq-defis-quest-card"
                  onClick={handleLaunchQuest}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleLaunchQuest();
                    }
                  }}
                >
                  <div className="sq-defis-quest-info">
                    <h3 className="sq-defis-quest-name">{quest.title}</h3>
                    <p className="sq-defis-quest-metrics">
                      {quest.distanceKm} km • {quest.estimatedMinutes} min pour
                      y arriver
                    </p>
                  </div>

                  <div className="sq-defis-quest-action">
                    <span className="sq-defis-xp-pill">
                      +{quest.xpReward} XP
                    </span>
                    <IonIcon
                      icon={chevronForwardOutline}
                      className="sq-defis-arrow"
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Defis;
