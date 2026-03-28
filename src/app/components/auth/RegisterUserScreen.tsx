import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { auth, db } from "../../../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { COUNTRIES } from "../../data/countries";
import { normalizeCoTutorInviteCode, rememberPendingCoTutorInvite } from "../../utils/coTutorInvite";
import { persistAcquisitionSource, resolveAcquisitionSource, trackAcquisitionEvent } from "../../utils/acquisitionTracking";
import { validatePlatformInviteCode, validateAccessToken, markPlatformInviteUsed, markAccessTokenUsed } from "../../utils/platformInvite";
import { AuthPageShell } from "./AuthPageShell";
import { ConsentManager, ConsentState, saveConsent } from "../ConsentManager";

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
  const [showTermsStep, setShowTermsStep] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // SECURITY FIX: Consentimiento ANTES de recolectar datos (GDPR Art.7, LFPDPPP Art.15-16)
  const [consentStep, setConsentStep] = useState<"consent" | "register" | "post-register">("consent");
  const [consentData, setConsentData] = useState<ConsentState | null>(null);
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
      try {
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
          try {
            const invRef = doc(db, "invitations", inviteCode);
            const invSnap = await getDoc(invRef);
            if (cancelled) return;
            if (invSnap.exists() && !invSnap.data().used) {
              setGateStatus("allowed");
            } else {
              setGateStatus("invalid");
              setGateMessage("Este código de invitación no es válido o ya fue usado.");
            }
          } catch {
            // Allow on network error - validation happens later in joinWithCode
            if (!cancelled) setGateStatus("allowed");
          }
          return;
        }
        // Beta abierta: registro libre, la aprobación es post-registro por email
        setGateStatus("allowed");
      } catch {
        if (!cancelled) {
          setGateMessage("No pudimos verificar tu acceso. Revisá tu conexión e intentá de nuevo.");
          setGateStatus("invalid");
        }
      }
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
        // SECURITY: Registrar consentimiento explícito (GDPR Art.7, LFPDPPP Art.8-9, Ley 25.326 Art.5)
        consent: consentData ? {
          termsAccepted: consentData.termsAccepted,
          privacyAccepted: consentData.privacyAccepted,
          aiProcessingAccepted: consentData.aiProcessingAccepted,
          internationalTransferAccepted: consentData.internationalTransferAccepted,
          version: consentData.version,
          acceptedAt: consentData.timestamp,
        } : null,
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
      if (accessToken) {
        try { await markAccessTokenUsed(accessToken, user.uid); } catch (err) {
          console.warn("Could not mark access token as used:", err);
        }
      }

      // SECURITY FIX: Consentimiento ya se aceptó antes del form, ir directo
      if (consentData) saveConsent(consentData);
      navigate(inviteCode ? "/home" : "/register-pet", { replace: true });
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

  const handleAcceptTerms = () => {
    // Co-tutores van a /home (donde se procesa el invite), otros a /register-pet
    navigate(inviteCode ? "/home" : "/register-pet", { replace: true });
  };

  if (gateStatus === "loading") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A9B7D] border-t-transparent" />
          <p className="text-sm text-[#9CA3AF]">Verificando acceso...</p>
        </div>
      </AuthPageShell>
    );
  }

  // SECURITY: Paso de consentimiento ANTES de mostrar el formulario (GDPR Art.7, LFPDPPP Art.15)
  if (gateStatus === "allowed" && consentStep === "consent") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <ConsentManager
          onConsent={(consent) => {
            setConsentData(consent);
            setConsentStep("register");
          }}
          onBack={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
        />
      </AuthPageShell>
    );
  }

  if (gateStatus === "blocked") {
    return (
      <AuthPageShell
        eyebrow="Tu cuenta"
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="space-y-6">
          <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F0FAF9] px-6 py-6 text-center">
            <p className="text-base font-bold text-[#1A9B7D]">Pessy es solo por invitación</p>
            <p className="mt-2 text-sm leading-5 text-[#9CA3AF]">
              Por ahora el acceso es limitado. Podés solicitar tu lugar en la lista de espera.
            </p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-[14px] bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-[14px] border border-[#E5E7EB] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#1A9B7D]"
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
        title="Su historia comienza aquí."
        description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
        highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
      >
        <div className="space-y-6">
          <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F0FAF9] px-6 py-6 text-center">
            <p className="text-base font-bold text-[#1A9B7D]">Link inválido</p>
            <p className="mt-2 text-sm leading-5 text-[#9CA3AF]">{gateMessage}</p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-[14px] bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_rgba(26,155,125,0.3)]"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-[14px] border border-[#E5E7EB] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#1A9B7D]"
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
      title="Su historia comienza aquí."
      description="Pessy lo maneja. Vos lo disfrutás. Empezá gratis."
      highlights={["Identidad digital", "Rutinas", "Co-tutores"]}
    >
      <div className="mb-8">
        <h2
          className="text-3xl font-extrabold tracking-tight text-[#1A9B7D]"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
        >
          Crear cuenta
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#9CA3AF]">
          Empezá con tus datos. Pessy hace el resto — en serio.
        </p>
      </div>

      <form onSubmit={handleCreateAccount} className="space-y-4">
          {inviteCode && (
            <div className="rounded-[16px] border border-[#b5efd9] bg-[#F0FAF9] px-4 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1A9B7D]">Invitación de co-tutor</p>
              <p className="mt-1 text-sm leading-5 text-[#1A9B7D]">
                Esta cuenta se va a vincular con una mascota compartida apenas termines el registro.
              </p>
            </div>
          )}
          <input
            type="text"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none"
            required
          />

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none"
            required
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 pr-28 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[14px] border border-[#E5E7EB] bg-[#F0FAF9] px-3 py-1 text-xs font-bold text-[#1A9B7D]"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {/* País */}
          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-4 rounded-[12px] border border-[#E5E7EB] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none appearance-none bg-white text-slate-700 cursor-pointer"
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
            className="w-full rounded-[14px] bg-[#074738] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_rgba(26,155,125,0.3)] disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          <button
            type="button"
            onClick={() => navigate(inviteCode ? `/login?invite=${inviteCode}` : "/login")}
            className="w-full rounded-[14px] border border-[#E5E7EB] py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#1A9B7D] transition-all hover:bg-[#f4f3f9]"
          >
            Ya tengo cuenta
          </button>
      </form>

      {/* Consent modal removed — consent now collected BEFORE registration via ConsentManager (GDPR Art.7) */}
    </AuthPageShell>
  );
}
