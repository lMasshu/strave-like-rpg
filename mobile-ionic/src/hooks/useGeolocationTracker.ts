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
            const isGranted =
              permissions.location === "granted" ||
              permissions.coarseLocation === "granted";

            if (!isGranted) {
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
            if (
              perm.location === "denied" &&
              perm.coarseLocation !== "granted"
            ) {
              if (!cancelled) {
                setStatus("denied");
                setError("Permission de localisation refusée.");
              }
              return;
            }
          } catch {
            // Ignorer si l'API permissions n'est pas supportée dans l'environnement web
          }
        }

        if (cancelled) return;

        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (nextPosition, watchError) => {
            if (cancelled) return;

            if (watchError || !nextPosition) {
              const errorMessage =
                watchError instanceof Error
                  ? watchError.message
                  : typeof watchError === "string"
                    ? watchError
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
                String(errorCode) === "1" ||
                errorMessage.toLowerCase().includes("denied") ||
                errorMessage.toLowerCase().includes("permission")
              ) {
                setStatus("denied");
                setError("Permission de localisation refusée.");
              } else {
                setStatus("waiting");
                setError("Signal GPS indisponible pour le moment.");
              }
              return;
            }

            const coords = nextPosition.coords;
            if (
              !coords ||
              typeof coords.latitude !== "number" ||
              typeof coords.longitude !== "number" ||
              !Number.isFinite(coords.latitude) ||
              !Number.isFinite(coords.longitude) ||
              Math.abs(coords.latitude) > 90 ||
              Math.abs(coords.longitude) > 180
            ) {
              setStatus("waiting");
              setError("Coordonnées GPS reçues invalides.");
              return;
            }

            const speed =
              typeof coords.speed === "number" &&
              Number.isFinite(coords.speed) &&
              coords.speed >= 0
                ? coords.speed
                : null;

            const accuracy =
              typeof coords.accuracy === "number" &&
              Number.isFinite(coords.accuracy) &&
              coords.accuracy >= 0
                ? coords.accuracy
                : 0;

            const altitude =
              typeof coords.altitude === "number" &&
              Number.isFinite(coords.altitude)
                ? coords.altitude
                : null;

            const timestamp =
              typeof nextPosition.timestamp === "number" &&
              Number.isFinite(nextPosition.timestamp) &&
              nextPosition.timestamp > 0
                ? nextPosition.timestamp
                : Date.now();

            setError(null);
            setStatus("tracking");
            setPosition({
              coords: [coords.longitude, coords.latitude],
              latitude: coords.latitude,
              longitude: coords.longitude,
              altitude,
              speed,
              accuracy,
              heading: coords.heading ?? null,
              altitudeAccuracy: coords.altitudeAccuracy ?? null,
              timestamp,
            });
          },
        );

        if (cancelled) {
          void Geolocation.clearWatch({ id }).catch(() => undefined);
        } else {
          watchId = id;
        }
      } catch (startError) {
        if (!cancelled) {
          console.warn("Erreur de géolocalisation :", startError);
          const msg =
            startError instanceof Error
              ? startError.message
              : typeof startError === "string"
                ? startError
                : typeof startError === "object" &&
                    startError !== null &&
                    "message" in startError
                  ? String((startError as { message: unknown }).message)
                  : "";
          const isPermissionDenied =
            msg.toLowerCase().includes("denied") ||
            msg.toLowerCase().includes("permission");

          if (isPermissionDenied) {
            setStatus("denied");
            setError("Permission de localisation refusée.");
          } else {
            setStatus("waiting");
            setError("Impossible d'accéder à la position GPS.");
          }
        }
      }
    };

    void start();

    return () => {
      cancelled = true;

      if (watchId !== null) {
        void Geolocation.clearWatch({ id: watchId }).catch(() => undefined);
      }
    };
  }, [enabled]);

  return { position, status, error };
}
