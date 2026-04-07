import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { createPasswordResetActionCodeSettings } from "../../utils/authActionLinks";
import { doc, getDoc } from "firebase/firestore";

export function VetLoginScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    if (user && !authLoading) {
      const checkRole = async () => {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists() && snap.data().role === "vet") {
            navigate("/vet/dashboard", { replace: true });
          } else {
            setError("Esta cuenta no está registrada como profesional veterinario.");
          }
        } catch { navigate("/vet/dashboard", { replace: true }); }
      };
      checkRole();
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || authLoading) return;
    setError(""); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err: any) {
      if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") setError("Correo o contraseña incorrectos.");
      else if (err?.code === "auth/too-many-requests") setError("Demasiados intentos. Esperá unos minutos.");
      else setError("No se pudo iniciar sesión.");
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    if (loadingGoogle) return;
    setError(""); setLoadingGoogle(true);
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); }
    catch (err: any) {
      if (err?.code === "auth/popup-blocked") { try { await signInWithRedirect(auth, provider); return; } catch {} }
      setError("No se pudo iniciar con Google.");
    } finally { setLoadingGoogle(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);
    // Mismo mensaje genérico para éxito y user-not-found — no revelar existencia de cuenta
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
        setResetSuccess(genericSuccess);
      } else if (err?.code === "auth/invalid-email") {
        setResetError("El correo ingresado no es válido.");
      } else if (err?.code === "auth/operation-not-allowed") {
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #074738 0%, #0a6b54 50%, #1A9B7D 100%)" }}>
      <div className="absolute right-[-60px] top-[-60px] size-[300px] bg-white/5 rounded-full blur-[64px] pointer-events-none" />
      <div className="absolute left-[-80px] bottom-[100px] size-[250px] bg-white/5 rounded-full blur-[64px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-white" aria-hidden="true" style={{ fontSize: "32px" }}>stethoscope</span>
          </div>
          <h1 className="text-[48px] font-black text-white tracking-[-2.4px] leading-none" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Pessy</h1>
          <p className="text-[#1A9B7D] text-lg font-black tracking-[3px] uppercase mt-1">VET</p>
          <p className="text-white/60 text-sm mt-2" style={{ fontFamily: "'Manrope',sans-serif" }}>Plataforma profesional veterinaria</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input type="email" placeholder="Correo electrónico profesional" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-4 rounded-[12px] bg-white/95 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#1A9B7D] outline-none text-sm" required />
          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 pr-24 rounded-[12px] bg-white/95 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#1A9B7D] outline-none text-sm" required />
            <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#074738] bg-white/80 rounded-full px-3 py-1">{showPassword ? "Ocultar" : "Mostrar"}</button>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => { setShowReset(true); setResetEmail(email); setResetError(""); setResetSuccess(""); }} className="text-white/60 text-xs font-semibold">¿Olvidaste tu contraseña?</button>
            <button type="button" onClick={() => { setShowReset(true); setResetEmail(""); setResetError(""); setResetSuccess(""); }} className="text-white/40 text-xs">¿No recordás tu correo?</button>
          </div>
          {error && <p className="text-red-100 text-sm font-semibold text-center bg-red-500/20 rounded-xl px-4 py-2">{error}</p>}
          <button type="submit" disabled={loading || authLoading} className="w-full py-4 rounded-[14px] bg-white text-[#074738] font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] disabled:opacity-60 uppercase tracking-wider" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{authLoading ? "Validando..." : loading ? "Ingresando..." : "Ingresar"}</button>
          <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/20" /><span className="text-[10px] text-white/50 uppercase tracking-wider">o</span><div className="flex-1 h-px bg-white/20" /></div>
          <button type="button" onClick={handleGoogleSignIn} disabled={loadingGoogle} className="w-full py-3.5 rounded-[14px] bg-white/10 border border-white/20 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6,20.5H42V20H24v8h11.3C33.6,32.7,29.2,36,24,36c-6.6,0-12-5.4-12-12s5.4-12,12-12c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4C12.9,4,4,12.9,4,24s8.9,20,20,20s20-8.9,20-20C44,22.8,43.9,21.6,43.6,20.5z"/><path fill="#FF3D00" d="M6.3,14.7l6.6,4.8C14.7,15.3,19,12,24,12c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4 C16.3,4,9.7,8.3,6.3,14.7z"/><path fill="#4CAF50" d="M24,44c5.2,0,9.9-2,13.4-5.2l-6.2-5.2C29.2,35.1,26.7,36,24,36c-5.2,0-9.6-3.3-11.3-8l-6.5,5 C9.5,39.5,16.2,44,24,44z"/><path fill="#1976D2" d="M43.6,20.5H42V20H24v8h11.3c-0.8,2.3-2.2,4.2-4.1,5.6l0,0l6.2,5.2C37,38.5,44,33,44,24 C44,22.8,43.9,21.6,43.6,20.5z"/></svg>
            {loadingGoogle ? "Conectando..." : "Google"}
          </button>
          <button type="button" onClick={() => navigate("/vet/register")} className="w-full py-4 rounded-[14px] bg-white/15 border border-white/25 text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Registrarme como veterinario</button>
        </form>
        <p className="text-white/40 text-[11px] text-center mt-6">¿Sos tutor? <button onClick={() => navigate("/login")} className="text-white/70 underline font-semibold">Ingresá a Pessy</button></p>
      </div>

      {showReset && (
        <>
          <div onClick={() => setShowReset(false)} role="presentation" aria-hidden="true" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <div className="fixed inset-x-4 bottom-8 z-50 bg-white rounded-[24px] shadow-2xl p-6 max-w-md mx-auto">
            <h2 className="text-lg font-black text-slate-900 mb-1">Recuperar acceso</h2>
            <p className="text-sm text-slate-500 mb-4">Ingresá el correo de tu cuenta profesional.</p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input type="email" placeholder="Tu correo profesional" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full px-4 py-3 rounded-[12px] border border-slate-200 text-sm focus:ring-2 focus:ring-[#074738] outline-none" required />
              {resetError && <p className="text-red-600 text-xs font-semibold text-center">{resetError}</p>}
              {resetSuccess
                ? <p className="text-emerald-700 text-xs font-semibold text-center bg-emerald-50 rounded-xl p-3">{resetSuccess}</p>
                : <button type="submit" disabled={resetLoading} className="w-full py-3 rounded-[12px] bg-[#074738] text-white font-bold text-sm disabled:opacity-60">{resetLoading ? "Enviando..." : "Enviar link"}</button>
              }
              <button type="button" onClick={() => setShowReset(false)} className="w-full py-2 text-slate-500 text-sm font-bold">{resetSuccess ? "Cerrar" : "Cancelar"}</button>
              {!resetSuccess && (
                <p className="text-center text-xs text-slate-400 pt-1" style={{ fontFamily: "'Manrope',sans-serif" }}>
                  ¿No recordás el correo?{" "}
                  <a href="mailto:hola@pessy.app?subject=No recuerdo mi correo (vet)" className="font-semibold text-[#074738] underline underline-offset-2">
                    Contactanos
                  </a>
                </p>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
}
