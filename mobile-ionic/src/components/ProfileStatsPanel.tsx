import { useState } from "react";
import { IonSpinner } from "@ionic/react";
import StatMetric from "./StatMetric";
import {
  activitiesOfSport,
  computeTotals,
  DistanceBar,
  distanceBars,
  formatActiveDuration,
  periodLabel,
  periodRange,
  SportType,
  SPORTS,
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
  /** Sports pratiqués par le compte (déduits de tout son historique). */
  sports: SportType[];
}

const PERIODS: { id: StatsPeriod; label: string; chartTitle: string }[] = [
  { id: "week", label: "Semaine", chartTitle: "Distance par jour" },
  { id: "month", label: "Mois", chartTitle: "Distance par semaine" },
  { id: "year", label: "Année", chartTitle: "Distance par mois" },
];

function formatThousands(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

interface DistanceBarChartProps {
  bars: DistanceBar[];
  period: StatsPeriod;
  label: string;
}

/** Histogramme des kilomètres, une barre par jour, tranche de jours ou mois. */
const DistanceBarChart: React.FC<DistanceBarChartProps> = ({
  bars,
  period,
  label,
}) => {
  const maxKm = Math.max(1, ...bars.map((bar) => bar.km));
  return (
    <div
      className={`sq-profile-barchart sq-stats-chart-${period}`}
      role="list"
      aria-label={label}
    >
      {bars.map((bar) => (
        <div
          key={bar.label}
          className={`sq-barchart-col sq-stats-bar${bar.isCurrent ? " is-current" : ""}`}
          role="listitem"
          aria-label={`${bar.label} : ${bar.km} km`}
        >
          <span className="sq-barchart-val sq-tabular" aria-hidden="true">
            {bar.km > 0 ? bar.km : ""}
          </span>
          <div className="sq-barchart-bar-track" aria-hidden="true">
            <div
              className="sq-barchart-bar-fill"
              style={{ height: `${Math.round((bar.km / maxKm) * 100)}%` }}
            />
          </div>
          <span className="sq-barchart-label" aria-hidden="true">
            {bar.label}
          </span>
        </div>
      ))}
    </div>
  );
};

/** Statistiques du profil calculées à partir des vraies activités de la période choisie. */
const ProfileStatsPanel: React.FC<ProfileStatsPanelProps> = ({
  period,
  onPeriodChange,
  activities,
  loading,
  error,
  now,
  sports,
}) => {
  const [chosenSport, setChosenSport] = useState<SportType | null>(null);
  // Le sport choisi peut disparaître de la liste (rechargement) : on retombe sur le premier.
  const sport =
    chosenSport && sports.includes(chosenSport) ? chosenSport : sports[0];

  const range = periodRange(period, now);
  const totals = computeTotals(activities, range);
  const bars = distanceBars(period, range, activities, now);
  const current = PERIODS.find((p) => p.id === period)!;
  const sportLabel = SPORTS.find((s) => s.id === sport)?.label ?? "";
  const sportBars = sport
    ? distanceBars(period, range, activitiesOfSport(activities, sport), now)
    : [];

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

        <DistanceBarChart
          bars={bars}
          period={period}
          label={current.chartTitle}
        />
      </section>

      <section
        className="sq-card sq-profile-barchart-card"
        aria-labelledby="sport-chart-heading"
      >
        <div className="sq-profile-section-header">
          <div>
            <h2 id="sport-chart-heading" className="sq-section-title">
              Distance par sport
            </h2>
            <p className="sq-profile-section-sub">
              {sport
                ? `${current.chartTitle} · ${sportLabel}`
                : "Volume en kilomètres"}
            </p>
          </div>
        </div>

        {sport ? (
          <>
            <div
              className="sq-stats-periods sq-stats-sports"
              role="group"
              aria-label="Sport affiché"
              style={{
                gridTemplateColumns: `repeat(${sports.length}, minmax(0, 1fr))`,
              }}
            >
              {sports.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id === sport}
                  className={id === sport ? "is-active" : ""}
                  onClick={() => setChosenSport(id)}
                >
                  {SPORTS.find((s) => s.id === id)?.label}
                </button>
              ))}
            </div>
            <DistanceBarChart
              bars={sportBars}
              period={period}
              label={`${current.chartTitle} – ${sportLabel}`}
            />
          </>
        ) : (
          <p className="sq-stats-message">
            Enregistre une première sortie pour voir tes kilomètres par sport.
          </p>
        )}
      </section>
    </>
  );
};

export default ProfileStatsPanel;
