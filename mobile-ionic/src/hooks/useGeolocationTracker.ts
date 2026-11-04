import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { LngLat } from "../services/geo";

export interface TrackedPosition {
  coords: LngLat;
  latitude: number;
  longitude: number;
  altitude: number | null; // en mètres
  speed: number | null; // en m/s
  accuracy: number; // en mètres
  heading?: number | null;
  altitudeAccuracy?: number | null;
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
      setError(null);
      return;
    }

    let cancelled = false;
    let watchId: string | null = null;

    const start = async () => {
      setStatus("waiting");
      setError(null);

      try {
        // Sur mobile, la permission se demande explicitement.
        // Sur le web, le navigateur la demande au premier suivi ou via checkPermissions.
        if (Capacitor.isNativePlatform()) {
          if (typeof Geolocation.requestPermissions === "function") {
            const permissions = await Geolocation.requestPermissions();

            if (permissions.location !== "granted") {
              if (!cancelled) {
                setStatus("denied");
                setError("Permission de localisation refusée.");
              }
              return;
            }
          }
        } else if (typeof Geolocation.checkPermissions === "function") {
          try {
            const perm = await Geolocation.checkPermissions();
            if (perm.location === "denied") {
              if (!cancelled) {
                setStatus("denied");
                setError("Permission de localisation refusée.");
              }
              return;
            }
            if (
              perm.location === "prompt" &&
              typeof Geolocation.requestPermissions === "function"
            ) {
              const req = await Geolocation.requestPermissions();
              if (req.location !== "granted") {
                if (!cancelled) {
                  setStatus("denied");
                  setError("Permission de localisation refusée.");
                }
                return;
              }
            }
          } catch {
            // Ignorer si l'API permissions n'est pas supportée dans l'environnement web
          }
        }

        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (nextPosition, watchError) => {
            if (cancelled) return;

            if (watchError || !nextPosition) {
              const errorMessage =
                watchError instanceof Error
                  ? watchError.message
                  : typeof watchError === "object" &&
                      watchError !== null &&
                      "message" in watchError
                    ? String((watchError as { message: unknown }).message)
                    : "";
              const errorCode =
                typeof watchError === "object" &&
                watchError !== null &&
                "code" in watchError
                  ? (watchError as { code: unknown }).code
                  : null;

              if (
                errorCode === 1 ||
                errorMessage.toLowerCase().includes("denied") ||
                errorMessage.toLowerCase().includes("permission")
              ) {
                setStatus("denied");
                setError("Permission de localisation refusée.");
              } else {
                setError("Signal GPS indisponible pour le moment.");
              }
              return;
            }

            setError(null);
            setStatus("tracking");
            setPosition({
              coords: [
                nextPosition.coords.longitude,
                nextPosition.coords.latitude,
              ],
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
              altitude: nextPosition.coords.altitude ?? null,
              speed: nextPosition.coords.speed ?? null,
              accuracy: nextPosition.coords.accuracy,
              heading: nextPosition.coords.heading ?? null,
              altitudeAccuracy: nextPosition.coords.altitudeAccuracy ?? null,
              timestamp: nextPosition.timestamp || Date.now(),
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
