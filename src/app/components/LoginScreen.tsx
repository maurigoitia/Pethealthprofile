import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { createPasswordResetActionCodeSettings } from "../utils/authActionLinks";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../utils/acquisitionTracking";
import { SEO } from "./SEO";
import { AuthPageShell } from "./AuthPageShell";

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
    const domain = window.location.hostname;
    const suffix = code ? ` [${code}]` : "";
    switch (code) {
      case "auth/unauthorized-domain":
        return `Google no está autorizado para este dominio (${domain}). Falta agregarlo en Firebase Auth > Settings > Authorized domains.${suffix}`;
      case "auth/operation-not-allowed":
      case "auth/configuration-not-found":
        return `El proveedor Google no está habilitado en Firebase Authentication.${suffix}`;
      case "auth/network-request-failed":
        return `No hay conexión con Google/Firebase. Revisá internet e intentá nuevamente.${suffix}`;
      case "auth/popup-blocked":
        return `El navegador bloqueó la ventana de Google. Permití popups o reintentá.${suffix}`;
      case "auth/popup-closed-by-user":
        return `Cerraste la ventana de Google antes de completar el acceso.${suffix}`;
      case "auth/cancelled-popup-request":
        return `Se canceló el intento anterior de popup. Reintentá una sola vez.${suffix}`;
      case "auth/invalid-api-key":
      case "auth/app-not-authorized":
        return `Configuración Firebase inválida para este entorno (API key / dominio).${suffix}`;
      default:
        return `No se pudo iniciar con Google. Revisá configuración de Auth en Firebase.${suffix}`;
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
        setError("Correo o contraseña incorrectos. Si te registraste con Google, ingresá con Google o usá recuperación de contraseña.");
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
    try {
      await sendPasswordResetEmail(
        auth,
        resetEmail.trim().toLowerCase(),
        createPasswordResetActionCodeSettings()
      );
      setResetSuccess("¡Listo! Revisá tu correo para restablecer la contraseña.");
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        setResetError("No encontramos una cuenta con ese correo.");
      } else if (err?.code === "auth/invalid-email") {
        setResetError("El correo ingresado no es válido.");
      } else if (err?.code === "auth/operation-not-allowed") {
        setResetError("En Firebase Auth falta habilitar Email/Password para recuperar contraseña.");
      } else if (err?.code === "auth/unauthorized-continue-uri" || err?.code === "auth/invalid-continue-uri") {
        setResetError("El dominio actual no está autorizado en Firebase Authentication.");
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
      // useEffect handles navigate to /home when user is set
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        setError("La ventana de Google fue bloqueada o cerrada. Por favor, permití las ventanas emergentes (pop-ups) e intentá de nuevo.");
      } else {
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
            className="text-3xl font-extrabold tracking-tight text-[#002f24]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            Bienvenido de nuevo
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#5e716b]">
            Entrá para seguir desde donde quedaste.
          </p>
        </div>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 w-full"
        >
          <div className="w-full rounded-[1.75rem] border border-[#dfe6e2] bg-[#f4f3f9] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#074738]">Tu mascota, sus cosas</p>
            <p className="mt-2 text-sm font-medium leading-6 text-[#36584e]">
              Porque quererlo ya es suficiente trabajo.
            </p>
          </div>
        </motion.div>

        <motion.form
          onSubmit={handleLogin}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full space-y-4"
        >
          {inviteCode && (
            <div className="rounded-[1.5rem] border border-[#b5efd9] bg-[#eef8f3] px-5 py-4 text-slate-900">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#074738]">Invitacion de co-tutor</p>
              <p className="text-sm font-medium leading-5 mt-1">
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
            className="w-full rounded-[1.5rem] border border-[#dfe6e2] bg-white px-5 py-4 text-slate-900 outline-none focus:ring-2 focus:ring-[#074738]/20"
            required
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              aria-label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[1.5rem] border border-[#dfe6e2] bg-white px-5 py-4 pr-28 text-slate-900 outline-none focus:ring-2 focus:ring-[#074738]/20"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[#dfe6e2] bg-[#f4f3f9] px-3 py-1 text-xs font-bold text-[#074738]"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setShowReset(true); setResetEmail(email); setResetError(""); setResetSuccess(""); }}
              className="text-sm font-semibold text-[#5e716b] transition-colors hover:text-[#074738]"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading || authLoading}
            className="w-full rounded-full bg-[#074738] py-4 font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            {authLoading ? "Validando sesión..." : loading ? "Ingresando..." : "Ingresar"}
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-[#dfe6e2]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">o continuar con</span>
            <div className="h-px flex-1 bg-[#dfe6e2]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-[#dfe6e2] bg-[#f4f3f9] py-4 text-[15px] font-bold text-slate-900 transition-all active:scale-[0.99] disabled:opacity-60 hover:bg-[#edf2f1]"
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

          <button
            type="button"
            disabled
            className="w-full rounded-full border border-[#dfe6e2] bg-white py-4 font-bold uppercase tracking-[0.16em] text-[#9ca8a2] cursor-not-allowed"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            Solo por invitación
          </button>

          <a
            href="/solicitar-acceso"
            className="block text-center text-sm font-semibold text-[#1A9B7D] hover:underline mt-2"
          >
            ¿Querés acceso? Solicitalo acá
          </a>
        </motion.form>
      </AuthPageShell>

      <AnimatePresence>
        {showReset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReset(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-4 bottom-8 z-50 bg-white rounded-3xl shadow-2xl p-6 max-w-md mx-auto"
            >
              <h2 className="text-xl font-black text-slate-900 mb-1">Recuperar contraseña</h2>
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
