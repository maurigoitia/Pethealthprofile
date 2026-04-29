import type { ActionCodeSettings } from "firebase/auth";

const PRODUCTION_URL = "https://pessy.app";
const LOCAL_FALLBACK_URL = "http://localhost:5173";

// Origins from Capacitor native context that are not valid Firebase Auth domains
const NATIVE_ORIGINS = new Set(["https://localhost", "http://localhost", "capacitor://localhost"]);

const normalizeBaseUrl = (rawValue?: string | null): string | null => {
  const value = (rawValue || "").trim();
  if (!value) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return null;
  }
};

export const getAuthActionBaseUrl = (): string => {
  const envUrl = normalizeBaseUrl(import.meta.env.VITE_AUTH_ACTION_URL as string | undefined);
  if (envUrl) return envUrl;
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    // In Capacitor native context the origin is localhost — always use the real domain
    if (NATIVE_ORIGINS.has(origin)) return PRODUCTION_URL;
    return origin;
  }
  return LOCAL_FALLBACK_URL;
};

export const buildAuthActionUrl = (
  path: string,
  params?: Record<string, string | undefined | null>
): string => {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(safePath, `${getAuthActionBaseUrl()}/`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  return url.toString();
};

export const createVerificationActionCodeSettings = (): ActionCodeSettings => ({
  url: buildAuthActionUrl("/login", { source: "verify_email" }),
  handleCodeInApp: false,
});

export const createPasswordResetActionCodeSettings = (): ActionCodeSettings => ({
  url: buildAuthActionUrl("/reset-password"),
  handleCodeInApp: true,
});

