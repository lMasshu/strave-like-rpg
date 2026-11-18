import React, { useEffect, useRef, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  chatbubblesOutline,
  closeOutline,
  documentTextOutline,
  refreshOutline,
  sendOutline,
  settingsOutline,
  sparklesOutline,
  warningOutline,
} from "ionicons/icons";
import { useNavigate } from "react-router-dom";
import {
  apiClient,
  CoachMessageDto,
  CoachWeeklyReportDto,
} from "../services/apiClient";
import "./GuildMasterModal.css";

export interface GuildMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "report" | "chat";
}

const QUICK_PROMPTS = [
  "Bilan de mes sorties récentes",
  "Conseils pour préparer un marathon dans 6 mois",
  "Que faire pour bien récupérer après une sortie longue ?",
  "Comment améliorer mon endurance sans me blesser ?",
];

function formatDurationMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours === 0) return `${remainMins} min`;
  return `${hours} h ${remainMins > 0 ? `${remainMins} min` : ""}`;
}

const GuildMasterModal: React.FC<GuildMasterModalProps> = ({
  isOpen,
  onClose,
  defaultTab = "report",
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"report" | "chat">(defaultTab);

  // État du Bilan
  const [report, setReport] = useState<CoachWeeklyReportDto | null>(null);
  const [isCoachEnabled, setIsCoachEnabled] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // État du Chat
  const [messages, setMessages] = useState<CoachMessageDto[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger le bilan et les messages à l'ouverture
  useEffect(() => {
    if (!isOpen) return;

    loadWeeklyReport();
    loadMessages();
  }, [isOpen]);

  // Scroll automatique au dernier message
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages, activeTab, isSending]);

  const loadWeeklyReport = async () => {
    setIsReportLoading(true);
    setReportError(null);
    try {
      const data = await apiClient.getCoachWeeklyReport();
      setIsCoachEnabled(data.enabled);
      setReport(data.report);
    } catch (err: unknown) {
      setReportError(
        err instanceof Error
          ? err.message
          : "Impossible de joindre le Maître de Guilde.",
      );
    } finally {
      setIsReportLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const list = await apiClient.getCoachMessages();
      // list est antéchronologique (plus récents en premier) -> on inverse pour la conversation
      setMessages([...list].reverse());
    } catch (err) {
      console.warn("Impossible de charger les messages du coach :", err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setInputText("");
    setChatError(null);

    // Ajout optimiste du message utilisateur
    const optimisticUserMsg: CoachMessageDto = {
      id: `temp-${Date.now()}`,
      playerId: "me",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsSending(true);

    try {
      const assistantMsg = await apiClient.sendCoachMessage(text);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Le Maître de Guilde est inaccessible pour le moment.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleGoToSettings = () => {
    onClose();
    navigate("/parametres");
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="guild-master-modal"
    >
      <IonHeader className="top-bar">
        <IonToolbar>
          <div className="guild-master-title-row">
            <span className="guild-master-avatar" aria-hidden="true">
              🧙‍♂️
            </span>
            <div>
              <IonTitle>Maître de Guilde</IonTitle>
              <span className="guild-master-subtitle">
                Coach sportif & mentor RPG
              </span>
            </div>
          </div>
          <IonButtons slot="end">
            <IonButton onClick={onClose} aria-label="Fermer">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>

        <div className="guild-master-segment-bar">
          <IonSegment
            value={activeTab}
            onIonChange={(e) =>
              setActiveTab(e.detail.value as "report" | "chat")
            }
          >
            <IonSegmentButton value="report">
              <IonIcon icon={documentTextOutline} />
              Bilan Hebdo
            </IonSegmentButton>
            <IonSegmentButton value="chat">
              <IonIcon icon={chatbubblesOutline} />
              Discussion
            </IonSegmentButton>
          </IonSegment>
        </div>
      </IonHeader>

      <IonContent className="guild-master-content">
        {/* ================= Onglet 1 : Bilan Hebdomadaire ================= */}
        {activeTab === "report" && (
          <div className="guild-master-tab-pane">
            {!isCoachEnabled ? (
              <div className="coach-disabled-card">
                <div className="coach-disabled-icon" aria-hidden="true">
                  <IonIcon icon={sparklesOutline} />
                </div>
                <h3>Le Maître de Guilde se repose</h3>
                <p>
                  Pour que le Maître analyse vos kilomètres, prépare vos bilans
                  et suive vos objectifs, activez-le dans vos paramètres.
                </p>
                <IonButton
                  expand="block"
                  onClick={handleGoToSettings}
                  className="coach-settings-btn"
                >
                  <IonIcon icon={settingsOutline} slot="start" />
                  Ouvrir les Paramètres
                </IonButton>
              </div>
            ) : isReportLoading ? (
              <div className="coach-loading-pane">
                <IonSpinner name="crescent" />
                <p>Le Maître consulte les parchemins de vos aventures…</p>
              </div>
            ) : reportError ? (
              <div className="coach-error-card">
                <IonIcon icon={warningOutline} className="coach-warning-icon" />
                <h3>Parchemins inaccessibles</h3>
                <p>{reportError}</p>
                <IonButton fill="outline" onClick={loadWeeklyReport}>
                  <IonIcon icon={refreshOutline} slot="start" />
                  Réessayer
                </IonButton>
              </div>
            ) : report ? (
              <div className="coach-report-container">
                <div className="coach-report-meta">
                  <span className="coach-report-badge">
                    Semaine {report.weekNumber} • {report.year}
                  </span>
                  <button
                    type="button"
                    className="coach-refresh-btn"
                    onClick={loadWeeklyReport}
                    aria-label="Actualiser le bilan"
                  >
                    <IonIcon icon={refreshOutline} />
                  </button>
                </div>

                {/* Métriques clés */}
                <div className="coach-metrics-grid">
                  <div className="coach-metric-card">
                    <span className="coach-metric-val">
                      {(report.summary.totalDistanceMeters / 1000).toFixed(1)}{" "}
                      <small>km</small>
                    </span>
                    <span className="coach-metric-label">Distance</span>
                  </div>
                  <div className="coach-metric-card">
                    <span className="coach-metric-val">
                      {formatDurationMinutes(
                        report.summary.totalDurationSeconds,
                      )}
                    </span>
                    <span className="coach-metric-label">Temps</span>
                  </div>
                  <div className="coach-metric-card">
                    <span className="coach-metric-val">
                      {report.summary.activityCount}
                    </span>
                    <span className="coach-metric-label">Sorties</span>
                  </div>
                  <div className="coach-metric-card">
                    <span className="coach-metric-val">
                      +{report.summary.elevationGainMeters} <small>m</small>
                    </span>
                    <span className="coach-metric-label">D+</span>
                  </div>
                </div>

                {/* Parchemin du Maître */}
                <article className="coach-parchment-card">
                  <div className="coach-parchment-header">
                    <span className="coach-parchment-tag">
                      Message du Maître de Guilde
                    </span>
                  </div>
                  <div className="coach-parchment-body">
                    {report.reportText.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </article>

                <div className="coach-chat-invite">
                  <p>Une question sur ce bilan ou votre prochaine séance ?</p>
                  <IonButton
                    fill="outline"
                    size="small"
                    onClick={() => setActiveTab("chat")}
                  >
                    <IonIcon icon={chatbubblesOutline} slot="start" />
                    Discuter avec le Maître
                  </IonButton>
                </div>
              </div>
            ) : (
              <div className="coach-empty-card">
                <p>Aucun bilan disponible pour cette semaine.</p>
                <IonButton fill="outline" onClick={loadWeeklyReport}>
                  Générer le bilan
                </IonButton>
              </div>
            )}
          </div>
        )}

        {/* ================= Onglet 2 : Salon de discussion ================= */}
        {activeTab === "chat" && (
          <div className="guild-master-chat-pane">
            <div className="coach-chat-stream">
              {messages.length === 0 && (
                <div className="coach-chat-welcome">
                  <span className="coach-welcome-avatar" aria-hidden="true">
                    🧙‍♂️
                  </span>
                  <h3>Bienvenue à la Guilde</h3>
                  <p>
                    Je suis à votre écoute pour vous conseiller sur vos sorties,
                    préparer un objectif (5k, 10k, marathon) ou optimiser votre
                    récupération.
                  </p>
                </div>
              )}

              {messages.map((msg, index) => {
                const isAssistant = msg.role === "assistant";
                return (
                  <div
                    key={msg.id || index}
                    className={`coach-chat-row ${isAssistant ? "is-assistant" : "is-user"}`}
                  >
                    {isAssistant && (
                      <div className="coach-bubble-avatar" aria-hidden="true">
                        🧙‍♂️
                      </div>
                    )}
                    <div className="coach-chat-bubble">
                      <div className="coach-bubble-text">
                        {msg.content.split("\n\n").map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="coach-chat-row is-assistant">
                  <div className="coach-bubble-avatar" aria-hidden="true">
                    🧙‍♂️
                  </div>
                  <div className="coach-chat-bubble coach-typing-bubble">
                    <span className="coach-typing-dot" />
                    <span className="coach-typing-dot" />
                    <span className="coach-typing-dot" />
                  </div>
                </div>
              )}

              {chatError && (
                <div className="coach-chat-error-banner" role="alert">
                  <IonIcon icon={warningOutline} aria-hidden="true" />
                  <span>{chatError}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions rapides de questions */}
            <div className="coach-quick-prompts-bar">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  className="coach-prompt-pill"
                  disabled={isSending}
                  onClick={() => handleSendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Barre de saisie */}
            <form
              className="coach-input-bar"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                placeholder="Posez votre question au Maître…"
                value={inputText}
                disabled={isSending}
                onChange={(e) => setInputText(e.target.value)}
                className="coach-input-field"
                aria-label="Votre question"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="coach-send-btn"
                aria-label="Envoyer"
              >
                <IonIcon icon={sendOutline} />
              </button>
            </form>
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default GuildMasterModal;
