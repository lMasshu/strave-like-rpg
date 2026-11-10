import type {
  ActivityRecording,
  RecordedSample,
  RecordingEvent,
  TrackSegment,
} from "../data/activityRecording";
import type { WorkoutStatus } from "../hooks/useActiveWorkout";
import { haversineMeters } from "./geo";

export interface WorkoutRecordingState {
  status: WorkoutStatus;
  recording: ActivityRecording;
  distanceMeters: number;
  elevationGainMeters: number;
  lastTrackSample: RecordedSample | null;
  lastAltitudeMeters: number | null;
  lastAccurateTimestampMs: number | null;
  pendingReason: TrackSegment["reason"] | null;
}

export interface RecordingSnapshot {
  startedAtMs: number;
  endedAtMs: number | null;
  recording: ActivityRecording;
  distanceMeters: number;
  elevationGainMeters: number;
}

export type RecordingAction =
  | { type: RecordingEvent["type"]; timestampMs: number }
  | { type: "sample"; sample: RecordedSample; receivedAtMs: number }
  | { type: "signalLost" }
  | { type: "reset" };

export function createRecordingState(): WorkoutRecordingState {
  return {
    status: "idle",
    recording: {
      version: 1,
      requestedIntervalMs: 1000,
      samples: [],
      events: [],
      segments: [],
      elapsedDurationMs: 0,
      activeDurationMs: 0,
    },
    distanceMeters: 0,
    elevationGainMeters: 0,
    lastTrackSample: null,
    lastAltitudeMeters: null,
    lastAccurateTimestampMs: null,
    pendingReason: "start",
  };
}

function coordinate(sample: RecordedSample): [number, number] {
  return [sample.longitude, sample.latitude];
}

