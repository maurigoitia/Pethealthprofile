import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../data/countries";
import { startGmailConnectFlow } from "../services/gmailSyncService";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../utils/coTutorInvite";

export function RegisterUserScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGmailStep, setShowGmailStep] = useState(false);
  const [gmailStepLoading, setGmailStepLoading] = useState(false);
  const inviteCode = useMemo(
    () => normalizeCoTutorInviteCode(new URLSearchParams(location.search).get("invite")),
    [location.search]
  );

  useEffect(() => {
    if (!inviteCode) return;
    rememberPendingCoTutorInvite(inviteCode);
  }, [inviteCode]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      const inviteEnabled = true;

      await updateProfile(user, { displayName: name.trim() });
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, "users", user.uid), {
        fullName: name.trim(),
        name: name.trim(),
        email: cleanEmail,
        country: country || null,
        createdAt: nowIso,
        gmailSync: {
          connected: false,
          accountEmail: null,
          grantedScopes: [],
          inviteEnabled,
          inviteStatus: inviteEnabled ? "open_access" : "not_invited",
          consentRequestedAt: nowIso,
          lastInAppPromptAt: nowIso,
          updatedAt: nowIso,
        },
        gmailSyncInvitation: {
          enabled: inviteEnabled,
          status: inviteEnabled ? "open_access" : "not_invited",
          reason: null,
          updatedAt: nowIso,
        },
        gmailSyncReminder: {
          status: "pending_permission",
          dayNumber: 0,
          sentCount: 0,
          consentRequestedAt: nowIso,
          lastPushSentAt: null,
          updatedAt: nowIso,
          lastError: null,
        },
      });

      if (inviteCode) {
        navigate("/home", { replace: true });
      } else if (inviteEnabled) {
        setShowGmailStep(true);
      } else {
        navigate("/register-pet");
      }
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        setError("Ese correo ya está registrado.");
      } else if (err?.code === "auth/invalid-email") {
        setError("Correo electrónico inválido.");
      } else if (err?.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else if (err?.code === "auth/network-request-failed") {
        setError("Sin conexión. Revisá internet e intentá nuevamente.");
      } else {
        setError("No se pudo crear la cuenta. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmailNow = async () => {
    if (gmailStepLoading) return;
    setGmailStepLoading(true);
    try {
      await startGmailConnectFlow({ returnPath: "/register-pet" });
    } catch (error) {
      console.error("No se pudo iniciar OAuth Gmail en registro:", error);
      alert("No se pudo iniciar la conexión con Gmail. Podés continuar y conectarlo después.");
      setGmailStepLoading(false);
    }
  };

  const handleContinueWithoutGmail = () => {
    navigate("/register-pet");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundImage: "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-10 pb-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#074738]">Pessy</h1>
          <p className="text-slate-500 text-sm mt-2">Que su historia no se pierda.</p>
        </div>

        <form onSubmit={handleCreateAccount} className="space-y-4">
          {inviteCode && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Invitación de co-tutor</p>
              <p className="text-sm text-emerald-900 leading-5 mt-1">
                Esta cuenta se va a vincular con una mascota compartida apenas termines el registro.
              </p>
            </div>
          )}
          <input
            type="text"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
            required
          />

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
            required
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
            required
          />

          {/* País */}
          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none appearance-none bg-white text-slate-700 cursor-pointer"
            >
              <option value="">🌍 ¿De dónde sos?</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              ▾
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-[#074738] text-white font-bold disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          <button
            type="button"
            onClick={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
            className="w-full py-4 rounded-2xl border-2 border-[#074738] text-[#074738] font-bold hover:bg-[#074738]/5 transition-all"
          >
            Ya tengo cuenta
          </button>
        </form>
      </div>

      {showGmailStep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="size-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-emerald-600 text-3xl">mail</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 text-center mb-2">
              Activá sincronización de correo
            </h2>
            <p className="text-sm text-slate-600 text-center leading-relaxed mb-5">
              Pessy puede leer correos veterinarios para completar historial, tratamientos y turnos.
              Vas a autorizarlo en Google como <span className="font-bold">pessy.app</span>.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => void handleConnectGmailNow()}
                disabled={gmailStepLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {gmailStepLoading ? "Abriendo Google..." : "Dar permiso ahora"}
              </button>
              <button
                onClick={handleContinueWithoutGmail}
                className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
              >
                Continuar sin conectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
