/**
 * sentryConfig.test.ts — SCRUM-44
 *
 * Tests for Sentry error tracking config.
 * All Sentry SDK calls are mocked — no real network traffic.
 * Uses vi.stubEnv for reliable env patching across dynamic imports.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInit = vi.fn();
const mockSetUser = vi.fn();
const mockCaptureException = vi.fn();
const mockSetExtras = vi.fn();
const mockWithScope = vi.fn((cb: (scope: unknown) => void) => {
  cb({ setExtras: mockSetExtras });
});
const mockBrowserTracingIntegration = vi.fn(() => ({ name: "BrowserTracing" }));
const mockReplayIntegration = vi.fn(() => ({ name: "Replay" }));

vi.mock("@sentry/react", () => ({
  init: (...args: unknown[]) => mockInit(...args),
  setUser: (...args: unknown[]) => mockSetUser(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  withScope: (cb: (scope: unknown) => void) => mockWithScope(cb),
  browserTracingIntegration: () => mockBrowserTracingIntegration(),
  replayIntegration: (...args: unknown[]) => mockReplayIntegration(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function importFresh() {
  vi.resetModules();
  return import("./sentryConfig");
}

// ── initSentry ────────────────────────────────────────────────────────────────

describe("initSentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op when VITE_SENTRY_DSN is not set", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    const { initSentry } = await importFresh();
    initSentry();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("calls Sentry.init when DSN is present", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://test@sentry.io/123");
    const { initSentry } = await importFresh();
    initSentry();
    expect(mockInit).toHaveBeenCalledOnce();
  });

  it("passes the DSN to Sentry.init", async () => {
    const dsn = "https://abc123@sentry.io/456";
    vi.stubEnv("VITE_SENTRY_DSN", dsn);
    const { initSentry } = await importFresh();
    initSentry();
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ dsn }));
  });

  it("uses tracesSampleRate=0.2 in production", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    vi.stubEnv("VITE_ENV", "production");
    const { initSentry } = await importFresh();
    initSentry();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ tracesSampleRate: 0.2 })
    );
  });

  it("uses tracesSampleRate=1.0 in non-production", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    vi.stubEnv("VITE_ENV", "staging");
    const { initSentry } = await importFresh();
    initSentry();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ tracesSampleRate: 1.0 })
    );
  });

  it("includes integrations array with at least 2 entries", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { initSentry } = await importFresh();
    initSentry();
    const [config] = mockInit.mock.calls[0] as [{ integrations: unknown[] }][];
    expect(Array.isArray(config.integrations)).toBe(true);
    expect(config.integrations.length).toBeGreaterThanOrEqual(2);
  });

  it("beforeSend returns null for 'Failed to fetch' errors", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { initSentry } = await importFresh();
    initSentry();
    const [config] = mockInit.mock.calls[0] as [{ beforeSend: Function }][];
    const result = config.beforeSend(
      { breadcrumbs: { values: [] } },
      { originalException: new Error("Failed to fetch") }
    );
    expect(result).toBeNull();
  });

  it("beforeSend redacts emails in breadcrumbs", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { initSentry } = await importFresh();
    initSentry();
    const [config] = mockInit.mock.calls[0] as [{ beforeSend: Function }][];
    const event = {
      breadcrumbs: {
        values: [{ message: "User test@example.com logged in" }],
      },
    };
    const result = config.beforeSend(event, {});
    expect(result.breadcrumbs.values[0].message).not.toContain("test@example.com");
    expect(result.breadcrumbs.values[0].message).toContain("[email]");
  });

  it("beforeSend redacts UIDs in breadcrumbs", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { initSentry } = await importFresh();
    initSentry();
    const [config] = mockInit.mock.calls[0] as [{ beforeSend: Function }][];
    const event = {
      breadcrumbs: {
        values: [{ message: "uid=abc123def456ghi789jkl fetched pets" }],
      },
    };
    const result = config.beforeSend(event, {});
    expect(result.breadcrumbs.values[0].message).toContain("[redacted]");
    expect(result.breadcrumbs.values[0].message).not.toContain("abc123def456ghi789jkl");
  });

  it("passes event through beforeSend when no special conditions", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { initSentry } = await importFresh();
    initSentry();
    const [config] = mockInit.mock.calls[0] as [{ beforeSend: Function }][];
    const event = { breadcrumbs: { values: [{ message: "normal log" }] } };
    const result = config.beforeSend(event, {});
    expect(result).not.toBeNull();
  });
});

// ── setSentryUser ─────────────────────────────────────────────────────────────

describe("setSentryUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls Sentry.setUser with the uid when authenticated", async () => {
    const { setSentryUser } = await importFresh();
    setSentryUser("user-uid-abc");
    expect(mockSetUser).toHaveBeenCalledWith({ id: "user-uid-abc" });
  });

  it("calls Sentry.setUser(null) on logout", async () => {
    const { setSentryUser } = await importFresh();
    setSentryUser(null);
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it("never passes email to setUser — only uid", async () => {
    const { setSentryUser } = await importFresh();
    setSentryUser("uid-only-no-email");
    const [arg] = mockSetUser.mock.calls[0];
    expect(arg).not.toHaveProperty("email");
    expect(arg).toEqual({ id: "uid-only-no-email" });
  });
});

// ── captureError ──────────────────────────────────────────────────────────────

describe("captureError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls Sentry.captureException when DSN is set", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { captureError } = await importFresh();
    const err = new Error("something broke");
    captureError(err);
    expect(mockWithScope).toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(err);
  });

  it("attaches context extras when provided", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { captureError } = await importFresh();
    captureError(new Error("ctx error"), { petId: "pet-123", action: "load" });
    expect(mockSetExtras).toHaveBeenCalledWith({ petId: "pet-123", action: "load" });
  });

  it("works without context (no setExtras call with undefined)", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://x@sentry.io/1");
    const { captureError } = await importFresh();
    captureError(new Error("no context"));
    expect(mockCaptureException).toHaveBeenCalled();
    expect(mockSetExtras).not.toHaveBeenCalled();
  });

  it("falls back to console.error when DSN is not set", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureError } = await importFresh();
    captureError(new Error("test error"));
    expect(consoleSpy).toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
