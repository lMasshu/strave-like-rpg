import type { WorkoutStatus } from "../hooks/useActiveWorkout";
import type { TrackedPosition } from "../hooks/useGeolocationTracker";

export type LivePaceState =
  "moving" | "stopped" | "unavailable" | "paused" | "inactive";

export interface LivePaceResult {
  state: LivePaceState;
  paceMinPerKm: string;
}

/** Instantaneous pace only: missing or stale fixes never become an average. */
export function getLivePace(
  position: TrackedPosition | null,
  nowMs: number,
  status: WorkoutStatus,
): LivePaceResult {
  if (status !== "recording") {
    return {
      state: status === "paused" ? "paused" : "inactive",
      paceMinPerKm: "--:--",
    };
  }

  if (
    !position ||
    position.speed === null ||
    !Number.isFinite(position.speed) ||
    position.speed < 0 ||
    !Number.isFinite(position.accuracy) ||
    position.accuracy === null ||
    position.accuracy < 0 ||
    position.accuracy > 25 ||
    !Number.isFinite(position.timestamp) ||
    position.timestamp <= 0 ||
    position.timestamp > nowMs ||
    nowMs - position.timestamp >= 3000
  ) {
    return { state: "unavailable", paceMinPerKm: "--:--" };
  }

  if (position.speed === 0) {
    return { state: "stopped", paceMinPerKm: "--:--" };
  }

  const totalSeconds = Math.round(1000 / position.speed);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    state: "moving",
    paceMinPerKm: `${minutes}:${String(seconds).padStart(2, "0")}`,
  };
}
