/**
 * Vitest global setup — SCRUM-44
 */
import "@testing-library/jest-dom";

// Stub matchMedia (not available in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Ensure Intl.DateTimeFormat.prototype.resolvedOptions always returns a timeZone
// (jsdom may have it, but we guard defensively by checking via an instance)
try {
  const testFmt = new Intl.DateTimeFormat();
  if (!testFmt.resolvedOptions().timeZone) {
    Object.defineProperty(Intl.DateTimeFormat.prototype, "resolvedOptions", {
      configurable: true,
      value: () => ({ timeZone: "America/Argentina/Buenos_Aires" }),
    });
  }
} catch {
  // If Intl is unavailable leave it — tests will skip timezone-sensitive cases
}
