/**
 * i18n tests — SCRUM-44 / SCRUM-104
 * Tests: language detection, country mapping, storage
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getLangFromCountry, getLangFromBrowser, resolveLang, SUPPORTED_LANGUAGES } from "./index";

// ─── getLangFromCountry ───────────────────────────────────────────────────────

describe("getLangFromCountry", () => {
  it("maps AR → es", () => expect(getLangFromCountry("AR")).toBe("es"));
  it("maps MX → es", () => expect(getLangFromCountry("MX")).toBe("es"));
  it("maps UY → es", () => expect(getLangFromCountry("UY")).toBe("es"));
  it("maps US → en", () => expect(getLangFromCountry("US")).toBe("en"));
  it("maps GB → en", () => expect(getLangFromCountry("GB")).toBe("en"));
  it("maps BR → pt-BR", () => expect(getLangFromCountry("BR")).toBe("pt-BR"));
  it("maps PT → pt-BR", () => expect(getLangFromCountry("PT")).toBe("pt-BR"));
  it("is case-insensitive: ar → es", () => expect(getLangFromCountry("ar")).toBe("es"));
  it("returns null for unknown country", () => expect(getLangFromCountry("ZZ")).toBeNull());
  it("returns null for empty string", () => expect(getLangFromCountry("")).toBeNull());
});

// ─── getLangFromBrowser ───────────────────────────────────────────────────────

describe("getLangFromBrowser", () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(window, "navigator");

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(window, "navigator", originalNavigator);
    }
  });

  it("returns es for es-AR", () => {
    Object.defineProperty(window, "navigator", {
      value: { language: "es-AR", languages: ["es-AR"] },
      writable: true, configurable: true,
    });
    expect(getLangFromBrowser()).toBe("es");
  });

  it("returns en for en-US", () => {
    Object.defineProperty(window, "navigator", {
      value: { language: "en-US", languages: ["en-US"] },
      writable: true, configurable: true,
    });
    expect(getLangFromBrowser()).toBe("en");
  });

  it("returns pt-BR for pt-BR", () => {
    Object.defineProperty(window, "navigator", {
      value: { language: "pt-BR", languages: ["pt-BR"] },
      writable: true, configurable: true,
    });
    expect(getLangFromBrowser()).toBe("pt-BR");
  });

  it("returns pt-BR for pt (Portuguese without region)", () => {
    Object.defineProperty(window, "navigator", {
      value: { language: "pt", languages: ["pt"] },
      writable: true, configurable: true,
    });
    expect(getLangFromBrowser()).toBe("pt-BR");
  });

  it("falls back to es for unknown language", () => {
    Object.defineProperty(window, "navigator", {
      value: { language: "fr-FR", languages: ["fr-FR"] },
      writable: true, configurable: true,
    });
    expect(getLangFromBrowser()).toBe("es");
  });
});

// ─── resolveLang ──────────────────────────────────────────────────────────────

describe("resolveLang", () => {
  beforeEach(() => localStorage.clear());

  it("prefers localStorage over country", () => {
    localStorage.setItem("pessy_lang", "en");
    expect(resolveLang("AR")).toBe("en");
  });

  it("uses country when no localStorage", () => {
    expect(resolveLang("BR")).toBe("pt-BR");
  });

  it("falls back to browser when no country", () => {
    Object.defineProperty(window, "navigator", {
      value: { language: "en-US", languages: ["en-US"] },
      writable: true, configurable: true,
    });
    expect(resolveLang(undefined)).toBe("en");
  });

  it("ignores invalid localStorage value", () => {
    localStorage.setItem("pessy_lang", "invalid-lang");
    expect(["es", "en", "pt-BR"]).toContain(resolveLang("US"));
  });
});

// ─── SUPPORTED_LANGUAGES ─────────────────────────────────────────────────────

describe("SUPPORTED_LANGUAGES", () => {
  it("contains es, en, and pt-BR", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain("es");
    expect(codes).toContain("en");
    expect(codes).toContain("pt-BR");
  });

  it("each language has a flag and label", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.flag).toBeTruthy();
      expect(lang.label).toBeTruthy();
    }
  });
});
