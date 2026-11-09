import React from "react";
import LineMdIcon, { type LineMdIconName } from "./LineMdIcon";
import "./RpgBadgeCard.css";

export interface RpgBadgeCardProps {
  id?: string;
  name: string;
  description: string;
  icon?: LineMdIconName;
  unlocked?: boolean;
  unlockedAt?: string;
  category?: string;
  onClick?: () => void;
  className?: string;
}

const RpgBadgeCard: React.FC<RpgBadgeCardProps> = ({
  name,
  description,
  icon,
  unlocked = false,
  unlockedAt,
  onClick,
  className = "",
}) => {
  return (
    <div
      className={`sq-card sq-badge-card ${unlocked ? "unlocked" : "locked"} ${onClick ? "sq-card-interactive" : ""} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="sq-badge-card-icon-wrapper">
        {unlocked ? (
          <LineMdIcon name={icon || "star"} className="sq-badge-card-icon" />
        ) : (
          <LineMdIcon
            name="security"
            className="sq-badge-card-icon locked-icon"
          />
        )}
      </div>

      <div className="sq-badge-card-content">
        <div className="sq-badge-card-header">
          <h4 className="sq-badge-card-title">{name}</h4>
          {unlocked ? (
            unlockedAt && (
              <span className="sq-badge sq-badge-gold">{unlockedAt}</span>
            )
          ) : (
            <span className="sq-badge sq-badge-muted">Verrouillé</span>
          )}
        </div>
        <p className="sq-badge-card-desc">{description}</p>
      </div>
    </div>
  );
};

export default RpgBadgeCard;
