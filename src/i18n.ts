// SCRUM-104: i18n stub — Spanish-only for now
// Real i18n setup (i18next) will replace this when multi-language support is needed

const DEFAULT_LOCALE = "es";

const i18n = {
  language: DEFAULT_LOCALE,
  t: (key: string, params?: Record<string, string>) => {
    // Return last segment of key as fallback, with params interpolated
    let text = key.split(".").pop() || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, v);
      });
    }
    return text;
  },
};

export function changeLanguage(_lang: string): void {
  // No-op until i18next is configured
}

export function getLangFromCountry(_country: string): string {
  return DEFAULT_LOCALE;
}

export function getStoredLang(): string | null {
  return localStorage.getItem("pessy_lang");
}

export default i18n;
