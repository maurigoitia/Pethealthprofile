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

      <AuthPageShell
        eyebrow="Acceso"
        title="Pessy — Porque quererlo ya es suficiente trabajo"
        description="Porque quererlo ya es suficiente trabajo."
        highlights={["Identidad digital", "Recordatorios", "Co-tutores"]}
      >
        {/* Desktop-only: "Bienvenido de nuevo" heading (mobile lo muestra el shell dark) */}
        <div className="mb-8 hidden lg:block">
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

        <form onSubmit={handleLogin} className="w-full space-y-4">
          {inviteCode && (
            <div className="rounded-[16px] border border-[#1A9B7D]/30 bg-[#E0F2F1] px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#074738]" style={{ fontFamily: "'Manrope', sans-serif" }}>Invitación de co-tutor</p>
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
            className="w-full rounded-[12px] border border-white/15 bg-white/10 px-5 py-4 text-white placeholder:text-white/50 outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 lg:border-[#E5E7EB] lg:bg-white lg:text-[#1A1A1A] lg:placeholder:text-[#9CA3AF] lg:focus:ring-[#1A9B7D]/30 lg:focus:border-[#1A9B7D]"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-[14px] border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition-colors lg:border-[#E5E7EB] lg:bg-[#F0FAF9] lg:text-[#074738] lg:hover:bg-[#E0F2F1]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm font-semibold text-white/60 hover:text-white transition-colors lg:text-[#6B7280] lg:hover:text-[#074738]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

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
            disabled={loading || authLoading}
            className="pessy-cta-glow w-full rounded-[14px] bg-white py-4 font-bold uppercase tracking-[0.16em] text-[#074738] disabled:opacity-60 hover:bg-[#E0F2F1] transition-colors active:scale-[0.97] lg:bg-[#074738] lg:text-white lg:hover:bg-[#1A9B7D]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {authLoading ? "Validando sesión..." : loading ? "Ingresando..." : "Ingresar"}
          </button>

          {/* Google OAuth: hidden in native WebView (403 disallowed_useragent) */}
          {!isNativeAppContext() && (
            <>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-white/15 lg:bg-[#E5E7EB]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50 lg:text-[#9CA3AF]" style={{ fontFamily: "'Manrope', sans-serif" }}>o continuar con</span>
                <div className="h-px flex-1 bg-white/15 lg:bg-[#E5E7EB]" />
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loadingGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-[14px] border border-white/15 bg-white/10 py-4 text-[15px] font-bold text-white transition-all active:scale-[0.99] disabled:opacity-60 hover:bg-white/20 lg:border-[#E5E7EB] lg:bg-[#F0FAF9] lg:text-[#1A1A1A] lg:hover:bg-[#E0F2F1]"
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
            className="w-full rounded-[14px] border border-white/15 bg-transparent py-4 font-bold uppercase tracking-[0.16em] text-white transition-all hover:bg-white/10 lg:border-[#dfe6e2] lg:bg-white lg:text-[#074738] lg:hover:bg-[#f4f3f9]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            Crear cuenta
          </button>
        </form>
      </AuthPageShell>
    </>
  );
}
