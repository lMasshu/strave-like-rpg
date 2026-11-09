import { useEffect, useRef, useState, useCallback } from "react";
import {
  haversineMeters,
  pointAlongRoute,
  calculateBearing,
} from "../services/geo";
import type { GeneratedQuest } from "../services/questGenerator";
import { getLivePace, type LivePaceState } from "../services/livePace";
import {
  useGeolocationTracker,
  type TrackedPosition,
  type GeolocationStatus,
} from "./useGeolocationTracker";

/**
 * État de la machine à états de l'entraînement.
 */
export type WorkoutStatus = "idle" | "recording" | "paused" | "finished";

/**
 * Qualité du signal GPS perçu par l'appareil.
 */
export type GpsSignalQuality = "optimal" | "weak" | "none";

/** Seuil maximal d'imprécision GPS en mètres accepté pour l'accumulation sportive */
export const MAX_ACCURACY_THRESHOLD = 25;

/**
 * Métriques télémétriques temps réel d'un entraînement actif.
 */
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
  currentPosition: TrackedPosition | null;
  gpsStatus: GeolocationStatus;
  gpsError: string | null;
  gpsQuality: GpsSignalQuality;
  simulating: boolean;
}

/**
 * Contrôleur d'entraînement permettant de piloter l'enregistrement sportif.
 */
export interface ActiveWorkoutController {
  metrics: ActiveWorkoutMetrics;
  startWorkout: () => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  finishWorkout: () => void;
  resetWorkout: () => void;
  toggleSimulation: () => void;
}

const SIMULATION_SPEED_MS = 3.0; // ~10.8 km/h

/**
 * Hook central orchestrant l'enregistrement d'une course ou d'une marche active.
 *
 * - Pilote le chronomètre actif (pause / reprise / fin).
 * - Filtre le flux GPS natif via useGeolocationTracker (rejet accuracy > 25m, seuil anti-saut statique).
 * - Calcule en continu la distance Haversine, la vitesse, l'allure (min/km), le dénivelé et les points d'XP.
 * - Fournit un mode de simulation dynamique pour tester le tracé même sans signal GPS réel.
 *
 * @param activeQuest Quête optionnelle à suivre lors de la sortie
 * @returns Contrôleur d'entraînement exposé à l'interface utilisateur
 */
