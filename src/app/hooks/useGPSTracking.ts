import { useState, useEffect, useRef, useCallback } from "react";
import { Geolocation, type Position } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speedKmh?: number;
}

export interface GPSTrackingState {
  isTracking: boolean;
  isPaused: boolean;
  route: GeoPoint[];
  currentPosition: GeoPoint | null;
  distanceKm: number;
  durationSeconds: number;
  averageSpeedKmh: number;
  permissionStatus: "granted" | "denied" | "prompt" | "checking";
  error: string | null;
}

function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

function calcTotalDistanceKm(route: GeoPoint[]): number {
  if (route.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversineDistanceKm(route[i - 1], route[i]);
  }
  return Math.round(total * 1000) / 1000;
}

export function useGPSTracking() {
  const [state, setState] = useState<GPSTrackingState>({
    isTracking: false,
    isPaused: false,
    route: [],
    currentPosition: null,
    distanceKm: 0,
    durationSeconds: 0,
    permissionStatus: "checking",
    error: null,
    averageSpeedKmh: 0,
  });

  const watchIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedSecondsRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const routeRef = useRef<GeoPoint[]>([]);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPermission = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        setState((s) => ({
          ...s,
          permissionStatus:
            perm.location === "granted" ? "granted" : perm.location === "denied" ? "denied" : "prompt",
        }));
      } else {
        // Web
        if (!navigator.geolocation) {
          setState((s) => ({ ...s, permissionStatus: "denied", error: "GPS no disponible en este dispositivo" }));
          return;
        }
        const result = await navigator.permissions?.query({ name: "geolocation" });
        setState((s) => ({
          ...s,
          permissionStatus: (result?.state as "granted" | "denied" | "prompt") ?? "prompt",
        }));
      }
    } catch {
      setState((s) => ({ ...s, permissionStatus: "prompt" }));
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
        const granted = perm.location === "granted";
        setState((s) => ({ ...s, permissionStatus: granted ? "granted" : "denied" }));
        return granted;
      } else {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setState((s) => ({ ...s, permissionStatus: "granted" }));
              resolve(true);
            },
            () => {
              setState((s) => ({ ...s, permissionStatus: "denied" }));
              resolve(false);
            }
          );
        });
      }
    } catch {
      setState((s) => ({ ...s, permissionStatus: "denied" }));
      return false;
    }
  }, []);

  const startTracking = useCallback(async (): Promise<boolean> => {
    let hasPermission = state.permissionStatus === "granted";
    if (!hasPermission) {
      hasPermission = await requestPermission();
    }
    if (!hasPermission) {
      setState((s) => ({ ...s, error: "Pessy necesita acceso a tu ubicación para trackear el paseo." }));
      return false;
    }

    routeRef.current = [];
    startTimeRef.current = Date.now();
    pausedSecondsRef.current = 0;

    setState((s) => ({
      ...s,
      isTracking: true,
      isPaused: false,
      route: [],
      distanceKm: 0,
      durationSeconds: 0,
      averageSpeedKmh: 0,
      error: null,
    }));

    // Timer
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) - pausedSecondsRef.current;
      setState((s) => ({ ...s, durationSeconds: elapsed }));
    }, 1000);

    // GPS watch
    try {
      if (Capacitor.isNativePlatform()) {
        watchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000 },
          (pos, err) => {
            if (err || !pos) return;
            handlePositionUpdate(pos);
          }
        );
      } else {
        const id = navigator.geolocation.watchPosition(
          (pos) => handlePositionUpdate(pos),
          (err) => setState((s) => ({ ...s, error: `Error GPS: ${err.message}` })),
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
        );
        watchIdRef.current = String(id);
      }
    } catch (e) {
      setState((s) => ({ ...s, error: "Error al iniciar GPS", isTracking: false }));
      return false;
    }

    return true;
  }, [state.permissionStatus, requestPermission]);

  const handlePositionUpdate = useCallback((pos: Position | GeolocationPosition) => {
    const coords = pos.coords;
    const point: GeoPoint = {
      lat: coords.latitude,
      lng: coords.longitude,
      timestamp: Date.now(),
      accuracy: coords.accuracy,
      speedKmh: coords.speed != null ? Math.round(coords.speed * 3.6 * 10) / 10 : undefined,
    };

    // Filter noise — skip if accuracy > 30m or if distance < 5m from last point
    if (point.accuracy && point.accuracy > 50) return;
    if (routeRef.current.length > 0) {
      const last = routeRef.current[routeRef.current.length - 1];
      const d = haversineDistanceKm(last, point) * 1000; // meters
      if (d < 5) return; // skip if < 5m movement
    }

    routeRef.current = [...routeRef.current, point];
    const distanceKm = calcTotalDistanceKm(routeRef.current);

    setState((s) => {
      const avgSpeed = s.durationSeconds > 0 ? (distanceKm / (s.durationSeconds / 3600)) : 0;
      return {
        ...s,
        route: routeRef.current,
        currentPosition: point,
        distanceKm,
        averageSpeedKmh: Math.round(avgSpeed * 10) / 10,
      };
    });
  }, []);

  const pauseTracking = useCallback(() => {
    pauseStartRef.current = Date.now();
    setState((s) => ({ ...s, isPaused: true }));
  }, []);

  const resumeTracking = useCallback(() => {
    if (pauseStartRef.current) {
      pausedSecondsRef.current += Math.floor((Date.now() - pauseStartRef.current) / 1000);
      pauseStartRef.current = null;
    }
    setState((s) => ({ ...s, isPaused: false }));
  }, []);

  const stopTracking = useCallback(() => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Clear GPS watch
    if (watchIdRef.current !== null) {
      if (Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: watchIdRef.current });
      } else {
        navigator.geolocation.clearWatch(Number(watchIdRef.current));
      }
      watchIdRef.current = null;
    }

    setState((s) => ({ ...s, isTracking: false, isPaused: false }));
  }, []);

  const resetTracking = useCallback(() => {
    stopTracking();
    routeRef.current = [];
    startTimeRef.current = null;
    pausedSecondsRef.current = 0;
    setState((s) => ({
      ...s,
      route: [],
      currentPosition: null,
      distanceKm: 0,
      durationSeconds: 0,
      averageSpeedKmh: 0,
      error: null,
    }));
  }, [stopTracking]);

  return {
    ...state,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    resetTracking,
    requestPermission,
  };
}
