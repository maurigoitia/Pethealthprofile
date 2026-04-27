import { app } from "../../lib/firebase";

const STORAGE_KEY = "pessy_acquisition_source";

type TrackableValue = string | number | boolean | null | undefined;

let analyticsPromise: Promise<{
  analytics: unknown | null;
  logEvent: ((analyticsInstance: unknown, eventName: string, eventParams?: Record<string, TrackableValue>) => void) | null;
}> | null = null;

function sanitizeSource(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return normalized || null;
}

export function getStoredAcquisitionSource(): string | null {
  if (typeof window === "undefined") return null;
  return sanitizeSource(window.localStorage.getItem(STORAGE_KEY));
}

export function persistAcquisitionSource(source: string | null | undefined) {
  if (typeof window === "undefined") return;
  const normalized = sanitizeSource(source);
  if (!normalized) return;
  window.localStorage.setItem(STORAGE_KEY, normalized);
}

export function resolveAcquisitionSource(search: string, pathname: string): string | null {
  const params = new URLSearchParams(search);
  const fromQuery = sanitizeSource(params.get("src"));
  if (fromQuery) return fromQuery;

  if (pathname === "/empezar") return "empezar";
  if (pathname === "/") return "landing";

  return getStoredAcquisitionSource();
}

export function withAcquisitionParams(
  path: string,
  source: string | null | undefined,
  extraParams: Record<string, string | null | undefined> = {},
): string {
  const url = new URL(path, "https://pessy.app");
  const normalizedSource = sanitizeSource(source);
  if (normalizedSource) {
    url.searchParams.set("src", normalizedSource);
  }

  Object.entries(extraParams).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });

  return `${url.pathname}${url.search}${url.hash}`;
}

function getAnalyticsClient() {
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    if (typeof window === "undefined") {
      return { analytics: null, logEvent: null };
    }

    try {
      const analyticsModule = await import("firebase/analytics");
      const supported = await analyticsModule.isSupported();
      if (!supported) {
        return { analytics: null, logEvent: null };
      }

      return {
        analytics: analyticsModule.getAnalytics(app),
        logEvent: analyticsModule.logEvent as (
          analyticsInstance: unknown,
          eventName: string,
          eventParams?: Record<string, TrackableValue>,
        ) => void,
      };
    } catch (error) {
      console.warn("[tracking] No se pudo inicializar analytics:", error);
      return { analytics: null, logEvent: null };
    }
  })();

  return analyticsPromise;
}

export async function trackAcquisitionEvent(
  eventName: string,
  params: Record<string, TrackableValue> = {},
) {
  if (typeof window === "undefined") return;

  const payload = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  );

  try {
    const globalWindow = window as typeof window & {
      dataLayer?: Array<Record<string, TrackableValue>>;
      gtag?: (command: string, eventName: string, eventParams?: Record<string, TrackableValue>) => void;
    };

    globalWindow.dataLayer?.push({ event: eventName, ...payload });
    globalWindow.gtag?.("event", eventName, payload);

    const { analytics, logEvent } = await getAnalyticsClient();
    if (analytics && logEvent) {
      logEvent(analytics, eventName, payload);
    }
  } catch (error) {
    console.warn(`[tracking] Falló el evento ${eventName}:`, error);
  }
}
