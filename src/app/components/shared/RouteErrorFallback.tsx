import { useEffect } from "react";
import { useNavigate, useRouteError } from "react-router";

export function RouteErrorFallback() {
  const navigate = useNavigate();
  const error = useRouteError() as any;

  // Auto-reload on chunk/module load errors (stale SW hashes after deploy)
  useEffect(() => {
    // CRÍTICO: loguear siempre el error para diagnosticar en prod
    // (antes el error se tragaba silencioso y solo veíamos el fallback)
    if (error) {
      console.error("[RouteErrorFallback] captured error:", error);
      if (error instanceof Error && error.stack) {
        console.error("[RouteErrorFallback] stack:", error.stack);
      }
    }
    if (error instanceof Error) {
      const isChunkError =
        (error as any).name === "ChunkLoadError" ||
        error.message.includes("Loading chunk") ||
        error.message.includes("CSS chunk") ||
        error.message.includes("Failed to fetch dynamically imported module") ||
        error.message.includes("Importing a module script failed");
      if (isChunkError) {
        window.location.reload();
      }
    }
  }, [error]);

  const message =
    error?.status === 404
      ? "La pantalla no existe o fue movida."
      : "Ocurrió un error inesperado en esta pantalla.";

  // Mostrar detalles del error si URL tiene ?debug=1 (para diagnóstico en prod)
  const showDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const errorDetails = showDebug && error
    ? (error instanceof Error ? `${error.message}\n\n${error.stack || ""}` : String(error))
    : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundImage: "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-10 pb-10 text-center">
        <h1 className="text-3xl font-black text-[#074738]">Pessy</h1>
        <p className="text-slate-500 mt-3 text-sm">Tuvimos un problema en esta vista.</p>
        <p className="mt-4 text-sm text-slate-700">{message}</p>
        {errorDetails && (
          <pre className="mt-4 text-[10px] text-left text-red-700 bg-red-50 p-2 rounded-lg overflow-auto max-h-40 whitespace-pre-wrap break-all">{errorDetails}</pre>
        )}
        <div className="mt-8 space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 rounded-2xl bg-[#074738] text-white font-bold"
          >
            Reintentar
          </button>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="w-full py-4 rounded-2xl border-2 border-[#074738] text-[#074738] font-bold"
          >
            Volver a la página principal
          </button>
          <a
            href="/reset"
            className="block text-xs text-slate-400 underline mt-4"
          >
            ¿Sigue fallando? Resetear caché
          </a>
        </div>
      </div>
    </div>
  );
}