export function useActiveWorkout(
  activeQuest?: GeneratedQuest | null,
): ActiveWorkoutController {
  const [status, setStatus] = useState<WorkoutStatus>("idle");
  // Refresh expiry even when the GPS stops delivering callbacks.
  const [, setPaceClock] = useState(0);
  const recordingStartedAtRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elevationGainMeters, setElevationGainMeters] = useState(0);
  const [trackCoordinates, setTrackCoordinates] = useState<[number, number][]>(
    [],
  );
  const [simulating, setSimulating] = useState(false);
  const [simulatedPosition, setSimulatedPosition] =
    useState<TrackedPosition | null>(null);

  const tracker = useGeolocationTracker(!simulating);
  const currentPosition = simulating ? simulatedPosition : tracker.position;

  const lastAltitudeRef = useRef<number | null>(null);
  const lastRecordedCoordRef = useRef<[number, number] | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const simulationOriginRef = useRef<[number, number]>([2.3522, 48.8566]); // Paris centre par défaut
  const simulationStepRef = useRef(0);
  const simulatedDistanceMetersRef = useRef(0);

  // Réinitialiser la distance de simulation dès qu'une nouvelle quête est chargée
  useEffect(() => {
    simulatedDistanceMetersRef.current = 0;
    simulationStepRef.current = 0;
  }, [activeQuest?.id]);

  // 1. Horloge : Incrémentation du temps écoulé tant que le statut est 'recording'
  useEffect(() => {
    if (status !== "recording") return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = window.setInterval(() => {
      setPaceClock((tick) => tick + 1);
    }, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  // 2. Traitement des positions réelles (GPS) avec filtre de précision sportive
  useEffect(() => {
    if (status !== "recording" || simulating || !tracker.position) return;

    const pos = tracker.position;

    // Filtre 1 : Rejeter immédiatement les points trop imprécis (> 25m) pour éviter les sauts
    if (pos.accuracy > MAX_ACCURACY_THRESHOLD) {
      return;
    }

    const newCoord = pos.coords;
    const altitude = pos.altitude;
    const timestamp = pos.timestamp;

    setTrackCoordinates((prev) => {
      if (prev.length === 0) {
        lastRecordedCoordRef.current = newCoord;
        if (altitude !== null) lastAltitudeRef.current = altitude;
        lastTimestampRef.current = timestamp;
        return [newCoord];
      }

      const prevCoord = lastRecordedCoordRef.current || prev[prev.length - 1];
      const deltaM = haversineMeters(newCoord, prevCoord);

      // Filtre 2 : Seuil anti-bruit adaptatif proportionnel à l'imprécision
      const minDistanceThreshold = Math.max(2.0, pos.accuracy * 0.4);
      if (deltaM < minDistanceThreshold) {
        return prev;
      }

      // Filtre 3 : Rejet des téléportations absurdes (> 12 m/s = 43 km/h pour un coureur)
      if (lastTimestampRef.current) {
        const deltaSec = (timestamp - lastTimestampRef.current) / 1000;
        if (deltaSec > 0.4) {
          const speed = deltaM / deltaSec;
          if (speed > 12) {
            return prev;
          }
        }
      }

      setDistanceMeters((d) => d + deltaM);
      lastRecordedCoordRef.current = newCoord;
      lastTimestampRef.current = timestamp;

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

  // 3. Mode Simulation unifié (Quête ou Course libre)
  useEffect(() => {
    if (status !== "recording" || !simulating) return;

    const simTimer = window.setInterval(() => {
      simulationStepRef.current += 1;
      const step = simulationStepRef.current;
      let simCoord: [number, number];

      // Si une quête est active, on avance le long de l'itinéraire de la quête
      let heading = 90;
      if (activeQuest && activeQuest.route?.coordinates?.length > 1) {
        simulatedDistanceMetersRef.current += SIMULATION_SPEED_MS;
        const along = pointAlongRoute(
          activeQuest.route.coordinates,
          simulatedDistanceMetersRef.current,
        );
        simCoord =
          along ||
          activeQuest.route.coordinates[
            activeQuest.route.coordinates.length - 1
          ];

        if (lastRecordedCoordRef.current) {
          heading = calculateBearing(lastRecordedCoordRef.current, simCoord);
        }
      } else {
        // Sinon, boucle progressive de course libre
        const origin = simulationOriginRef.current;
        const lngOffset = Math.sin(step * 0.05) * 0.003 + step * 0.00015;
        const latOffset = Math.cos(step * 0.05) * 0.002 + step * 0.0001;
        simCoord = [
          Number((origin[0] + lngOffset).toFixed(6)),
          Number((origin[1] + latOffset).toFixed(6)),
        ];

        if (lastRecordedCoordRef.current) {
          heading = calculateBearing(lastRecordedCoordRef.current, simCoord);
        }
      }

      const simPos: TrackedPosition = {
        coords: simCoord,
        longitude: simCoord[0],
        latitude: simCoord[1],
        altitude: 40 + Math.sin(step * 0.1) * 5,
        speed: SIMULATION_SPEED_MS,
        accuracy: 4,
        heading,
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
  }, [status, simulating, activeQuest]);

  // Contrôles
  const startWorkout = useCallback(() => {
    recordingStartedAtRef.current = Date.now();
    setStatus("recording");
    if (tracker.position) {
      simulationOriginRef.current = tracker.position.coords;
    }
  }, [tracker.position]);

  const pauseWorkout = useCallback(() => {
    setStatus("paused");
  }, []);

  const resumeWorkout = useCallback(() => {
    recordingStartedAtRef.current = Date.now();
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
    simulatedDistanceMetersRef.current = 0;
    lastRecordedCoordRef.current = null;
    lastAltitudeRef.current = null;
  }, []);

  const toggleSimulation = useCallback(() => {
    setSimulating((prev) => {
      const next = !prev;
      if (next && status === "idle") {
        recordingStartedAtRef.current = Date.now();
        setStatus("recording");
      }
      return next;
    });
  }, [status]);

  // Métriques dérivées
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
  const currentSpeedMs =
    currentPosition?.speed ?? (simulating ? SIMULATION_SPEED_MS : 0);
  const speedKmh = Number(((currentSpeedMs || 0) * 3.6).toFixed(1));
  const pacePosition =
    currentPosition &&
    currentPosition.timestamp > recordingStartedAtRef.current &&
    (simulating || tracker.status === "tracking")
      ? currentPosition
      : null;
  const livePace = getLivePace(pacePosition, Date.now(), status);
  const xpEarned = Math.round(distanceKm * 100 + elevationGainMeters * 2);

  const gpsQuality: GpsSignalQuality = currentPosition
    ? currentPosition.accuracy <= 20
      ? "optimal"
      : "weak"
    : "none";

  return {
    metrics: {
      status,
      elapsedSeconds,
      distanceMeters: Math.round(distanceMeters),
      distanceKm,
      speedKmh,
      paceMinPerKm: livePace.paceMinPerKm,
      paceState: livePace.state,
      elevationGainMeters,
      xpEarned,
      trackCoordinates,
      currentPosition,
      gpsStatus: tracker.status,
      gpsError: tracker.error,
      gpsQuality,
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
