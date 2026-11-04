import React, { useState, useEffect } from "react";
import type {
  TrackedPosition,
  GeolocationStatus,
} from "../hooks/useGeolocationTracker";
import "./GeolocationDebugConsole.css";

export interface GeolocationDebugConsoleProps {
  position: TrackedPosition | null;
  status: GeolocationStatus;
  error?: string | null;
  simulating?: boolean;
  defaultExpanded?: boolean;
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
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [logs, setLogs] = useState<GpsLogEntry[]>([]);
  const [updateCount, setUpdateCount] = useState(0);

  // Enregistrement des réceptions GPS en temps réel dans le journal
  useEffect(() => {
    if (!position) return;

    setUpdateCount((c) => c + 1);
    const now = new Date(position.timestamp);
    const timeStr = `${now.toTimeString().split(" ")[0]}.${String(
      now.getMilliseconds(),
    ).padStart(3, "0")}`;

    const altStr =
      position.altitude !== null ? `${position.altitude.toFixed(1)}m` : "N/A";
    const speedStr =
      position.speed !== null
        ? `${(position.speed * 3.6).toFixed(1)}km/h`
        : "0km/h";

    const entry: GpsLogEntry = {
      id: `${position.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      timeStr,
      summary: `Lat: ${position.latitude.toFixed(5)}, Lng: ${position.longitude.toFixed(5)} | Alt: ${altStr} | Vit: ${speedStr} | ±${position.accuracy.toFixed(0)}m`,
      type: "position",
    };

    setLogs((prev) => [entry, ...prev.slice(0, 19)]);
  }, [position]);

  // Enregistrement des changements de statut / erreurs
  useEffect(() => {
    if (error) {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      setLogs((prev) => [
        {
          id: `err-${Date.now()}`,
          timeStr,
          summary: `Erreur: ${error}`,
          type: "error",
        },
        ...prev.slice(0, 19),
      ]);
    }
  }, [error]);

  const formatCoord = (value: number | undefined) =>
    value !== undefined ? value.toFixed(6) : "--";

  const formatAltitude = (value: number | null | undefined) =>
    value !== null && value !== undefined ? `${value.toFixed(1)} m` : "--";

  const formatSpeed = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "--";
    const kmh = (value * 3.6).toFixed(1);
    const ms = value.toFixed(1);
    return `${kmh} km/h (${ms} m/s)`;
  };

  const formatAccuracy = (value: number | undefined) =>
    value !== undefined ? `±${value.toFixed(1)} m` : "--";

  const formatTimestamp = (value: number | undefined) => {
    if (!value) return "--";
    const date = new Date(value);
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
          <span className={`debug-status-indicator status-${effectiveStatus}`} />
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
      </header>

      {/* Résumé compact quand la console est repliée */}
      {!isExpanded && (
        <div className="debug-collapsed-summary">
          <span>
            {position
              ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
              : "En attente GPS…"}
          </span>
          {position && <span>±{position.accuracy.toFixed(0)}m</span>}
          {position?.speed !== null && position?.speed !== undefined && (
            <span>{(position.speed * 3.6).toFixed(0)} km/h</span>
          )}
        </div>
      )}

      {/* Panneau complet visible par défaut */}
      {isExpanded && (
        <div className="debug-console-body">
          {error && <div className="debug-alert-box">{error}</div>}

          <div className="debug-grid">
            <div className="debug-cell">
              <span className="debug-cell-label">Latitude</span>
              <span
                className="debug-cell-value"
                data-testid="debug-latitude"
              >
                {position ? formatCoord(position.latitude) : "--"}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Longitude</span>
              <span
                className="debug-cell-value"
                data-testid="debug-longitude"
              >
                {position ? formatCoord(position.longitude) : "--"}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Altitude</span>
              <span
                className="debug-cell-value"
                data-testid="debug-altitude"
              >
                {formatAltitude(position?.altitude)}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Vitesse</span>
              <span
                className="debug-cell-value"
                data-testid="debug-speed"
              >
                {formatSpeed(position?.speed)}
              </span>
            </div>

            <div className="debug-cell">
              <span className="debug-cell-label">Précision</span>
              <span
                className="debug-cell-value"
                data-testid="debug-accuracy"
              >
                {formatAccuracy(position?.accuracy)}
              </span>
            </div>

            <div className="debug-cell debug-cell-wide">
              <span className="debug-cell-label">Horodatage</span>
              <span
                className="debug-cell-value"
                data-testid="debug-timestamp"
              >
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
                >
                  Effacer
                </button>
              )}
            </div>

            <ul
              className="debug-log-list"
              data-testid="debug-log-list"
            >
              {logs.length === 0 ? (
                <li className="debug-log-empty">
                  {status === "waiting"
                    ? "En attente des premières coordonnées GPS…"
                    : "Aucun événement enregistré."}
                </li>
              ) : (
                logs.map((log) => (
                  <li
                    key={log.id}
                    className={`debug-log-item log-${log.type}`}
                  >
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
