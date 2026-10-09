import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { LngLat } from "../services/geo";

export interface TrackedPosition {
  coords: LngLat;
  accuracy: number; // en mètres
  speed: number | null; // en m/s
  timestamp: number;
}

export type GeolocationStatus = "idle" | "waiting" | "tracking" | "denied";

interface GeolocationTracker {
  position: TrackedPosition | null;
  status: GeolocationStatus;
  error: string | null;
}

/**
 * Suit la position GPS de l'appareil tant que `enabled` vaut true.
 * Dans le navigateur, le plugin Capacitor s'appuie sur la géolocalisation
 * du navigateur (localhost ou HTTPS obligatoire).
 */
export function useGeolocationTracker(enabled: boolean): GeolocationTracker {
  const [position, setPosition] = useState<TrackedPosition | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let watchId: string | null = null;

    const start = async () => {
      setStatus("waiting");
      setError(null);

      try {
        // Sur mobile, la permission se demande explicitement.
        // Sur le web, le navigateur la demande au premier suivi.
        if (Capacitor.isNativePlatform()) {
          const permissions = await Geolocation.requestPermissions();

          if (permissions.location !== "granted") {
            if (!cancelled) {
              setStatus("denied");
              setError("Permission de localisation refusée.");
            }
            return;
          }
        }

        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (nextPosition, watchError) => {
            if (cancelled) return;

            if (watchError || !nextPosition) {
              setError("Signal GPS indisponible pour le moment.");
              return;
            }

            setError(null);
            setStatus("tracking");
            setPosition({
              coords: [
                nextPosition.coords.longitude,
                nextPosition.coords.latitude,
              ],
              accuracy: nextPosition.coords.accuracy,
              speed: nextPosition.coords.speed,
              timestamp: nextPosition.timestamp,
            });
          },
        );

        if (cancelled) {
          await Geolocation.clearWatch({ id });
        } else {
          watchId = id;
        }
      } catch (startError) {
        if (!cancelled) {
          console.warn("Erreur de géolocalisation :", startError);
          setStatus("denied");
          setError("Impossible d'accéder à la position GPS.");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;

      if (watchId !== null) {
        void Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [enabled]);

  return { position, status, error };
}
