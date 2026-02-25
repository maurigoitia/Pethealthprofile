import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
