const PROD_HOSTS = new Set([
  "pessy.app",
  "www.pessy.app",
  "app.pessy.app",
  "polar-scene-488615-i0.web.app",
]);

const FOCUS_HISTORY_EXPERIMENT_HOSTS = new Set([
  "pessy-focus-qa.web.app",
]);

export function isProductionAppHost(): boolean {
  if (typeof window === "undefined") return false;
  return PROD_HOSTS.has(window.location.hostname.toLowerCase());
}

export function isFocusExperienceHost(): boolean {
  if (typeof window === "undefined") return false;
  const envFlag = import.meta.env.VITE_ENABLE_FOCUS_EXPERIENCE;
  if (envFlag === "true") return true;
  if (envFlag === "false") return false;
  return false;
}

export function isFocusHistoryExperimentHost(): boolean {
  if (typeof window === "undefined") return false;
  const envFlag = import.meta.env.VITE_ENABLE_FOCUS_HISTORY_EXPERIMENT;
  if (envFlag === "true") return true;
  if (envFlag === "false") return false;
  return FOCUS_HISTORY_EXPERIMENT_HOSTS.has(window.location.hostname.toLowerCase());
}

export function isPendingActionsEnabled(): boolean {
  const envFlag = import.meta.env.VITE_ENABLE_PENDING_ACTIONS;
  if (envFlag === "true") return true;
  if (envFlag === "false") return false;
  return !isProductionAppHost();
}

export function isHomeDoseCardsEnabled(): boolean {
  const envFlag = import.meta.env.VITE_ENABLE_HOME_DOSE_CARDS;
  if (envFlag === "true") return true;
  if (envFlag === "false") return false;
  // En producción lo apagamos por defecto para evitar recordatorios falsos
  // hasta que toda la lógica de scheduling esté 100% auditada.
  return !isProductionAppHost();
}

/**
 * Detect if the app is running inside the Flutter WebView wrapper.
 * The Flutter WebView injects a `PessyNative` JS channel — if it exists,
 * we're inside the native app. Also detect standalone PWA mode or
 * explicit `?source=flutter` param.
 */
export function isNativeAppContext(): boolean {
  if (typeof window === "undefined") return false;
  // Flutter WebView JS bridge
  if ((window as any).PessyNative) return true;
  // URL param (set by Flutter config)
  if (new URLSearchParams(window.location.search).get("source") === "flutter") return true;
  // Standalone PWA (installed on home screen)
  if ((window.navigator as any)?.standalone === true) return true;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  return false;
}

/**
 * Returns true when the landing/website pages should be shown.
 * False inside native app or standalone PWA — those should only see app screens.
 */
export function isWebsiteContext(): boolean {
  return !isNativeAppContext();
}

export function isEmailSyncEnabled(): boolean {
  const envFlag = import.meta.env.VITE_ENABLE_EMAIL_SYNC;
  if (envFlag === "true") return true;
  if (envFlag === "false") return false;
  return true;
}
