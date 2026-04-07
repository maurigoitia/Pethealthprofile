import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { createPasswordResetActionCodeSettings } from "../../utils/authActionLinks";
import { SEO } from "../shared/SEO";

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("from") === "vet" ? "/vet/login" : "/login";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Mensaje genérico para éxito y user-not-found — no revelar si la cuenta existe
  const GENERIC_SUCCESS = "Si existe una cuenta con ese correo, vas a recibir un link para restablecer tu contraseña.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(
        auth,
        email.trim().toLowerCase(),
        createPasswordResetActionCodeSettings()
      );
      setSuccess(true);
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        setSuccess(true); // no revelar existencia
      } else if (err?.code === "auth/invalid-email") {
        setError("El correo ingresado no es válido.");
      } else if (err?.code === "auth/operation-not-allowed") {
        setError("La recuperación de contraseña no está disponible en este momento.");
      } else if (
        err?.code === "auth/unauthorized-continue-uri" ||
        err?.code === "auth/invalid-continue-uri"
      ) {
        console.warn("Password reset: continue URI not authorized.", err);
        setError("Hubo un problema al enviar el correo. Intentá de nuevo más tarde.");
      } else {
        setError("No se pudo enviar el correo. Intentá nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Recuperar contraseña | Pessy"
        description="Recuperá el acceso a tu cuenta Pessy."
        canonical="https://pessy.app/forgot-password"
        robots="noindex,nofollow"
      />

      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "#F0FAF9" }}
      >
        <div className="w-full max-w-md">
          {/* Header */}
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="flex items-center gap-2 text-sm font-semibold text-[#6B7280] mb-8 hover:text-[#074738] transition-colors"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
            Volver
          </button>

          <h1
            className="text-3xl font-extrabold tracking-tight text-[#074738] mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Recuperar contraseña
          </h1>
          <p
            className="text-sm text-[#6B7280] mb-8"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Ingresá el correo de tu cuenta y te enviamos un link para crear una nueva contraseña.
          </p>

          {success ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700 font-medium leading-relaxed">
                {GENERIC_SUCCESS}
              </div>
              <button
                type="button"
                onClick={() => navigate(returnTo)}
                className="w-full rounded-[14px] bg-[#074738] py-4 font-bold uppercase tracking-[0.16em] text-white hover:bg-[#1A9B7D] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Tu correo electrónico"
                aria-label="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-5 py-4 text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
                autoFocus
                required
              />

              {error && (
                <p
                  className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-center text-sm font-semibold text-[#EF4444]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[14px] bg-[#074738] py-4 font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60 hover:bg-[#1A9B7D] transition-colors shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  "Enviar link"
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate(returnTo)}
                className="w-full rounded-[14px] border border-[#E5E7EB] bg-white py-4 font-bold text-[#6B7280] hover:bg-[#F0FAF9] transition-colors"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
