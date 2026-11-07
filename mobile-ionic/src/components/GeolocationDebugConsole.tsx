import React, { useState, useEffect } from "react";
import type {
  TrackedPosition,
  GeolocationStatus,
} from "../hooks/useGeolocationTracker";
import type { ActiveWorkoutMetrics } from "../hooks/useActiveWorkout";
import type { GeneratedQuest } from "../services/questGenerator";
import "./GeolocationDebugConsole.css";

export interface GeolocationDebugConsoleProps {
  position: TrackedPosition | null;
  status: GeolocationStatus;
  error?: string | null;
  simulating?: boolean;
  defaultExpanded?: boolean;
  // Contrôles Admin / Dev unifiés
  onToggleSimulation?: () => void;
  workoutMetrics?: ActiveWorkoutMetrics;
  activeQuest?: GeneratedQuest | null;
  onGenerateQuest?: (
    type: "loop" | "poi",
    distanceKm: number,
  ) => Promise<void> | void;
  onClearQuest?: () => void;
  isGeneratingQuest?: boolean;
  onClose?: () => void;
}

interface GpsLogEntry {
  id: string;
  timeStr: string;
  summary: string;
  type: "position" | "status" | "error";
}

export const GeolocationDebugConsole: React.FC<
  GeolocationDebugConsoleProps
