import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Health } from "@capgo/capacitor-health";
import type { WatchLinkStatus, WatchWorkout } from "../data/watchLink";
import {
  fetchRecentWatchWorkouts,
  getWatchLinkStatus,
  HealthClient,
  linkWatch,
} from "../services/watchLink";

export interface UseWatchLinkResult {
  status: WatchLinkStatus | null;
  workouts: WatchWorkout[];
  isBusy: boolean;
  error: string | null;
  link: () => Promise<void>;
  refresh: () => Promise<void>;
  openSettings: () => Promise<void>;
}

const ERROR_MESSAGE =
  "Impossible de lire Health Connect. Réessayez ou vérifiez les autorisations.";

/** État de liaison montre ↔ appli, rafraîchi au montage et au retour au premier plan. */
export function useWatchLink(
  client: HealthClient = Health,
): UseWatchLinkResult {
  const [status, setStatus] = useState<WatchLinkStatus | null>(null);
  const [workouts, setWorkouts] = useState<WatchWorkout[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const applyStatus = useCallback(
    async (next: WatchLinkStatus) => {
      const recent =
        next.state === "linked" ? await fetchRecentWatchWorkouts(client) : [];
      if (!mounted.current) return;
      setStatus(next);
      setWorkouts(recent);
    },
    [client],
  );

  const run = useCallback(async (task: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await task();
    } catch {
      if (mounted.current) setError(ERROR_MESSAGE);
    } finally {
      if (mounted.current) setIsBusy(false);
    }
  }, []);

  const refresh = useCallback(
    () => run(async () => applyStatus(await getWatchLinkStatus(client))),
    [applyStatus, client, run],
  );

  const link = useCallback(
    () => run(async () => applyStatus(await linkWatch(client))),
    [applyStatus, client, run],
  );

  const openSettings = useCallback(
    () => run(() => client.openHealthConnectSettings()),
    [client, run],
  );

  useEffect(() => {
    mounted.current = true;
    void refresh();

    // Les autorisations peuvent changer dans Health Connect pendant que l'appli est en arrière-plan.
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void refresh();
    });

    return () => {
      mounted.current = false;
      void listener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [refresh]);

  return { status, workouts, isBusy, error, link, refresh, openSettings };
}
