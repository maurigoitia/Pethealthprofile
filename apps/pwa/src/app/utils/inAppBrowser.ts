/**
 * Detecta si el usuario está dentro de un in-app browser (TikTok, Instagram, Facebook, etc.)
 * Google bloquea OAuth en estos WebViews desde 2021 (disallowed_useragent).
 */

interface InAppBrowserInfo {
  isInApp: boolean;
  source: "tiktok" | "instagram" | "facebook" | "snapchat" | "twitter" | "linkedin" | "unknown" | null;
}

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === "undefined") return { isInApp: false, source: null };

  const ua = navigator.userAgent.toLowerCase();

  // Orden de prioridad: los más comunes primero
  if (ua.includes("musical_ly") || ua.includes("tiktok") || ua.includes("bytedance")) {
    return { isInApp: true, source: "tiktok" };
  }
  if (ua.includes("instagram")) {
    return { isInApp: true, source: "instagram" };
  }
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab")) {
    return { isInApp: true, source: "facebook" };
  }
  if (ua.includes("snapchat")) {
    return { isInApp: true, source: "snapchat" };
  }
  if (ua.includes("twitter") || ua.includes(" x/")) {
    return { isInApp: true, source: "twitter" };
  }
  if (ua.includes("linkedinapp")) {
    return { isInApp: true, source: "linkedin" };
  }

  // Heurística genérica: WebView sin Chrome/Safari estándar
  const isWebView =
    (ua.includes("wv") && ua.includes("android")) ||
    (ua.includes("iphone") && !ua.includes("safari") && !ua.includes("crios") && !ua.includes("fxios"));

  if (isWebView) {
    return { isInApp: true, source: "unknown" };
  }

  return { isInApp: false, source: null };
}

/**
 * Intenta abrir la URL en el navegador del sistema (fuera del WebView).
 * En Android usa intent://, en iOS muestra instrucciones.
 */
export function openInSystemBrowser(url: string): boolean {
  const ua = navigator.userAgent.toLowerCase();

  // Android: intent URL para Chrome
  if (ua.includes("android")) {
    const intentUrl = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intentUrl;
    return true;
  }

  // iOS: no hay forma programática confiable, pero window.open a veces funciona
  if (ua.includes("iphone") || ua.includes("ipad")) {
    window.open(url, "_blank");
    return true;
  }

  // Fallback
  window.open(url, "_blank");
  return true;
}

export function getInAppBrowserLabel(source: InAppBrowserInfo["source"]): string {
  switch (source) {
    case "tiktok": return "TikTok";
    case "instagram": return "Instagram";
    case "facebook": return "Facebook";
    case "snapchat": return "Snapchat";
    case "twitter": return "X (Twitter)";
    case "linkedin": return "LinkedIn";
    default: return "esta app";
  }
}
