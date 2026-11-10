import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { pointAlongRoute, calculateBearing } from "../services/geo";
import type { GeneratedQuest } from "../services/questGenerator";
import { getLivePace, type LivePaceState } from "../services/livePace";
import {
  createRecordingState,
  reduceRecording,
  getRecordingSnapshot,
  getRecordingDurations,
  type RecordingAction,
  type RecordingSnapshot,
} from "../services/workoutRecording";
import {
  useGeolocationTracker,
  type TrackedPosition,
  type GeolocationStatus,
} from "./useGeolocationTracker";

export type WorkoutStatus = "idle" | "recording" | "paused" | "finished";
export type GpsSignalQuality = "optimal" | "weak" | "none";
export const MAX_ACCURACY_THRESHOLD = 25;

export interface ActiveWorkoutMetrics {
  status: WorkoutStatus;
  elapsedSeconds: number;
  distanceMeters: number;
  distanceKm: number;
  speedKmh: number;
  paceMinPerKm: string;
  paceState: LivePaceState;
  elevationGainMeters: number;
  xpEarned: number;
  trackCoordinates: [number, number][];
  trackSegments: [number, number][][];
  recordingSnapshot: RecordingSnapshot | null;
  recordingError: string | null;
  recordingSessionId: number;
  currentPosition: TrackedPosition | null;
  gpsStatus: GeolocationStatus;
  gpsError: string | null;
  gpsQuality: GpsSignalQuality;
  simulating: boolean;
}

export interface ActiveWorkoutController {
  metrics: ActiveWorkoutMetrics;
  startWorkout: () => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  finishWorkout: () => void;
  resetWorkout: () => void;
  toggleSimulation: () => void;
}

const SIMULATION_SPEED_MS = 3;

