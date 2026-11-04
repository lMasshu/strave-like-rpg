import { useEffect, useRef, useState } from "react";
import type { GeneratedQuest } from "../services/questGenerator";
import { pointAlongRoute } from "../services/geo";
import {
  advanceQuestRun,
  createQuestRun,
  type QuestRunState,
} from "../services/questProgress";
import {
  useGeolocationTracker,
  type GeolocationStatus,
  type TrackedPosition,
} from "./useGeolocationTracker";

// La simulation de marche est réservée au développement (ou activée par variable).
export const GPS_SIMULATION_AVAILABLE =
  import.meta.env.DEV || import.meta.env.VITE_GPS_SIMULATION === "true";

const SIMULATION_SPEED_METERS_PER_SECOND = 25;

interface QuestRun {
  state: QuestRunState;
  position: TrackedPosition | null;
  gpsStatus: GeolocationStatus;
  gpsError: string | null;
  simulating: boolean;
  toggleSimulation: () => void;
}

/**
 * Déroule une quête : suit le GPS, lance le chrono dès l'acceptation et
 * valide les points de passage jusqu'à la victoire ou l'échec.
 * À utiliser avec une `key` basée sur l'id de la quête pour repartir de zéro.
 */
export function useQuestRun(quest: GeneratedQuest): QuestRun {
  const [state, setState] = useState<QuestRunState>(() =>
    createQuestRun(quest),
  );
  const [simulating, setSimulating] = useState(false);
  const [simulatedPosition, setSimulatedPosition] =
    useState<TrackedPosition | null>(null);

  const startedAtRef = useRef(Date.now());
  const simulatedDistanceRef = useRef(0);

  const isRunning = state.status === "running";
  const tracker = useGeolocationTracker(isRunning && !simulating);
  const position = simulating ? simulatedPosition : tracker.position;

  const elapsedSeconds = () => (Date.now() - startedAtRef.current) / 1000;

  // Chrono : mis à jour chaque seconde tant que la quête est en cours
  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setState((previous) =>
        advanceQuestRun(previous, quest, null, elapsedSeconds()),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, quest]);

  // Chaque nouvelle position peut valider un point de passage
  useEffect(() => {
    if (!position) return;

    setState((previous) =>
      advanceQuestRun(
        previous,
        quest,
        { coords: position.coords, accuracy: position.accuracy },
        elapsedSeconds(),
      ),
    );
  }, [position, quest]);

  // Simulation : une marche le long de l'itinéraire, pour tester sans bouger
  useEffect(() => {
    if (!simulating || !isRunning) return;

    const walker = window.setInterval(() => {
      simulatedDistanceRef.current += SIMULATION_SPEED_METERS_PER_SECOND;

      const coords = pointAlongRoute(
        quest.route.coordinates,
        simulatedDistanceRef.current,
      );

      if (coords) {
        setSimulatedPosition({
          coords,
          accuracy: 5,
          speed: SIMULATION_SPEED_METERS_PER_SECOND,
          timestamp: Date.now(),
        });
      }
    }, 1000);

    return () => window.clearInterval(walker);
  }, [simulating, isRunning, quest]);

  const toggleSimulation = () => {
    setSimulating((current) => !current);
  };

  return {
    state,
    position,
    gpsStatus: tracker.status,
    gpsError: tracker.error,
    simulating,
    toggleSimulation,
  };
}
