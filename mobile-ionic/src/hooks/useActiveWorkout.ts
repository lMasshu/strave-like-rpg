import { useEffect, useRef, useState, useCallback } from "react";
import { haversineMeters } from "../services/geo";
import {
  useGeolocationTracker,
  type TrackedPosition,
  type GeolocationStatus,
} from "./useGeolocationTracker";

export type WorkoutStatus = "idle" | "recording" | "paused" | "finished";

export interface ActiveWorkoutMetrics {
  status: WorkoutStatus;
  elapsedSeconds: number;
  distanceMeters: number;
  distanceKm: number;
  speedKmh: number;
  paceMinPerKm: string;
  elevationGainMeters: number;
  xpEarned: number;
  trackCoordinates: [number, number][];
  currentPosition: TrackedPosition | null;
  gpsStatus: GeolocationStatus;
  gpsError: string | null;
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

function formatPace(speedMs: number | null, distanceKm: number, elapsedSec: number): string {
  // Préférer la vitesse instantanée si disponible (> 0.5 m/s)
  if (speedMs && speedMs > 0.5) {
    const secPerKm = 1000 / speedMs;
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.round(secPerKm % 60);
    if (mins < 30) {
      return `${mins}:${String(secs).padStart(2, "0")}`;
    }
  }

  // Sinon vitesse moyenne globale si distance suffisante
  if (distanceKm > 0.05 && elapsedSec > 5) {
    const avgSecPerKm = elapsedSec / distanceKm;
    const mins = Math.floor(avgSecPerKm / 60);
    const secs = Math.round(avgSecPerKm % 60);
    if (mins < 30) {
      return `${mins}:${String(secs).padStart(2, "0")}`;
    }
  }

  return "--:--";
}

const SIMULATION_SPEED_MS = 3.0; // ~10.8 km/h

export function useActiveWorkout(): ActiveWorkoutController {
  const [status, setStatus] = useState<WorkoutStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elevationGainMeters, setElevationGainMeters] = useState(0);
  const [trackCoordinates, setTrackCoordinates] = useState<[number, number][]>([]);
  const [simulating, setSimulating] = useState(false);
  const [simulatedPosition, setSimulatedPosition] = useState<TrackedPosition | null>(null);

  const tracker = useGeolocationTracker(status === "recording" && !simulating);
  const currentPosition = simulating ? simulatedPosition : tracker.position;

  const lastAltitudeRef = useRef<number | null>(null);
  const lastRecordedCoordRef = useRef<[number, number] | null>(null);
  const simulationOriginRef = useRef<[number, number]>([2.3522, 48.8566]); // Paris centre par défaut
  const simulationStepRef = useRef(0);

  // 1. Horloge : Incrémentation du temps écoulé tant que le statut est 'recording'
  useEffect(() => {
    if (status !== "recording") return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  // 2. Traitement des positions réelles (GPS)
  useEffect(() => {
    if (status !== "recording" || simulating || !tracker.position) return;

    const newCoord = tracker.position.coords;
    const altitude = tracker.position.altitude;

    setTrackCoordinates((prev) => {
      if (prev.length === 0) {
        lastRecordedCoordRef.current = newCoord;
        if (altitude !== null) lastAltitudeRef.current = altitude;
        return [newCoord];
      }

      const prevCoord = lastRecordedCoordRef.current || prev[prev.length - 1];
      const deltaM = haversineMeters(newCoord, prevCoord);

      // Filtrer les micro-bruits GPS (< 1.2m)
      if (deltaM < 1.2) {
        return prev;
      }

      setDistanceMeters((d) => d + deltaM);
      lastRecordedCoordRef.current = newCoord;

      if (altitude !== null && lastAltitudeRef.current !== null) {
        const deltaAlt = altitude - lastAltitudeRef.current;
        if (deltaAlt > 0.5) {
          setElevationGainMeters((gain) => gain + Math.round(deltaAlt));
        }
        lastAltitudeRef.current = altitude;
      } else if (altitude !== null) {
        lastAltitudeRef.current = altitude;
      }

      return [...prev, newCoord];
    });
  }, [tracker.position, status, simulating]);

  // 3. Mode Simulation (pour dev desktop sans GPS physique)
  useEffect(() => {
    if (status !== "recording" || !simulating) return;

    const simTimer = window.setInterval(() => {
      simulationStepRef.current += 1;
      const step = simulationStepRef.current;

      // Générer une boucle progressive (déplacement vers l'est et le nord)
      const origin = simulationOriginRef.current;
      const lngOffset = Math.sin(step * 0.05) * 0.003 + step * 0.00015;
      const latOffset = Math.cos(step * 0.05) * 0.002 + step * 0.0001;

      const simCoord: [number, number] = [
        Number((origin[0] + lngOffset).toFixed(6)),
        Number((origin[1] + latOffset).toFixed(6)),
      ];

      const simPos: TrackedPosition = {
        coords: simCoord,
        longitude: simCoord[0],
        latitude: simCoord[1],
        altitude: 40 + Math.sin(step * 0.1) * 5,
        speed: SIMULATION_SPEED_MS,
        accuracy: 4,
        heading: 90,
        altitudeAccuracy: 1,
        timestamp: Date.now(),
      };

      setSimulatedPosition(simPos);

      setTrackCoordinates((prev) => {
        if (prev.length === 0) {
          lastRecordedCoordRef.current = simCoord;
          return [simCoord];
        }

        const prevCoord = lastRecordedCoordRef.current || prev[prev.length - 1];
        const deltaM = haversineMeters(simCoord, prevCoord);

        if (deltaM >= 1.0) {
          setDistanceMeters((d) => d + deltaM);
          lastRecordedCoordRef.current = simCoord;
        }

        return [...prev, simCoord];
      });
    }, 1000);

    return () => window.clearInterval(simTimer);
  }, [status, simulating]);

  // Contrôles
  const startWorkout = useCallback(() => {
    setStatus("recording");
    if (tracker.position) {
      simulationOriginRef.current = tracker.position.coords;
    }
  }, [tracker.position]);

  const pauseWorkout = useCallback(() => {
    setStatus("paused");
  }, []);

  const resumeWorkout = useCallback(() => {
    setStatus("recording");
  }, []);

  const finishWorkout = useCallback(() => {
    setStatus("finished");
  }, []);

  const resetWorkout = useCallback(() => {
    setStatus("idle");
    setElapsedSeconds(0);
    setDistanceMeters(0);
    setElevationGainMeters(0);
    setTrackCoordinates([]);
    setSimulatedPosition(null);
    simulationStepRef.current = 0;
    lastRecordedCoordRef.current = null;
    lastAltitudeRef.current = null;
  }, []);

  const toggleSimulation = useCallback(() => {
    setSimulating((prev) => !prev);
  }, []);

  // Métriques dérivées
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
  const currentSpeedMs = currentPosition?.speed ?? (simulating ? SIMULATION_SPEED_MS : 0);
  const speedKmh = Number(((currentSpeedMs || 0) * 3.6).toFixed(1));
  const paceMinPerKm = formatPace(currentSpeedMs, distanceKm, elapsedSeconds);
  const xpEarned = Math.round(distanceKm * 100 + elevationGainMeters * 2);

  return {
    metrics: {
      status,
      elapsedSeconds,
      distanceMeters: Math.round(distanceMeters),
      distanceKm,
      speedKmh,
      paceMinPerKm,
      elevationGainMeters,
      xpEarned,
      trackCoordinates,
      currentPosition,
      gpsStatus: tracker.status,
      gpsError: tracker.error,
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
