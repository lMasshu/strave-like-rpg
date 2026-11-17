import { IonSpinner } from "@ionic/react";
import StatMetric from "./StatMetric";
import TodoPlaceholder from "./TodoPlaceholder";
import {
  computeTotals,
  distanceBars,
  formatActiveDuration,
  periodLabel,
  periodRange,
  StatsActivity,
  StatsPeriod,
} from "../services/activityStats";
import "./ProfileStatsPanel.css";

export interface ProfileStatsPanelProps {
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
  /** Résumés des activités de la période (renvoyés par l'API). */
  activities: StatsActivity[];
  loading: boolean;
  error: string | null;
  now: Date;
}

const PERIODS: { id: StatsPeriod; label: string; chartTitle: string }[] = [
  { id: "week", label: "Semaine", chartTitle: "Distance par jour" },
  { id: "month", label: "Mois", chartTitle: "Distance par semaine" },
  { id: "year", label: "Année", chartTitle: "Distance par mois" },
];

function formatThousands(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Statistiques du profil calculées à partir des vraies activités de la période choisie. */
const ProfileStatsPanel: React.FC<ProfileStatsPanelProps> = ({
  period,
  onPeriodChange,
  activities,
  loading,
  error,
  now,
}) => {
  const range = periodRange(period, now);
  const totals = computeTotals(activities, range);
  const bars = distanceBars(period, range, activities, now);
  const maxKm = Math.max(1, ...bars.map((bar) => bar.km));
  const current = PERIODS.find((p) => p.id === period)!;

  return (
    <>
      <section className="sq-profile-section" aria-labelledby="stats-heading">
        <div className="sq-profile-section-header sq-stats-header">
          <div>
            <h2 id="stats-heading" className="sq-section-title">
              Statistiques
            </h2>
            <p className="sq-profile-section-sub">
              {periodLabel(period, range)}
            </p>
          </div>
          {loading && <IonSpinner name="crescent" aria-label="Chargement" />}
        </div>

        <div
          className="sq-stats-periods"
          role="group"
          aria-label="Période des statistiques"
        >
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === period}
              className={option.id === period ? "is-active" : ""}
              onClick={() => onPeriodChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="sq-stats-message" role="alert">
            {error}
          </p>
        )}

        <div className="sq-profile-stats-grid">
          <StatMetric label="Distance" value={totals.distanceKm} unit="km" />
          <StatMetric
            label="Dénivelé"
            value={formatThousands(totals.elevationMeters)}
            unit="m D+"
          />
          <StatMetric
            label="Sorties"
            value={totals.activityCount}
            unit={totals.activityCount > 1 ? "sorties" : "sortie"}
          />
          <StatMetric
            label="Temps actif"
            value={formatActiveDuration(totals.durationSeconds)}
          />
        </div>

        {!loading && !error && totals.activityCount === 0 && (
          <p className="sq-stats-message">Aucune sortie sur cette période.</p>
        )}
      </section>

      <section
        className="sq-card sq-profile-barchart-card"
        aria-labelledby="stats-chart-heading"
      >
        <div className="sq-profile-section-header">
          <div>
            <h2 id="stats-chart-heading" className="sq-section-title">
              {current.chartTitle}
            </h2>
            <p className="sq-profile-section-sub">Volume en kilomètres</p>
          </div>
        </div>

        <div
          className={`sq-profile-barchart sq-stats-chart-${period}`}
          role="list"
          aria-label={current.chartTitle}
        >
          {bars.map((bar) => (
            <div
              key={bar.label}
              className="sq-barchart-col"
              role="listitem"
              aria-label={`${bar.label} : ${bar.km} km`}
            >
              <span className="sq-barchart-val sq-tabular" aria-hidden="true">
                {bar.km > 0 ? bar.km : ""}
              </span>
              <div className="sq-barchart-bar-track" aria-hidden="true">
                <div
                  className={`sq-barchart-bar-fill ${bar.isCurrent ? "is-current" : ""}`}
                  style={{
                    height: `${Math.round((bar.km / maxKm) * 100)}%`,
                  }}
                />
              </div>
              <span className="sq-barchart-label" aria-hidden="true">
                {bar.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <TodoPlaceholder>TODO: graphique par sport pratiqué</TodoPlaceholder>
    </>
  );
};

export default ProfileStatsPanel;
