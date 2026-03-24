import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../data/countries";
import { startGmailConnectFlow } from "../services/gmailSyncService";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../utils/acquisitionTracking";
import { validatePlatformInviteCode, validateAccessToken, markPlatformInviteUsed } from "../utils/platformInvite";
import { AuthPageShell } from "./AuthPageShell";
import { GmailConsentScreen } from "./GmailConsentScreen";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showGmailStep, setShowGmailStep] = useState(false);
  const [gmailStepLoading, setGmailStepLoading] = useState(false);
  const [gateStatus, setGateStatus] = useState<"loading" | "allowed" | "blocked" | "invalid">("loading");
  const [gateMessage, setGateMessage] = useState("");
  const [platformInviteCreatedBy, setPlatformInviteCreatedBy] = useState<string | null>(null);
  const [accessTokenDocId, setAccessTokenDocId] = useState<string | null>(null);

  const refCode = useMemo(() => (searchParams.get("ref") || "").trim().toUpperCase(), [searchParams]);
  const accessToken = useMemo(() => (searchParams.get("access") || "").trim(), [searchParams]);

  // BUG-009 FIX: guardar sincrónicamente durante el render (ver LoginScreen)
  const inviteCode = useMemo(() => {
    const code = normalizeCoTutorInviteCode(searchParams.get("invite"));
    if (code) rememberPendingCoTutorInvite(code);
    return code;
  }, [searchParams]);
  const acquisitionSource = useMemo(
    () => resolveAcquisitionSource(location.search, location.pathname),
    [location.pathname, location.search]
  );
  const leadName = useMemo(() => searchParams.get("lead_name")?.trim() || "", [searchParams]);
  const leadEmail = useMemo(() => searchParams.get("lead_email")?.trim().toLowerCase() || "", [searchParams]);
  const leadPet = useMemo(() => searchParams.get("lead_pet")?.trim() || "", [searchParams]);

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

  useEffect(() => {
    let cancelled = false;
    async function checkGate() {
      if (refCode) {
        const result = await validatePlatformInviteCode(refCode);
        if (cancelled) return;
        if (result.valid) {
          setPlatformInviteCreatedBy(result.doc.createdBy);
          setGateStatus("allowed");
        } else {
          setGateMessage(
            result.reason === "expired" ? "Este link expiró. Pedile uno nuevo a quien te invitó." :
            result.reason === "already_used" ? "Este link ya fue usado." :
            "Este link no es válido."
          );
          setGateStatus("invalid");
        }
        return;
      }
      if (accessToken) {
        const result = await validateAccessToken(accessToken);
        if (cancelled) return;
        if (result.valid) {
          setAccessTokenDocId(result.doc.token);
          if (result.doc.email) setEmail((c) => c || result.doc.email);
          setGateStatus("allowed");
        } else {
          setGateMessage(
            result.reason === "expired" ? "Este acceso expiró. Solicitá uno nuevo." :
            "Este acceso no es válido."
          );
          setGateStatus("invalid");
        }
        return;
      }
      if (inviteCode) {
        setGateStatus("allowed");
        return;
      }
      setGateStatus("blocked");
    }
    void checkGate();
    return () => { cancelled = true; };
  }, [refCode, accessToken, inviteCode]);

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
        ...(platformInviteCreatedBy ? { invitedBy: platformInviteCreatedBy } : {}),
        accessSource: refCode ? "invite" : accessToken ? "waitlist" : inviteCode ? "cotutor" : "direct",
      });

      void trackAcquisitionEvent("pessy_acquisition_register_success", {
        source: acquisitionSource,
        path: location.pathname,
        gmail_invite_enabled: inviteEnabled,
      });

      if (refCode) {
        try { await markPlatformInviteUsed(refCode, user.uid); } catch (err) {
          console.warn("Could not mark platform invite as used:", err);
        }
      }

      // BUG-005 FIX: usuarios con invite también pasan por el step de Gmail (flujo consistente).
      // Después del step de Gmail, se redirigen a /home (donde se procesa el invite code)
      // en lugar de /register-pet (que no aplica para co-tutores).
      if (inviteEnabled) {
        setShowGmailStep(true);
      } else {
        navigate(inviteCode ? "/home" : "/register-pet", { replace: true });
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
    // BUG-005 FIX: si viene con invite code, volver a /home después de Gmail OAuth
    const afterGmailPath = inviteCode ? "/home" : "/register-pet";
    try {
      await startGmailConnectFlow({ returnPath: afterGmailPath });
    } catch (error) {
      console.error("No se pudo iniciar OAuth Gmail en registro:", error);
      alert("No se pudo iniciar la conexión con Gmail. Podés continuar y conectarlo después.");
      setGmailStepLoading(false);
    }
  };

  const handleContinueWithoutGmail = () => {
    // BUG-005 FIX: co-tutores van a /home (donde se procesa el invite), otros a /register-pet
    navigate(inviteCode ? "/home" : "/register-pet", { replace: true });
  };

  if (gateStatus === "loading") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aqui."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#074738] border-t-transparent" />
          <p className="text-sm text-[#5e716b]">Verificando acceso...</p>
        </div>
      </AuthPageShell>
    );
  }

  if (gateStatus === "blocked") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aqui."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-[#e8d5b5] bg-[#fdf6ec] px-6 py-6 text-center">
            <p className="text-base font-bold text-[#002f24]">Pessy es solo por invitación</p>
            <p className="mt-2 text-sm leading-5 text-[#5e716b]">
              Por ahora el acceso es limitado. Podés solicitar tu lugar en la lista de espera.
            </p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-full bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-full border border-[#dfe6e2] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#074738]"
          >
            Ya tengo cuenta
          </a>
        </div>
      </AuthPageShell>
    );
  }

  if (gateStatus === "invalid") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aqui."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-[#e8d5b5] bg-[#fdf6ec] px-6 py-6 text-center">
            <p className="text-base font-bold text-[#002f24]">Link inválido</p>
            <p className="mt-2 text-sm leading-5 text-[#5e716b]">{gateMessage}</p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-full bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-full border border-[#dfe6e2] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#074738]"
          >
            Ya tengo cuenta
          </a>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Tu cuenta"
      title="Su historia comienza aqui."
      description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
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
          Empeza con tus datos. Pessy hace el resto — en serio.
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

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 pr-28 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-[#074738]"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

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
        <GmailConsentScreen
          onAccept={() => void handleConnectGmailNow()}
          onDecline={handleContinueWithoutGmail}
          loading={gmailStepLoading}
        />
      )}
    </AuthPageShell>
  );
}
