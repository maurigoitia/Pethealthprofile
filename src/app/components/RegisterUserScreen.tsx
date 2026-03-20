import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../data/countries";
import { startGmailConnectFlow } from "../services/gmailSyncService";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../utils/acquisitionTracking";
import { AuthPageShell } from "./AuthPageShell";

export function RegisterUserScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGmailStep, setShowGmailStep] = useState(false);
  const [gmailStepLoading, setGmailStepLoading] = useState(false);
  const inviteCode = useMemo(
    () => normalizeCoTutorInviteCode(searchParams.get("invite")),
    [searchParams]
  );
  const acquisitionSource = useMemo(
    () => resolveAcquisitionSource(location.search, location.pathname),
    [location.pathname, location.search]
  );
  const leadName = useMemo(() => searchParams.get("lead_name")?.trim() || "", [searchParams]);
  const leadEmail = useMemo(() => searchParams.get("lead_email")?.trim().toLowerCase() || "", [searchParams]);
  const leadPet = useMemo(() => searchParams.get("lead_pet")?.trim() || "", [searchParams]);

  useEffect(() => {
    if (!inviteCode) return;
    rememberPendingCoTutorInvite(inviteCode);
  }, [inviteCode]);

  useEffect(() => {
    if (!acquisitionSource) return;
    persistAcquisitionSource(acquisitionSource);
    void trackAcquisitionEvent("pessy_acquisition_register_view", {
      source: acquisitionSource,
      path: location.pathname,
    });
  }, [acquisitionSource, location.pathname]);

  useEffect(() => {
    if (leadName) setName((current) => current || leadName);
    if (leadEmail) setEmail((current) => current || leadEmail);
    if (!leadPet) return;
    localStorage.setItem(
      "pessy_landing_prefill",
      JSON.stringify({
        name: leadName || "",
        email: leadEmail || "",
        petName: leadPet,
      })
    );
  }, [leadEmail, leadName, leadPet]);

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

      void trackAcquisitionEvent("pessy_acquisition_register_success", {
        source: acquisitionSource,
        path: location.pathname,
        gmail_invite_enabled: inviteEnabled,
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
    <AuthPageShell
      eyebrow="Tu cuenta"
      title="Su historia comienza aqui."
      description="Crea tu cuenta y dejale a Pessy el trabajo de organizar todo lo de tu mascota."
      highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
    >
      <div className="mb-8">
        <h2
          className="text-3xl font-extrabold tracking-tight text-[#002f24]"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
        >
          Crear cuenta
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#5e716b]">
          Empeza con tus datos. Pessy hace el resto.
        </p>
      </div>

      <form onSubmit={handleCreateAccount} className="space-y-4">
          {inviteCode && (
            <div className="rounded-[1.5rem] border border-[#b5efd9] bg-[#eef8f3] px-4 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#074738]">Invitacion de co-tutor</p>
              <p className="mt-1 text-sm leading-5 text-[#002f24]">
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
            className="w-full rounded-full bg-[#074738] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          <button
            type="button"
            onClick={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
            className="w-full rounded-full border border-[#dfe6e2] py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#074738] transition-all hover:bg-[#f4f3f9]"
          >
            Ya tengo cuenta
          </button>
      </form>

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
              Pessy usa IA para leer correos de turnos y estudios, y organiza todo automaticamente.
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
    </AuthPageShell>
  );
}
