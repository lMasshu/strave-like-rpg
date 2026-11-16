import type { LivePaceState } from "../services/livePace";
import { getLivePaceCaption } from "../services/livePacePresentation";

interface LivePaceMetricProps {
  state: LivePaceState;
  paceMinPerKm: string;
}

/** Compact map readout, including why the live pace is unavailable. */
export default function LivePaceMetric({
  state,
  paceMinPerKm,
}: LivePaceMetricProps): React.JSX.Element {
  return (
    <div className="live-metric-item" aria-label="Rythme réel">
      <span className="live-metric-val sq-tabular">{paceMinPerKm}</span>
      <span className="live-metric-lbl">
        {state === "moving" || state === "inactive"
          ? "Rythme réel"
          : getLivePaceCaption(state)}
      </span>
    </div>
  );
}
