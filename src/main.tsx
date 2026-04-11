import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
// SCRUM-48: Error tracking
import { initSentry } from "./app/config/sentryConfig";
initSentry();
// SCRUM-104: i18n — must import before App renders
import "./i18n";

declare const __PESSY_BUILD_ID__: string;

// Recuperación de pantalla blanca por mismatch de chunks (PWA/cache viejo tras deploy)
const shouldRecoverFromChunkError = (reason: unknown) => {
  const message =
    typeof reason === "string"
      ? reason
      : (reason as any)?.message || (reason as any)?.reason?.message || "";
  return /Loading chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);
};

const recoverOnceFromChunkError = () => {
  if (sessionStorage.getItem("pessy_chunk_recovered") === "1") return;
  sessionStorage.setItem("pessy_chunk_recovered", "1");
  window.location.reload();
};

window.addEventListener("error", (event) => {
  if (shouldRecoverFromChunkError(event.error || event.message)) {
    recoverOnceFromChunkError();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (shouldRecoverFromChunkError(event.reason)) {
    recoverOnceFromChunkError();
  }
});

const clearStalePwaCacheOnBuildChange = async () => {
  if (typeof window === "undefined") return false;

  const buildId = typeof __PESSY_BUILD_ID__ === "string" ? __PESSY_BUILD_ID__ : "";
  if (!buildId) return false;

  const buildKey = "pessy_build_id";
  const previousBuild = localStorage.getItem(buildKey);

  if (!previousBuild) {
    localStorage.setItem(buildKey, buildId);
    return false;
  }

  if (previousBuild === buildId) return false;

  localStorage.setItem(buildKey, buildId);

  const reloadKey = `pessy_build_reloaded_${buildId}`;
  if (sessionStorage.getItem(reloadKey) === "1") return false;
  sessionStorage.setItem(reloadKey, "1");

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }
  } catch (error) {
    console.warn("No se pudo limpiar cache PWA anterior:", error);
  }

  window.location.reload();
  return true;
};

// Force SW update check on every page load (helps iOS Safari pick up new deploys)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) reg.update();
  });
}

const bootstrap = async () => {
  const shouldReload = await clearStalePwaCacheOnBuildChange();
  if (shouldReload) return;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.update().then(() => {
          // Si hay un SW esperando activarse, recargar la app para usar la versión nueva
          if (registration.waiting) {
            console.warn("[SW] Nueva versión disponible, recargando...");
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }
          // Escuchar si llega un update después del check inicial
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.warn("[SW] Update instalado, disponible en próxima recarga.");
              }
            });
          });
        }).catch((err) => {
          console.warn("[SW] No se pudo chequear actualizaciones:", err);
        });
      });
    });
  }

  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void bootstrap();
