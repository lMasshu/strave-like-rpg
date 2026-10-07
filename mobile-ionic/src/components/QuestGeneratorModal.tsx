import React, { useState } from "react";
import { IonModal, IonSpinner, IonIcon } from "@ionic/react";
import {
  diceOutline,
  sparklesOutline,
  repeatOutline,
  locationOutline,
  navigateOutline,
  closeOutline,
  flameOutline,
  walkOutline,
  bicycleOutline,
  checkmarkOutline,
  trendingUpOutline,
  timeOutline,
} from "ionicons/icons";
import {
  generateRandomQuest,
  GeneratedQuest,
  QuestType,
} from "../services/questGenerator";
import { TransportProfile } from "../services/mapboxDirections";
import "./QuestGeneratorModal.css";

interface QuestGeneratorModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  userLocation: [number, number];
  currentMode: TransportProfile;
  mapboxToken?: string;
  onAcceptQuest: (quest: GeneratedQuest) => void;
}

export const QuestGeneratorModal: React.FC<QuestGeneratorModalProps> = ({
  isOpen,
  onDismiss,
  userLocation,
  currentMode,
  mapboxToken,
  onAcceptQuest,
}) => {
  const [selectedType, setSelectedType] = useState<QuestType | "any">("any");
  const [targetDistance, setTargetDistance] = useState<number>(3);
  const [selectedProfile, setSelectedProfile] =
    useState<TransportProfile>(currentMode);
  const [loading, setLoading] = useState<boolean>(false);
  const [generatedQuest, setGeneratedQuest] = useState<GeneratedQuest | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const quest = await generateRandomQuest({
        userLocation,
        preferredType: selectedType,
        targetDistanceKm: targetDistance,
        profile: selectedProfile,
        mapboxToken,
      });
      setGeneratedQuest(quest);
    } catch (err) {
      console.error("Erreur lors de la génération de la quête :", err);
      setErrorMsg("Impossible de générer le tracé. Veuillez vérifier votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (generatedQuest) {
      onAcceptQuest(generatedQuest);
      onDismiss();
    }
  };

  const getDifficultyLabel = (diff: GeneratedQuest["difficulty"]) => {
    switch (diff) {
      case "easy":
        return "Facile";
      case "medium":
        return "Modéré";
      case "hard":
        return "Difficile";
      case "epic":
        return "Expert";
    }
  };

  const getTypeLabel = (type: QuestType) => {
    switch (type) {
      case "loop":
        return "Boucle";
      case "poi":
        return "Point d'intérêt";
      case "linear":
        return "Itinéraire";
    }
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      className="quest-generator-modal"
    >
      <div className="quest-modal-container">
        <header className="quest-modal-header">
          <div className="quest-modal-title-group">
            <h2 className="quest-modal-title">Générateur de parcours</h2>
            <p className="quest-modal-subtitle">
              Créez un tracé sur-mesure selon vos critères
            </p>
          </div>
          <button
            type="button"
            className="quest-modal-close-btn"
            onClick={onDismiss}
            aria-label="Fermer"
          >
            <IonIcon icon={closeOutline} />
          </button>
        </header>

        <div className="quest-modal-body">
          <section className="quest-section">
            <span className="quest-section-label">Type d'itinéraire</span>
            <div className="quest-chips-row">
              <button
                type="button"
                className={`quest-chip ${selectedType === "any" ? "active" : ""}`}
                onClick={() => setSelectedType("any")}
              >
                <IonIcon icon={sparklesOutline} />
                <span>Aléatoire</span>
              </button>
              <button
                type="button"
                className={`quest-chip ${selectedType === "loop" ? "active" : ""}`}
                onClick={() => setSelectedType("loop")}
              >
                <IonIcon icon={repeatOutline} />
                <span>Boucle</span>
              </button>
              <button
                type="button"
                className={`quest-chip ${selectedType === "poi" ? "active" : ""}`}
                onClick={() => setSelectedType("poi")}
              >
                <IonIcon icon={locationOutline} />
                <span>Lieu d'intérêt</span>
              </button>
              <button
                type="button"
                className={`quest-chip ${selectedType === "linear" ? "active" : ""}`}
                onClick={() => setSelectedType("linear")}
              >
                <IonIcon icon={navigateOutline} />
                <span>Aller simple</span>
              </button>
            </div>
          </section>

          <section className="quest-section">
            <span className="quest-section-label">Distance cible</span>
            <div className="quest-distance-buttons">
              {[1.5, 3, 5, 8].map((dist) => (
                <button
                  key={dist}
                  type="button"
                  className={`quest-dist-btn ${targetDistance === dist ? "active" : ""}`}
                  onClick={() => setTargetDistance(dist)}
                >
                  <span className="dist-val">{dist} km</span>
                  <span className="dist-desc">
                    {dist === 1.5
                      ? "Courte"
                      : dist === 3
                        ? "Moyenne"
                        : dist === 5
                          ? "Longue"
                          : "Défi"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="quest-section">
            <span className="quest-section-label">Activité</span>
            <div className="quest-chips-row">
              <button
                type="button"
                className={`quest-chip ${selectedProfile === "pedestrian" ? "active" : ""}`}
                onClick={() => setSelectedProfile("pedestrian")}
              >
                <IonIcon icon={walkOutline} />
                <span>À pied</span>
              </button>
              <button
                type="button"
                className={`quest-chip ${selectedProfile === "bicycle" ? "active" : ""}`}
                onClick={() => setSelectedProfile("bicycle")}
              >
                <IonIcon icon={bicycleOutline} />
                <span>À vélo</span>
              </button>
            </div>
          </section>

          <button
            type="button"
            className="quest-generate-btn"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <IonSpinner name="crescent" style={{ width: 18, height: 18, color: "#fff" }} />
            ) : (
              <>
                <IonIcon icon={diceOutline} />
                <span>{generatedQuest ? "Générer un autre tracé" : "Calculer le tracé"}</span>
              </>
            )}
          </button>

          {errorMsg && <div className="quest-error-banner">{errorMsg}</div>}

          {generatedQuest && (
            <article className="generated-quest-card">
              <div className="quest-card-top">
                <div className="quest-badges-group">
                  <span className="rpg-badge">{getTypeLabel(generatedQuest.type)}</span>
                  <span className="rpg-badge">{getDifficultyLabel(generatedQuest.difficulty)}</span>
                </div>
                <div className="quest-xp-badge">
                  <IonIcon icon={flameOutline} />
                  <span>+{generatedQuest.xpReward} XP</span>
                </div>
              </div>

              <h3 className="quest-card-title">{generatedQuest.title}</h3>
              <p className="quest-card-desc">{generatedQuest.description}</p>

              {generatedQuest.targetPoiName && (
                <div className="quest-poi-highlight">
                  <IonIcon icon={locationOutline} />
                  <span>Destination : <strong>{generatedQuest.targetPoiName}</strong></span>
                </div>
              )}

              <div className="quest-metrics-row">
                <div className="quest-metric-box">
                  <span className="m-label">Distance</span>
                  <span className="m-value">{generatedQuest.route.distanceKm} km</span>
                </div>
                <div className="quest-metric-box">
                  <span className="m-label">Durée est.</span>
                  <span className="m-value">
                    <IonIcon icon={timeOutline} className="mini-icon" />
                    {generatedQuest.route.durationMinutes} min
                  </span>
                </div>
                <div className="quest-metric-box">
                  <span className="m-label">Dénivelé</span>
                  <span className="m-value d-plus">
                    <IonIcon icon={trendingUpOutline} className="mini-icon" />
                    +{generatedQuest.route.elevationGain ?? 0}m
                  </span>
                </div>
              </div>

              <div className="quest-card-actions">
                <button
                  type="button"
                  className="quest-accept-btn"
                  onClick={handleAccept}
                >
                  <IonIcon icon={checkmarkOutline} />
                  <span>Sélectionner cet itinéraire</span>
                </button>
              </div>
            </article>
          )}
        </div>
      </div>
    </IonModal>
  );
};

export default QuestGeneratorModal;
