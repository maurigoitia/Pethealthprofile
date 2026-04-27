// Sentry error-tracking stub — real integration pending SCRUM-48
export function initSentry(): void {
  // No-op until Sentry DSN is configured
  if (import.meta.env.VITE_SENTRY_DSN) {
    console.info("[Sentry] DSN detected but SDK not yet installed.");
  }
}

export function setSentryUser(_userId: string | null): void {
  // No-op until Sentry SDK is installed
}