export function reduceRecording(
  state: WorkoutRecordingState,
  action: RecordingAction,
): WorkoutRecordingState {
  if (action.type === "reset") return createRecordingState();
  if (action.type === "signalLost") {
    if (state.status !== "recording" || state.pendingReason) return state;
    return {
      ...state,
      lastTrackSample: null,
      lastAltitudeMeters: null,
      lastAccurateTimestampMs: null,
      pendingReason: "gps-gap",
    };
  }
  if (action.type !== "sample") {
    const allowed =
      action.type === "start"
        ? state.status === "idle"
        : action.type === "resume"
          ? state.status === "paused"
          : action.type === "pause"
            ? state.status === "recording"
            : state.status === "recording" || state.status === "paused";
    if (!allowed) return state;
    const latest = Math.max(
      state.recording.events.at(-1)?.timestampMs ?? 0,
      state.recording.samples.at(-1)?.timestampMs ?? 0,
    );
    if (
      !Number.isSafeInteger(action.timestampMs) ||
      action.timestampMs <= 0 ||
      action.timestampMs < latest
    ) {
      throw new Error("L'horloge a reculé : transition de course impossible.");
    }
    return {
      ...state,
      status:
        action.type === "pause"
          ? "paused"
          : action.type === "finish"
            ? "finished"
            : "recording",
      recording: {
        ...state.recording,
        events: [
          ...state.recording.events,
          { type: action.type, timestampMs: action.timestampMs },
        ],
      },
      lastTrackSample: null,
      lastAltitudeMeters: null,
      lastAccurateTimestampMs: null,
      pendingReason: action.type === "resume" ? "resume" : state.pendingReason,
    };
  }
  if (state.status !== "recording") return state;
  const input = action.sample;
  const previous = state.recording.samples.at(-1);
  const latestEvent = state.recording.events.at(-1)!;
  if (
    !Number.isFinite(input.latitude) ||
    Math.abs(input.latitude) > 90 ||
    !Number.isFinite(input.longitude) ||
    Math.abs(input.longitude) > 180 ||
    !Number.isSafeInteger(input.timestampMs) ||
    input.timestampMs <= latestEvent.timestampMs ||
    input.timestampMs <= (previous?.timestampMs ?? 0) ||
    input.timestampMs > action.receivedAtMs
  )
    return state;

  const point = { ...input };
  if (point.altitudeMeters !== null && !Number.isFinite(point.altitudeMeters))
    point.altitudeMeters = null;
  if (
    point.horizontalAccuracyMeters !== null &&
    (!Number.isFinite(point.horizontalAccuracyMeters) ||
      point.horizontalAccuracyMeters < 0)
  )
    point.horizontalAccuracyMeters = null;
  if (
    point.speedMetersPerSecond !== null &&
    (!Number.isFinite(point.speedMetersPerSecond) ||
      point.speedMetersPerSecond < 0)
  )
    point.speedMetersPerSecond = null;
  if (point.speedMetersPerSecond === null) point.speedSource = null;

  let pendingReason = state.pendingReason;
  if (previous && previous.source !== point.source)
    pendingReason = "source-change";
  else if (
    !pendingReason &&
    state.lastAccurateTimestampMs !== null &&
    point.timestampMs - state.lastAccurateTimestampMs > 5000
  )
    pendingReason = "gps-gap";
  const goodAccuracy =
    point.horizontalAccuracyMeters !== null &&
    point.horizontalAccuracyMeters <= 25;
  const newOrigin =
    goodAccuracy && (pendingReason !== null || state.lastTrackSample === null);
  if ((newOrigin || !goodAccuracy) && point.speedSource === "derived") {
    point.speedMetersPerSecond = null;
    point.speedSource = null;
  }
  const index = state.recording.samples.length;
  let segments = state.recording.segments;
  let lastTrackSample = pendingReason ? null : state.lastTrackSample;
  let lastAccurateTimestampMs = state.lastAccurateTimestampMs;
  let distanceMeters = state.distanceMeters;
  let elevationGainMeters = state.elevationGainMeters;
  let lastAltitudeMeters = pendingReason ? null : state.lastAltitudeMeters;
  if (goodAccuracy) {
    lastAccurateTimestampMs = point.timestampMs;
    if (newOrigin) {
      segments = [
        ...segments,
        { reason: pendingReason ?? "gps-gap", sampleIndices: [index] },
      ];
      lastTrackSample = point;
      lastAltitudeMeters = point.altitudeMeters;
      pendingReason = null;
    } else if (lastTrackSample) {
      const delta = haversineMeters(
        coordinate(lastTrackSample),
        coordinate(point),
      );
      const seconds = (point.timestampMs - lastTrackSample.timestampMs) / 1000;
      if (delta / seconds > 12) {
        pendingReason = "gps-gap";
        lastTrackSample = null;
        lastAltitudeMeters = null;
        lastAccurateTimestampMs = null;
      } else if (delta >= Math.max(2, point.horizontalAccuracyMeters! * 0.4)) {
        distanceMeters += delta;
        if (point.altitudeMeters !== null && lastAltitudeMeters !== null) {
          const gain = point.altitudeMeters - lastAltitudeMeters;
          if (gain > 0.5) elevationGainMeters += Math.round(gain);
        }
        if (point.altitudeMeters !== null)
          lastAltitudeMeters = point.altitudeMeters;
        segments = [
          ...segments.slice(0, -1),
          {
            ...segments[segments.length - 1],
            sampleIndices: [
              ...segments[segments.length - 1].sampleIndices,
              index,
            ],
          },
        ];
        lastTrackSample = point;
      }
    }
  }
  return {
    ...state,
    distanceMeters,
    elevationGainMeters,
    lastTrackSample,
    lastAltitudeMeters,
    lastAccurateTimestampMs,
    pendingReason,
    recording: {
      ...state.recording,
      samples: [...state.recording.samples, point],
      segments,
    },
  };
}

/** Independent snapshot: finishing freezes time; reading it cannot mutate the session. */
export function getRecordingSnapshot(
  state: WorkoutRecordingState,
  nowMs: number,
): RecordingSnapshot | null {
  if (state.recording.events.length === 0) return null;
  return {
    startedAtMs: state.recording.events[0].timestampMs,
    endedAtMs:
      state.status === "finished"
        ? state.recording.events.at(-1)!.timestampMs
        : null,
    distanceMeters: state.distanceMeters,
    elevationGainMeters: state.elevationGainMeters,
    recording: {
      ...structuredClone(state.recording),
      ...getRecordingDurations(state, nowMs),
    },
  };
}

export function getRecordingDurations(
  state: WorkoutRecordingState,
  nowMs: number,
): Pick<ActivityRecording, "elapsedDurationMs" | "activeDurationMs"> {
  const events = state.recording.events;
  if (events.length === 0) return { elapsedDurationMs: 0, activeDurationMs: 0 };
  const startedAtMs = events[0].timestampMs;
  const endedAtMs =
    state.status === "finished" ? events[events.length - 1].timestampMs : null;
  const until = Math.max(
    endedAtMs ?? nowMs,
    events[events.length - 1].timestampMs,
    state.recording.samples.at(-1)?.timestampMs ?? 0,
  );
  let activeDurationMs = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type === "start" || events[i].type === "resume") {
      activeDurationMs +=
        (events[i + 1]?.timestampMs ?? until) - events[i].timestampMs;
    }
  }
  return { elapsedDurationMs: until - startedAtMs, activeDurationMs };
}