/** Actual measurements and lifecycle events are the source of truth, not timer ticks. */
export function useActiveWorkout(
  activeQuest?: GeneratedQuest | null,
): ActiveWorkoutController {
  const [session, setSession] = useState(createRecordingState);
  const sessionRef = useRef(session);
  const sessionIdRef = useRef(0);
  const [clock, setClock] = useState(Date.now);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulatedPosition, setSimulatedPosition] =
    useState<TrackedPosition | null>(null);
  const simulationOriginRef = useRef<[number, number]>([2.3522, 48.8566]);
  const simulationStepRef = useRef(0);
  const simulatedDistanceRef = useRef(0);
  const status = session.status;

  const apply = useCallback((action: RecordingAction): void => {
    try {
      const previous = sessionRef.current;
      const next = reduceRecording(previous, action);
      if (
        next !== previous &&
        (action.type === "start" || action.type === "reset")
      )
        sessionIdRef.current++;
      sessionRef.current = next;
      setSession(next);
      setRecordingError(null);
    } catch (error: unknown) {
      setRecordingError(
        error instanceof Error
          ? error.message
          : "Erreur de chronologie de course.",
      );
    }
  }, []);

  const capturePosition = useCallback(
    (position: TrackedPosition): void => {
      apply({
        type: "sample",
        receivedAtMs: Date.now(),
        sample: {
          latitude: position.latitude,
          longitude: position.longitude,
          timestampMs: position.timestamp,
          altitudeMeters: position.altitude,
          horizontalAccuracyMeters: position.accuracy,
          speedMetersPerSecond: position.speed,
          speedSource: position.speedSource ?? null,
          source: "gps",
        },
      });
    },
    [apply],
  );
  const captureSignalLoss = useCallback(
    (): void => apply({ type: "signalLost" }),
    [apply],
  );
  const tracker = useGeolocationTracker(
    !simulating,
    capturePosition,
    captureSignalLoss,
  );
  const { resetSpeedHistory } = tracker;
  const currentPosition = simulating ? simulatedPosition : tracker.position;

  useEffect(() => {
    simulatedDistanceRef.current = 0;
    simulationStepRef.current = 0;
  }, [activeQuest?.id]);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "recording" || simulating) return;
    if (tracker.status !== "tracking") {
      apply({ type: "signalLost" });
      return;
    }
    if (!currentPosition) return;
    apply({
      type: "sample",
      receivedAtMs: Date.now(),
      sample: {
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        timestampMs: currentPosition.timestamp,
        altitudeMeters: currentPosition.altitude,
        horizontalAccuracyMeters: currentPosition.accuracy,
        speedMetersPerSecond: currentPosition.speed,
        speedSource: currentPosition.speedSource ?? null,
        source: simulating ? "simulation" : "gps",
      },
    });
  }, [currentPosition, tracker.status, status, simulating, apply]);

  useEffect(() => {
    if (status !== "recording" || !simulating) return;
    const timer = window.setInterval(() => {
      const step = ++simulationStepRef.current;
      const previous = sessionRef.current.lastTrackSample;
      let coords: [number, number];
      if (activeQuest && activeQuest.route.coordinates.length > 1) {
        simulatedDistanceRef.current += SIMULATION_SPEED_MS;
        coords =
          pointAlongRoute(
            activeQuest.route.coordinates,
            simulatedDistanceRef.current,
          ) ??
          activeQuest.route.coordinates[
            activeQuest.route.coordinates.length - 1
          ];
      } else {
        // A physical-size synthetic step (3 m), not the old ~15 m step at 3 m/s.
        coords = [
          simulationOriginRef.current[0],
          simulationOriginRef.current[1] +
            (step * SIMULATION_SPEED_MS) / 111195,
        ];
      }
      const position: TrackedPosition = {
        coords,
        longitude: coords[0],
        latitude: coords[1],
        altitude: 40 + Math.sin(step * 0.1) * 5,
        speed: SIMULATION_SPEED_MS,
        speedSource: "native",
        accuracy: 4,
        heading: previous
          ? calculateBearing([previous.longitude, previous.latitude], coords)
          : 0,
        altitudeAccuracy: 1,
        timestamp: Date.now(),
      };
      setSimulatedPosition(position);
      apply({
        type: "sample",
        receivedAtMs: Date.now(),
        sample: {
          latitude: position.latitude,
          longitude: position.longitude,
          timestampMs: position.timestamp,
          altitudeMeters: position.altitude,
          horizontalAccuracyMeters: position.accuracy,
          speedMetersPerSecond: position.speed,
          speedSource: "native",
          source: "simulation",
        },
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, simulating, activeQuest, apply]);

  const startWorkout = useCallback((): void => {
    resetSpeedHistory?.();
    if (tracker.position) simulationOriginRef.current = tracker.position.coords;
    apply({ type: "start", timestampMs: Date.now() });
  }, [apply, tracker.position, resetSpeedHistory]);
  const pauseWorkout = useCallback(
    (): void => apply({ type: "pause", timestampMs: Date.now() }),
    [apply],
  );
  const resumeWorkout = useCallback((): void => {
    resetSpeedHistory?.();
    apply({ type: "resume", timestampMs: Date.now() });
  }, [apply, resetSpeedHistory]);
  const finishWorkout = useCallback(
    (): void => apply({ type: "finish", timestampMs: Date.now() }),
    [apply],
  );
  const resetWorkout = useCallback((): void => {
    apply({ type: "reset" });
    setSimulatedPosition(null);
    simulationStepRef.current = 0;
    simulatedDistanceRef.current = 0;
  }, [apply]);
  const toggleSimulation = useCallback((): void => {
    resetSpeedHistory?.();
    setSimulating(!simulating);
    if (!simulating && sessionRef.current.status === "idle")
      apply({ type: "start", timestampMs: Date.now() });
  }, [apply, simulating, resetSpeedHistory]);

  // Clone only on actual journal changes, never the entire history on each 250 ms tick.
  const frozenSnapshot = useMemo(
    () => getRecordingSnapshot(session, Date.now()),
    [session],
  );
  const durations = getRecordingDurations(session, Math.max(clock, Date.now()));
  const recordingSnapshot = frozenSnapshot
    ? {
        ...frozenSnapshot,
        recording: { ...frozenSnapshot.recording, ...durations },
      }
    : null;
  const trackSegments = useMemo(
    (): [number, number][][] =>
      session.recording.segments.map((segment) =>
        segment.sampleIndices.map((index) => {
          const point = session.recording.samples[index];
          return [point.longitude, point.latitude];
        }),
      ),
    [session.recording],
  );
  const trackCoordinates = useMemo(() => trackSegments.flat(), [trackSegments]);
  const latestEvent = session.recording.events.at(-1);
  const pacePosition =
    currentPosition &&
    latestEvent &&
    currentPosition.timestamp > latestEvent.timestampMs &&
    (simulating || tracker.status === "tracking")
      ? currentPosition
      : null;
  const pace = getLivePace(pacePosition, Date.now(), status);
  const distanceKm = Number((session.distanceMeters / 1000).toFixed(2));
  return {
    metrics: {
      status,
      elapsedSeconds: Math.floor(durations.activeDurationMs / 1000),
      distanceMeters: Math.round(session.distanceMeters),
      distanceKm,
      speedKmh: Number(((currentPosition?.speed ?? 0) * 3.6).toFixed(1)),
      paceMinPerKm: pace.paceMinPerKm,
      paceState: pace.state,
      elevationGainMeters: session.elevationGainMeters,
      xpEarned: Math.round(distanceKm * 100 + session.elevationGainMeters * 2),
      trackCoordinates,
      trackSegments,
      recordingSnapshot,
      recordingError,
      recordingSessionId: sessionIdRef.current,
      currentPosition,
      gpsStatus: tracker.status,
      gpsError: tracker.error,
      gpsQuality: !currentPosition
        ? "none"
        : currentPosition.accuracy !== null && currentPosition.accuracy <= 20
          ? "optimal"
          : "weak",
      simulating,
    },
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    finishWorkout,
    resetWorkout,
    toggleSimulation,
  };
}
