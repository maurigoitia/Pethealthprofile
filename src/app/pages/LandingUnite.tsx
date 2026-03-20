import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { SEO } from "../components/SEO";
import { detectInAppBrowser, openInSystemBrowser, getInAppBrowserLabel } from "../utils/inAppBrowser";
import { ArrowRight, Briefcase, ExternalLink, Mail } from "lucide-react";

export default function LandingUnite() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState("");
  const [showInAppWarning, setShowInAppWarning] = useState(false);

  const inAppInfo = detectInAppBrowser();

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/home", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleGoogleSignIn = async () => {
    // Si estamos en un in-app browser, interceptar antes de que Google lo bloquee
    if (inAppInfo.isInApp) {
      setShowInAppWarning(true);
      return;
    }

    if (loadingGoogle) return;
    setError("");
    setLoadingGoogle(true);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const isStandalone =
        (window.navigator as any)?.standalone === true ||
        window.matchMedia?.("(display-mode: standalone)")?.matches === true;

      if (isStandalone) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
      navigate("/home");
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch {
          setError("No se pudo conectar con Google. Intentá de nuevo.");
          return;
        }
      }
      setError("No se pudo conectar con Google. Intentá de nuevo.");
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleOpenInBrowser = () => {
    openInSystemBrowser("https://pessy.app/empezar");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between relative overflow-hidden"
      style={{ backgroundImage: "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)" }}
    >
      <SEO
        title="Pessy — Porque quererlo ya es suficiente trabajo"
        description="Pessy lo maneja. Vos lo disfrutás. La app con IA que tiene todo lo de tu mascota en un solo lugar."
        canonical="https://pessy.app/empezar"
      />

      {/* Background decorativo */}
      <div className="absolute left-0 top-0 h-full w-full flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="relative rotate-6 opacity-15" style={{ width: "500px", height: "900px", filter: "brightness(0) invert(1)" }}>
          <img src="/pessy-logo.svg" alt="" className="w-full h-full object-contain" />
        </div>
      </div>
      <div className="absolute left-[120px] top-[-128px] size-[400px] bg-white/10 rounded-full blur-[64px] pointer-events-none" />
      <div className="absolute left-[-80px] bottom-[100px] size-[300px] bg-white/5 rounded-full blur-[64px] pointer-events-none" />

      {/* Contenido principal */}
      <div className="flex flex-col items-center relative z-10 w-full max-w-md px-6 py-6 flex-1 justify-center"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)" }}
      >

        {/* Logo + Tagline */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-6"
        >
          <img
            src="/pessy-logo.svg"
            alt="Logo Pessy"
            className="w-16 h-16 mb-3 object-contain drop-shadow-[0_14px_32px_rgba(0,0,0,0.25)]"
          />
          <h1
            className="text-[48px] font-black text-white tracking-[-2.4px] leading-[48px] mb-2"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Pessy
          </h1>
          <p
            className="text-white/85 text-[16px] font-medium text-center tracking-[0.3px] leading-[24px] max-w-[280px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Porque quererlo ya es suficiente trabajo.
          </p>
        </motion.div>

        {/* Sección Dueños — CTA principal */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full space-y-3 mb-6"
        >
          {/* Aviso de in-app browser */}
          {showInAppWarning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-[24px] bg-white/95 backdrop-blur-sm p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <ExternalLink className="size-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-slate-900">
                    Abrí en tu navegador
                  </p>
                  <p className="text-[13px] text-slate-600 leading-[20px] mt-1">
                    El navegador de {getInAppBrowserLabel(inAppInfo.source)} no permite conectar con Google de forma segura.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 mb-3">
                <p className="text-[13px] text-slate-700 leading-[20px]">
                  <strong>Tocá los 3 puntos</strong> (⋮ o ⋯) arriba a la derecha y elegí{" "}
                  <strong>"Abrir en navegador"</strong> o <strong>"Abrir en Chrome/Safari"</strong>.
                </p>
              </div>

              <button
                onClick={handleOpenInBrowser}
                className="w-full py-3.5 rounded-[20px] bg-[#074738] text-white font-bold text-[14px] flex items-center justify-center gap-2"
              >
                <ExternalLink className="size-4" />
                Intentar abrir en navegador
              </button>

              <button
                onClick={() => setShowInAppWarning(false)}
                className="w-full py-2.5 mt-2 text-[13px] text-slate-500 font-medium"
              >
                Cancelar
              </button>
            </motion.div>
          )}

          {!showInAppWarning && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={loadingGoogle || authLoading}
                className="w-full py-4 rounded-[40px] bg-white text-[#074738] font-bold text-[16px] flex items-center justify-center gap-3 shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)] active:scale-[0.98] transition-all disabled:opacity-60"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <span className="size-7 rounded-full bg-slate-50 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6,20.5H42V20H24v8h11.3C33.6,32.7,29.2,36,24,36c-6.6,0-12-5.4-12-12s5.4-12,12-12 c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4C12.9,4,4,12.9,4,24s8.9,20,20,20s20-8.9,20-20C44,22.8,43.9,21.6,43.6,20.5z"/>
                    <path fill="#FF3D00" d="M6.3,14.7l6.6,4.8C14.7,15.3,19,12,24,12c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4 C16.3,4,9.7,8.3,6.3,14.7z"/>
                    <path fill="#4CAF50" d="M24,44c5.2,0,9.9-2,13.4-5.2l-6.2-5.2C29.2,35.1,26.7,36,24,36c-5.2,0-9.6-3.3-11.3-8l-6.5,5 C9.5,39.5,16.2,44,24,44z"/>
                    <path fill="#1976D2" d="M43.6,20.5H42V20H24v8h11.3c-0.8,2.3-2.2,4.2-4.1,5.6l0,0l6.2,5.2C37,38.5,44,33,44,24 C44,22.8,43.9,21.6,43.6,20.5z"/>
                  </svg>
                </span>
                {loadingGoogle ? "Conectando..." : "Empezar ahora con Google"}
              </button>

              <button
                onClick={() => navigate("/login")}
                className="w-full py-3.5 rounded-[40px] bg-white/12 border border-white/35 text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
              >
                <Mail className="size-4" />
                Entrar con email
              </button>

              {error && (
                <p className="text-sm font-semibold text-center text-red-100 bg-red-500/20 rounded-xl px-4 py-2">
                  {error}
                </p>
              )}

              {/* Indicador sutil de in-app browser */}
              {inAppInfo.isInApp && (
                <p className="text-[12px] text-white/60 text-center leading-[18px]">
                  Estás en {getInAppBrowserLabel(inAppInfo.source)}. Al tocar Google,
                  te vamos a ayudar a abrir en tu navegador.
                </p>
              )}
            </>
          )}
        </motion.div>

        {/* Separador */}
        <div className="w-full flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">profesionales</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* Sección Partners — B2B */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full"
        >
          <a
            href="mailto:it@pessy.app?subject=Trabajo%20en%20pet%20care%20-%20Quiero%20conocer%20Pessy"
            className="w-full py-4 px-6 rounded-[24px] bg-white/8 border border-white/20 flex items-center gap-4 hover:bg-white/14 transition-all group"
          >
            <div className="size-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <Briefcase className="size-5 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[15px]">
                ¿Trabajas en pet care?
              </p>
              <p className="text-white/60 text-[13px] leading-[18px]">
                Escribinos a it@pessy.app
              </p>
            </div>
            <ArrowRight className="size-5 text-white/40 group-hover:text-white/70 transition-colors flex-shrink-0" />
          </a>
        </motion.div>
      </div>

      {/* Footer legal */}
      <div className="relative z-10 pb-8 px-6 text-center">
        <p className="text-[11px] text-white/40 leading-[16px]">
          Al registrarte aceptás los{" "}
          <a href="/terminos" className="underline hover:text-white/60">Términos</a>{" "}
          y{" "}
          <a href="/privacidad" className="underline hover:text-white/60">Política de Privacidad</a>
        </p>
      </div>
    </div>
  );
}
