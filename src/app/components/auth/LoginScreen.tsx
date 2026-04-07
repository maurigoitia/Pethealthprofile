import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { createPasswordResetActionCodeSettings } from "../../utils/authActionLinks";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../../utils/acquisitionTracking";
import { SEO } from "../shared/SEO";
import { AuthPageShell } from "./AuthPageShell";
import { isNativeAppContext } from "../../utils/runtimeFlags";

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Recuperar contraseña
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  // BUG-009 FIX: guardar el invite code sincrónicamente durante el render, no en un useEffect.
  // Si el usuario ya está logueado, el useEffect de redirect puede dispararse antes de que el
  // useEffect de inviteCode corra (aunque en teoría corren en orden, hay edge cases con
  // Firebase Auth que resuelve en el primer render). Guardar en useMemo es seguro e idempotente.
  const inviteCode = useMemo(() => {
    const code = normalizeCoTutorInviteCode(new URLSearchParams(location.search).get("invite"));
    if (code) rememberPendingCoTutorInvite(code);
    return code;
  }, [location.search]);

  // Platform invite code (?ref=CODE) — enables register button
  const refCode = useMemo(
    () => new URLSearchParams(location.search).get("ref")?.trim() || "",
    [location.search]
  );
  const hasValidCode = !!(inviteCode || refCode);
  const acquisitionSource = useMemo(
    () => resolveAcquisitionSource(location.search, location.pathname),
    [location.pathname, location.search]
  );

  useEffect(() => {
    if (!acquisitionSource) return;
    persistAcquisitionSource(acquisitionSource);
    void trackAcquisitionEvent("pessy_acquisition_login_view", {
      source: acquisitionSource,
      path: location.pathname,
    });
  }, [acquisitionSource, location.pathname]);

  const isStandalonePwa = () => {
    if (typeof window === "undefined") return false;
    const iosStandalone = (window.navigator as any)?.standalone === true;
    const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true;
    return iosStandalone || mediaStandalone;
  };

  const getGoogleAuthErrorMessage = (code?: string): string => {
    switch (code) {
      case "auth/unauthorized-domain":
      case "auth/invalid-api-key":
      case "auth/app-not-authorized":
      case "auth/configuration-not-found":
        return "Hubo un problema al conectar. Intentá de nuevo o usá correo y contraseña.";
      case "auth/operation-not-allowed":
        return "Este método de inicio de sesión no está disponible en este momento.";
      case "auth/network-request-failed":
        return "Sin conexión a internet. Revisá tu conexión e intentá de nuevo.";
      case "auth/popup-blocked":
        return "El navegador bloqueó la ventana de Google. Permití ventanas emergentes e intentá de nuevo.";
      case "auth/popup-closed-by-user":
        return "Cerraste la ventana de Google antes de completar el acceso.";
      case "auth/cancelled-popup-request":
        return "Se canceló el intento anterior. Intentá de nuevo.";
      default:
        return "No se pudo iniciar con Google. Intentá de nuevo o usá correo y contraseña.";
    }
  };

  // Handle redirect result from signInWithRedirect (PWA standalone mode)
  useEffect(() => {
    getRedirectResult(auth).catch(() => {
      // Redirect result errors (e.g. user closed Google) are non-fatal
    });
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/home", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || authLoading) return;
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const rawPassword = password;
    const trimmedPassword = password.trim();
    const passwordsToTry =
      trimmedPassword && trimmedPassword !== rawPassword
        ? [rawPassword, trimmedPassword]
        : [rawPassword];

    try {
      let signedIn = false;
      let lastError: any = null;

      for (const candidatePassword of passwordsToTry) {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, candidatePassword);
          signedIn = true;
          break;
        } catch (candidateError: any) {
          lastError = candidateError;
          const canRetryWithTrimmed =
            candidatePassword === rawPassword &&
            passwordsToTry.length > 1 &&
            (candidateError?.code === "auth/wrong-password" ||
              candidateError?.code === "auth/invalid-credential");
          if (!canRetryWithTrimmed) {
            throw candidateError;
          }
        }
      }

      if (!signedIn && lastError) throw lastError;
      navigate("/home", { replace: true });
    } catch (err: any) {
      if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        // SCRUM-14: Error genérico — no revelar si el email existe o método de auth
        setError("Correo o contraseña incorrectos. Revisá tus datos e intentá nuevamente.");
      } else if (err?.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Esperá unos minutos o recuperá tu contraseña.");
      } else if (err?.code === "auth/network-request-failed") {
        setError("Sin conexión. Revisá internet e intentá nuevamente.");
      } else {
        setError("No se pudo iniciar sesión. Intentá nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);
    // Mensaje genérico usado tanto para éxito real como para user-not-found —
    // no revelar si la cuenta existe (previene enumeración de emails).
    const genericSuccess = "Si existe una cuenta con ese correo, vas a recibir un link para restablecer tu contraseña.";
    try {
      await sendPasswordResetEmail(
        auth,
        resetEmail.trim().toLowerCase(),
        createPasswordResetActionCodeSettings()
      );
      setResetSuccess(genericSuccess);
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        // No revelar que la cuenta no existe
        setResetSuccess(genericSuccess);
      } else if (err?.code === "auth/invalid-email") {
        setResetError("El correo ingresado no es válido.");
      } else if (err?.code === "auth/operation-not-allowed") {
        console.warn("Password reset blocked: Email/Password provider not enabled in Firebase Auth.", err);
        setResetError("La recuperación de contraseña no está disponible en este momento. Intentá más tarde.");
      } else if (err?.code === "auth/unauthorized-continue-uri" || err?.code === "auth/invalid-continue-uri") {
        console.warn("Password reset blocked: continue URI not authorized in Firebase Auth.", err);
        setResetError("Hubo un problema al enviar el correo. Intentá de nuevo más tarde.");
      } else {
        setResetError("No se pudo enviar el correo. Intentá nuevamente.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loadingGoogle) return;
    setError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    
    try {
      if (isStandalonePwa()) {
        setLoadingGoogle(true);
        await signInWithRedirect(auth, provider);
        return;
      }
      
      // Keep popup initialization strictly synchronous to avoid Safari blocking it
      const signInPromise = signInWithPopup(auth, provider);
      setLoadingGoogle(true);
      await signInPromise;

      navigate("/home");
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        setError("La ventana de Google fue bloqueada o cerrada. Por favor, permití las ventanas emergentes (pop-ups) e intentá de nuevo.");
      } else {
        console.error("Google sign-in error:", {
          code: err?.code,
          message: err?.message,
          domain: window.location.hostname,
        });
        setError(getGoogleAuthErrorMessage(err?.code));
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <>
      <SEO
        title="Login | Pessy"
        description="Accede a Pessy — la app con IA que tiene todo lo de tu mascota en un solo lugar."
        canonical="https://pessy.app/login"
        robots="noindex,nofollow"
      />

      <AuthPageShell
        eyebrow="Acceso"
        title="Pessy — Porque quererlo ya es suficiente trabajo"
        description="Porque quererlo ya es suficiente trabajo. Con IA."
        highlights={["Identidad digital", "Recordatorios", "Co-tutores"]}
      >
        <div className="mb-8">
          <h2
            className="text-3xl font-extrabold tracking-tight text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            Bienvenido de nuevo
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#9CA3AF]">
            Entrá para seguir desde donde quedaste.
          </p>
        </div>

        <div className="mb-8 w-full">
          <div className="w-full rounded-[16px] border border-[#E5E7EB] bg-[#F0FAF9] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#074738]" style={{ fontFamily: "'Manrope', sans-serif" }}>Tu mascota, sus cosas</p>
            <p className="mt-2 text-sm font-medium leading-6 text-[#6B7280]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Porque quererlo ya es suficiente trabajo.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full space-y-4">
          {inviteCode && (
            <div className="rounded-[16px] border border-[#1A9B7D]/30 bg-[#E0F2F1] px-5 py-4 text-[#1A1A1A]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#074738]" style={{ fontFamily: "'Manrope', sans-serif" }}>Invitacion de co-tutor</p>
              <p className="text-sm font-medium leading-5 mt-1 text-[#6B7280]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Al completar el acceso, vamos a vincular esta cuenta con la mascota compartida.
              </p>
            </div>
          )}
          <input
            type="email"
            placeholder="Correo electrónico"
            aria-label="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-5 py-4 text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
            required
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              aria-label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-5 py-4 pr-28 text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[14px] border border-[#E5E7EB] bg-[#F0FAF9] px-3 py-1 text-xs font-bold text-[#074738] hover:bg-[#E0F2F1] transition-colors"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setShowReset(true); setResetEmail(email); setResetError(""); setResetSuccess(""); }}
              className="text-sm font-semibold text-[#6B7280] transition-colors hover:text-[#074738]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              ¿Olvidaste tu contraseña?
            </button>

          </div>

          {error && <p className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-center text-sm font-semibold text-[#EF4444]" style={{ fontFamily: "'Manrope', sans-serif" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || authLoading}
            className="w-full rounded-[14px] bg-[#074738] py-4 font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60 hover:bg-[#1A9B7D] transition-colors shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {authLoading ? "Validando sesión..." : loading ? "Ingresando..." : "Ingresar"}
          </button>

          {/* Google OAuth: hidden in native WebView (403 disallowed_useragent).
              TODO: implement via SFSafariViewController / Chrome Custom Tabs for native */}
          {!isNativeAppContext() && (
          <>
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-[#E5E7EB]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]" style={{ fontFamily: "'Manrope', sans-serif" }}>o continuar con</span>
            <div className="h-px flex-1 bg-[#E5E7EB]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-[14px] border border-[#E5E7EB] bg-[#F0FAF9] py-4 text-[15px] font-bold text-[#1A1A1A] transition-all active:scale-[0.99] disabled:opacity-60 hover:bg-[#E0F2F1]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <span className="size-7 rounded-full bg-white flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6,20.5H42V20H24v8h11.3C33.6,32.7,29.2,36,24,36c-6.6,0-12-5.4-12-12s5.4-12,12-12 c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4C12.9,4,4,12.9,4,24s8.9,20,20,20s20-8.9,20-20C44,22.8,43.9,21.6,43.6,20.5z"/>
                <path fill="#FF3D00" d="M6.3,14.7l6.6,4.8C14.7,15.3,19,12,24,12c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4 C16.3,4,9.7,8.3,6.3,14.7z"/>
                <path fill="#4CAF50" d="M24,44c5.2,0,9.9-2,13.4-5.2l-6.2-5.2C29.2,35.1,26.7,36,24,36c-5.2,0-9.6-3.3-11.3-8l-6.5,5 C9.5,39.5,16.2,44,24,44z"/>
                <path fill="#1976D2" d="M43.6,20.5H42V20H24v8h11.3c-0.8,2.3-2.2,4.2-4.1,5.6l0,0l6.2,5.2C37,38.5,44,33,44,24 C44,22.8,43.9,21.6,43.6,20.5z"/>
              </svg>
            </span>
            {loadingGoogle ? "Conectando con Google..." : "Google"}
          </button>
          </>
          )}

          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              if (inviteCode) params.set("invite", inviteCode);
              if (refCode) params.set("ref", refCode);
              const qs = params.toString();
              navigate(`/register-user${qs ? `?${qs}` : ""}`);
            }}
            className="w-full rounded-[14px] border border-[#dfe6e2] bg-white py-4 font-bold uppercase tracking-[0.16em] text-[#074738] transition-all hover:bg-[#f4f3f9]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            Crear cuenta
          </button>
        </form>
      </AuthPageShell>

      {showReset && (
        <>
          <div
            onClick={() => setShowReset(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-x-4 bottom-8 z-50 bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6 max-w-md mx-auto">
            <h2 className="text-xl font-black text-slate-900 mb-1">Recuperar acceso</h2>
            <p className="text-sm text-slate-500 mb-5">
              Ingresá tu correo y te enviamos un link para crear una nueva contraseña.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="email"
                placeholder="Tu correo electrónico"
                aria-label="Correo electrónico para recuperar contraseña"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#074738]"
                required
              />

              {resetError && (
                <p className="text-sm text-red-600 font-semibold text-center">{resetError}</p>
              )}

              {resetSuccess ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium text-center">
                  {resetSuccess}
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {resetLoading
                    ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                    : "Enviar link"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                {resetSuccess ? "Cerrar" : "Cancelar"}
              </button>

            </form>
          </div>
        </>
      )}
    </>
  );
}
