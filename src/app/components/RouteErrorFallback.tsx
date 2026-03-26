import { useNavigate, useRouteError } from "react-router";

export function RouteErrorFallback() {
  const navigate = useNavigate();
  const error = useRouteError() as any;
  const message =
    error?.status === 404
      ? "La pantalla no existe o fue movida."
      : "Ocurrió un error inesperado en esta pantalla.";

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
        <div className="mt-8 space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 rounded-2xl bg-[#074738] text-white font-bold"
          >
            Reintentar
          </button>
          <button
            onClick={() => navigate("/home")}
            className="w-full py-4 rounded-2xl border-2 border-[#074738] text-[#074738] font-bold"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
