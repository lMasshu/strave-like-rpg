import React from "react";
import LineMdIcon from "./LineMdIcon";
import "./RaidBossBanner.css";

export interface RaidBossBannerProps {
  name: string;
  location: string;
  currentHp: number;
  maxHp: number;
  endsIn: string;
  tier?: string;
  onJoinRaid?: () => void;
  className?: string;
}

const RaidBossBanner: React.FC<RaidBossBannerProps> = ({
  name,
  location,
  currentHp,
  maxHp,
  endsIn,
  tier = "Raid Régional",
  onJoinRaid,
  className = "",
}) => {
  const percentage =
    maxHp > 0
      ? Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)))
      : 0;
  const percentageText = `${percentage}%`;

  return (
    <div className={`sq-card sq-raid-boss-card ${className}`.trim()}>
      <div className="sq-raid-boss-header">
        <div className="sq-raid-boss-meta">
          <span className="sq-badge sq-badge-danger">
            <LineMdIcon name="alert" />
            {tier}
          </span>
          <span className="sq-badge sq-badge-muted">
            <LineMdIcon name="watch" />
            {endsIn}
          </span>
        </div>
      </div>

      <div className="sq-raid-boss-identity">
        <h3 className="sq-raid-boss-title">{name}</h3>
        <p className="sq-raid-boss-location">
          <LineMdIcon name="map-marker" />
          <span>{location}</span>
        </p>
      </div>

      <div className="sq-raid-boss-hp-section">
        <div className="sq-raid-boss-hp-info">
          <span className="sq-raid-hp-label">Points de Vie Globaux</span>
          <span className="sq-raid-hp-percent sq-tabular">
            {percentageText}
          </span>
        </div>

        <div className="sq-progress">
          <div
            className="sq-progress-bar sq-progress-raid"
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <div className="sq-raid-boss-hp-details sq-tabular">
          <span>{currentHp.toLocaleString("fr-FR")} PV</span>
          <span>Max {maxHp.toLocaleString("fr-FR")} PV</span>
        </div>
      </div>

      {onJoinRaid && (
        <button
          type="button"
          className="sq-button-primary sq-raid-boss-cta"
          onClick={onJoinRaid}
        >
          Participer au Raid
        </button>
      )}
    </div>
  );
};

export default RaidBossBanner;
