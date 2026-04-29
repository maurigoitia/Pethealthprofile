import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { SEO } from "../shared/SEO";

type Status = "verifying" | "ready" | "submitting" | "success" | "invalid";

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode") || "";
  const mode = searchParams.get("mode");

  const [status, setStatus] = useState<Status>("verifying");
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!oobCode || (mode && mode !== "resetPassword")) {
      setStatus("invalid");
      setVerifyError(
        "Este link no es válido para restablecer tu contraseña. Pedí uno nuevo desde la pantalla de inicio."
      );
      return;
    }

    (async () => {
      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        if (cancelled) return;
        setAccountEmail(email);
        setStatus("ready");
      } catch (err: any) {
        if (cancelled) return;
        const code = err?.code;
        if (code === "auth/expired-action-code") {
          setVerifyError("Este link ya expiró. Pedí uno nuevo y volvé a intentarlo.");
        } else if (code === "auth/invalid-action-code") {
          setVerifyError("Este link ya no es válido. Puede que haya sido usado o esté vencido.");
        } else if (code === "auth/user-disabled") {
          setVerifyError("Esta cuenta está deshabilitada. Escribinos para ayudarte.");
        } else {
          setVerifyError("No pudimos validar el link. Intentá pedir uno nuevo.");
        }
        setStatus("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [oobCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setStatus("submitting");
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/expired-action-code") {
        setError("El link expiró. Pedí uno nuevo y volvé a intentarlo.");
      } else if (code === "auth/invalid-action-code") {
        setError("El link ya no es válido. Pedí uno nuevo.");
      } else if (code === "auth/weak-password") {
        setError("La contraseña es demasiado débil. Probá una más larga o con otros caracteres.");
      } else {
        setError("No pudimos cambiar la contraseña. Intentá de nuevo.");
      }
      setStatus("ready");
    }
  };

  return (
    <>
      <SEO
        title="Restablecer contraseña | Pessy"
        description="Creá una nueva contraseña para tu cuenta Pessy."
        canonical="https://pessy.app/reset-password"
        robots="noindex,nofollow"
      />

      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "#F0FAF9" }}
      >
        <div className="w-full max-w-md">
          <h1
            className="text-3xl font-extrabold tracking-tight text-[#074738] mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Restablecer contraseña
          </h1>

          {status === "verifying" && (
            <p
              className="text-sm text-[#6B7280] mb-8"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Validando el link...
            </p>
          )}

          {status === "invalid" && (
            <div className="space-y-6">
              <div
                className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-5 text-sm text-[#B91C1C] font-medium leading-relaxed"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {verifyError}
              </div>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="w-full rounded-[14px] bg-[#074738] py-4 font-bold uppercase tracking-[0.16em] text-white hover:bg-[#1A9B7D] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Pedir un link nuevo
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full rounded-[14px] border border-[#E5E7EB] bg-white py-4 font-bold text-[#6B7280] hover:bg-[#F0FAF9] transition-colors"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Volver al inicio de sesión
              </button>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6">
              <div
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700 font-medium leading-relaxed"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Listo. Ya podés iniciar sesión con tu nueva contraseña.
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full rounded-[14px] bg-[#074738] py-4 font-bold uppercase tracking-[0.16em] text-white hover:bg-[#1A9B7D] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Iniciar sesión
              </button>
            </div>
          )}

          {(status === "ready" || status === "submitting") && (
            <>
              <p
                className="text-sm text-[#6B7280] mb-8"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {accountEmail
                  ? `Creá una nueva contraseña para ${accountEmail}.`
                  : "Creá una nueva contraseña para tu cuenta."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="password"
                  placeholder="Nueva contraseña (mínimo 8 caracteres)"
                  aria-label="Nueva contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-5 py-4 text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                  autoFocus
                  required
                  minLength={8}
                  autoComplete="new-password"
                />

                <input
                  type="password"
                  placeholder="Repetí la nueva contraseña"
                  aria-label="Confirmar nueva contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-5 py-4 text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
                  disabled={status === "submitting"}
                  className="w-full rounded-[14px] bg-[#074738] py-4 font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60 hover:bg-[#1A9B7D] transition-colors shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {status === "submitting" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </span>
                  ) : (
                    "Guardar contraseña"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full rounded-[14px] border border-[#E5E7EB] bg-white py-4 font-bold text-[#6B7280] hover:bg-[#F0FAF9] transition-colors"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Cancelar
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default ResetPasswordScreen;
