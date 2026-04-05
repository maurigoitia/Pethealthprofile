import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { createPasswordResetActionCodeSettings } from "../utils/authActionLinks";

export function LoginScreen() {
  const navigate = useNavigate();
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
        // SECURITY: Generic error message to prevent user enumeration.
        // Never reveal whether an email exists or which auth method it uses.
        setError(
          "Correo o contraseña incorrectos. Si te registraste con Google, probá con el botón Google."
        );
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
        // SECURITY: Don't reveal if email exists. Show same success message.
        setResetSuccess("Si hay una cuenta con ese correo, vas a recibir un enlace para restablecer la contraseña.");
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
    setLoadingGoogle(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate("/home");
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch {}
      }
      setError("No se pudo iniciar con Google. Revisá que el proveedor esté habilitado.");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-8 py-12 relative overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(rgb(43, 124, 238) 0%, rgb(61, 139, 255) 50%, rgb(93, 163, 255) 100%)",
      }}
    >
      {/* Fondo decorativo */}
      <div className="absolute left-0 top-0 h-[853px] w-full flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="relative rotate-6 opacity-25" style={{ width: "670px", height: "1228px", filter: "brightness(0) invert(1)" }}>
          <img src="/pessy-logo.png" alt="" className="w-full h-full object-contain" />
        </div>
      </div>
      <div className="absolute left-[120px] top-[-128px] size-[400px] bg-white/10 rounded-full blur-[64px] pointer-events-none" />
      <div className="absolute left-[-80px] top-[473px] size-[300px] bg-white/5 rounded-full blur-[64px] pointer-events-none" />

      <div className="flex flex-col items-center relative z-10 w-full max-w-md flex-1 justify-center">
        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-10"
        >
          <h1 className="text-[72px] font-black text-white tracking-[-3.6px] leading-[72px] mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Pessy
          </h1>
          <p className="text-white/85 text-[16px] font-medium text-center tracking-[0.4px] leading-[24px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            tu mascota sus cosas todo en orden
          </p>
        </motion.div>

        {/* Formulario login */}
        <motion.form
          onSubmit={handleLogin}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full space-y-4"
        >
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-4 rounded-[24px] bg-white/92 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-white/70 outline-none"
            required
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 pr-28 rounded-[24px] bg-white/92 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-white/70 outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#2b7cee] bg-white/80 border border-white rounded-full px-3 py-1"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {/* Link olvidé contraseña */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setShowReset(true); setResetEmail(email); setResetError(""); setResetSuccess(""); }}
              className="text-white/80 text-sm font-semibold hover:text-white transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error && <p className="text-red-100 text-sm font-semibold text-center bg-red-500/20 rounded-xl px-4 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading || authLoading}
            className="w-full py-5 rounded-[40px] bg-white text-[#2b7cee] font-bold text-[16px] shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)] disabled:opacity-60 tracking-[1.2px] uppercase"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {authLoading ? "Validando sesión..." : loading ? "Ingresando..." : "Ingresar"}
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-white/30" />
            <span className="text-[11px] font-semibold text-white/75 uppercase tracking-[0.12em]">o continuar con</span>
            <div className="flex-1 h-px bg-white/30" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle}
            className="w-full py-4 rounded-[40px] bg-white/12 border border-white/35 text-white font-bold text-[15px] flex items-center justify-center gap-3 hover:bg-white/20 active:scale-[0.99] transition-all disabled:opacity-60"
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
            onClick={() => navigate("/register-user")}
            className="w-full py-5 rounded-[40px] bg-white/20 backdrop-blur-sm text-white font-bold text-[16px] border-[1.5px] border-white/30 hover:bg-white/30 transition-all tracking-[1.2px] uppercase"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Registrarse gratis
          </button>
        </motion.form>
      </div>

      {/* Modal recuperar contraseña */}
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
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2b7cee]"
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
                    className="w-full py-3 rounded-xl bg-[#2b7cee] text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
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
    </div>
  );
}
