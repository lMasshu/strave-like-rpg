import React from "react";
import "./StatMetric.css";

export interface StatMetricProps {
  value: string | number;
  unit?: string;
  label: string;
  icon?: string;
  trend?: string;
  className?: string;
}

const StatMetric: React.FC<StatMetricProps> = ({
  value,
  unit,
  label,
  trend,
  className = "",
}) => {
  return (
    <div className={`sq-stat-metric ${className}`.trim()}>
      <div className="sq-stat-metric-header">
        <span className="sq-stat-metric-label">{label}</span>
      </div>
      <div className="sq-stat-metric-body">
        <span className="sq-stat-metric-value sq-tabular">{value}</span>
        {unit && <span className="sq-stat-metric-unit">{unit}</span>}
      </div>
      {trend && <div className="sq-stat-metric-trend">{trend}</div>}
    </div>
  );
};

export default StatMetric;
