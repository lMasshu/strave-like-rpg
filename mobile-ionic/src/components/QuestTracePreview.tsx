import React from "react";
import "./QuestTracePreview.css";

interface QuestTracePreviewProps {
  distanceKm: number;
  elevationMeters: number;
  durationMinutes?: number;
  className?: string;
}

const QuestTracePreview: React.FC<QuestTracePreviewProps> = ({
  distanceKm,
  elevationMeters,
  className = "",
}) => {
  return (
    <div
      className={`sq-trace-preview ${className}`}
      data-testid="quest-trace-svg"
      aria-label={`Tracé de quête de ${distanceKm} kilomètres et ${elevationMeters} mètres de dénivelé`}
    >
      <div className="sq-trace-canvas-wrap">
        <svg
          viewBox="0 0 320 160"
          className="sq-trace-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="traceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--sq-green-athletic, #16a34a)" />
              <stop
                offset="60%"
                stopColor="var(--sq-green-athletic-tint, #22c55e)"
              />
              <stop offset="100%" stopColor="var(--sq-gold-rpg, #d97706)" />
            </linearGradient>
            <filter id="traceGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grille technique de fond discrète */}
          <line
            x1="20"
            y1="40"
            x2="300"
            y2="40"
            stroke="var(--sq-border)"
            strokeDasharray="3 4"
            strokeWidth="0.8"
            opacity="0.4"
          />
          <line
            x1="20"
            y1="80"
            x2="300"
            y2="80"
            stroke="var(--sq-border)"
            strokeDasharray="3 4"
            strokeWidth="0.8"
            opacity="0.4"
          />
          <line
            x1="20"
            y1="120"
            x2="300"
            y2="120"
            stroke="var(--sq-border)"
            strokeDasharray="3 4"
            strokeWidth="0.8"
            opacity="0.4"
          />

          {/* Boucle vectorielle de parcours asymétrique anti-aller-retour */}
          <path
            d="M 50 110 C 30 70, 70 30, 130 35 C 190 40, 260 25, 280 65 C 295 95, 250 135, 180 130 C 120 125, 75 140, 50 110 Z"
            stroke="url(#traceGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Point de départ et d'arrivée */}
          <circle
            cx="50"
            cy="110"
            r="5"
            fill="var(--sq-green-athletic, #16a34a)"
          />
          <circle
            cx="50"
            cy="110"
            r="8"
            stroke="var(--sq-green-athletic, #16a34a)"
            strokeWidth="1.5"
            opacity="0.6"
          />

          {/* Balise sommet / POI mi-parcours */}
          <circle cx="280" cy="65" r="4" fill="var(--sq-gold-rpg, #d97706)" />
        </svg>

        <div className="sq-trace-elevation-chip">
          <span className="sq-tabular">{elevationMeters} m D+</span>
        </div>
      </div>
    </div>
  );
};

export default QuestTracePreview;
