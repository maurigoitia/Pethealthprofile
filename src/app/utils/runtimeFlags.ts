const PROD_HOSTS = new Set([
  "pessy.app",
  "www.pessy.app",
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

export function isEmailSyncEnabled(): boolean {
  const envFlag = import.meta.env.VITE_ENABLE_EMAIL_SYNC;
  if (envFlag === "true") return true;
  if (envFlag === "false") return false;
  return true;
}
