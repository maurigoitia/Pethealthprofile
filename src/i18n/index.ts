/**
 * i18n setup — Pessy
 * SCRUM-104: ES / EN / PT-BR
 *
 * Detección de idioma (prioridad):
 *  1. localStorage 'pessy_lang' (usuario eligió explícitamente)
 *  2. País del usuario (AR/MX/UY → es, US → en, BR → pt-BR)
 *  3. navigator.language del dispositivo
 *  4. Fallback: es
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./es";
import en from "./en";
import pt from "./pt";

export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español", flag: "🇦🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "pt-BR", label: "Português", flag: "🇧🇷" },
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// Country code → language
const COUNTRY_TO_LANG: Record<string, SupportedLang> = {
  AR: "es", MX: "es", UY: "es", CL: "es", CO: "es", PE: "es",
  ES: "es", VE: "es", EC: "es", BO: "es", PY: "es", CR: "es",
  US: "en", CA: "en", GB: "en", AU: "en", NZ: "en",
  BR: "pt-BR", PT: "pt-BR",
};

export function getLangFromCountry(countryCode: string): SupportedLang | null {
  if (!countryCode) return null;
  return COUNTRY_TO_LANG[countryCode.toUpperCase()] ?? null;
}

export function getLangFromBrowser(): SupportedLang {
  const nav = navigator.language || navigator.languages?.[0] || "es";
  const lower = nav.toLowerCase();
  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("en")) return "en";
  return "es";
}

export function getStoredLang(): SupportedLang | null {
  try {
    const stored = localStorage.getItem("pessy_lang");
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      return stored as SupportedLang;
    }
  } catch { /* ignore */ }
  return null;
}

export function storeLang(lang: SupportedLang): void {
  try { localStorage.setItem("pessy_lang", lang); } catch { /* ignore */ }
}

export function resolveLang(userCountry?: string): SupportedLang {
  return (
    getStoredLang() ||
    (userCountry ? getLangFromCountry(userCountry) : null) ||
    getLangFromBrowser()
  );
}

// ─── i18next init ─────────────────────────────────────────────────────────────

const DEFAULT_LANG = resolveLang();

i18n.use(initReactI18next).init({
  resources: {
    es:    { translation: es },
    en:    { translation: en },
    "pt-BR": { translation: pt },
  },
  lng: DEFAULT_LANG,
  fallbackLng: "es",
  interpolation: {
    escapeValue: false, // React already escapes
  },
  // Silenciar warnings de keys faltantes en dev (el ES es siempre completo)
  saveMissing: false,
  missingKeyHandler: (lngs, ns, key) => {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing key: ${key} (${lngs.join(",")})`);
    }
  },
});

export default i18n;

/**
 * Cambiar idioma en runtime.
 * Llamar desde LanguageSelector o cuando cambia userCountry.
 */
export async function changeLanguage(lang: SupportedLang): Promise<void> {
  storeLang(lang);
  await i18n.changeLanguage(lang);
  // Actualizar dir del documento para RTL (no aplica a ES/EN/PT, pero por completitud)
  document.documentElement.setAttribute("lang", lang);
}
