import React from "react";
import { IonIcon } from "@ionic/react";
import { lockClosedOutline, ribbonOutline } from "ionicons/icons";
import "./RpgBadgeCard.css";

export interface RpgBadgeCardProps {
  id?: string;
  name: string;
  description: string;
  icon?: string;
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
    >
      <div className="sq-badge-card-icon-wrapper">
        {unlocked ? (
          <IonIcon
            icon={icon || ribbonOutline}
            className="sq-badge-card-icon"
          />
        ) : (
          <IonIcon
            icon={lockClosedOutline}
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