> = ({
  position,
  status,
  error = null,
  simulating = false,
  defaultExpanded = true,
  onToggleSimulation,
  workoutMetrics,
  activeQuest = null,
  onGenerateQuest,
  onClearQuest,
  isGeneratingQuest = false,
  onClose,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [logs, setLogs] = useState<GpsLogEntry[]>([]);
  const [updateCount, setUpdateCount] = useState(0);

  // Formulaire de génération personnalisée
  const [customDistance, setCustomDistance] = useState(3.0);
  const [customType, setCustomType] = useState<"loop" | "poi">("loop");

  // Enregistrement des réceptions GPS en temps réel dans le journal
  useEffect(() => {
    if (!position) return;

    setUpdateCount((c) => c + 1);
    const now =
      typeof position.timestamp === "number" &&
      Number.isFinite(position.timestamp) &&
      position.timestamp > 0
        ? new Date(position.timestamp)
        : new Date();
    const timeStr = `${now.toTimeString().split(" ")[0]}.${String(
      now.getMilliseconds(),
    ).padStart(3, "0")}`;

    const altStr =
      typeof position.altitude === "number" &&
      Number.isFinite(position.altitude)
        ? `${position.altitude.toFixed(1)}m`
        : "N/A";
    const speedStr =
      typeof position.speed === "number" &&
      Number.isFinite(position.speed) &&
      position.speed >= 0
        ? `${(position.speed * 3.6).toFixed(1)}km/h`
        : "N/A";
    const latStr =
      typeof position.latitude === "number" &&
      Number.isFinite(position.latitude) &&
      Math.abs(position.latitude) <= 90
        ? position.latitude.toFixed(5)
        : "--";
    const lngStr =
      typeof position.longitude === "number" &&
      Number.isFinite(position.longitude) &&
      Math.abs(position.longitude) <= 180
        ? position.longitude.toFixed(5)
        : "--";
    const accStr =
      typeof position.accuracy === "number" &&
      Number.isFinite(position.accuracy) &&
      position.accuracy >= 0
        ? `±${position.accuracy.toFixed(0)}m`
        : "N/A";

    const entry: GpsLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timeStr,
      summary: `Fix: [${latStr}, ${lngStr}] alt:${altStr} vit:${speedStr} acc:${accStr}`,
      type: "position",
    };

    setLogs((prev) => [entry, ...prev.slice(0, 19)]);
  }, [position]);

  // Enregistrement des erreurs
  useEffect(() => {
    if (!error) return;

    const now = new Date();
    const timeStr = `${now.toTimeString().split(" ")[0]}.${String(
      now.getMilliseconds(),
    ).padStart(3, "0")}`;

    const entry: GpsLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timeStr,
      summary: `Erreur: ${error}`,
      type: "error",
    };

    setLogs((prev) => [entry, ...prev.slice(0, 19)]);
  }, [error]);

  const formatCoord = (
    value: number | undefined | null,
    type: "lat" | "lng" = "lat",
  ) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "--";
    const limit = type === "lat" ? 90 : 180;
    if (Math.abs(value) > limit) return "--";
    return value.toFixed(6);
  };

  const formatAltitude = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? `${value.toFixed(1)} m`
      : "--";

  const formatSpeed = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return "--";
    }
    const kmh = (value * 3.6).toFixed(1);
    const ms = value.toFixed(1);
    return `${kmh} km/h (${ms} m/s)`;
  };

  const formatAccuracy = (value: number | undefined | null) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? `±${value.toFixed(1)} m`
      : "--";

  const formatTimestamp = (value: number | undefined | null) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return "--";
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) return "--";
    return `${date.toLocaleTimeString()} (${value})`;
  };

  const statusLabel = (() => {
    if (simulating) return "Simulé";
    switch (status) {
      case "tracking":
        return "Actif (suivi)";
      case "waiting":
        return "Recherche signal";
      case "denied":
        return "Permission refusée";
      case "idle":
        return "Inactif";
      default:
        return status;
    }
  })();

  const effectiveStatus = simulating ? "simulated" : status;

  return (
    <aside
      className={`geolocation-debug-console ${isExpanded ? "expanded" : "collapsed"}`}
      data-testid="geolocation-debug-console"
      aria-label="Console debug de géolocalisation"
    >
      <header className="debug-console-header">
        <div className="debug-console-title-area">
          <span
            className={`debug-status-indicator status-${effectiveStatus}`}
          />
          <h3 className="debug-console-title">Console Debug GPS</h3>
          <span
            className={`debug-status-pill status-${effectiveStatus}`}
            data-testid="debug-status"
          >
            {statusLabel}
          </span>
          {updateCount > 0 && (
            <span className="debug-counter-badge">#{updateCount}</span>
          )}
        </div>

        <div className="debug-header-actions">
          <button
            type="button"
            className="debug-toggle-btn"
            data-testid="debug-toggle-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? "Réduire la console debug"
                : "Agrandir la console debug"
            }
          >
            {isExpanded ? "▲ Réduire" : "▼ Détails"}
          </button>
          {onClose && (
            <button
              type="button"
              className="debug-close-btn"
              onClick={onClose}
              title="Fermer le panel"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Résumé compact quand la console est repliée */}
      {!isExpanded && (
        <div className="debug-collapsed-summary">
          <span>
            {position &&
            typeof position.latitude === "number" &&
            Number.isFinite(position.latitude) &&
            Math.abs(position.latitude) <= 90 &&
            typeof position.longitude === "number" &&
            Number.isFinite(position.longitude) &&
            Math.abs(position.longitude) <= 180
              ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
              : "En attente GPS…"}
          </span>
          {position &&
            typeof position.accuracy === "number" &&
            Number.isFinite(position.accuracy) &&
            position.accuracy >= 0 && (
              <span>±{position.accuracy.toFixed(0)}m</span>
            )}
          {typeof position?.speed === "number" &&
            Number.isFinite(position.speed) &&
            position.speed >= 0 && (
              <span>{(position.speed * 3.6).toFixed(0)} km/h</span>
            )}
        </div>
      )}

      {/* Panneau complet visible */}
      {isExpanded && (
        <div className="debug-console-body">
          {error && <div className="debug-alert-box">{error}</div>}

          {/* Section Génération de Quêtes sur Commande (Admin) */}
          {onGenerateQuest && (
            <div className="admin-quest-gen-card">
              <div className="admin-section-title">
                🎲 Générateur de Quêtes (Admin)
              </div>
              {isGeneratingQuest ? (
                <div className="admin-gen-loading">
                  <span>Génération de l'itinéraire en cours…</span>
                </div>
              ) : (
                <div className="admin-gen-form">
                  <div className="admin-gen-row">
                    <div className="admin-field-group">
                      <label className="admin-field-label">Type :</label>
                      <div className="admin-type-toggle">
                        <button
                          type="button"
                          className={`admin-type-btn ${customType === "loop" ? "active" : ""}`}
                          onClick={() => setCustomType("loop")}
                        >
                          🔄 Boucle
                        </button>
                        <button
                          type="button"
                          className={`admin-type-btn ${customType === "poi" ? "active" : ""}`}
                          onClick={() => setCustomType("poi")}
                        >
                          📍 POI
                        </button>
                      </div>
                    </div>

                    <div className="admin-field-group">
                      <label
                        className="admin-field-label"
                        htmlFor="admin-dist-input"
                      >
                        Distance :
                      </label>
                      <div className="admin-input-wrap">
                        <input
                          id="admin-dist-input"
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="25"
                          value={customDistance}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              setCustomDistance(val);
                            }
                          }}
                          className="admin-dist-input"
                        />
                        <span className="admin-unit">km</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="admin-gen-submit-btn"
                    onClick={() => onGenerateQuest(customType, customDistance)}
                  >
                    🚀 Générer{" "}
                    {customType === "loop" ? "une boucle" : "une quête POI"} de{" "}
                    {customDistance} km
                  </button>
                </div>
              )}

              {activeQuest && onClearQuest && (
                <button
                  type="button"
                  className="admin-clear-quest-btn"
                  onClick={onClearQuest}
                >
                  ✕ Supprimer la quête et le tracé
                </button>
              )}
            </div>
          )}

          {/* Section Contrôle de Simulation Unifié */}
          {onToggleSimulation && (
            <div className="admin-sim-card">
              <div className="admin-sim-header">
                <span className="admin-sim-mode">
                  {activeQuest
                    ? `🎯 Mode Quête : ${activeQuest.title}`
                    : "🏃 Mode Course Libre"}
                </span>
                <span
                  className={`admin-sim-badge ${simulating ? "active" : ""}`}
                >
                  {simulating ? "SIMULATION ACTIVE" : "GPS MATÉRIEL"}
                </span>
              </div>
              <button
                type="button"
                className={`admin-sim-btn ${simulating ? "is-simulating" : ""}`}
                onClick={onToggleSimulation}
              >
                {simulating
                  ? "⏹️ Arrêter la simulation"
                  : "▶️ Démarrer la simulation de course"}
              </button>
            </div>
          )}

          {/* Section Télémétrie Course / Workout */}
          {workoutMetrics && (
            <div className="admin-workout-metrics">
              <div className="admin-section-title">
                Session Sportive en Direct
              </div>
              <div className="admin-workout-grid">
                <div className="admin-stat-item">
                  <span className="admin-stat-lbl">Statut</span>
                  <span className="admin-stat-val">
                    {workoutMetrics.status.toUpperCase()}
                  </span>
                </div>
                <div className="admin-stat-item">
                  <span className="admin-stat-lbl">Temps</span>
                  <span className="admin-stat-val">
                    {workoutMetrics.elapsedSeconds}s
                  </span>
                </div>
                <div className="admin-stat-item">
                  <span className="admin-stat-lbl">Distance</span>
                  <span className="admin-stat-val">
                    {workoutMetrics.distanceKm} km
                  </span>
                </div>
                <div className="admin-stat-item">
                  <span className="admin-stat-lbl">Allure</span>
                  <span className="admin-stat-val">
                    {workoutMetrics.paceMinPerKm}
                  </span>
                </div>
                <div className="admin-stat-item">
                  <span className="admin-stat-lbl">Tracé GPS</span>
                  <span className="admin-stat-val">
                    {workoutMetrics.trackCoordinates.length} pts
                  </span>
                </div>
                <div className="admin-stat-item">
                  <span className="admin-stat-lbl">Qualité Signal</span>
                  <span className="admin-stat-val">
                    {workoutMetrics.gpsQuality.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Données GPS Brutes */}
          <div className="debug-grid">
            <div className="debug-cell">
              <span className="debug-cell-label">Latitude</span>
              <span className="debug-cell-value" data-testid="debug-latitude">
                {position ? formatCoord(position.latitude, "lat") : "--"}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Longitude</span>
              <span className="debug-cell-value" data-testid="debug-longitude">
                {position ? formatCoord(position.longitude, "lng") : "--"}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Altitude</span>
              <span className="debug-cell-value" data-testid="debug-altitude">
                {formatAltitude(position?.altitude)}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Vitesse</span>
              <span className="debug-cell-value" data-testid="debug-speed">
                {formatSpeed(position?.speed)}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Précision</span>
              <span className="debug-cell-value" data-testid="debug-accuracy">
                {formatAccuracy(position?.accuracy)}
              </span>
            </div>

            <div className="debug-cell debug-cell-wide">
              <span className="debug-cell-label">Horodatage</span>
              <span className="debug-cell-value" data-testid="debug-timestamp">
                {formatTimestamp(position?.timestamp)}
              </span>
            </div>
          </div>

          <section className="debug-log-section">
            <div className="debug-log-header">
              <span className="debug-log-title">
                Flux d'événements ({logs.length})
              </span>
              {logs.length > 0 && (
                <button
                  type="button"
                  className="debug-log-clear-btn"
                  onClick={() => setLogs([])}
                  aria-label="Effacer le journal d'événements"
                >
                  Effacer
                </button>
              )}
            </div>

            <ul className="debug-log-list" data-testid="debug-log-list">
              {logs.length === 0 ? (
                <li className="debug-log-empty">
                  {status === "waiting"
                    ? "En attente des premières coordonnées GPS…"
                    : "Aucun événement enregistré."}
                </li>
              ) : (
                logs.map((log) => (
                  <li key={log.id} className={`debug-log-item log-${log.type}`}>
                    <time className="debug-log-time">[{log.timeStr}]</time>
                    <span className="debug-log-msg">{log.summary}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </aside>
  );
};

export default GeolocationDebugConsole;
