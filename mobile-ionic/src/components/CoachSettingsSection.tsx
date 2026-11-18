import React, { useEffect, useState } from "react";
import { IonIcon, IonSpinner, IonToggle } from "@ionic/react";
import {
  chatbubbleEllipsesOutline,
  checkmarkCircle,
  compassOutline,
  flagOutline,
  lockClosedOutline,
  sparklesOutline,
  trophyOutline,
} from "ionicons/icons";
import { apiClient, CoachGoal, CoachSettingsDto } from "../services/apiClient";
import "./CoachSettingsSection.css";

interface GoalOption {
  id: CoachGoal;
  title: string;
  description: string;
  icon: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "casual",
    title: "Détente & Exploration libre",
    description:
      "Marche, sorties plaisir et bien-être sans contrainte de chrono.",
    icon: compassOutline,
  },
  {
    id: "active",
    title: "Aventurier Actif",
    description:
      "2 à 3 sorties régulières par semaine pour entretenir forme et souffle.",
    icon: sparklesOutline,
  },
  {
    id: "5k",
    title: "Objectif 5 km",
    description:
      "Valider ses premiers 5 km d'un trait avec aisance respiratoire.",
    icon: flagOutline,
  },
  {
    id: "10k",
    title: "Objectif 10 km",
    description:
      "Structurer son entraînement (endurance fondamentale et variations d'allure).",
    icon: flagOutline,
  },
  {
    id: "half-marathon",
    title: "Objectif Semi-marathon (21,1 km)",
    description:
      "Montée en volume, gestion du ravitaillement et sorties longues.",
    icon: trophyOutline,
  },
  {
    id: "marathon",
    title: "Objectif Marathon (42,195 km)",
    description:
      "Préparation rigoureuse sur plusieurs mois, gestion de l'allure et affûtage.",
    icon: trophyOutline,
  },
];

const CoachSettingsSection: React.FC = () => {
  const [settings, setSettings] = useState<CoachSettingsDto>({
    coachEnabled: false,
    coachGoal: "casual",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getCoachSettings()
      .then((data) => {
        if (isMounted) {
          setSettings(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les paramètres du Maître de Guilde.",
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = async (enabled: boolean) => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiClient.updateCoachSettings({
        coachEnabled: enabled,
      });
      setSettings(updated);
      showFeedback(
        enabled ? "Maître de Guilde activé" : "Maître de Guilde désactivé",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectGoal = async (goal: CoachGoal) => {
    if (goal === settings.coachGoal || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiClient.updateCoachSettings({ coachGoal: goal });
      setSettings(updated);
      showFeedback("Objectif de progression mis à jour");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur de mise à jour de l'objectif",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback(null);
    }, 2800);
  };

  if (isLoading) {
    return (
      <section className="coach-settings-section" aria-label="Maître de Guilde">
        <div className="settings-section-heading">
          <h2>Maître de Guilde (Coach IA)</h2>
          <p>Chargement de vos préférences…</p>
        </div>
        <div className="coach-settings-card coach-loading-card">
          <IonSpinner name="crescent" />
        </div>
      </section>
    );
  }

  return (
    <section className="coach-settings-section" aria-labelledby="coach-heading">
      <div className="settings-section-heading">
        <div className="coach-heading-with-badge">
          <h2 id="coach-heading">Maître de Guilde (Coach IA)</h2>
          <span className="coach-badge-tag">Optionnel</span>
        </div>
        <p>
          Un mentor bienveillant qui analyse vos sorties réelles pour vous
          guider et répondre à vos questions sans surcharger votre quotidien.
        </p>
      </div>

      <div className="coach-settings-card">
        {/* Ligne principale Activation */}
        <div className="coach-toggle-row">
          <div className="coach-toggle-info">
            <div className="coach-toggle-icon-wrap" aria-hidden="true">
              <IonIcon icon={chatbubbleEllipsesOutline} />
            </div>
            <div>
              <strong className="coach-toggle-title">
                Activer le Maître de Guilde
              </strong>
              <p className="coach-toggle-sub">
                Bilan de progression hebdomadaire et salon de discussion.
              </p>
            </div>
          </div>
          <IonToggle
            checked={settings.coachEnabled}
            disabled={isSaving}
            onIonChange={(e) => handleToggle(e.detail.checked)}
            aria-label="Activer le Maître de Guilde"
            className="coach-toggle-switch"
          />
        </div>

        {/* Sélection d'objectif si activé */}
        {settings.coachEnabled && (
          <div className="coach-goals-container">
            <h3 className="coach-goals-title">
              Votre style d'aventure & objectif
            </h3>
            <p className="coach-goals-sub">
              Le Maître adapte ses bilans et ses conseils selon votre cible
              actuelle.
            </p>

            <div
              className="coach-goals-grid"
              role="radiogroup"
              aria-label="Objectif sportif"
            >
              {GOAL_OPTIONS.map((opt) => {
                const isSelected = settings.coachGoal === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isSaving}
                    className={`coach-goal-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSelectGoal(opt.id)}
                  >
                    <div className="coach-goal-header">
                      <IonIcon
                        icon={opt.icon}
                        className="coach-goal-icon"
                        aria-hidden="true"
                      />
                      <span className="coach-goal-name">{opt.title}</span>
                      {isSelected && (
                        <IonIcon
                          icon={checkmarkCircle}
                          className="coach-goal-check"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="coach-goal-desc">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bannière de confidentialité et sobriété de stockage */}
        <div className="coach-privacy-banner">
          <IonIcon
            icon={lockClosedOutline}
            className="coach-privacy-icon"
            aria-hidden="true"
          />
          <p>
            <strong>Sobriété & respect de votre vie privée :</strong> les bilans
            sont calculés à la demande (lazy evaluation) et l'historique de
            discussion est strictement plafonné aux 30 derniers messages pour ne
            pas encombrer vos données. Le traitement est effectué en local par
            le modèle Ollama.
          </p>
        </div>

        {/* Messages de retour visuel */}
        {feedback && (
          <div className="coach-feedback-banner" role="status">
            <IonIcon icon={checkmarkCircle} aria-hidden="true" />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div className="coach-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default CoachSettingsSection;
