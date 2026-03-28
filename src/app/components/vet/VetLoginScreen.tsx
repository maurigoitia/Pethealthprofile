import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
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
      // Verify user is a vet before redirecting
      const checkRole = async () => {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists() && snap.data().role === "vet") {
            navigate("/vet/dashboard", { replace: true });
          } else {
            // Not a vet — show error
            setError("Esta cuenta no está registrada como profesional veterinario.");
          }
        } catch {
          navigate("/vet/dashboard", { replace: true });
        }
      };
      checkRole();
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || authLoading) return;
    setError("");
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      // Role check happens in useEffect
    } catch (err: any) {
      if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        setError("Correo o contraseña incorrectos.");
      } else if (err?.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Esperá unos minutos.");
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
    setLoadingGoogle(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        try { await signInWithRedirect(auth, provider); return; } catch {}
      }
      setError("No se pudo iniciar con Google.");
    } finally {
      setLoadingGoogle(false);
    }
  };
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(""); setResetSuccess(""); setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetSuccess("¡Listo! Revisá tu correo para restablecer la contraseña.");
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") setResetError("No encontramos una cuenta con ese correo.");
      else setResetError("No se pudo enviar el correo. Intentá nuevamente.");
    } finally { setResetLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-8 py-12 relative overflow-hidden"
      style={{ backgroundImage: "linear-gradient(135deg, #074738 0%, #0a6b54 50%, #1A9B7D 100%)" }}>
      {/* Decorative background */}
      <div className="absolute left-0 top-0 h-full w-full overflow-hidden pointer-events-none">
        <div className="absolute right-[-60px] top-[-60px] size-[300px] bg-white/5 rounded-full blur-[64px]" />
        <div className="absolute left-[-80px] bottom-[100px] size-[250px] bg-white/5 rounded-full blur-[64px]" />
      </div>

      <div className="flex flex-col items-center relative z-10 w-full max-w-md flex-1 justify-center">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-white/90" style={{ fontSize: "36px" }}>stethoscope</span>
          </div>
          <h1 className="text-[56px] font-black text-white tracking-[-2.8px] leading-[56px] mb-1"
            style={{ fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Pessy</h1>
          <p className="text-[#1A9B7D] text-[20px] font-black tracking-[2px] uppercase">VET</p>          <p className="text-white/70 text-[14px] font-medium text-center mt-2"
            style={{ fontFamily: "'Manrope',sans-serif" }}>
            Plataforma profesional veterinaria
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="w-full space-y-4">
          <input type="email" placeholder="Correo electrónico profesional" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-4 rounded-[16px] bg-white/95 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-[#1A9B7D] outline-none"
            required />

          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 pr-28 rounded-[16px] bg-white/95 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-[#1A9B7D] outline-none"
              required />
            <button type="button" onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#074738] bg-white/80 border border-white rounded-full px-3 py-1">
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => { setShowReset(true); setResetEmail(email); }}
              className="text-white/70 text-sm font-semibold hover:text-white transition-colors">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error && <p className="text-red-100 text-sm font-semibold text-center bg-red-500/20 rounded-xl px-4 py-2">{error}</p>}
          <button type="submit" disabled={loading || authLoading}
            className="w-full py-5 rounded-[40px] bg-white text-[#074738] font-bold text-[16px] shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)] disabled:opacity-60 tracking-[1.2px] uppercase"
            style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            {authLoading ? "Validando..." : loading ? "Ingresando..." : "Ingresar"}
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-white/30" />
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-[0.12em]">o continuar con</span>
            <div className="flex-1 h-px bg-white/30" />
          </div>

          <button type="button" onClick={handleGoogleSignIn} disabled={loadingGoogle}
            className="w-full py-4 rounded-[40px] bg-white/12 border border-white/35 text-white font-bold text-[15px] flex items-center justify-center gap-3 hover:bg-white/20 transition-all disabled:opacity-60">
            <span className="size-7 rounded-full bg-white flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6,20.5H42V20H24v8h11.3C33.6,32.7,29.2,36,24,36c-6.6,0-12-5.4-12-12s5.4-12,12-12c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4C12.9,4,4,12.9,4,24s8.9,20,20,20s20-8.9,20-20C44,22.8,43.9,21.6,43.6,20.5z"/><path fill="#FF3D00" d="M6.3,14.7l6.6,4.8C14.7,15.3,19,12,24,12c3,0,5.7,1.1,7.8,3l5.7-5.7C34,6.1,29.3,4,24,4C16.3,4,9.7,8.3,6.3,14.7z"/><path fill="#4CAF50" d="M24,44c5.2,0,9.9-2,13.4-5.2l-6.2-5.2C29.2,35.1,26.7,36,24,36c-5.2,0-9.6-3.3-11.3-8l-6.5,5C9.5,39.5,16.2,44,24,44z"/><path fill="#1976D2" d="M43.6,20.5H42V20H24v8h11.3c-0.8,2.3-2.2,4.2-4.1,5.6l0,0l6.2,5.2C37,38.5,44,33,44,24C44,22.8,43.9,21.6,43.6,20.5z"/></svg>
            </span>
            {loadingGoogle ? "Conectando..." : "Google"}
          </button>

          <button type="button" onClick={() => navigate("/vet/register")}
            className="w-full py-5 rounded-[40px] bg-white/20 backdrop-blur-sm text-white font-bold text-[16px] border-[1.5px] border-white/30 hover:bg-white/30 transition-all tracking-[1.2px] uppercase"
            style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            Registrarme como veterinario
          </button>
        </form>
        {/* Link to tutor app */}
        <p className="text-white/50 text-xs text-center mt-6">
          ¿Sos tutor? <button onClick={() => navigate("/login")} className="text-white/80 underline font-semibold">Ingresá a Pessy</button>
        </p>
      </div>

      {/* Reset password modal */}
      {showReset && (
        <>
          <div onClick={() => setShowReset(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <div className="fixed inset-x-4 bottom-8 z-50 bg-white rounded-3xl shadow-2xl p-6 max-w-md mx-auto">
            <h2 className="text-xl font-black text-slate-900 mb-1">Recuperar contraseña</h2>
            <p className="text-sm text-slate-500 mb-5">Ingresá tu correo y te enviamos un link.</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input type="email" placeholder="Tu correo electrónico" value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#074738]" required />
              {resetError && <p className="text-sm text-red-600 font-semibold text-center">{resetError}</p>}
              {resetSuccess ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium text-center">{resetSuccess}</div>
              ) : (
                <button type="submit" disabled={resetLoading}
                  className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold disabled:opacity-60">
                  {resetLoading ? "Enviando..." : "Enviar link"}
                </button>
              )}
              <button type="button" onClick={() => setShowReset(false)}
                className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-bold">
                {resetSuccess ? "Cerrar" : "Cancelar"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}