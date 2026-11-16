import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";
import { haversineMeters, type LngLat } from "../services/geo";

export interface TrackedPosition {
  coords: LngLat;
  latitude: number;
  longitude: number;
  altitude: number | null; // en mètres
  speed: number | null; // en m/s
  speedSource?: "native" | "derived" | null;
  accuracy: number | null; // en mètres, null si inconnue
  heading?: number | null;
  altitudeAccuracy?: number | null;
  timestamp: number;
}

export type GeolocationStatus = "idle" | "waiting" | "tracking" | "denied";

interface GeolocationTracker {
  position: TrackedPosition | null;
  status: GeolocationStatus;
  error: string | null;
  resetSpeedHistory: () => void;
}

export const GPS_TRACKING_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
  interval: 1000, // Demande une mise à jour toutes les secondes sur Android
  minimumUpdateInterval: 1000, // Autorise une mise à jour dès 1 seconde sur Android
  enableLocationFallback: true, // Bascule automatique vers LocationManager
};

/**
 * Suit la position GPS de l'appareil tant que `enabled` vaut true.
 * Dans le navigateur, le plugin Capacitor s'appuie sur la géolocalisation
 * du navigateur (localhost ou HTTPS obligatoire).
 */
export function useGeolocationTracker(
  enabled: boolean,
  onPosition?: (position: TrackedPosition) => void,
  onSignalLost?: () => void,
): GeolocationTracker {
  const listeners = useRef({ onPosition, onSignalLost });
  listeners.current = { onPosition, onSignalLost };
  const [position, setPosition] = useState<TrackedPosition | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const lastFixRef = useRef<{
    coords: LngLat;
    timestamp: number;
    speed: number | null;
  } | null>(null);
  const lastTimestampRef = useRef(0);
  const speedEpochRef = useRef(0);
  const resetSpeedHistory = useCallback((): void => {
    lastFixRef.current = null;
    speedEpochRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setError(null);
      lastFixRef.current = null;
      lastTimestampRef.current = 0;
      return;
    }

    let cancelled = false;
    let watchId: string | null = null;

    const handleValidPosition = (nextPosition: Position) => {
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

      const accuracy =
        typeof coords.accuracy === "number" &&
        Number.isFinite(coords.accuracy) &&
        coords.accuracy >= 0
          ? coords.accuracy
          : null;

      const altitude =
        typeof coords.altitude === "number" && Number.isFinite(coords.altitude)
          ? coords.altitude
          : null;

      const timestamp = nextPosition.timestamp;
      if (
        !Number.isSafeInteger(timestamp) ||
        timestamp <= 0 ||
        timestamp > Date.now() ||
        timestamp <= lastTimestampRef.current
      )
        return;
      lastTimestampRef.current = timestamp;

      // Calcul ou fiabilisation de la vitesse (fallback dérivé si coords.speed est null sur mobile)
      let speed: number | null = null;
      let speedSource: "native" | "derived" | null = null;
      if (
        typeof coords.speed === "number" &&
        Number.isFinite(coords.speed) &&
        coords.speed >= 0
      ) {
        speed = coords.speed;
        speedSource = "native";
      } else if (lastFixRef.current && accuracy !== null && accuracy <= 25) {
        const prev = lastFixRef.current;
        const deltaSeconds = (timestamp - prev.timestamp) / 1000;

        if (deltaSeconds >= 0.5 && deltaSeconds <= 5) {
          const deltaMeters = haversineMeters(
            [coords.longitude, coords.latitude],
            prev.coords,
          );

          // Seuil anti-bruit GPS : si déplacement sous l'imprécision, vitesse nulle
          if (
            deltaMeters < 1.5 ||
            (deltaMeters < accuracy * 0.25 && deltaMeters < 3.0)
          ) {
            speed = 0;
          } else {
            const instantSpeed = deltaMeters / deltaSeconds;
            // Rejeter les téléportations absurdes (> 45 m/s = 162 km/h)
            if (instantSpeed <= 45) {
              if (typeof prev.speed === "number" && prev.speed >= 0) {
                speed = Number(0.6 * instantSpeed + 0.4 * prev.speed);
              } else {
                speed = instantSpeed;
              }
            }
          }
        }
        if (speed !== null) speedSource = "derived";
      }

      lastFixRef.current = {
        coords: [coords.longitude, coords.latitude],
        timestamp,
        speed,
      };
      if (
        accuracy === null ||
        accuracy > 25 ||
        timestamp <= speedEpochRef.current
      )
        lastFixRef.current = null;

      setError(null);
      setStatus("tracking");
      const tracked: TrackedPosition = {
        coords: [coords.longitude, coords.latitude],
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude,
        speed,
        speedSource,
        accuracy,
        heading: coords.heading ?? null,
        altitudeAccuracy: coords.altitudeAccuracy ?? null,
        timestamp,
      };
      listeners.current.onPosition?.(tracked);
      setPosition(tracked);
    };

    const start = async () => {
      setStatus("waiting");
      setError(null);

      try {
        // Sur mobile, la permission se demande explicitement.
        if (Capacitor.isNativePlatform()) {
          if (typeof Geolocation.requestPermissions === "function") {
            const permissions = await Geolocation.requestPermissions({
              permissions: ["location", "coarseLocation"],
            });
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

        // 1. Positionnement immédiat sans attendre le premier tick de watchPosition
        if (typeof Geolocation.getCurrentPosition === "function") {
          void Geolocation.getCurrentPosition(GPS_TRACKING_OPTIONS)
            .then((pos) => {
              if (!cancelled && pos) {
                handleValidPosition(pos);
              }
            })
            .catch(() => undefined);
        }

        // 2. Écoute continue cadencée à 1 seconde sur Android
        const id = await Geolocation.watchPosition(
          GPS_TRACKING_OPTIONS,
          (nextPosition, watchError) => {
            if (cancelled) return;

            if (watchError || !nextPosition) {
              lastFixRef.current = null;
              listeners.current.onSignalLost?.();
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

              const isPermissionDenied =
                errorCode === 1 ||
                String(errorCode) === "1" ||
                errorMessage.toLowerCase().includes("denied") ||
                errorMessage.toLowerCase().includes("permission") ||
                errorMessage.toLowerCase().includes("manifest");

              const isLocationDisabled =
                errorMessage
                  .toLowerCase()
                  .includes("location services are not enabled") ||
                errorMessage.toLowerCase().includes("location_disabled");

              if (isPermissionDenied) {
                setStatus("denied");
                setError("Permission de localisation refusée.");
              } else if (isLocationDisabled) {
                setStatus("waiting");
                setError(
                  "Veuillez activer la localisation (GPS) sur votre appareil.",
                );
              } else {
                setStatus("waiting");
                setError("Signal GPS indisponible pour le moment.");
              }
              return;
            }

            handleValidPosition(nextPosition);
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
            msg.toLowerCase().includes("permission") ||
            msg.toLowerCase().includes("manifest");

          const isLocationDisabled =
            msg.toLowerCase().includes("location services are not enabled") ||
            msg.toLowerCase().includes("location_disabled");

          if (isPermissionDenied) {
            setStatus("denied");
            setError("Permission de localisation refusée.");
          } else if (isLocationDisabled) {
            setStatus("waiting");
            setError(
              "Veuillez activer la localisation (GPS) sur votre appareil.",
            );
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

  return { position, status, error, resetSpeedHistory };
}
