import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../../utils/acquisitionTracking";
import { toast } from "sonner";
import { SEO } from "../shared/SEO";
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

  // BUG-009 FIX: guardar el invite code sincrónicamente durante el render, no en un useEffect.
  const inviteCode = useMemo(() => {
    const code = normalizeCoTutorInviteCode(new URLSearchParams(location.search).get("invite"));
    if (code) rememberPendingCoTutorInvite(code);
    return code;
  }, [location.search]);

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

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      if (err?.code) toast.error(getGoogleAuthErrorMessage(err.code));
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
          if (!canRetryWithTrimmed) throw candidateError;
        }
      }

      if (!signedIn && lastError) throw lastError;
      navigate("/home", { replace: true });
    } catch (err: any) {
      if (
        err?.code === "auth/user-not-found" ||
        err?.code === "auth/wrong-password" ||
        err?.code === "auth/invalid-credential"
      ) {
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
      const signInPromise = signInWithPopup(auth, provider);
      setLoadingGoogle(true);
      await signInPromise;
      navigate("/home");
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        setError("La ventana de Google fue bloqueada o cerrada. Permití ventanas emergentes e intentá de nuevo.");
      } else {
        console.error("Google sign-in error:", { code: err?.code, message: err?.message, domain: window.location.hostname });
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
        description="Accede a Pessy — todo lo de tu mascota en un solo lugar."
        canonical="https://pessy.app/login"
        robots="noindex,nofollow"
      />

      {/* Stitch-style layout: hero con illustration + form below.
          Single light bg, no dark gradient. Más limpio y consistente con el resto de Pessy. */}
      <div
        className="min-h-screen bg-[#F0FAF9] flex flex-col"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#F0FAF9] overflow-hidden relative w-full">
          {/* Hero — illustration con gradiente fade al fondo */}
          <div className="h-64 relative overflow-hidden flex items-end px-5 pb-6">
            <div className="absolute inset-0 z-0">
              <img
                src="/illustrations/dark_top_surprised_cork_head.svg"
                alt=""
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#F0FAF9] via-[#F0FAF9]/40 to-transparent" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <img src="/pessy-logo.svg" alt="" className="w-9 h-9" />
                <h1
                  className="text-[32px] font-extrabold text-[#074738] tracking-tight leading-none"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Pessy
                </h1>
              </div>
              <p className="text-[15px] text-[#6B7280] max-w-[260px] leading-relaxed">
                Tu mascota, sus cosas, todo en orden.
              </p>
            </div>
          </div>

          {/* Form */}
          <main className="flex-1 px-5 pt-2 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
            <form onSubmit={handleLogin} className="space-y-4">
              {inviteCode && (
                <div className="rounded-[14px] border border-[#1A9B7D]/30 bg-[#E0F2F1] px-4 py-3">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#074738]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Invitación de co-tutor
                  </p>
                  <p className="text-sm font-medium leading-5 mt-1 text-[#6B7280]">
                    Al completar el acceso, vamos a vincular esta cuenta con la mascota compartida.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                  htmlFor="login-email"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  aria-label="Correo electrónico"
                  placeholder="hola@pessy.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                  htmlFor="login-password"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    aria-label="Contraseña"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 px-4 pr-14 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-full text-[#6B7280] hover:text-[#074738] flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-[13px] font-semibold text-[#1A9B7D] hover:underline transition-all"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {error && (
                <p
                  className="rounded-[12px] border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-center text-sm font-semibold text-[#EF4444]"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || authLoading}
                className="w-full h-14 bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] flex items-center justify-center disabled:opacity-50 active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(7,71,56,0.18)]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {authLoading ? "Validando sesión..." : loading ? "Ingresando..." : "Ingresar"}
              </button>

              {/* Google SSO: oculto en WebView nativo */}
              {!isNativeAppContext() && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-[#E5E7EB]" />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] font-semibold">o</span>
                    <div className="h-px flex-1 bg-[#E5E7EB]" />
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loadingGoogle}
                    className="w-full h-14 bg-white border border-[#E5E7EB] rounded-[14px] flex items-center justify-center gap-2 text-[14px] font-semibold text-[#1A1A1A] active:scale-[0.97] transition-transform disabled:opacity-60"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.2 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.7-.4-3.5z"/>
                    </svg>
                    {loadingGoogle ? "Conectando..." : "Continuar con Google"}
                  </button>
                </>
              )}
            </form>
          </main>

          {/* Footer — link a registro */}
          <footer className="p-6 flex flex-col items-center gap-2">
            <p className="text-[14px] text-[#6B7280]">¿Todavía no tenés cuenta?</p>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (inviteCode) params.set("invite", inviteCode);
                if (refCode) params.set("ref", refCode);
                const qs = params.toString();
                navigate(`/register-user${qs ? `?${qs}` : ""}`);
              }}
              className="px-6 py-2.5 rounded-full bg-[#1A9B7D]/10 text-[#1A9B7D] text-[14px] font-bold active:scale-[0.97] transition-transform"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Crear cuenta
            </button>
          </footer>

          {/* Decorative blurs sutiles */}
          <div className="absolute bottom-10 -right-10 w-40 h-40 bg-[#1A9B7D]/8 rounded-full blur-3xl -z-10" />
          <div className="absolute top-20 -left-10 w-40 h-40 bg-[#074738]/8 rounded-full blur-3xl -z-10" />
        </div>
      </div>
    </>
  );
}
